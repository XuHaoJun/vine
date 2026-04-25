import { describe, it, expect, vi } from 'vitest'
import Fastify from 'fastify'
import { registerPaymentsWebhookRoutes } from './webhook.route'
import { createPaymentsService } from '@vine/pay'
import { signFormBody } from '../../../../../packages/pay/src/test-utils/ecpay-mac'
import type { StickerOrderRepository, StickerOrderRow } from './order.repository'
import type { EntitlementRepository } from './entitlement.repository'

const STAGE_CREDS = {
  merchantId: '3002607',
  hashKey: 'pwFHCqoQZGmho4w6',
  hashIv: 'EkRm7iFT261dpevs',
  mode: 'stage' as const,
}

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
  const pay = createPaymentsService({ connector: 'ecpay', ecpay: STAGE_CREDS })

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

  const tx = {}
  const db = {
    transaction: vi.fn().mockImplementation((fn: (tx: any) => Promise<void>) => fn(tx)),
  }

  const alerts = { notify: vi.fn().mockResolvedValue(undefined) }

  return { pay, orderRepo, entitlementRepo, db, tx, alerts }
}

function buildSuccessBody() {
  return signFormBody(
    {
      MerchantID: '3002607',
      MerchantTradeNo: 'order-1',
      TradeAmt: '3000',
      RtnCode: '1',
      RtnMsg: '交易成功',
      TradeNo: 'trade-abc',
      PaymentDate: '2026/04/23 12:34:56',
      PaymentType: 'Credit_CreditCard',
      SimulatePaid: '0',
    },
    STAGE_CREDS.hashKey,
    STAGE_CREDS.hashIv,
  )
}

describe('POST /webhooks/ecpay', () => {
  it('valid signed body → 200 "1|OK" and order transitions to paid', async () => {
    const order = makeOrder({ status: 'created', amountMinor: 3000, currency: 'TWD' })
    const { pay, orderRepo, entitlementRepo, db } = makeDeps(order)

    const app = Fastify()
    await registerPaymentsWebhookRoutes(app, { pay, orderRepo, entitlementRepo, db })
    await app.ready()

    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/ecpay',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: buildSuccessBody(),
    })

    await app.close()

    expect(res.statusCode).toBe(200)
    expect(res.body).toBe('1|OK')
    expect(orderRepo.transitionToPaid).toHaveBeenCalledOnce()
    expect(entitlementRepo.grant).toHaveBeenCalledOnce()
  })

  it('bad CheckMacValue → 400', async () => {
    const { pay, orderRepo, entitlementRepo, db, alerts } = makeDeps(null)

    const app = Fastify()
    await registerPaymentsWebhookRoutes(app, { pay, orderRepo, entitlementRepo, db, alerts })
    await app.ready()

    const tampered = Buffer.from(
      'MerchantTradeNo=order-1&TradeAmt=3000&RtnCode=1&CheckMacValue=DEADBEEF',
      'utf8',
    )

    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/ecpay',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: tampered,
    })

    await app.close()

    expect(res.statusCode).toBe(400)
    expect(orderRepo.findById).not.toHaveBeenCalled()
    expect(alerts.notify).toHaveBeenCalledWith(expect.objectContaining({
      type: 'payment.webhook_verification_failed',
      severity: 'warning',
      orderId: undefined,
    }))
  })

  it('amount mismatch → still 200 "1|OK" but no state change', async () => {
    // Order has amountMinor=9999 but webhook reports 3000 — mismatch
    const order = makeOrder({ status: 'created', amountMinor: 9999, currency: 'TWD' })
    const { pay, orderRepo, entitlementRepo, db } = makeDeps(order)

    const app = Fastify()
    await registerPaymentsWebhookRoutes(app, { pay, orderRepo, entitlementRepo, db })
    await app.ready()

    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/ecpay',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: buildSuccessBody(), // reports TradeAmt=3000
    })

    await app.close()

    // Must still ack 1|OK to avoid ECPay infinite retry
    expect(res.statusCode).toBe(200)
    expect(res.body).toBe('1|OK')
    // No state transitions because amount doesn't match
    expect(orderRepo.transitionToPaid).not.toHaveBeenCalled()
    expect(entitlementRepo.grant).not.toHaveBeenCalled()
  })
})
