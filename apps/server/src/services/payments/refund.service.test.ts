import { describe, expect, it, vi } from 'vitest'
import { createRefundService } from './refund.service'
import type { StickerOrderRow } from './order.repository'

function makeOrder(overrides: Partial<StickerOrderRow> = {}): StickerOrderRow {
  return {
    id: 'order-1',
    userId: 'user-1',
    packageId: 'pkg-1',
    amountMinor: 3000,
    currency: 'TWD',
    status: 'paid',
    connectorName: 'ecpay',
    connectorChargeId: 'trade-1',
    paidAt: '2026-04-25T01:00:00.000Z',
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

function makeRefundDeps(opts: { order: StickerOrderRow; refundResult?: any }) {
  const tx = {}
  const orderRepo = {
    create: vi.fn(),
    findById: vi.fn().mockResolvedValue(opts.order),
    transitionToPaid: vi.fn(),
    transitionToFailed: vi.fn(),
    beginRefund: vi.fn().mockResolvedValue(1),
    markRefunded: vi.fn().mockResolvedValue(1),
    markRefundFailed: vi.fn().mockResolvedValue(1),
    updateReconciliation: vi.fn(),
    findForReconciliation: vi.fn(),
  }
  const entitlementRepo = {
    grant: vi.fn(),
    find: vi.fn(),
    revokeByOrder: vi.fn().mockResolvedValue(1),
  }
  return {
    db: { transaction: vi.fn().mockImplementation((fn) => fn(tx)) },
    pay: {
      createCharge: vi.fn(),
      handleWebhook: vi.fn(),
      getCharge: vi.fn(),
      refundCharge: vi.fn().mockResolvedValue(
        opts.refundResult ?? {
          status: 'succeeded',
          simulated: true,
          refundedAt: new Date('2026-04-25T02:00:00Z'),
          connectorRefundId: undefined,
          raw: {},
        },
      ),
    },
    orderRepo,
    entitlementRepo,
    alerts: { notify: vi.fn().mockResolvedValue(undefined) },
    mode: 'stage' as const,
  }
}

describe('createRefundService', () => {
  it('refundOrder transitions paid order to refunded and revokes entitlement', async () => {
    const deps = makeRefundDeps({
      order: makeOrder({ status: 'paid', connectorChargeId: 'trade-1' }),
      refundResult: {
        status: 'succeeded',
        simulated: true,
        refundedAt: new Date('2026-04-25T02:00:00Z'),
        connectorRefundId: undefined,
        raw: {},
      },
    })

    const service = createRefundService(deps)
    const result = await service.refundOrder({
      orderId: 'order-1',
      reason: 'admin_exception',
      requestedByUserId: 'admin-1',
    })

    expect(result.status).toBe('refunded')
    expect(deps.orderRepo.beginRefund).toHaveBeenCalledOnce()
    expect(deps.pay.refundCharge).toHaveBeenCalledWith({
      merchantTransactionId: 'order-1',
      connectorChargeId: 'trade-1',
      amount: { minorAmount: 3000, currency: 'TWD' },
      reason: 'admin_exception',
      testMode: true,
    })
    expect(deps.entitlementRepo.revokeByOrder).toHaveBeenCalledWith(
      expect.anything(),
      'order-1',
    )
  })

  it('refundOrder does not call ECPay for an already refunded order', async () => {
    const deps = makeRefundDeps({ order: makeOrder({ status: 'refunded' }) })
    const service = createRefundService(deps)
    const result = await service.refundOrder({
      orderId: 'order-1',
      reason: 'admin_exception',
      requestedByUserId: 'admin-1',
    })

    expect(result.status).toBe('refunded')
    expect(deps.pay.refundCharge).not.toHaveBeenCalled()
  })

  it('refundOrder marks refund_failed and alerts when ECPay rejects refund', async () => {
    const deps = makeRefundDeps({
      order: makeOrder({ status: 'paid', connectorChargeId: 'trade-1' }),
      refundResult: { status: 'failed', reason: 'TradeNo not found', raw: {} },
    })

    const service = createRefundService(deps)
    const result = await service.refundOrder({
      orderId: 'order-1',
      reason: 'admin_exception',
      requestedByUserId: 'admin-1',
    })

    expect(result).toMatchObject({
      status: 'refund_failed',
      failureReason: 'TradeNo not found',
    })
    expect(deps.orderRepo.markRefundFailed).toHaveBeenCalled()
    expect(deps.alerts.notify).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'payment.refund_failed',
        severity: 'critical',
        orderId: 'order-1',
      }),
    )
  })

  it('compensatePaidCharge allows created order with verified connector charge id', async () => {
    const deps = makeRefundDeps({
      order: makeOrder({ status: 'created', connectorChargeId: null }),
      refundResult: {
        status: 'succeeded',
        simulated: true,
        refundedAt: new Date('2026-04-25T02:00:00Z'),
        connectorRefundId: undefined,
        raw: {},
      },
    })

    const service = createRefundService(deps)
    const result = await service.compensatePaidCharge({
      orderId: 'order-1',
      connectorChargeId: 'trade-from-webhook',
      amount: { minorAmount: 3000, currency: 'TWD' },
      paidAt: new Date('2026-04-25T01:00:00Z'),
      reason: 'technical_error',
    })

    expect(result.status).toBe('refunded')
    expect(deps.orderRepo.beginRefund).toHaveBeenCalledWith(
      expect.anything(),
      'order-1',
      expect.objectContaining({
        connectorChargeId: 'trade-from-webhook',
        allowedStatuses: ['created', 'failed', 'paid', 'refund_failed'],
      }),
    )
    expect(deps.pay.refundCharge).toHaveBeenCalledWith({
      merchantTransactionId: 'order-1',
      connectorChargeId: 'trade-from-webhook',
      amount: { minorAmount: 3000, currency: 'TWD' },
      reason: 'technical_error',
      testMode: true,
    })
    expect(deps.entitlementRepo.revokeByOrder).toHaveBeenCalledWith(
      expect.anything(),
      'order-1',
    )
  })
})
