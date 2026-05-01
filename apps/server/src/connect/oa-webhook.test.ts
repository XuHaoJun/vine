import { describe, expect, it, vi, beforeEach } from 'vitest'
import { Code } from '@connectrpc/connect'
import { createContextValues } from '@connectrpc/connect'
import { oaHandler } from './oa'
import { connectAuthDataKey } from './auth-context'

vi.mock('@take-out/better-auth-utils/server', () => ({
  getAuthDataFromRequest: vi.fn(),
}))

import { getAuthDataFromRequest } from '@take-out/better-auth-utils/server'
const mockedGetAuthDataFromRequest = vi.mocked(getAuthDataFromRequest)

function makeAuthCtx(userId: string) {
  const values = createContextValues()
  values.set(connectAuthDataKey, { id: userId } as any)
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

function makeDeps(
  overrides: {
    ownerId?: string
    webhookDelivery?: any
  } = {},
) {
  const ownerId = overrides.ownerId ?? 'user-1'
  const oa = {
    getOfficialAccount: vi.fn().mockImplementation((id: string) =>
      Promise.resolve({
        id,
        providerId: 'provider-1',
        name: 'Test OA',
        uniqueId: 'test-oa',
        description: '',
        imageUrl: '',
        status: 'active',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        email: '',
        country: '',
        company: '',
        industry: '',
        channelSecret: 'secret',
      }),
    ),
    getProvider: vi.fn().mockImplementation((id: string) =>
      Promise.resolve({
        id,
        name: 'Test Provider',
        ownerId,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      }),
    ),
    getWebhook: vi.fn().mockResolvedValue({
      id: 'wh-1',
      oaId: 'oa-1',
      url: 'https://hook.example',
      status: 'verified',
      useWebhook: true,
      webhookRedeliveryEnabled: false,
      errorStatisticsEnabled: false,
      lastVerifiedAt: null,
      lastVerifyStatusCode: null,
      lastVerifyReason: null,
      createdAt: '2026-01-01T00:00:00Z',
    }),
    updateWebhookSettings: vi.fn().mockImplementation((_oaId: string, input: any) =>
      Promise.resolve({
        id: 'wh-1',
        oaId: 'oa-1',
        url: input.url ?? 'https://hook.example',
        status: 'verified',
        useWebhook: input.useWebhook ?? true,
        webhookRedeliveryEnabled: input.webhookRedeliveryEnabled ?? false,
        errorStatisticsEnabled: input.errorStatisticsEnabled ?? false,
        lastVerifiedAt: null,
        lastVerifyStatusCode: null,
        lastVerifyReason: null,
        createdAt: '2026-01-01T00:00:00Z',
      }),
    ),
    verifyWebhook: vi.fn().mockResolvedValue({ status: 'verified' }),
  }

  const webhookDelivery = overrides.webhookDelivery ?? {
    verifyWebhook: vi.fn().mockResolvedValue({
      success: true,
      statusCode: 200,
      reason: 'OK',
      timestamp: '2026-01-01T00:00:00Z',
    }),
    listDeliveries: vi.fn().mockResolvedValue({ deliveries: [] }),
    getDelivery: vi.fn().mockResolvedValue(null),
    redeliver: vi.fn().mockResolvedValue({ kind: 'redelivery-disabled' }),
    sendTestWebhookEvent: vi.fn().mockResolvedValue({
      success: true,
      statusCode: 200,
      reason: 'OK',
      timestamp: '2026-01-01T00:00:00Z',
    }),
  }

  const capturedImpl: any = {}
  const mockRouter = {
    service: (_desc: any, impl: any) => {
      Object.assign(capturedImpl, impl)
    },
  }

  const auth = {} as any
  const drive = {} as any

  oaHandler({ oa: oa as any, auth, drive, webhookDelivery })(mockRouter as any)

  return { capturedImpl, oa, webhookDelivery }
}

beforeEach(() => {
  mockedGetAuthDataFromRequest.mockReset()
})

describe('oa webhook observability rpc', () => {
  describe('authentication', () => {
    it('returns unauthenticated for getWebhookSettings without auth', async () => {
      const { capturedImpl } = makeDeps()
      mockedGetAuthDataFromRequest.mockResolvedValue(null as any)
      await expect(
        capturedImpl.getWebhookSettings(
          { officialAccountId: 'oa-1' },
          makeAuthCtx('user-1'),
        ),
      ).rejects.toMatchObject({ code: Code.Unauthenticated })
    })

    it('returns unauthenticated for listWebhookDeliveries without auth', async () => {
      const { capturedImpl } = makeDeps()
      mockedGetAuthDataFromRequest.mockResolvedValue(null as any)
      await expect(
        capturedImpl.listWebhookDeliveries(
          { officialAccountId: 'oa-1', pageSize: 10 },
          makeAuthCtx('user-1'),
        ),
      ).rejects.toMatchObject({ code: Code.Unauthenticated })
    })

    it('returns unauthenticated for getWebhookDelivery without auth', async () => {
      const { capturedImpl } = makeDeps()
      mockedGetAuthDataFromRequest.mockResolvedValue(null as any)
      await expect(
        capturedImpl.getWebhookDelivery(
          { officialAccountId: 'oa-1', deliveryId: 'd1' },
          makeAuthCtx('user-1'),
        ),
      ).rejects.toMatchObject({ code: Code.Unauthenticated })
    })

    it('returns unauthenticated for redeliverWebhook without auth', async () => {
      const { capturedImpl } = makeDeps()
      mockedGetAuthDataFromRequest.mockResolvedValue(null as any)
      await expect(
        capturedImpl.redeliverWebhook(
          { officialAccountId: 'oa-1', deliveryId: 'd1' },
          makeAuthCtx('user-1'),
        ),
      ).rejects.toMatchObject({ code: Code.Unauthenticated })
    })

    it('returns unauthenticated for updateWebhookSettings without auth', async () => {
      const { capturedImpl } = makeDeps()
      mockedGetAuthDataFromRequest.mockResolvedValue(null as any)
      await expect(
        capturedImpl.updateWebhookSettings(
          { officialAccountId: 'oa-1', url: 'https://hook.example' },
          makeAuthCtx('user-1'),
        ),
      ).rejects.toMatchObject({ code: Code.Unauthenticated })
    })

    it('returns unauthenticated for verifyWebhookEndpoint without auth', async () => {
      const { capturedImpl } = makeDeps()
      mockedGetAuthDataFromRequest.mockResolvedValue(null as any)
      await expect(
        capturedImpl.verifyWebhookEndpoint(
          { officialAccountId: 'oa-1' },
          makeAuthCtx('user-1'),
        ),
      ).rejects.toMatchObject({ code: Code.Unauthenticated })
    })

    it('returns unauthenticated for sendTestWebhookEvent without auth', async () => {
      const { capturedImpl } = makeDeps()
      mockedGetAuthDataFromRequest.mockResolvedValue(null as any)
      await expect(
        capturedImpl.sendTestWebhookEvent(
          { officialAccountId: 'oa-1' },
          makeAuthCtx('user-1'),
        ),
      ).rejects.toMatchObject({ code: Code.Unauthenticated })
    })
  })

  describe('authorization', () => {
    it('rejects non-owner getWebhookSettings with PermissionDenied', async () => {
      const { capturedImpl } = makeDeps({ ownerId: 'user-2' })
      mockedGetAuthDataFromRequest.mockResolvedValue({ id: 'user-1' } as any)
      await expect(
        capturedImpl.getWebhookSettings(
          { officialAccountId: 'oa-1' },
          makeAuthCtx('user-1'),
        ),
      ).rejects.toMatchObject({ code: Code.PermissionDenied })
    })

    it('rejects non-owner listWebhookDeliveries with PermissionDenied', async () => {
      const { capturedImpl } = makeDeps({ ownerId: 'user-2' })
      mockedGetAuthDataFromRequest.mockResolvedValue({ id: 'user-1' } as any)
      await expect(
        capturedImpl.listWebhookDeliveries(
          { officialAccountId: 'oa-1', pageSize: 10 },
          makeAuthCtx('user-1'),
        ),
      ).rejects.toMatchObject({ code: Code.PermissionDenied })
    })

    it('rejects non-owner getWebhookDelivery with PermissionDenied', async () => {
      const { capturedImpl } = makeDeps({ ownerId: 'user-2' })
      mockedGetAuthDataFromRequest.mockResolvedValue({ id: 'user-1' } as any)
      await expect(
        capturedImpl.getWebhookDelivery(
          { officialAccountId: 'oa-1', deliveryId: 'd1' },
          makeAuthCtx('user-1'),
        ),
      ).rejects.toMatchObject({ code: Code.PermissionDenied })
    })

    it('rejects non-owner redeliverWebhook with PermissionDenied', async () => {
      const { capturedImpl } = makeDeps({ ownerId: 'user-2' })
      mockedGetAuthDataFromRequest.mockResolvedValue({ id: 'user-1' } as any)
      await expect(
        capturedImpl.redeliverWebhook(
          { officialAccountId: 'oa-1', deliveryId: 'd1' },
          makeAuthCtx('user-1'),
        ),
      ).rejects.toMatchObject({ code: Code.PermissionDenied })
    })

    it('rejects non-owner updateWebhookSettings with PermissionDenied', async () => {
      const { capturedImpl } = makeDeps({ ownerId: 'user-2' })
      mockedGetAuthDataFromRequest.mockResolvedValue({ id: 'user-1' } as any)
      await expect(
        capturedImpl.updateWebhookSettings(
          { officialAccountId: 'oa-1', url: 'https://hook.example' },
          makeAuthCtx('user-1'),
        ),
      ).rejects.toMatchObject({ code: Code.PermissionDenied })
    })

    it('rejects non-owner verifyWebhookEndpoint with PermissionDenied', async () => {
      const { capturedImpl } = makeDeps({ ownerId: 'user-2' })
      mockedGetAuthDataFromRequest.mockResolvedValue({ id: 'user-1' } as any)
      await expect(
        capturedImpl.verifyWebhookEndpoint(
          { officialAccountId: 'oa-1' },
          makeAuthCtx('user-1'),
        ),
      ).rejects.toMatchObject({ code: Code.PermissionDenied })
    })

    it('rejects non-owner sendTestWebhookEvent with PermissionDenied', async () => {
      const { capturedImpl } = makeDeps({ ownerId: 'user-2' })
      mockedGetAuthDataFromRequest.mockResolvedValue({ id: 'user-1' } as any)
      await expect(
        capturedImpl.sendTestWebhookEvent(
          { officialAccountId: 'oa-1' },
          makeAuthCtx('user-1'),
        ),
      ).rejects.toMatchObject({ code: Code.PermissionDenied })
    })
  })

  describe('getWebhookSettings', () => {
    it('returns settings for owner', async () => {
      const { capturedImpl, oa } = makeDeps()
      mockedGetAuthDataFromRequest.mockResolvedValue({ id: 'user-1' } as any)
      const result = await capturedImpl.getWebhookSettings(
        { officialAccountId: 'oa-1' },
        makeAuthCtx('user-1'),
      )
      expect(result.settings).toEqual({
        webhook: {
          id: 'wh-1',
          oaId: 'oa-1',
          url: 'https://hook.example',
          status: 2,
          lastVerifiedAt: undefined,
          createdAt: '2026-01-01T00:00:00Z',
        },
        useWebhook: true,
        webhookRedeliveryEnabled: false,
        errorStatisticsEnabled: false,
        lastVerifyStatusCode: undefined,
        lastVerifyReason: undefined,
      })
      expect(oa.getWebhook).toHaveBeenCalledWith('oa-1')
    })
  })

  describe('redeliverWebhook', () => {
    it('maps redelivery-disabled to FailedPrecondition', async () => {
      const { capturedImpl, webhookDelivery } = makeDeps({
        webhookDelivery: {
          verifyWebhook: vi.fn(),
          listDeliveries: vi.fn(),
          getDelivery: vi.fn(),
          redeliver: vi.fn().mockResolvedValue({ kind: 'redelivery-disabled' }),
          sendTestWebhookEvent: vi.fn(),
        },
      })
      mockedGetAuthDataFromRequest.mockResolvedValue({ id: 'user-1' } as any)
      await expect(
        capturedImpl.redeliverWebhook(
          { officialAccountId: 'oa-1', deliveryId: 'd1' },
          makeAuthCtx('user-1'),
        ),
      ).rejects.toMatchObject({ code: Code.FailedPrecondition })
      expect(webhookDelivery.redeliver).toHaveBeenCalledWith({
        oaId: 'oa-1',
        deliveryId: 'd1',
      })
    })
  })
})
