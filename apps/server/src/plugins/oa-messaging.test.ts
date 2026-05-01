import { describe, expect, it, afterAll, vi } from 'vitest'
import Fastify from 'fastify'
import { oaApiPath } from './oa-routes'
import { oaMessagingPlugin } from './oa-messaging'

const validToken = 'valid-test-token'
const oaId = '550e8400-e29b-41d4-a716-446655440000'
const userId = 'user-123'

function createTestApp(
  mockDb: {
    mockSelect: ReturnType<typeof vi.fn>
    mockInsert: ReturnType<typeof vi.fn>
    mockUpdate: ReturnType<typeof vi.fn>
  },
  mockSendOAMessage?: ReturnType<typeof vi.fn>,
  mockCheckAndIncrementUsage?: ReturnType<typeof vi.fn>,
  mockGetQuota?: ReturnType<typeof vi.fn>,
  mockGetConsumption?: ReturnType<typeof vi.fn>,
  mockResolveReplyToken?: ReturnType<typeof vi.fn>,
  mockMarkReplyTokenUsed?: ReturnType<typeof vi.fn>,
) {
  const { mockSelect, mockInsert, mockUpdate } = mockDb
  const db = { select: mockSelect, insert: mockInsert, update: mockUpdate } as any
  const mockOa = {
    getOfficialAccount: vi.fn(),
    issueAccessToken: vi.fn().mockResolvedValue({
      access_token: 'test-token',
      expires_in: 2592000,
      token_type: 'Bearer',
    }),
    revokeAccessToken: vi.fn(),
    sendOAMessage:
      mockSendOAMessage ??
      vi.fn().mockResolvedValue({
        success: true,
        chatId: 'chat-id',
        messageId: 'msg-id',
      }),
    checkAndIncrementUsage: mockCheckAndIncrementUsage ?? vi.fn().mockResolvedValue(true),
    getQuota: mockGetQuota ?? vi.fn().mockResolvedValue({ type: 'none', totalUsage: 0 }),
    getConsumption: mockGetConsumption ?? vi.fn().mockResolvedValue({ totalUsage: 0 }),
    resolveReplyToken:
      mockResolveReplyToken ??
      vi.fn().mockResolvedValue({
        valid: true,
        record: {
          id: 'token-id-1',
          oaId,
          token: 'reply-1',
          userId,
          chatId: 'chat-1',
          messageId: 'msg-1',
          used: false,
          expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        },
      }),
    markReplyTokenUsed: mockMarkReplyTokenUsed ?? vi.fn().mockResolvedValue(undefined),
  }
  const mockDrive = {
    put: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockResolvedValue({ content: Buffer.from(''), mimeType: null, size: 0 }),
    exists: vi.fn().mockResolvedValue(false),
    delete: vi.fn().mockResolvedValue(undefined),
    getUrl: vi.fn().mockResolvedValue('http://localhost/uploads/test'),
  }
  const app = Fastify()
  app.register(oaMessagingPlugin, { oa: mockOa as any, db, drive: mockDrive })
  return { app, mockOa }
}

function makeMockDb(tokenResult: unknown[], friendshipResult: unknown[]) {
  const mockLimit1 = vi.fn().mockResolvedValue(tokenResult)
  const mockLimit2 = vi.fn().mockResolvedValue(friendshipResult)
  const mockWhere1 = vi.fn().mockReturnValue({ limit: mockLimit1 })
  const mockWhere2 = vi.fn().mockReturnValue({ limit: mockLimit2 })
  let selectCallCount = 0
  const mockSelect = vi.fn().mockImplementation(() => {
    selectCallCount++
    if (selectCallCount <= 2) {
      return {
        from: vi.fn().mockReturnValue({
          where: selectCallCount === 1 ? mockWhere1 : mockWhere2,
        }),
      }
    }
    // friendship select
    return {
      from: vi.fn().mockReturnValue({
        where: vi
          .fn()
          .mockReturnValue({ limit: vi.fn().mockResolvedValue(friendshipResult) }),
      }),
    }
  })
  const mockInsert = vi.fn().mockReturnValue({ values: vi.fn().mockReturnThis() })
  const mockUpdate = vi
    .fn()
    .mockReturnValue({ set: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis() })
  return { mockSelect, mockInsert, mockUpdate }
}

describe('oaMessagingPlugin — Push Message', () => {
  afterAll(() => {})

  describe('auth', () => {
    it('returns 401 when no Bearer token', async () => {
      const mockDb = makeMockDb([], [])
      const { app } = createTestApp(mockDb)
      await app.ready()

      const res = await app.inject({
        method: 'POST',
        url: oaApiPath('/bot/message/push'),
        payload: { to: userId, messages: [{ type: 'text', text: 'hello' }] },
      })

      await app.close()
      expect(res.statusCode).toBe(401)
      const body = JSON.parse(res.body)
      expect(body.code).toBe('INVALID_TOKEN')
      expect(body.message).toBe('Missing Bearer token')
    })

    it('returns 401 when token not found', async () => {
      const mockDb = makeMockDb([], [])
      const { app } = createTestApp(mockDb)
      await app.ready()

      const res = await app.inject({
        method: 'POST',
        url: oaApiPath('/bot/message/push'),
        headers: { authorization: `Bearer invalid-token` },
        payload: { to: userId, messages: [{ type: 'text', text: 'hello' }] },
      })

      await app.close()
      expect(res.statusCode).toBe(401)
      const body = JSON.parse(res.body)
      expect(body.code).toBe('INVALID_TOKEN')
      expect(body.message).toBe('Invalid access token')
    })

    it('does not register the root /v2 push route', async () => {
      const mockDb = makeMockDb([{ oaId, token: validToken, expiresAt: null }], [])
      const { app } = createTestApp(mockDb)
      await app.ready()

      const res = await app.inject({
        method: 'POST',
        url: '/v2/bot/message/push',
        headers: { authorization: `Bearer ${validToken}` },
        payload: { to: userId, messages: [{ type: 'text', text: 'hello' }] },
      })

      await app.close()
      expect(res.statusCode).toBe(404)
    })
  })

  describe('validation', () => {
    it('returns 400 when missing to', async () => {
      const mockDb = makeMockDb([{ oaId, token: validToken, expiresAt: null }], [])
      const { app } = createTestApp(mockDb)
      await app.ready()

      const res = await app.inject({
        method: 'POST',
        url: oaApiPath('/bot/message/push'),
        headers: { authorization: `Bearer ${validToken}` },
        payload: { messages: [{ type: 'text', text: 'hello' }] },
      })

      await app.close()
      expect(res.statusCode).toBe(400)
      const body = JSON.parse(res.body)
      expect(body.code).toBe('INVALID_REQUEST')
    })

    it('returns 400 when missing messages', async () => {
      const mockDb = makeMockDb([{ oaId, token: validToken, expiresAt: null }], [])
      const { app } = createTestApp(mockDb)
      await app.ready()

      const res = await app.inject({
        method: 'POST',
        url: oaApiPath('/bot/message/push'),
        headers: { authorization: `Bearer ${validToken}` },
        payload: { to: userId },
      })

      await app.close()
      expect(res.statusCode).toBe(400)
      const body = JSON.parse(res.body)
      expect(body.code).toBe('INVALID_REQUEST')
    })

    it('returns 400 when text is missing in text message', async () => {
      const mockDb = makeMockDb(
        [{ oaId, token: validToken, expiresAt: null }],
        [{ oaId, userId, status: 'friend' }],
      )
      const { app } = createTestApp(mockDb)
      await app.ready()

      const res = await app.inject({
        method: 'POST',
        url: oaApiPath('/bot/message/push'),
        headers: { authorization: `Bearer ${validToken}` },
        payload: { to: userId, messages: [{ type: 'text' }] },
      })

      await app.close()
      expect(res.statusCode).toBe(400)
      const body = JSON.parse(res.body)
      expect(body.code).toBe('INVALID_MESSAGE_TYPE')
      expect(body.message).toContain('text')
    })

    it('returns 400 when flex message is invalid', async () => {
      const mockDb = makeMockDb(
        [{ oaId, token: validToken, expiresAt: null }],
        [{ oaId, userId, status: 'friend' }],
      )
      const { app } = createTestApp(mockDb)
      await app.ready()

      const res = await app.inject({
        method: 'POST',
        url: oaApiPath('/bot/message/push'),
        headers: { authorization: `Bearer ${validToken}` },
        payload: {
          to: userId,
          messages: [
            {
              type: 'flex',
              altText: 'test',
              contents: {
                type: 'bubble',
                body: { type: 'box', layout: 'sideways', contents: [] },
              },
            },
          ],
        },
      })

      await app.close()
      expect(res.statusCode).toBe(400)
      const body = JSON.parse(res.body)
      expect(body.code).toBe('INVALID_MESSAGE_TYPE')
    })

    it('returns 400 when unsupported message type', async () => {
      const mockDb = makeMockDb(
        [{ oaId, token: validToken, expiresAt: null }],
        [{ oaId, userId, status: 'friend' }],
      )
      const { app } = createTestApp(mockDb)
      await app.ready()

      const res = await app.inject({
        method: 'POST',
        url: oaApiPath('/bot/message/push'),
        headers: { authorization: `Bearer ${validToken}` },
        payload: { to: userId, messages: [{ type: 'custom' }] },
      })

      await app.close()
      expect(res.statusCode).toBe(400)
      const body = JSON.parse(res.body)
      expect(body.code).toBe('INVALID_MESSAGE_TYPE')
      expect(body.message).toContain('custom')
    })
  })

  describe('friendship check', () => {
    it('returns 403 when user is not a friend', async () => {
      const mockDb = makeMockDb([{ oaId, token: validToken, expiresAt: null }], [])
      const { app } = createTestApp(mockDb)
      await app.ready()

      const res = await app.inject({
        method: 'POST',
        url: oaApiPath('/bot/message/push'),
        headers: { authorization: `Bearer ${validToken}` },
        payload: { to: userId, messages: [{ type: 'text', text: 'hello' }] },
      })

      await app.close()
      expect(res.statusCode).toBe(403)
      const body = JSON.parse(res.body)
      expect(body.code).toBe('NOT_FRIEND')
    })

    it('returns 403 when friendship status is not friend', async () => {
      const mockDb = makeMockDb(
        [{ oaId, token: validToken, expiresAt: null }],
        [{ oaId, userId, status: 'pending' }],
      )
      const { app } = createTestApp(mockDb)
      await app.ready()

      const res = await app.inject({
        method: 'POST',
        url: oaApiPath('/bot/message/push'),
        headers: { authorization: `Bearer ${validToken}` },
        payload: { to: userId, messages: [{ type: 'text', text: 'hello' }] },
      })

      await app.close()
      expect(res.statusCode).toBe(403)
      const body = JSON.parse(res.body)
      expect(body.code).toBe('NOT_FRIEND')
    })
  })

  describe('push message delivery', () => {
    it('sends text message successfully', async () => {
      const mockDb = makeMockDb(
        [{ oaId, token: validToken, expiresAt: null }],
        [{ oaId, userId, status: 'friend' }],
      )
      const mockSend = vi
        .fn()
        .mockResolvedValue({ success: true, chatId: 'chat-1', messageId: 'msg-1' })
      const { app, mockOa } = createTestApp(mockDb, mockSend)
      await app.ready()

      const res = await app.inject({
        method: 'POST',
        url: oaApiPath('/bot/message/push'),
        headers: { authorization: `Bearer ${validToken}` },
        payload: { to: userId, messages: [{ type: 'text', text: 'hello world' }] },
      })

      await app.close()
      expect(res.statusCode).toBe(200)
      expect(mockOa.sendOAMessage).toHaveBeenCalledWith(oaId, userId, {
        type: 'text',
        text: 'hello world',
        metadata: null,
      })
    })

    it('sends flex message successfully', async () => {
      const mockDb = makeMockDb(
        [{ oaId, token: validToken, expiresAt: null }],
        [{ oaId, userId, status: 'friend' }],
      )
      const mockSend = vi
        .fn()
        .mockResolvedValue({ success: true, chatId: 'chat-1', messageId: 'msg-1' })
      const { app, mockOa } = createTestApp(mockDb, mockSend)
      await app.ready()

      const flexMessage = {
        type: 'flex',
        altText: 'Hello',
        contents: {
          type: 'bubble',
          body: {
            type: 'box',
            layout: 'vertical',
            contents: [{ type: 'text', text: 'Hello' }],
          },
        },
      }

      const res = await app.inject({
        method: 'POST',
        url: oaApiPath('/bot/message/push'),
        headers: { authorization: `Bearer ${validToken}` },
        payload: { to: userId, messages: [flexMessage] },
      })

      await app.close()
      expect(res.statusCode).toBe(200)
      expect(mockOa.sendOAMessage).toHaveBeenCalledOnce()
      const call = mockOa.sendOAMessage.mock.calls[0]
      expect(call[0]).toBe(oaId)
      expect(call[1]).toBe(userId)
      expect(call[2].type).toBe('flex')
      expect(call[2].text).toBeNull()
      expect(JSON.parse(call[2].metadata)).toEqual(flexMessage)
    })

    it('sends multiple messages in order', async () => {
      const mockDb = makeMockDb(
        [{ oaId, token: validToken, expiresAt: null }],
        [{ oaId, userId, status: 'friend' }],
      )
      const mockSend = vi
        .fn()
        .mockResolvedValue({ success: true, chatId: 'chat-1', messageId: 'msg-1' })
      const { app, mockOa } = createTestApp(mockDb, mockSend)
      await app.ready()

      const res = await app.inject({
        method: 'POST',
        url: oaApiPath('/bot/message/push'),
        headers: { authorization: `Bearer ${validToken}` },
        payload: {
          to: userId,
          messages: [
            { type: 'text', text: 'first' },
            { type: 'text', text: 'second' },
          ],
        },
      })

      await app.close()
      expect(res.statusCode).toBe(200)
      expect(mockOa.sendOAMessage).toHaveBeenCalledTimes(2)
      expect(mockOa.sendOAMessage.mock.calls[0][2].text).toBe('first')
      expect(mockOa.sendOAMessage.mock.calls[1][2].text).toBe('second')
    })
  })

  describe('quota enforcement', () => {
    it('allows push when quota is not exceeded', async () => {
      const mockDb = makeMockDb(
        [{ oaId, token: validToken, expiresAt: null }],
        [{ oaId, userId, status: 'friend' }],
      )
      const mockSend = vi
        .fn()
        .mockResolvedValue({ success: true, chatId: 'chat-1', messageId: 'msg-1' })
      const { app, mockOa } = createTestApp(mockDb, mockSend)
      await app.ready()

      const res = await app.inject({
        method: 'POST',
        url: oaApiPath('/bot/message/push'),
        headers: { authorization: `Bearer ${validToken}` },
        payload: { to: userId, messages: [{ type: 'text', text: 'hello' }] },
      })

      await app.close()
      expect(res.statusCode).toBe(200)
    })

    it('blocks push when quota is exceeded', async () => {
      const mockDb = makeMockDb(
        [{ oaId, token: validToken, expiresAt: null }],
        [{ oaId, userId, status: 'friend' }],
      )
      const mockSend = vi.fn()
      const { app, mockOa } = createTestApp(
        mockDb,
        mockSend,
        vi.fn().mockResolvedValue(false),
      )
      await app.ready()

      const res = await app.inject({
        method: 'POST',
        url: oaApiPath('/bot/message/push'),
        headers: { authorization: `Bearer ${validToken}` },
        payload: { to: userId, messages: [{ type: 'text', text: 'hello' }] },
      })

      await app.close()
      expect(res.statusCode).toBe(429)
      const body = JSON.parse(res.body)
      expect(body.code).toBe('QUOTA_EXCEEDED')
      expect(body.message).toBe('You have reached your monthly limit.')
      expect(mockOa.sendOAMessage).not.toHaveBeenCalled()
    })

    it('does not check quota for reply messages', async () => {
      const mockDb = makeMockDb([{ oaId, token: validToken, expiresAt: null }], [])
      const { app, mockOa } = createTestApp(mockDb)
      await app.ready()

      const res = await app.inject({
        method: 'POST',
        url: oaApiPath('/bot/message/reply'),
        headers: { authorization: `Bearer ${validToken}` },
        payload: {
          replyToken: 'reply-1',
          messages: [{ type: 'text', text: 'hello back' }],
        },
      })

      await app.close()
      expect(res.statusCode).toBe(200)
      expect(mockOa.checkAndIncrementUsage).not.toHaveBeenCalled()
    })
  })

  describe('quota endpoints', () => {
    it('returns quota info with type none when no limit set', async () => {
      const mockDb = makeMockDb([{ oaId, token: validToken, expiresAt: null }], [])
      const { app } = createTestApp(mockDb)
      await app.ready()

      const res = await app.inject({
        method: 'GET',
        url: oaApiPath('/bot/message/quota'),
        headers: { authorization: `Bearer ${validToken}` },
      })

      await app.close()
      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.type).toBe('none')
      expect(body.totalUsage).toBe(0)
    })

    it('returns quota info with type limited when limit is set', async () => {
      const mockDb = makeMockDb([{ oaId, token: validToken, expiresAt: null }], [])
      const { app, mockOa } = createTestApp(
        mockDb,
        undefined,
        undefined,
        vi.fn().mockResolvedValue({ type: 'limited', value: 1000, totalUsage: 500 }),
      )
      await app.ready()

      const res = await app.inject({
        method: 'GET',
        url: oaApiPath('/bot/message/quota'),
        headers: { authorization: `Bearer ${validToken}` },
      })

      await app.close()
      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.type).toBe('limited')
      expect(body.value).toBe(1000)
      expect(body.totalUsage).toBe(500)
    })

    it('returns consumption info', async () => {
      const mockDb = makeMockDb([{ oaId, token: validToken, expiresAt: null }], [])
      const { app, mockOa } = createTestApp(
        mockDb,
        undefined,
        undefined,
        undefined,
        vi.fn().mockResolvedValue({ totalUsage: 500 }),
      )
      await app.ready()

      const res = await app.inject({
        method: 'GET',
        url: oaApiPath('/bot/message/quota/consumption'),
        headers: { authorization: `Bearer ${validToken}` },
      })

      await app.close()
      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.totalUsage).toBe(500)
    })

    it('returns 401 when accessing quota without token', async () => {
      const mockDb = makeMockDb([], [])
      const { app } = createTestApp(mockDb)
      await app.ready()

      const res = await app.inject({
        method: 'GET',
        url: oaApiPath('/bot/message/quota'),
      })

      await app.close()
      expect(res.statusCode).toBe(401)
    })
  })
})

describe('oaMessagingPlugin — Reply Message', () => {
  describe('auth', () => {
    it('returns 401 when no Bearer token', async () => {
      const mockDb = makeMockDb([], [])
      const { app } = createTestApp(mockDb)
      await app.ready()

      const res = await app.inject({
        method: 'POST',
        url: oaApiPath('/bot/message/reply'),
        payload: { replyToken: 'reply-1', messages: [{ type: 'text', text: 'hello' }] },
      })

      await app.close()
      expect(res.statusCode).toBe(401)
    })
  })

  describe('validation', () => {
    it('returns 400 when missing replyToken', async () => {
      const mockDb = makeMockDb([{ oaId, token: validToken, expiresAt: null }], [])
      const { app } = createTestApp(mockDb)
      await app.ready()

      const res = await app.inject({
        method: 'POST',
        url: oaApiPath('/bot/message/reply'),
        headers: { authorization: `Bearer ${validToken}` },
        payload: { messages: [{ type: 'text', text: 'hello' }] },
      })

      await app.close()
      expect(res.statusCode).toBe(400)
      const body = JSON.parse(res.body)
      expect(body.code).toBe('INVALID_REQUEST')
    })

    it('returns 400 when missing messages', async () => {
      const mockDb = makeMockDb([{ oaId, token: validToken, expiresAt: null }], [])
      const { app } = createTestApp(mockDb)
      await app.ready()

      const res = await app.inject({
        method: 'POST',
        url: oaApiPath('/bot/message/reply'),
        headers: { authorization: `Bearer ${validToken}` },
        payload: { replyToken: 'reply-1' },
      })

      await app.close()
      expect(res.statusCode).toBe(400)
      const body = JSON.parse(res.body)
      expect(body.code).toBe('INVALID_REQUEST')
    })

    it('returns 400 when text is missing in text message', async () => {
      const mockDb = makeMockDb([{ oaId, token: validToken, expiresAt: null }], [])
      const { app } = createTestApp(mockDb)
      await app.ready()

      const res = await app.inject({
        method: 'POST',
        url: oaApiPath('/bot/message/reply'),
        headers: { authorization: `Bearer ${validToken}` },
        payload: { replyToken: 'reply-1', messages: [{ type: 'text' }] },
      })

      await app.close()
      expect(res.statusCode).toBe(400)
      const body = JSON.parse(res.body)
      expect(body.code).toBe('INVALID_MESSAGE_TYPE')
    })

    it('returns 400 when unsupported message type', async () => {
      const mockDb = makeMockDb([{ oaId, token: validToken, expiresAt: null }], [])
      const { app } = createTestApp(mockDb)
      await app.ready()

      const res = await app.inject({
        method: 'POST',
        url: oaApiPath('/bot/message/reply'),
        headers: { authorization: `Bearer ${validToken}` },
        payload: {
          replyToken: 'reply-1',
          messages: [{ type: 'sticker', stickerId: '1', packageId: '1' }],
        },
      })

      await app.close()
      // sticker is a supported type, should pass validation
      expect(res.statusCode).toBe(200)
    })
  })

  describe('reply message', () => {
    it('sends text reply via sendOAMessage', async () => {
      const mockSend = vi
        .fn()
        .mockResolvedValue({ success: true, chatId: 'chat-1', messageId: 'msg-reply-1' })
      const mockDb = makeMockDb([{ oaId, token: validToken, expiresAt: null }], [])
      const { app, mockOa } = createTestApp(mockDb, mockSend)
      await app.ready()

      const res = await app.inject({
        method: 'POST',
        url: oaApiPath('/bot/message/reply'),
        headers: { authorization: `Bearer ${validToken}` },
        payload: {
          replyToken: 'reply-1',
          messages: [{ type: 'text', text: 'hello back' }],
        },
      })

      await app.close()
      expect(res.statusCode).toBe(200)
      expect(mockOa.sendOAMessage).toHaveBeenCalledWith(oaId, userId, {
        type: 'text',
        text: 'hello back',
        metadata: null,
      })
      expect(mockOa.markReplyTokenUsed).toHaveBeenCalled()
    })

    it('sends flex reply via sendOAMessage', async () => {
      const mockSend = vi
        .fn()
        .mockResolvedValue({ success: true, chatId: 'chat-1', messageId: 'msg-reply-1' })
      const mockDb = makeMockDb([{ oaId, token: validToken, expiresAt: null }], [])
      const { app, mockOa } = createTestApp(mockDb, mockSend)
      await app.ready()

      const flexMessage = {
        type: 'flex',
        altText: 'reply',
        contents: {
          type: 'bubble',
          body: {
            type: 'box',
            layout: 'vertical',
            contents: [{ type: 'text', text: 'replied' }],
          },
        },
      }

      const res = await app.inject({
        method: 'POST',
        url: oaApiPath('/bot/message/reply'),
        headers: { authorization: `Bearer ${validToken}` },
        payload: {
          replyToken: 'reply-1',
          messages: [flexMessage],
        },
      })

      await app.close()
      expect(res.statusCode).toBe(200)
      expect(mockOa.sendOAMessage).toHaveBeenCalledOnce()
      const call = mockOa.sendOAMessage.mock.calls[0]
      expect(call[0]).toBe(oaId)
      expect(call[1]).toBe(userId)
      expect(call[2].type).toBe('flex')
      expect(call[2].text).toBeNull()
      expect(JSON.parse(call[2].metadata!)).toEqual(flexMessage)
    })

    it('returns 400 for not_found reply token', async () => {
      const mockDb = makeMockDb([{ oaId, token: validToken, expiresAt: null }], [])
      const { app } = createTestApp(
        mockDb,
        undefined,
        undefined,
        undefined,
        undefined,
        vi.fn(() => Promise.resolve({ valid: false, reason: 'not_found' as const })),
      )
      await app.ready()

      const res = await app.inject({
        method: 'POST',
        url: oaApiPath('/bot/message/reply'),
        headers: { authorization: `Bearer ${validToken}` },
        payload: {
          replyToken: 'unknown-token',
          messages: [{ type: 'text', text: 'hello back' }],
        },
      })

      await app.close()
      expect(res.statusCode).toBe(400)
      const body = JSON.parse(res.body)
      expect(body.code).toBe('INVALID_REPLY_TOKEN')
      expect(body.message).toBe('Reply token not_found')
    })

    it('returns 400 for expired reply token', async () => {
      const mockDb = makeMockDb([{ oaId, token: validToken, expiresAt: null }], [])
      const { app } = createTestApp(
        mockDb,
        undefined,
        undefined,
        undefined,
        undefined,
        vi.fn(() => Promise.resolve({ valid: false, reason: 'expired' as const })),
      )
      await app.ready()

      const res = await app.inject({
        method: 'POST',
        url: oaApiPath('/bot/message/reply'),
        headers: { authorization: `Bearer ${validToken}` },
        payload: {
          replyToken: 'expired-token',
          messages: [{ type: 'text', text: 'hello back' }],
        },
      })

      await app.close()
      expect(res.statusCode).toBe(400)
      const body = JSON.parse(res.body)
      expect(body.code).toBe('INVALID_REPLY_TOKEN')
      expect(body.message).toBe('Reply token expired')
    })

    it('returns 400 for already_used reply token', async () => {
      const mockDb = makeMockDb([{ oaId, token: validToken, expiresAt: null }], [])
      const { app } = createTestApp(
        mockDb,
        undefined,
        undefined,
        undefined,
        undefined,
        vi.fn(() => Promise.resolve({ valid: false, reason: 'already_used' as const })),
      )
      await app.ready()

      const res = await app.inject({
        method: 'POST',
        url: oaApiPath('/bot/message/reply'),
        headers: { authorization: `Bearer ${validToken}` },
        payload: {
          replyToken: 'used-token',
          messages: [{ type: 'text', text: 'hello back' }],
        },
      })

      await app.close()
      expect(res.statusCode).toBe(400)
      const body = JSON.parse(res.body)
      expect(body.code).toBe('INVALID_REPLY_TOKEN')
      expect(body.message).toBe('Reply token already_used')
    })
  })
})
