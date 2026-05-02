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

function makeDeps(oaOverrides: Partial<Record<string, any>> = {}) {
  const oa = {
    getOfficialAccount: vi.fn().mockResolvedValue({ id: 'oa-1', providerId: 'p-1' }),
    getProvider: vi.fn().mockResolvedValue({ id: 'p-1', ownerId: 'owner-1' }),
    getRichMenuAlias: vi.fn().mockResolvedValue(null),
    getRichMenu: vi.fn().mockResolvedValue(null),
    isOAFriend: vi.fn().mockResolvedValue(true),
    isUserChatMember: vi.fn().mockResolvedValue(true),
    linkRichMenuToUser: vi.fn().mockResolvedValue(undefined),
    registerReplyToken: vi.fn().mockResolvedValue({ token: 'reply-token-1' }),
    buildRichMenuSwitchPostbackEvent: vi.fn().mockReturnValue({ destination: 'oa-1', events: [] }),
    ...oaOverrides,
  }
  const webhookDelivery = {
    deliverRealEvent: vi.fn().mockResolvedValue({ kind: 'ok' }),
    verifyWebhook: vi.fn(),
    listDeliveries: vi.fn(),
    getDelivery: vi.fn(),
    redeliver: vi.fn(),
    sendTestWebhookEvent: vi.fn(),
    cleanupExpiredDeliveries: vi.fn(),
  }
  const capturedImpl: any = {}
  const mockRouter = {
    service: (_desc: any, impl: any) => { Object.assign(capturedImpl, impl) },
  }
  oaHandler({ oa: oa as any, auth: {} as any, drive: {} as any, webhookDelivery })(
    mockRouter as any,
  )
  return { capturedImpl, oa, webhookDelivery }
}

beforeEach(() => {
  mockedGetAuthDataFromRequest.mockReset()
})

describe('switchRichMenu', () => {
  it('returns RICHMENU_ALIAS_ID_NOTFOUND when alias does not exist', async () => {
    const { capturedImpl, oa } = makeDeps({
      getRichMenuAlias: vi.fn().mockResolvedValue(null),
    })
    mockedGetAuthDataFromRequest.mockResolvedValue({ id: 'user-1' } as any)
    const ctx = makeAuthCtx('user-1')
    const result = await capturedImpl.switchRichMenu(
      { officialAccountId: 'oa-1', chatId: 'chat-1', richMenuAliasId: 'alias-x', data: 'd' },
      ctx,
    )
    expect(result.status).toBe('RICHMENU_ALIAS_ID_NOTFOUND')
    expect(oa.linkRichMenuToUser).not.toHaveBeenCalled()
  })

  it('returns RICHMENU_NOTFOUND when richMenuId in alias does not exist', async () => {
    const { capturedImpl, oa } = makeDeps({
      getRichMenuAlias: vi.fn().mockResolvedValue({ richMenuAliasId: 'alias-a', richMenuId: 'rm-1' }),
      getRichMenu: vi.fn().mockResolvedValue(null),
    })
    mockedGetAuthDataFromRequest.mockResolvedValue({ id: 'user-1' } as any)
    const ctx = makeAuthCtx('user-1')
    const result = await capturedImpl.switchRichMenu(
      { officialAccountId: 'oa-1', chatId: 'chat-1', richMenuAliasId: 'alias-a', data: 'd' },
      ctx,
    )
    expect(result.status).toBe('RICHMENU_NOTFOUND')
    expect(oa.linkRichMenuToUser).not.toHaveBeenCalled()
  })

  it('rejects when session user is not a member of the chat', async () => {
    const { capturedImpl, oa } = makeDeps({
      isUserChatMember: vi.fn().mockResolvedValue(false),
    })
    mockedGetAuthDataFromRequest.mockResolvedValue({ id: 'user-1' } as any)
    const ctx = makeAuthCtx('user-1')
    await expect(
      capturedImpl.switchRichMenu(
        { officialAccountId: 'oa-1', chatId: 'chat-1', richMenuAliasId: 'alias-a', data: 'd' },
        ctx,
      ),
    ).rejects.toMatchObject({ code: Code.PermissionDenied })
    expect(oa.linkRichMenuToUser).not.toHaveBeenCalled()
  })

  it('rejects when session user is not an OA friend', async () => {
    const { capturedImpl, oa } = makeDeps({
      isOAFriend: vi.fn().mockResolvedValue(false),
    })
    mockedGetAuthDataFromRequest.mockResolvedValue({ id: 'user-1' } as any)
    const ctx = makeAuthCtx('user-1')
    await expect(
      capturedImpl.switchRichMenu(
        { officialAccountId: 'oa-1', chatId: 'chat-1', richMenuAliasId: 'alias-a', data: 'd' },
        ctx,
      ),
    ).rejects.toMatchObject({ code: Code.PermissionDenied })
    expect(oa.linkRichMenuToUser).not.toHaveBeenCalled()
  })

  it('links rich menu and returns SUCCESS, fires webhook async', async () => {
    const { capturedImpl, oa, webhookDelivery } = makeDeps({
      getRichMenuAlias: vi.fn().mockResolvedValue({ richMenuAliasId: 'alias-a', richMenuId: 'rm-1' }),
      getRichMenu: vi.fn().mockResolvedValue({ richMenuId: 'rm-1', name: 'Menu A' }),
    })
    mockedGetAuthDataFromRequest.mockResolvedValue({ id: 'user-1' } as any)
    const ctx = makeAuthCtx('user-1')
    const result = await capturedImpl.switchRichMenu(
      { officialAccountId: 'oa-1', chatId: 'chat-1', richMenuAliasId: 'alias-a', data: 'switch-data' },
      ctx,
    )
    expect(result.status).toBe('SUCCESS')
    expect(result.newRichMenuAliasId).toBe('alias-a')
    expect(oa.linkRichMenuToUser).toHaveBeenCalledWith('oa-1', 'user-1', 'rm-1')
    // webhook fires fire-and-forget — just verify it was called
    expect(webhookDelivery.deliverRealEvent).toHaveBeenCalled()
  })

  it('throws UNAUTHENTICATED without session', async () => {
    const { capturedImpl } = makeDeps()
    const values = createContextValues()
    const ctx = {
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
    await expect(
      capturedImpl.switchRichMenu(
        { officialAccountId: 'oa-1', chatId: 'chat-1', richMenuAliasId: 'alias-a', data: 'd' },
        ctx,
      ),
    ).rejects.toMatchObject({ code: Code.Unauthenticated })
  })
})
