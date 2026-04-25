import type { WebhookEvent } from '@vine/pay'
import type { StickerOrderRepository } from './order.repository'
import type { EntitlementRepository } from './entitlement.repository'
import type { PaymentAlertSink } from './alert-sink'

type MinLogger = {
  warn(obj: object, msg: string): void
  error(obj: object, msg: string): void
  info(obj: object, msg: string): void
}

export type PaymentEventDeps = {
  db: any
  orderRepo: StickerOrderRepository
  entitlementRepo: EntitlementRepository
  alerts?: PaymentAlertSink
  refund?: {
    compensatePaidCharge: (input: {
      orderId: string
      connectorChargeId: string
      amount: { minorAmount: number; currency: string }
      paidAt: Date
      reason: string
    }) => Promise<unknown>
  }
}

export async function handlePaymentEvent(
  deps: PaymentEventDeps,
  event: WebhookEvent,
  log: MinLogger,
): Promise<void> {
  if (event.kind === 'unknown') {
    log.warn({ raw: event.raw }, 'unknown ecpay event, skipping')
    return
  }

  try {
    await deps.db.transaction(async (tx: any) => {
      const order = await deps.orderRepo.findById(tx, event.merchantTransactionId)
      if (!order) {
        log.warn({ id: event.merchantTransactionId }, 'webhook for unknown order')
        return
      }

      if (event.kind === 'charge.succeeded') {
        return applyChargeSucceeded(tx, deps, order, event, log)
      }
      if (event.kind === 'charge.failed') {
        return applyChargeFailed(tx, deps, order, event, log)
      }
    })
  } catch (err) {
    if (event.kind === 'charge.succeeded') {
      if (deps.refund) {
        try {
          await deps.refund.compensatePaidCharge({
            orderId: event.merchantTransactionId,
            connectorChargeId: event.connectorChargeId,
            amount: event.amount,
            paidAt: event.paidAt,
            reason: 'technical_error',
          })
        } catch {
          // compensation failed — already in a bad state, don't block alert
        }
      }

      if (deps.alerts) {
        try {
          await deps.alerts.notify({
            type: 'payment.entitlement_grant_failed',
            severity: 'critical',
            orderId: event.merchantTransactionId,
            message: `Entitlement grant failed for order ${event.merchantTransactionId}`,
            context: { error: String(err) },
          })
        } catch {
          // alert failed — don't block response
        }
      }

      if (!deps.refund) {
        throw err
      }
    } else {
      throw err
    }
  }
}

async function applyChargeSucceeded(
  tx: any,
  deps: PaymentEventDeps,
  order: Awaited<ReturnType<StickerOrderRepository['findById']>> & {},
  event: Extract<WebhookEvent, { kind: 'charge.succeeded' }>,
  log: MinLogger,
): Promise<void> {
  if (
    order.amountMinor !== event.amount.minorAmount ||
    order.currency !== event.amount.currency
  ) {
    log.error(
      { orderId: order.id, expected: order.amountMinor, got: event.amount },
      'AMOUNT MISMATCH — not transitioning, not granting',
    )
    await deps.alerts?.notify({
      type: 'payment.amount_mismatch',
      severity: 'critical',
      orderId: order.id,
      message: `Amount mismatch for order ${order.id}`,
      context: { expected: order.amountMinor, got: event.amount },
    })
    return
  }

  const updated = await deps.orderRepo.transitionToPaid(tx, order.id, {
    connectorChargeId: event.connectorChargeId,
    paidAt: event.paidAt,
  })

  if (updated === 0) {
    log.info({ orderId: order.id }, 'order already paid, no-op')
    return
  }

  if (order.status === 'failed') {
    log.warn(
      { orderId: order.id },
      'order transitioned failed → paid (ECPay retry scenario)',
    )
  }

  await deps.entitlementRepo.grant(tx, {
    userId: order.userId,
    packageId: order.packageId,
    grantedByOrderId: order.id,
  })
}

async function applyChargeFailed(
  tx: any,
  deps: PaymentEventDeps,
  order: Awaited<ReturnType<StickerOrderRepository['findById']>> & {},
  event: Extract<WebhookEvent, { kind: 'charge.failed' }>,
  log: MinLogger,
): Promise<void> {
  if (order.status === 'paid') {
    log.error({ orderId: order.id }, 'CRITICAL: charge.failed after paid — ignoring')
    return
  }
  await deps.orderRepo.transitionToFailed(tx, order.id, { failureReason: event.reason })
}
