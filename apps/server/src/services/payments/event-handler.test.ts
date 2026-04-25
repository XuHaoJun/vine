import { describe, it, expect, vi, beforeEach } from 'vitest'
import { handlePaymentEvent } from './event-handler'
import type { StickerOrderRepository, StickerOrderRow } from './order.repository'
import type { EntitlementRepository } from './entitlement.repository'
import type { Logger } from 'pino'

const silentLog = {
  warn: () => {},
  error: () => {},
  info: () => {},
  debug: () => {},
  child: () => silentLog,
} as unknown as Logger

function makeOrder(overrides: Partial<StickerOrderRow> = {}): StickerOrderRow {
  return {
    id: 'order-1',
    userId: 'user-1',
    packageId: 'pkg-1',
    amountMinor: 3000,
    currency: 'TWD',
    connectorName: 'ecpay',
    status: 'created',
    connectorChargeId: null,
    paidAt: null,
    failureReason: null,
    createdAt: '2026-04-23T00:00:00Z',
    updatedAt: '2026-04-23T00:00:00Z',
    ...overrides,
  } as StickerOrderRow
}

function makeDeps(orderRow: StickerOrderRow | null, transitionToPaidCount = 1) {
  const orderRepo: StickerOrderRepository = {
    create: vi.fn(),
    findById: vi.fn().mockResolvedValue(orderRow),
    transitionToPaid: vi.fn().mockResolvedValue(transitionToPaidCount),
    transitionToFailed: vi.fn().mockResolvedValue(1),
    beginRefund: vi.fn().mockResolvedValue(1),
    markRefunded: vi.fn().mockResolvedValue(1),
    markRefundFailed: vi.fn().mockResolvedValue(1),
    updateReconciliation: vi.fn(),
    findForReconciliation: vi.fn().mockResolvedValue([]),
  }

  const entitlementRepo: EntitlementRepository = {
    grant: vi.fn().mockResolvedValue(undefined),
    find: vi.fn().mockResolvedValue(null),
    revokeByOrder: vi.fn().mockResolvedValue(1),
  }

  // minimal tx stub — handler only passes it through to repos
  const tx = {}
  const db = {
    transaction: vi.fn().mockImplementation((fn: (tx: any) => Promise<void>) => fn(tx)),
  }

  return { orderRepo, entitlementRepo, db, tx }
}

describe('handlePaymentEvent', () => {
  it('charge.succeeded: created → paid and grants entitlement', async () => {
    const order = makeOrder({ status: 'created' })
    const { orderRepo, entitlementRepo, db, tx } = makeDeps(order)

    await handlePaymentEvent(
      { db, orderRepo, entitlementRepo },
      {
        kind: 'charge.succeeded',
        merchantTransactionId: 'order-1',
        connectorChargeId: 'charge-abc',
        amount: { minorAmount: 3000, currency: 'TWD' },
        paidAt: new Date('2026-04-23T10:00:00Z'),
      },
      silentLog,
    )

    expect(orderRepo.transitionToPaid).toHaveBeenCalledWith(tx, 'order-1', {
      connectorChargeId: 'charge-abc',
      paidAt: new Date('2026-04-23T10:00:00Z'),
    })
    expect(entitlementRepo.grant).toHaveBeenCalledWith(tx, {
      userId: 'user-1',
      packageId: 'pkg-1',
      grantedByOrderId: 'order-1',
    })
  })

  it('idempotent: second charge.succeeded does not duplicate entitlement grant', async () => {
    const order = makeOrder({ status: 'paid' })
    // transitionToPaid returns 0 when already paid
    const { orderRepo, entitlementRepo, db } = makeDeps(order, 0)

    await handlePaymentEvent(
      { db, orderRepo, entitlementRepo },
      {
        kind: 'charge.succeeded',
        merchantTransactionId: 'order-1',
        connectorChargeId: 'charge-abc',
        amount: { minorAmount: 3000, currency: 'TWD' },
        paidAt: new Date('2026-04-23T10:00:00Z'),
      },
      silentLog,
    )

    expect(orderRepo.transitionToPaid).toHaveBeenCalledOnce()
    expect(entitlementRepo.grant).not.toHaveBeenCalled()
  })

  it('amount mismatch: no transition, no grant', async () => {
    const order = makeOrder({ amountMinor: 3000, currency: 'TWD' })
    const { orderRepo, entitlementRepo, db } = makeDeps(order)

    await handlePaymentEvent(
      { db, orderRepo, entitlementRepo },
      {
        kind: 'charge.succeeded',
        merchantTransactionId: 'order-1',
        connectorChargeId: 'charge-abc',
        amount: { minorAmount: 9999, currency: 'TWD' }, // wrong amount
        paidAt: new Date('2026-04-23T10:00:00Z'),
      },
      silentLog,
    )

    expect(orderRepo.transitionToPaid).not.toHaveBeenCalled()
    expect(entitlementRepo.grant).not.toHaveBeenCalled()
  })

  it('paid + charge.failed: remains paid, no transition to failed', async () => {
    const order = makeOrder({ status: 'paid' })
    const { orderRepo, entitlementRepo, db } = makeDeps(order)

    await handlePaymentEvent(
      { db, orderRepo, entitlementRepo },
      {
        kind: 'charge.failed',
        merchantTransactionId: 'order-1',
        reason: 'network-timeout',
      },
      silentLog,
    )

    expect(orderRepo.transitionToFailed).not.toHaveBeenCalled()
    expect(entitlementRepo.grant).not.toHaveBeenCalled()
  })

  it('failed → paid: ECPay retry scenario — grants entitlement', async () => {
    const order = makeOrder({ status: 'failed' })
    const { orderRepo, entitlementRepo, db, tx } = makeDeps(order, 1)

    await handlePaymentEvent(
      { db, orderRepo, entitlementRepo },
      {
        kind: 'charge.succeeded',
        merchantTransactionId: 'order-1',
        connectorChargeId: 'charge-retry',
        amount: { minorAmount: 3000, currency: 'TWD' },
        paidAt: new Date('2026-04-23T12:00:00Z'),
      },
      silentLog,
    )

    expect(orderRepo.transitionToPaid).toHaveBeenCalledOnce()
    expect(entitlementRepo.grant).toHaveBeenCalledWith(tx, {
      userId: 'user-1',
      packageId: 'pkg-1',
      grantedByOrderId: 'order-1',
    })
  })

  it('unknown order: no side effects', async () => {
    const { orderRepo, entitlementRepo, db } = makeDeps(null)

    await handlePaymentEvent(
      { db, orderRepo, entitlementRepo },
      {
        kind: 'charge.succeeded',
        merchantTransactionId: 'nonexistent-order',
        connectorChargeId: 'charge-xyz',
        amount: { minorAmount: 3000, currency: 'TWD' },
        paidAt: new Date('2026-04-23T10:00:00Z'),
      },
      silentLog,
    )

    expect(orderRepo.transitionToPaid).not.toHaveBeenCalled()
    expect(entitlementRepo.grant).not.toHaveBeenCalled()
  })

  it('alerts amount mismatch', async () => {
    const alerts = { notify: vi.fn().mockResolvedValue(undefined) }
    const order = makeOrder({ amountMinor: 3000, currency: 'TWD' })
    const { orderRepo, entitlementRepo, db } = makeDeps(order)

    await handlePaymentEvent(
      { db, orderRepo, entitlementRepo, alerts },
      {
        kind: 'charge.succeeded',
        merchantTransactionId: 'order-1',
        connectorChargeId: 'charge-abc',
        amount: { minorAmount: 9999, currency: 'TWD' },
        paidAt: new Date('2026-04-25T01:00:00Z'),
      },
      silentLog,
    )

    expect(alerts.notify).toHaveBeenCalledWith(expect.objectContaining({
      type: 'payment.amount_mismatch',
      severity: 'critical',
      orderId: 'order-1',
    }))
  })

  it('compensates when entitlement grant throws after verified successful charge', async () => {
    const refund = { compensatePaidCharge: vi.fn().mockResolvedValue({ status: 'refunded', simulated: true }) }
    const alerts = { notify: vi.fn().mockResolvedValue(undefined) }
    const order = makeOrder({ status: 'created' })
    const { orderRepo, entitlementRepo, db } = makeDeps(order)
    entitlementRepo.grant = vi.fn().mockRejectedValue(new Error('unique index missing'))

    await handlePaymentEvent(
      { db, orderRepo, entitlementRepo, refund, alerts },
      {
        kind: 'charge.succeeded',
        merchantTransactionId: 'order-1',
        connectorChargeId: 'charge-abc',
        amount: { minorAmount: 3000, currency: 'TWD' },
        paidAt: new Date('2026-04-25T01:00:00Z'),
      },
      silentLog,
    )

    expect(refund.compensatePaidCharge).toHaveBeenCalledWith({
      orderId: 'order-1',
      connectorChargeId: 'charge-abc',
      amount: { minorAmount: 3000, currency: 'TWD' },
      paidAt: new Date('2026-04-25T01:00:00Z'),
      reason: 'technical_error',
    })
    expect(alerts.notify).toHaveBeenCalledWith(expect.objectContaining({
      type: 'payment.entitlement_grant_failed',
      severity: 'critical',
      orderId: 'order-1',
    }))
  })
})
