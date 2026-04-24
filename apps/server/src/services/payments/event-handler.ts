import type { WebhookEvent } from '@vine/pay'
import type { StickerOrderRepository } from './order.repository'
import type { EntitlementRepository } from './entitlement.repository'

type MinLogger = {
  warn(obj: object, msg: string): void
  error(obj: object, msg: string): void
  info(obj: object, msg: string): void
}

export type PaymentEventDeps = {
  db: any
  orderRepo: StickerOrderRepository
  entitlementRepo: EntitlementRepository
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
}

async function applyChargeSucceeded(
  tx: any,
  deps: PaymentEventDeps,
  order: Awaited<ReturnType<StickerOrderRepository['findById']>> & {},
  event: Extract<WebhookEvent, { kind: 'charge.succeeded' }>,
  log: MinLogger,
): Promise<void> {
  if (order.amountMinor !== event.amount.minorAmount || order.currency !== event.amount.currency) {
    log.error(
      { orderId: order.id, expected: order.amountMinor, got: event.amount },
      'AMOUNT MISMATCH — not transitioning, not granting',
    )
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
    log.warn({ orderId: order.id }, 'order transitioned failed → paid (ECPay retry scenario)')
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
