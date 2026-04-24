import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createStickerMarketUserHandler } from './stickerMarketUser'
import { Code, ConnectError } from '@connectrpc/connect'

function makeMockPay() {
  return {
    createCharge: vi.fn().mockResolvedValue({
      status: 'pending_action',
      action: {
        type: 'redirect_form_post',
        targetUrl: 'https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5',
        formFields: { MerchantTradeNo: 'x', TotalAmount: '75' },
      },
      connectorName: 'ecpay',
    }),
    handleWebhook: vi.fn(),
  }
}

const mockPkg = {
  id: 'pkg-1',
  name: 'Cute Stickers',
  priceMinor: 7500,
  currency: 'TWD',
  description: '',
  coverDriveKey: 'key',
  tabIconDriveKey: 'key2',
  stickerCount: 8,
  createdAt: '2026-04-23T00:00:00Z',
  updatedAt: '2026-04-23T00:00:00Z',
}

const mockOrder = {
  id: 'ORDER123',
  userId: 'user-1',
  packageId: 'pkg-1',
  amountMinor: 7500,
  currency: 'TWD',
  status: 'created' as const,
  connectorName: 'ecpay',
  connectorChargeId: null,
  paidAt: null,
  failureReason: null,
  createdAt: '2026-04-23T00:00:00Z',
  updatedAt: '2026-04-23T00:00:00Z',
}

/**
 * Build a minimal db mock where each `.select()` call returns a chain
 * resolving to `rows`. Calls are consumed in order via a queue.
 */
function makeDb(rowsQueue: Array<unknown[]>) {
  let callIdx = 0
  return {
    select: vi.fn().mockImplementation(() => {
      const rows = rowsQueue[callIdx++] ?? []
      return {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(rows),
      }
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([]),
      }),
    }),
  }
}

function makeDeps(overrides: { rowsQueue?: Array<unknown[]>; mode?: 'stage' | 'prod' } = {}) {
  const pay = makeMockPay()
  const db = makeDb(overrides.rowsQueue ?? [[mockPkg], []])
  return {
    deps: {
      db,
      pay,
      mode: overrides.mode ?? 'stage',
      returnUrl: 'https://example.com/return',
      orderResultUrl: 'https://example.com/order-result',
    },
    pay,
    db,
  }
}

const authCtx = { authData: { userID: 'user-1' } }

describe('createStickerMarketUserHandler', () => {
  describe('createCheckout', () => {
    it('creates order and returns redirect form', async () => {
      const { deps, pay } = makeDeps()
      const handler = createStickerMarketUserHandler(deps)

      const result = await handler.createCheckout({ packageId: 'pkg-1', simulatePaid: false }, authCtx)

      expect(result.orderId).toBeTruthy()
      expect(result.redirect.targetUrl).toBe(
        'https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5',
      )
      expect(result.redirect.formFields).toMatchObject({ MerchantTradeNo: 'x' })
      expect(pay.createCharge).toHaveBeenCalledOnce()
      const chargeArg = pay.createCharge.mock.calls[0][0]
      expect(chargeArg.merchantTransactionId).toBe(result.orderId)
      expect(chargeArg.amount).toEqual({ minorAmount: 7500, currency: 'TWD' })
    })

    it('rejects unknown package with NotFound', async () => {
      // first select returns no rows (pkg not found)
      const { deps } = makeDeps({ rowsQueue: [[]] })
      const handler = createStickerMarketUserHandler(deps)

      await expect(
        handler.createCheckout({ packageId: 'unknown-pkg', simulatePaid: false }, authCtx),
      ).rejects.toMatchObject({ code: Code.NotFound })
    })

    it('rejects if already entitled with AlreadyExists', async () => {
      // pkg found, entitlement found
      const existingEntitlement = { id: 'ent-1', userId: 'user-1', packageId: 'pkg-1', grantedByOrderId: 'o1', grantedAt: '2026-04-23T00:00:00Z' }
      const { deps } = makeDeps({ rowsQueue: [[mockPkg], [existingEntitlement]] })
      const handler = createStickerMarketUserHandler(deps)

      await expect(
        handler.createCheckout({ packageId: 'pkg-1', simulatePaid: false }, authCtx),
      ).rejects.toMatchObject({ code: Code.AlreadyExists })
    })

    it('rejects simulatePaid in prod mode with InvalidArgument', async () => {
      const { deps } = makeDeps({ mode: 'prod' })
      const handler = createStickerMarketUserHandler(deps)

      await expect(
        handler.createCheckout({ packageId: 'pkg-1', simulatePaid: true }, authCtx),
      ).rejects.toMatchObject({ code: Code.InvalidArgument })
    })
  })

  describe('getOrder', () => {
    it('returns own order', async () => {
      const { deps } = makeDeps({ rowsQueue: [[mockOrder]] })
      const handler = createStickerMarketUserHandler(deps)

      const result = await handler.getOrder({ orderId: 'ORDER123' }, authCtx)

      expect(result.orderId).toBe('ORDER123')
      expect(result.status).toBe(1) // ORDER_STATUS_CREATED
      expect(result.amountMinor).toBe(7500)
      expect(result.currency).toBe('TWD')
      expect(result.failureReason).toBe('')
    })

    it("rejects another user's order with PermissionDenied", async () => {
      const otherOrder = { ...mockOrder, userId: 'user-2' }
      const { deps } = makeDeps({ rowsQueue: [[otherOrder]] })
      const handler = createStickerMarketUserHandler(deps)

      await expect(
        handler.getOrder({ orderId: 'ORDER123' }, { authData: { userID: 'user-1' } }),
      ).rejects.toMatchObject({ code: Code.PermissionDenied })
    })

    it('rejects missing order with NotFound', async () => {
      const { deps } = makeDeps({ rowsQueue: [[]] })
      const handler = createStickerMarketUserHandler(deps)

      await expect(
        handler.getOrder({ orderId: 'MISSING' }, authCtx),
      ).rejects.toMatchObject({ code: Code.NotFound })
    })
  })
})
