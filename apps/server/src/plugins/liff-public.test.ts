import { describe, expect, it, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'
import { liffPublicPlugin } from './liff-public'
import { userPublic, chat, chatMember } from '@vine/db/schema-public'

vi.mock('@take-out/better-auth-utils/server', () => ({
  getAuthDataFromRequest: vi.fn(),
}))

import { getAuthDataFromRequest } from '@take-out/better-auth-utils/server'

const mockedAuth = vi.mocked(getAuthDataFromRequest)

const userId = 'user-1'
const liffId = 'channel-abc12345'
const chatId = 'chat-1'

function createTestDeps(overrides: {
  liffApp?: Record<string, unknown> | null
  userPublicRow?: Record<string, unknown> | null
  chatRow?: Record<string, unknown> | null
  chatMemberRows?: Array<Record<string, unknown>>
} = {}) {
  const liffApp = overrides.liffApp ?? {
    liffId,
    loginChannelId: 'lc-1',
    scopes: ['profile', 'chat_message.write'],
    viewType: 'full',
    endpointUrl: 'https://example.com',
    moduleMode: false,
    botPrompt: 'none',
    qrCode: false,
  }

  const liff = {
    getLiffApp: vi.fn().mockResolvedValue(liffApp),
    getLinkedOA: vi.fn().mockResolvedValue(null),
    createLoginChannel: vi.fn(),
    getLoginChannel: vi.fn(),
    getLoginChannelSecret: vi.fn(),
    listLoginChannels: vi.fn(),
    deleteLoginChannel: vi.fn(),
    createLiffApp: vi.fn(),
    updateLiffApp: vi.fn(),
    listLiffApps: vi.fn(),
    deleteLiffApp: vi.fn(),
  }

  const userRow = overrides.userPublicRow ?? {
    id: userId,
    name: 'Test User',
    username: 'testuser',
    image: 'https://example.com/avatar.png',
  }

  const chatRow = overrides.chatRow ?? {
    id: chatId,
    type: 'group',
    name: 'Test Group',
  }

  const memberRows = overrides.chatMemberRows ?? [{ id: 'cm-1', userId, chatId, status: 'accepted' }]

  const db = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  }

  // Track which table the select is targeting by comparing drizzle table references
  db.select.mockImplementation(() => ({
    from: vi.fn().mockImplementation((table: unknown) => {
      let result: Promise<unknown[]>
      if (table === chatMember) {
        result = Promise.resolve(memberRows)
      } else if (table === chat) {
        result = Promise.resolve([chatRow])
      } else {
        result = Promise.resolve([userRow])
      }
      return {
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue(result),
        }),
      }
    }),
  }))

  const auth = {} as any

  const liffRuntimeToken = {
    createAccessToken: vi.fn().mockReturnValue('access-token-123'),
    resolveAccessToken: vi.fn().mockReturnValue({
      kind: 'access',
      liffId,
      userId,
      scopes: ['profile', 'chat_message.write'],
      exp: Date.now() + 15 * 60 * 1000,
    }),
    createLaunchToken: vi.fn().mockReturnValue('launch-token-123'),
    resolveLaunchToken: vi.fn().mockReturnValue({
      kind: 'launch',
      liffId,
      chatId,
      userId,
      contextType: 'group',
      exp: Date.now() + 5 * 60 * 1000,
    }),
  }

  return { liff, db, auth, liffRuntimeToken }
}

function createTestApp(deps: ReturnType<typeof createTestDeps>) {
  const app = Fastify()
  app.register(liffPublicPlugin, deps)
  return app
}

beforeEach(() => {
  mockedAuth.mockReset()
  mockedAuth.mockResolvedValue({ id: userId } as any)
})

describe('liffPublicPlugin profile and launch routes', () => {
  it('GET /liff/v1/me returns current Vine user profile for a valid LIFF access token', async () => {
    const deps = createTestDeps()
    const app = createTestApp(deps)
    await app.ready()

    const res = await app.inject({
      method: 'GET',
      url: `/liff/v1/me?liffId=${liffId}`,
      headers: { authorization: 'Bearer access-token-123' },
    })
    await app.close()

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body).toEqual({
      userId,
      displayName: 'Test User',
      pictureUrl: 'https://example.com/avatar.png',
      statusMessage: '',
    })
    expect(deps.liffRuntimeToken.resolveAccessToken).toHaveBeenCalledWith('access-token-123', liffId)
  })

  it('GET /liff/v1/me returns 401 without a valid LIFF access token', async () => {
    const deps = createTestDeps()
    deps.liffRuntimeToken.resolveAccessToken.mockReturnValue(null)
    const app = createTestApp(deps)
    await app.ready()

    const res = await app.inject({
      method: 'GET',
      url: `/liff/v1/me?liffId=${liffId}`,
      headers: { authorization: 'Bearer bad-token' },
    })
    await app.close()

    expect(res.statusCode).toBe(401)
  })

  it('POST /liff/v1/access-token returns an access token for an authenticated Vine user', async () => {
    const deps = createTestDeps()
    const app = createTestApp(deps)
    await app.ready()

    const res = await app.inject({
      method: 'POST',
      url: '/liff/v1/access-token',
      payload: { liffId },
    })
    await app.close()

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body).toEqual({ accessToken: 'access-token-123', expiresIn: 900 })
    expect(deps.liffRuntimeToken.createAccessToken).toHaveBeenCalledWith({
      liffId,
      userId,
      scopes: ['profile', 'chat_message.write'],
    })
  })

  it('POST /liff/v1/launch returns a launch token for a chat member', async () => {
    const deps = createTestDeps({
      chatRow: { id: chatId, type: 'group', name: 'Test Group' },
      chatMemberRows: [{ id: 'cm-1', userId, chatId, status: 'accepted' }],
    })
    const app = createTestApp(deps)
    await app.ready()

    const res = await app.inject({
      method: 'POST',
      url: '/liff/v1/launch',
      payload: { liffId, chatId },
    })
    await app.close()

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body).toEqual({ launchToken: 'launch-token-123', contextType: 'group', chatId })
  })

  it('POST /liff/v1/launch returns 403 when the user is not a chat member', async () => {
    const deps = createTestDeps({
      chatMemberRows: [],
    })
    const app = createTestApp(deps)
    await app.ready()

    const res = await app.inject({
      method: 'POST',
      url: '/liff/v1/launch',
      payload: { liffId, chatId },
    })
    await app.close()

    expect(res.statusCode).toBe(403)
  })
})
