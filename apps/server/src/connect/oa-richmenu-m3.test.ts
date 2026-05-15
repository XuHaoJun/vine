import { Code } from '@connectrpc/connect'
import { createContextValues } from '@connectrpc/connect'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { connectAuthDataKey } from './auth-context'
import { oaHandler } from './oa'

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
  mockedGetAuthDataFromRequest.mockResolvedValue({ id: 'user-1' } as any)
  const oa = {
    getOfficialAccount: vi.fn().mockResolvedValue({ id: 'oa-1', providerId: 'p-1' }),
    getProvider: vi.fn().mockResolvedValue({ id: 'p-1', ownerId: 'owner-1' }),
    getRichMenuAlias: vi.fn().mockResolvedValue(null),
    getRichMenu: vi.fn().mockResolvedValue(null),
    isOAFriend: vi.fn().mockResolvedValue(true),
    isUserChatMember: vi.fn().mockResolvedValue(true),
    linkRichMenuToUser: vi.fn().mockResolvedValue(undefined),
    registerReplyToken: vi.fn().mockResolvedValue({ token: 'reply-token-1' }),
    buildRichMenuSwitchPostbackEvent: vi
      .fn()
      .mockReturnValue({ destination: 'oa-1', events: [] }),
    getRichMenuAliasList: vi.fn().mockResolvedValue([]),
    createRichMenuAlias: vi.fn().mockResolvedValue({
      richMenuAliasId: 'alias-new',
      richMenuId: 'rm-1',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      id: 'uuid',
      oaId: 'oa-1',
    }),
    deleteRichMenuAlias: vi.fn().mockResolvedValue(undefined),
    unlinkRichMenuFromUser: vi.fn().mockResolvedValue(undefined),
    listOAUsersWithRichMenus: vi.fn().mockResolvedValue([]),
    addRichMenuClick: vi.fn().mockResolvedValue(undefined),
    getRichMenuClickStats: vi.fn().mockResolvedValue([]),
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
  const richMenuDisplayScheduler = {
    enqueueDisplayPeriodJobs: vi.fn().mockResolvedValue(undefined),
  }
  const capturedImpl: any = {}
  const mockRouter = {
    service: (_desc: any, impl: any) => {
      Object.assign(capturedImpl, impl)
    },
  }
  oaHandler({
    oa: oa as any,
    auth: {} as any,
    drive: {} as any,
    webhookDelivery,
    oaAudience: {} as any,
    oaCampaign: {} as any,
    richMenuDisplayScheduler,
  })(mockRouter as any)
  return { capturedImpl, oa, webhookDelivery, richMenuDisplayScheduler }
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
      {
        officialAccountId: 'oa-1',
        chatId: 'chat-1',
        richMenuAliasId: 'alias-x',
        data: 'd',
      },
      ctx,
    )
    expect(result.status).toBe('RICHMENU_ALIAS_ID_NOTFOUND')
    expect(oa.linkRichMenuToUser).not.toHaveBeenCalled()
  })

  it('returns RICHMENU_NOTFOUND when richMenuId in alias does not exist', async () => {
    const { capturedImpl, oa } = makeDeps({
      getRichMenuAlias: vi
        .fn()
        .mockResolvedValue({ richMenuAliasId: 'alias-a', richMenuId: 'rm-1' }),
      getRichMenu: vi.fn().mockResolvedValue(null),
    })
    mockedGetAuthDataFromRequest.mockResolvedValue({ id: 'user-1' } as any)
    const ctx = makeAuthCtx('user-1')
    const result = await capturedImpl.switchRichMenu(
      {
        officialAccountId: 'oa-1',
        chatId: 'chat-1',
        richMenuAliasId: 'alias-a',
        data: 'd',
      },
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
        {
          officialAccountId: 'oa-1',
          chatId: 'chat-1',
          richMenuAliasId: 'alias-a',
          data: 'd',
        },
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
        {
          officialAccountId: 'oa-1',
          chatId: 'chat-1',
          richMenuAliasId: 'alias-a',
          data: 'd',
        },
        ctx,
      ),
    ).rejects.toMatchObject({ code: Code.PermissionDenied })
    expect(oa.linkRichMenuToUser).not.toHaveBeenCalled()
  })

  it('links rich menu and returns SUCCESS, fires webhook async', async () => {
    const { capturedImpl, oa, webhookDelivery } = makeDeps({
      getRichMenuAlias: vi
        .fn()
        .mockResolvedValue({ richMenuAliasId: 'alias-a', richMenuId: 'rm-1' }),
      getRichMenu: vi.fn().mockResolvedValue({ richMenuId: 'rm-1', name: 'Menu A' }),
    })
    mockedGetAuthDataFromRequest.mockResolvedValue({ id: 'user-1' } as any)
    const ctx = makeAuthCtx('user-1')
    const result = await capturedImpl.switchRichMenu(
      {
        officialAccountId: 'oa-1',
        chatId: 'chat-1',
        richMenuAliasId: 'alias-a',
        data: 'switch-data',
      },
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
    mockedGetAuthDataFromRequest.mockResolvedValue(null as any)
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
        {
          officialAccountId: 'oa-1',
          chatId: 'chat-1',
          richMenuAliasId: 'alias-a',
          data: 'd',
        },
        ctx,
      ),
    ).rejects.toMatchObject({ code: Code.Unauthenticated })
  })
})

describe('listRichMenuAliases', () => {
  it('requires OA ownership', async () => {
    const { capturedImpl, oa } = makeDeps({
      getProvider: vi.fn().mockResolvedValue({ id: 'p-1', ownerId: 'other-user' }),
    })
    const ctx = makeAuthCtx('user-1')
    await expect(
      capturedImpl.listRichMenuAliases({ officialAccountId: 'oa-1' }, ctx),
    ).rejects.toMatchObject({ code: Code.PermissionDenied })
  })

  it('returns alias list for owner', async () => {
    const { capturedImpl, oa } = makeDeps({
      getProvider: vi.fn().mockResolvedValue({ id: 'p-1', ownerId: 'user-1' }),
      getRichMenuAliasList: vi.fn().mockResolvedValue([
        {
          richMenuAliasId: 'alias-a',
          richMenuId: 'rm-1',
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
          id: 'u1',
          oaId: 'oa-1',
        },
      ]),
    })
    const ctx = makeAuthCtx('user-1')
    const result = await capturedImpl.listRichMenuAliases(
      { officialAccountId: 'oa-1' },
      ctx,
    )
    expect(result.aliases).toHaveLength(1)
    expect(result.aliases[0].richMenuAliasId).toBe('alias-a')
  })
})

describe('createRichMenuAlias', () => {
  it('creates alias and returns it', async () => {
    const { capturedImpl, oa } = makeDeps({
      getProvider: vi.fn().mockResolvedValue({ id: 'p-1', ownerId: 'user-1' }),
      getRichMenu: vi.fn().mockResolvedValue({ richMenuId: 'rm-1', hasImage: true }),
    })
    const ctx = makeAuthCtx('user-1')
    const result = await capturedImpl.createRichMenuAlias(
      { officialAccountId: 'oa-1', richMenuAliasId: 'alias-new', richMenuId: 'rm-1' },
      ctx,
    )
    expect(oa.createRichMenuAlias).toHaveBeenCalledWith({
      oaId: 'oa-1',
      richMenuAliasId: 'alias-new',
      richMenuId: 'rm-1',
    })
    expect(result.alias?.richMenuAliasId).toBe('alias-new')
  })

  it('rejects invalid alias format before writing', async () => {
    const { capturedImpl, oa } = makeDeps({
      getProvider: vi.fn().mockResolvedValue({ id: 'p-1', ownerId: 'user-1' }),
    })
    const ctx = makeAuthCtx('user-1')
    await expect(
      capturedImpl.createRichMenuAlias(
        { officialAccountId: 'oa-1', richMenuAliasId: 'bad alias!', richMenuId: 'rm-1' },
        ctx,
      ),
    ).rejects.toMatchObject({ code: Code.InvalidArgument })
    expect(oa.createRichMenuAlias).not.toHaveBeenCalled()
  })

  it('maps duplicate alias to ALREADY_EXISTS', async () => {
    const duplicate = Object.assign(new Error('duplicate key'), { code: '23505' })
    const { capturedImpl } = makeDeps({
      getProvider: vi.fn().mockResolvedValue({ id: 'p-1', ownerId: 'user-1' }),
      getRichMenu: vi.fn().mockResolvedValue({ richMenuId: 'rm-1', hasImage: true }),
      createRichMenuAlias: vi.fn().mockRejectedValue(duplicate),
    })
    const ctx = makeAuthCtx('user-1')
    await expect(
      capturedImpl.createRichMenuAlias(
        { officialAccountId: 'oa-1', richMenuAliasId: 'alias-new', richMenuId: 'rm-1' },
        ctx,
      ),
    ).rejects.toMatchObject({ code: Code.AlreadyExists })
  })
})

describe('deleteRichMenuAliasManager', () => {
  it('deletes alias', async () => {
    const { capturedImpl, oa } = makeDeps({
      getProvider: vi.fn().mockResolvedValue({ id: 'p-1', ownerId: 'user-1' }),
      getRichMenuAlias: vi
        .fn()
        .mockResolvedValue({ richMenuAliasId: 'alias-a', richMenuId: 'rm-1' }),
    })
    const ctx = makeAuthCtx('user-1')
    await capturedImpl.deleteRichMenuAliasManager(
      { officialAccountId: 'oa-1', richMenuAliasId: 'alias-a' },
      ctx,
    )
    expect(oa.deleteRichMenuAlias).toHaveBeenCalledWith('oa-1', 'alias-a')
  })
})

describe('listOAUsersWithRichMenus', () => {
  it('returns users with their rich menu assignments', async () => {
    const { capturedImpl, oa } = makeDeps({
      getProvider: vi.fn().mockResolvedValue({ id: 'p-1', ownerId: 'user-1' }),
      listOAUsersWithRichMenus: vi.fn().mockResolvedValue([
        {
          userId: 'u-1',
          userName: 'Alice',
          userImage: null,
          assignedRichMenuId: 'rm-1',
        },
      ]),
    })
    const ctx = makeAuthCtx('user-1')
    const result = await capturedImpl.listOAUsersWithRichMenus(
      { officialAccountId: 'oa-1', richMenuId: 'rm-1' },
      ctx,
    )
    expect(oa.listOAUsersWithRichMenus).toHaveBeenCalledWith({
      oaId: 'oa-1',
      richMenuId: 'rm-1',
    })
    expect(result.users).toHaveLength(1)
    expect(result.users[0].userId).toBe('u-1')
    expect(result.users[0].assignedRichMenuId).toBe('rm-1')
  })
})

describe('linkRichMenuToUserManager', () => {
  it('links menu to user', async () => {
    const { capturedImpl, oa } = makeDeps({
      getProvider: vi.fn().mockResolvedValue({ id: 'p-1', ownerId: 'user-1' }),
      getRichMenu: vi.fn().mockResolvedValue({ richMenuId: 'rm-1', name: 'Menu A' }),
    })
    const ctx = makeAuthCtx('user-1')
    await capturedImpl.linkRichMenuToUserManager(
      { officialAccountId: 'oa-1', userId: 'u-2', richMenuId: 'rm-1' },
      ctx,
    )
    expect(oa.linkRichMenuToUser).toHaveBeenCalledWith('oa-1', 'u-2', 'rm-1')
  })
})

describe('unlinkRichMenuFromUserManager', () => {
  it('unlinks menu from user', async () => {
    const { capturedImpl, oa } = makeDeps({
      getProvider: vi.fn().mockResolvedValue({ id: 'p-1', ownerId: 'user-1' }),
    })
    const ctx = makeAuthCtx('user-1')
    await capturedImpl.unlinkRichMenuFromUserManager(
      { officialAccountId: 'oa-1', userId: 'u-2' },
      ctx,
    )
    expect(oa.unlinkRichMenuFromUser).toHaveBeenCalledWith('oa-1', 'u-2')
  })
})

describe('trackRichMenuClick', () => {
  it('records click for an OA friend when area index is valid', async () => {
    const { capturedImpl, oa } = makeDeps({
      getRichMenu: vi.fn().mockResolvedValue({
        richMenuId: 'rm-1',
        areas: [{}, {}, {}],
      }),
    })
    const ctx = makeAuthCtx('user-1')
    await capturedImpl.trackRichMenuClick(
      { officialAccountId: 'oa-1', richMenuId: 'rm-1', areaIndex: 2 },
      ctx,
    )
    expect(oa.addRichMenuClick).toHaveBeenCalledWith({
      oaId: 'oa-1',
      richMenuId: 'rm-1',
      areaIndex: 2,
    })
  })

  it('rejects clicks from non-friends', async () => {
    const { capturedImpl, oa } = makeDeps({
      isOAFriend: vi.fn().mockResolvedValue(false),
    })
    const ctx = makeAuthCtx('user-1')
    await expect(
      capturedImpl.trackRichMenuClick(
        { officialAccountId: 'oa-1', richMenuId: 'rm-1', areaIndex: 0 },
        ctx,
      ),
    ).rejects.toMatchObject({ code: Code.PermissionDenied })
    expect(oa.addRichMenuClick).not.toHaveBeenCalled()
  })

  it('rejects out-of-range area indexes', async () => {
    const { capturedImpl, oa } = makeDeps({
      getRichMenu: vi.fn().mockResolvedValue({ richMenuId: 'rm-1', areas: [{}] }),
    })
    const ctx = makeAuthCtx('user-1')
    await expect(
      capturedImpl.trackRichMenuClick(
        { officialAccountId: 'oa-1', richMenuId: 'rm-1', areaIndex: 2 },
        ctx,
      ),
    ).rejects.toMatchObject({ code: Code.InvalidArgument })
    expect(oa.addRichMenuClick).not.toHaveBeenCalled()
  })
})

describe('getRichMenuStats', () => {
  it('returns aggregated stats for owner', async () => {
    const { capturedImpl, oa } = makeDeps({
      getProvider: vi.fn().mockResolvedValue({ id: 'p-1', ownerId: 'user-1' }),
      getRichMenuClickStats: vi.fn().mockResolvedValue([
        { areaIndex: 0, clickCount: 10 },
        { areaIndex: 1, clickCount: 5 },
      ]),
    })
    const ctx = makeAuthCtx('user-1')
    const result = await capturedImpl.getRichMenuStats(
      { officialAccountId: 'oa-1', richMenuId: 'rm-1' },
      ctx,
    )
    expect(result.stats).toHaveLength(2)
    expect(result.stats[0].clickCount).toBe(10)
  })
})

describe('rich menu display periods', () => {
  it('rejects invalid update display period', async () => {
    mockedGetAuthDataFromRequest.mockResolvedValue({ id: 'user-1' } as any)
    const { capturedImpl } = makeDeps({
      getProvider: vi.fn().mockResolvedValue({ id: 'p-1', ownerId: 'user-1' }),
      getRichMenu: vi.fn().mockResolvedValue({
        richMenuId: 'rm-1',
        displayStartsAt: null,
        displayEndsAt: null,
      }),
    })
    const ctx = makeAuthCtx('user-1')
    await expect(
      capturedImpl.updateRichMenu(
        {
          officialAccountId: 'oa-1',
          richMenuId: 'rm-1',
          name: 'Menu',
          chatBarText: 'Menu',
          selected: false,
          sizeWidth: 2500,
          sizeHeight: 843,
          areas: [],
          displayStartsAt: '2026-05-15T10:00:00.000Z',
          displayEndsAt: '2026-05-15T09:00:00.000Z',
        },
        ctx,
      ),
    ).rejects.toMatchObject({ code: Code.InvalidArgument })
  })

  it('enqueues replacement jobs when the display period changes', async () => {
    mockedGetAuthDataFromRequest.mockResolvedValue({ id: 'user-1' } as any)
    const { capturedImpl, richMenuDisplayScheduler } = makeDeps({
      getProvider: vi.fn().mockResolvedValue({ id: 'p-1', ownerId: 'user-1' }),
      getRichMenu: vi.fn().mockResolvedValue({
        richMenuId: 'rm-1',
        hasImage: true,
        displayStartsAt: null,
        displayEndsAt: null,
      }),
      updateRichMenu: vi.fn().mockResolvedValue({
        richMenuId: 'rm-1',
        displayScheduleRevision: 2,
      }),
    })
    const ctx = makeAuthCtx('user-1')
    await capturedImpl.updateRichMenu(
      {
        officialAccountId: 'oa-1',
        richMenuId: 'rm-1',
        name: 'Menu',
        chatBarText: 'Menu',
        selected: false,
        sizeWidth: 2500,
        sizeHeight: 843,
        areas: [],
        displayStartsAt: '2026-05-15T10:00:00.000Z',
      },
      ctx,
    )
    expect(richMenuDisplayScheduler.enqueueDisplayPeriodJobs).toHaveBeenCalledWith(
      expect.objectContaining({
        oaId: 'oa-1',
        richMenuId: 'rm-1',
        displayScheduleRevision: 2,
      }),
    )
  })

  it('rejects setting a menu without image as default', async () => {
    mockedGetAuthDataFromRequest.mockResolvedValue({ id: 'user-1' } as any)
    const { capturedImpl } = makeDeps({
      getProvider: vi.fn().mockResolvedValue({ id: 'p-1', ownerId: 'user-1' }),
      getRichMenu: vi.fn().mockResolvedValue({ richMenuId: 'rm-1', hasImage: false }),
    })
    const ctx = makeAuthCtx('user-1')
    await expect(
      capturedImpl.setDefaultRichMenu(
        { officialAccountId: 'oa-1', richMenuId: 'rm-1' },
        ctx,
      ),
    ).rejects.toMatchObject({ code: Code.FailedPrecondition })
  })
})
