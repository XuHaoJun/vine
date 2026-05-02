import { Code, createContextValues } from '@connectrpc/connect'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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

function makeDeps(ownerId = 'user-1') {
  const capturedImpl: any = {}
  const router = {
    service: (_desc: any, impl: any) => Object.assign(capturedImpl, impl),
  }
  const oa = {
    getOfficialAccount: vi
      .fn()
      .mockResolvedValue({ id: 'oa-1', providerId: 'provider-1' }),
    getProvider: vi.fn().mockResolvedValue({ id: 'provider-1', ownerId }),
    getQuota: vi.fn().mockResolvedValue({ type: 'limited', value: 1000, totalUsage: 25 }),
  }
  oaHandler({
    auth: {} as any,
    drive: {} as any,
    webhookDelivery: {} as any,
    oa: oa as any,
  })(router as any)
  return { capturedImpl, oa }
}

beforeEach(() => {
  mockedGetAuthDataFromRequest.mockReset()
})

describe('OA connect messaging console', () => {
  it('requires ownership before returning quota summary', async () => {
    const { capturedImpl } = makeDeps('user-1')
    mockedGetAuthDataFromRequest.mockResolvedValue({ id: 'user-1' } as any)

    const result = await capturedImpl.getMessagingApiQuotaSummary(
      { officialAccountId: 'oa-1' },
      makeAuthCtx('user-1'),
    )

    expect(result).toEqual({
      type: 'limited',
      monthlyLimit: 1000,
      totalUsage: 25,
    })
  })

  it('rejects quota summary for another provider owner', async () => {
    const { capturedImpl, oa } = makeDeps('other-user')
    mockedGetAuthDataFromRequest.mockResolvedValue({ id: 'user-1' } as any)

    await expect(
      capturedImpl.getMessagingApiQuotaSummary(
        { officialAccountId: 'oa-1' },
        makeAuthCtx('user-1'),
      ),
    ).rejects.toMatchObject({ code: Code.PermissionDenied })
    expect(oa.getQuota).not.toHaveBeenCalled()
  })
})
