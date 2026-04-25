import { describe, expect, it, vi } from 'vitest'
import { createReconciliationService } from './reconciliation.service'
import type { StickerOrderRow } from './order.repository'

function makeOrder(overrides: Partial<StickerOrderRow> = {}): StickerOrderRow {
  return {
    id: 'order-1',
    userId: 'user-1',
    packageId: 'pkg-1',
    amountMinor: 3000,
    currency: 'TWD',
    status: 'created',
    connectorName: 'ecpay',
    connectorChargeId: null,
    paidAt: null,
    failureReason: null,
    refundId: null,
    refundAmountMinor: null,
    refundReason: null,
    refundRequestedAt: null,
    refundedAt: null,
    refundFailureReason: null,
    refundRequestedByUserId: null,
    lastReconciledAt: null,
    lastConnectorStatus: null,
    lastReconciliationMismatch: null,
    createdAt: '2026-04-25T00:00:00Z',
    updatedAt: '2026-04-25T00:00:00Z',
    ...overrides,
  } as StickerOrderRow
}

function makeReconciliationDeps(opts: { orders: StickerOrderRow[]; chargeStatus: any }) {
  const tx = {}
  const orderRepo = {
    create: vi.fn(),
    findById: vi.fn(),
    transitionToPaid: vi.fn().mockResolvedValue(1),
    transitionToFailed: vi.fn(),
    beginRefund: vi.fn(),
    markRefunded: vi.fn(),
    markRefundFailed: vi.fn(),
    updateReconciliation: vi.fn().mockResolvedValue(undefined),
    findForReconciliation: vi.fn().mockResolvedValue(opts.orders),
  }
  const entitlementRepo = {
    grant: vi.fn().mockResolvedValue(undefined),
    find: vi.fn(),
    revokeByOrder: vi.fn(),
  }
  return {
    db: { transaction: vi.fn().mockImplementation((fn) => fn(tx)) },
    pay: {
      createCharge: vi.fn(),
      handleWebhook: vi.fn(),
      refundCharge: vi.fn(),
      getCharge: vi.fn().mockResolvedValue(opts.chargeStatus),
    },
    orderRepo,
    entitlementRepo,
    alerts: { notify: vi.fn().mockResolvedValue(undefined) },
  }
}

describe('createReconciliationService', () => {
  it('dryRun reports created order that is paid at connector', async () => {
    const deps = makeReconciliationDeps({
      orders: [makeOrder({ id: 'order-1', status: 'created' })],
      chargeStatus: { status: 'paid', connectorChargeId: 'trade-1', amount: { minorAmount: 3000, currency: 'TWD' }, paidAt: new Date('2026-04-25T01:00:00Z'), rawStatus: '1', raw: {} },
    })

    const service = createReconciliationService(deps)
    const result = await service.reconcileOrders({
      since: new Date('2026-04-24T00:00:00Z'),
      limit: 100,
      dryRun: true,
    })

    expect(result.checked).toBe(1)
    expect(result.mismatches[0]).toMatchObject({
      orderId: 'order-1',
      localStatus: 'created',
      connectorStatus: 'paid',
      action: 'reported',
    })
    expect(deps.orderRepo.transitionToPaid).not.toHaveBeenCalled()
  })

  it('non-dry-run marks failed order paid and grants entitlement when connector is paid', async () => {
    const deps = makeReconciliationDeps({
      orders: [makeOrder({ id: 'order-1', status: 'failed' })],
      chargeStatus: { status: 'paid', connectorChargeId: 'trade-1', amount: { minorAmount: 3000, currency: 'TWD' }, paidAt: new Date('2026-04-25T01:00:00Z'), rawStatus: '1', raw: {} },
    })

    const service = createReconciliationService(deps)
    await service.reconcileOrders({
      since: new Date('2026-04-24T00:00:00Z'),
      limit: 100,
      dryRun: false,
    })

    expect(deps.orderRepo.transitionToPaid).toHaveBeenCalled()
    expect(deps.entitlementRepo.grant).toHaveBeenCalled()
  })

  it('alerts when local paid order is missing at connector', async () => {
    const deps = makeReconciliationDeps({
      orders: [makeOrder({ id: 'order-1', status: 'paid' })],
      chargeStatus: { status: 'not_found', reason: 'order not found', rawStatus: '10200047', raw: {} },
    })

    const service = createReconciliationService(deps)
    await service.reconcileOrders({
      since: new Date('2026-04-24T00:00:00Z'),
      limit: 100,
      dryRun: false,
    })

    expect(deps.alerts.notify).toHaveBeenCalledWith(expect.objectContaining({
      type: 'payment.reconciliation_mismatch',
      severity: 'critical',
      orderId: 'order-1',
    }))
  })
})
