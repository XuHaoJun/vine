import { describe, expect, it, vi } from 'vitest'
import { Code, createContextValues } from '@connectrpc/connect'
import { connectAuthDataKey } from './auth-context'
import { createStickerMarketAdminHandler } from './stickerMarketAdmin'

function makeAuthCtx(authData: { id: string; role?: 'admin' }) {
  const values = createContextValues()
  values.set(connectAuthDataKey, authData as any)
  return {
    values,
    signal: new AbortController().signal,
    timeoutMs: undefined,
    method: {} as any,
    service: {} as any,
    requestMethod: 'POST',
    url: new URL('http://localhost/'),
    peer: { addr: '127.0.0.1' },
    requestHeader: new Headers(),
    responseHeader: new Headers(),
    responseTrailer: new Headers(),
  } as any
}

function makeDeps() {
  return {
    refund: {
      refundOrder: vi.fn().mockResolvedValue({
        orderId: 'order-1',
        status: 'refunded',
        simulated: true,
        failureReason: undefined,
      }),
    },
    reconciliation: {
      reconcileOrders: vi.fn().mockResolvedValue({
        checked: 0,
        matched: 0,
        mismatches: [],
      }),
    },
  }
}

describe('createStickerMarketAdminHandler', () => {
  it('rejects non-admin refund with PermissionDenied', async () => {
    const handler = createStickerMarketAdminHandler(makeDeps())
    await expect(
      handler.refundOrder({ orderId: 'order-1', reason: 'admin_exception' }, makeAuthCtx({ id: 'user-1' })),
    ).rejects.toMatchObject({ code: Code.PermissionDenied })
  })

  it('calls refund service for admin refund', async () => {
    const deps = makeDeps()
    const handler = createStickerMarketAdminHandler(deps)
    const result = await handler.refundOrder(
      { orderId: 'order-1', reason: 'admin_exception' },
      makeAuthCtx({ id: 'admin-1', role: 'admin' }),
    )

    expect(deps.refund.refundOrder).toHaveBeenCalledWith({
      orderId: 'order-1',
      reason: 'admin_exception',
      requestedByUserId: 'admin-1',
    })
    expect(result.status).toBe(2)
  })
})
