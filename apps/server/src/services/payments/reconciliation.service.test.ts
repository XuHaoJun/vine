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
    transitionToPaid: vi.fn().mockResolvedValue(1),
    updateReconciliation: vi.fn().mockResolvedValue(undefined),
    findForReconciliation: vi.fn().mockResolvedValue(opts.orders),
  }
  const entitlementRepo = {
    grant: vi.fn().mockResolvedValue(undefined),
  }
  return {
    db: { transaction: vi.fn().mockImplementation((fn) => fn(tx)) },
    pay: {
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
      chargeStatus: {
        status: 'paid',
        connectorChargeId: 'trade-1',
        amount: { minorAmount: 3000, currency: 'TWD' },
        paidAt: new Date('2026-04-25T01:00:00Z'),
        rawStatus: '1',
        raw: {},
      },
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
    expect(deps.orderRepo.updateReconciliation).toHaveBeenCalledWith(
      expect.anything(),
      'order-1',
      expect.objectContaining({ connectorStatus: 'paid', mismatch: expect.any(String) }),
    )
  })

  it('non-dry-run marks failed order paid and grants entitlement when connector is paid', async () => {
    const deps = makeReconciliationDeps({
      orders: [makeOrder({ id: 'order-1', status: 'failed' })],
      chargeStatus: {
        status: 'paid',
        connectorChargeId: 'trade-1',
        amount: { minorAmount: 3000, currency: 'TWD' },
        paidAt: new Date('2026-04-25T01:00:00Z'),
        rawStatus: '1',
        raw: {},
      },
    })

    const service = createReconciliationService(deps)
    await service.reconcileOrders({
      since: new Date('2026-04-24T00:00:00Z'),
      limit: 100,
      dryRun: false,
    })

    expect(deps.orderRepo.transitionToPaid).toHaveBeenCalledWith(
      expect.anything(),
      'order-1',
      expect.any(Object),
    )
    expect(deps.entitlementRepo.grant).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ userId: 'user-1', packageId: 'pkg-1' }),
    )
    expect(deps.orderRepo.updateReconciliation).toHaveBeenCalledWith(
      expect.anything(),
      'order-1',
      expect.objectContaining({ connectorStatus: 'paid', mismatch: expect.any(String) }),
    )
  })

  it('alerts when local paid order is missing at connector', async () => {
    const deps = makeReconciliationDeps({
      orders: [makeOrder({ id: 'order-1', status: 'paid' })],
      chargeStatus: {
        status: 'not_found',
        reason: 'order not found',
        rawStatus: '10200047',
        raw: {},
      },
    })

    const service = createReconciliationService(deps)
    await service.reconcileOrders({
      since: new Date('2026-04-24T00:00:00Z'),
      limit: 100,
      dryRun: false,
    })

    expect(deps.alerts.notify).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'payment.reconciliation_mismatch',
        severity: 'critical',
        orderId: 'order-1',
      }),
    )
    expect(deps.orderRepo.updateReconciliation).toHaveBeenCalledWith(
      expect.anything(),
      'order-1',
      expect.objectContaining({
        connectorStatus: 'not_found',
        mismatch: expect.any(String),
      }),
    )
  })

  it('resiliently handles query errors and reports them', async () => {
    const deps = makeReconciliationDeps({
      orders: [makeOrder({ id: 'order-1', status: 'created' })],
      chargeStatus: {
        status: 'paid',
        connectorChargeId: 'trade-1',
        amount: { minorAmount: 3000, currency: 'TWD' },
        paidAt: new Date('2026-04-25T01:00:00Z'),
        rawStatus: '1',
        raw: {},
      },
    })
    deps.pay.getCharge = vi.fn().mockRejectedValue(new Error('network timeout'))

    const service = createReconciliationService(deps)
    const result = await service.reconcileOrders({
      since: new Date('2026-04-24T00:00:00Z'),
      limit: 100,
      dryRun: false,
    })

    expect(result.checked).toBe(1)
    expect(result.mismatches.length).toBe(1)
    expect(result.mismatches[0]).toMatchObject({
      orderId: 'order-1',
      localStatus: 'created',
      connectorStatus: 'query_error',
      action: 'reported',
    })
    expect(deps.orderRepo.updateReconciliation).toHaveBeenCalledWith(
      expect.anything(),
      'order-1',
      expect.objectContaining({
        connectorStatus: 'query_error',
        mismatch: 'query_error',
      }),
    )
  })

  it('has no mismatches when local paid and connector paid', async () => {
    const deps = makeReconciliationDeps({
      orders: [makeOrder({ id: 'order-1', status: 'paid' })],
      chargeStatus: {
        status: 'paid',
        connectorChargeId: 'trade-1',
        amount: { minorAmount: 3000, currency: 'TWD' },
        paidAt: new Date('2026-04-25T01:00:00Z'),
        rawStatus: '1',
        raw: {},
      },
    })

    const service = createReconciliationService(deps)
    const result = await service.reconcileOrders({
      since: new Date('2026-04-24T00:00:00Z'),
      limit: 100,
      dryRun: false,
    })

    expect(result.mismatches.length).toBe(0)
    expect(deps.alerts.notify).not.toHaveBeenCalled()
    expect(deps.orderRepo.updateReconciliation).toHaveBeenCalledWith(
      expect.anything(),
      'order-1',
      expect.objectContaining({ connectorStatus: 'paid', mismatch: undefined }),
    )
  })
})
