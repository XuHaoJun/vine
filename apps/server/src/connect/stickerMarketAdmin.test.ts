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
    review: {
      listQueue: vi.fn().mockResolvedValue([]),
      getDetail: vi.fn().mockResolvedValue({ package: {}, latestValidation: [] }),
      approve: vi.fn().mockResolvedValue({}),
      reject: vi.fn().mockResolvedValue({}),
    },
    payout: {} as any,
    featuredShelf: {
      listShelves: vi.fn().mockResolvedValue([]),
      upsertShelf: vi.fn().mockResolvedValue({}),
      publishShelf: vi.fn().mockResolvedValue({}),
      archiveShelf: vi.fn().mockResolvedValue({}),
    },
  }
}

describe('createStickerMarketAdminHandler', () => {
  it('rejects non-admin payout queue access with PermissionDenied', async () => {
    const handler = createStickerMarketAdminHandler({
      refund: {} as any,
      reconciliation: {} as any,
      review: {} as any,
      payout: { listPendingRequests: vi.fn() },
      featuredShelf: {} as any,
    })

    await expect(
      handler.listPayoutRequests({ limit: 10 }, makeAuthCtx({ id: 'user-1' })),
    ).rejects.toMatchObject({ code: Code.PermissionDenied })
  })


  it('rejects non-admin refund with PermissionDenied', async () => {
    const handler = createStickerMarketAdminHandler(makeDeps())
    await expect(
      handler.refundOrder(
        { orderId: 'order-1', reason: 'admin_exception' },
        makeAuthCtx({ id: 'user-1' }),
      ),
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

  it('rejects non-admin reconcile with PermissionDenied', async () => {
    const handler = createStickerMarketAdminHandler(makeDeps())
    await expect(
      handler.reconcileStickerOrders(
        { sinceIso: '', limit: 0, dryRun: true },
        makeAuthCtx({ id: 'user-1' }),
      ),
    ).rejects.toMatchObject({ code: Code.PermissionDenied })
  })

  it('calls reconciliation service for admin reconcile', async () => {
    const deps = makeDeps()
    const handler = createStickerMarketAdminHandler(deps)
    const result = await handler.reconcileStickerOrders(
      { sinceIso: '2024-01-01T00:00:00.000Z', limit: 50, dryRun: false },
      makeAuthCtx({ id: 'admin-1', role: 'admin' }),
    )

    expect(deps.reconciliation.reconcileOrders).toHaveBeenCalledWith({
      since: new Date('2024-01-01T00:00:00.000Z'),
      limit: 50,
      dryRun: false,
    })
    expect(result).toHaveProperty('checked')
    expect(result).toHaveProperty('matched')
    expect(result).toHaveProperty('mismatches')
  })

  it('maps review detail assets for admin inspection', async () => {
    const deps = makeDeps()
    deps.review.getDetail.mockResolvedValue({
      package: {
        id: 'pkg-1',
        creatorId: 'creator-1',
        name: 'Review Pack',
        description: 'needs review',
        priceMinor: 75,
        currency: 'TWD',
        stickerCount: 8,
        status: 'in_review',
        tags: '[]',
        copyrightText: 'creator',
        autoPublish: true,
        coverDriveKey: 'stickers/pkg-1/cover.png',
        tabIconDriveKey: 'stickers/pkg-1/tab_icon.png',
      },
      assets: [
        {
          id: 'asset-1',
          number: 1,
          driveKey: 'stickers/pkg-1/01.png',
          width: 300,
          height: 300,
          sizeBytes: 100,
          mimeType: 'image/png',
        },
      ],
      latestValidation: [],
    })
    const handler = createStickerMarketAdminHandler(deps)

    const result = await handler.getStickerReviewDetail(
      { packageId: 'pkg-1' },
      makeAuthCtx({ id: 'admin-1', role: 'admin' }),
    )

    expect(result.package.coverDriveKey).toBe('stickers/pkg-1/cover.png')
    expect(result.package.tabIconDriveKey).toBe('stickers/pkg-1/tab_icon.png')
    expect(result.assets).toEqual([
      {
        id: 'asset-1',
        number: 1,
        driveKey: 'stickers/pkg-1/01.png',
        width: 300,
        height: 300,
        sizeBytes: 100,
        mimeType: 'image/png',
      },
    ])
  })
})
