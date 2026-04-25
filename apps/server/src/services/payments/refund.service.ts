import { Code, ConnectError } from '@connectrpc/connect'
import type { RefundChargeInput, RefundChargeResult, Money } from '@vine/pay'
import type { StickerOrderRow, StickerOrderRepository } from './order.repository'
import type { EntitlementRepository } from './entitlement.repository'
import type { PaymentAlertSink } from './alert-sink'

export type RefundReason = 'technical_error' | 'admin_exception'

export type RefundOrderInput = {
  orderId: string
  reason: RefundReason
  requestedByUserId: string
}

export type CompensatePaidChargeInput = {
  orderId: string
  connectorChargeId: string
  amount: Money
  paidAt: Date
  reason: RefundReason
}

export type RefundOrderResult =
  | { status: 'refunded'; refundedAt?: Date }
  | { status: 'refund_pending' }
  | { status: 'refund_failed'; failureReason: string }

export type RefundServiceDeps = {
  db: { transaction: (fn: (tx: any) => Promise<any>) => Promise<any> }
  pay: {
    refundCharge: (input: RefundChargeInput) => Promise<RefundChargeResult>
  }
  orderRepo: Pick<
    StickerOrderRepository,
    'findById' | 'beginRefund' | 'markRefunded' | 'markRefundFailed'
  >
  entitlementRepo: Pick<EntitlementRepository, 'revokeByOrder'>
  alerts: PaymentAlertSink
  mode: 'stage' | 'prod'
}

export function createRefundService(deps: RefundServiceDeps) {
  return {
    async refundOrder(input: RefundOrderInput): Promise<RefundOrderResult> {
      return runRefund(deps, {
        orderId: input.orderId,
        reason: input.reason,
        requestedByUserId: input.requestedByUserId,
        compensation: undefined,
        allowedStatuses: ['paid', 'refund_failed'],
      })
    },

    async compensatePaidCharge(
      input: CompensatePaidChargeInput,
    ): Promise<RefundOrderResult> {
      return runRefund(deps, {
        orderId: input.orderId,
        reason: input.reason,
        requestedByUserId: undefined,
        compensation: input,
        allowedStatuses: ['created', 'failed', 'paid', 'refund_failed'],
      })
    },
  }
}

async function runRefund(
  deps: RefundServiceDeps,
  input: {
    orderId: string
    reason: RefundReason
    requestedByUserId: string | undefined
    compensation: CompensatePaidChargeInput | undefined
    allowedStatuses: Array<'paid' | 'refund_failed' | 'created' | 'failed'>
  },
): Promise<RefundOrderResult> {
  const order = await deps.db.transaction(async (tx) => {
    const row = await deps.orderRepo.findById(tx, input.orderId)
    if (!row) {
      throw new ConnectError('order not found', Code.NotFound)
    }

    if (row.status === 'refunded' || row.status === 'refund_pending') {
      return row
    }

    if (
      !input.allowedStatuses.includes(
        row.status as (typeof input.allowedStatuses)[number],
      )
    ) {
      throw new ConnectError(
        'order cannot be refunded in current state',
        Code.FailedPrecondition,
      )
    }

    const refundId = `refund_${row.id}`

    const beginResult = await deps.orderRepo.beginRefund(tx, input.orderId, {
      refundId,
      refundAmountMinor: row.amountMinor,
      refundReason: input.reason,
      refundRequestedByUserId: input.requestedByUserId,
      connectorChargeId: input.compensation?.connectorChargeId ?? row.connectorChargeId!,
      paidAt: input.compensation
        ? new Date(input.compensation.paidAt)
        : row.paidAt
          ? new Date(row.paidAt)
          : undefined,
      allowedStatuses: input.allowedStatuses,
    })

    if (beginResult === 0) {
      throw new ConnectError(
        'order cannot be refunded in current state',
        Code.FailedPrecondition,
      )
    }

    return row
  })

  if (order.status === 'refunded' || order.status === 'refund_pending') {
    return { status: order.status }
  }

  const refundResult = await deps.pay.refundCharge({
    merchantTransactionId: order.id,
    connectorChargeId: input.compensation?.connectorChargeId ?? order.connectorChargeId!,
    amount: input.compensation?.amount ?? {
      minorAmount: order.amountMinor,
      currency: order.currency,
    },
    reason: input.reason,
    testMode: deps.mode === 'stage',
  })

  if (refundResult.status === 'succeeded') {
    await deps.db.transaction(async (tx) => {
      await deps.orderRepo.markRefunded(tx, input.orderId, {
        refundedAt: refundResult.refundedAt,
      })
      await deps.entitlementRepo.revokeByOrder(tx, input.orderId)
    })
    return { status: 'refunded', refundedAt: refundResult.refundedAt }
  }

  await deps.db.transaction(async (tx) => {
    await deps.orderRepo.markRefundFailed(tx, input.orderId, {
      refundFailureReason: refundResult.reason,
    })
  })

  await deps.alerts.notify({
    type: 'payment.refund_failed',
    severity: 'critical',
    orderId: order.id,
    message: `Refund failed for order ${order.id}: ${refundResult.reason}`,
    context: { reason: refundResult.reason, raw: refundResult.raw },
  })

  return { status: 'refund_failed', failureReason: refundResult.reason }
}
