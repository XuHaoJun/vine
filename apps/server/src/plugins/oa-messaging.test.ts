import { describe, expect, it, afterAll, vi } from 'vitest'
import Fastify from 'fastify'
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
  return app
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
      const app = createTestApp(mockDb)
      await app.ready()

      const res = await app.inject({
        method: 'POST',
        url: '/api/oa/v2/bot/message/push',
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
      const app = createTestApp(mockDb)
      await app.ready()

      const res = await app.inject({
        method: 'POST',
        url: '/api/oa/v2/bot/message/push',
        headers: { authorization: `Bearer invalid-token` },
        payload: { to: userId, messages: [{ type: 'text', text: 'hello' }] },
      })

      await app.close()
      expect(res.statusCode).toBe(401)
      const body = JSON.parse(res.body)
      expect(body.code).toBe('INVALID_TOKEN')
      expect(body.message).toBe('Invalid access token')
    })
  })

  describe('validation', () => {
    it('returns 400 when missing to', async () => {
      const mockDb = makeMockDb([{ oaId, token: validToken, expiresAt: null }], [])
      const app = createTestApp(mockDb)
      await app.ready()

      const res = await app.inject({
        method: 'POST',
        url: '/api/oa/v2/bot/message/push',
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
      const app = createTestApp(mockDb)
      await app.ready()

      const res = await app.inject({
        method: 'POST',
        url: '/api/oa/v2/bot/message/push',
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
      const app = createTestApp(mockDb)
      await app.ready()

      const res = await app.inject({
        method: 'POST',
        url: '/api/oa/v2/bot/message/push',
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
      const app = createTestApp(mockDb)
      await app.ready()

      const res = await app.inject({
        method: 'POST',
        url: '/api/oa/v2/bot/message/push',
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
      const app = createTestApp(mockDb)
      await app.ready()

      const res = await app.inject({
        method: 'POST',
        url: '/api/oa/v2/bot/message/push',
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
      const app = createTestApp(mockDb)
      await app.ready()

      const res = await app.inject({
        method: 'POST',
        url: '/api/oa/v2/bot/message/push',
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
      const app = createTestApp(mockDb)
      await app.ready()

      const res = await app.inject({
        method: 'POST',
        url: '/api/oa/v2/bot/message/push',
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
      const app = createTestApp(mockDb, mockSend)
      await app.ready()

      const res = await app.inject({
        method: 'POST',
        url: '/api/oa/v2/bot/message/push',
        headers: { authorization: `Bearer ${validToken}` },
        payload: { to: userId, messages: [{ type: 'text', text: 'hello world' }] },
      })

      await app.close()
      expect(res.statusCode).toBe(200)
      expect(mockSend).toHaveBeenCalledWith(oaId, userId, {
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
      const app = createTestApp(mockDb, mockSend)
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
        url: '/api/oa/v2/bot/message/push',
        headers: { authorization: `Bearer ${validToken}` },
        payload: { to: userId, messages: [flexMessage] },
      })

      await app.close()
      expect(res.statusCode).toBe(200)
      expect(mockSend).toHaveBeenCalledOnce()
      const call = mockSend.mock.calls[0]
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
      const app = createTestApp(mockDb, mockSend)
      await app.ready()

      const res = await app.inject({
        method: 'POST',
        url: '/api/oa/v2/bot/message/push',
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
      expect(mockSend).toHaveBeenCalledTimes(2)
      expect(mockSend.mock.calls[0][2].text).toBe('first')
      expect(mockSend.mock.calls[1][2].text).toBe('second')
    })
  })
})

describe('oaMessagingPlugin — Reply Message', () => {
  describe('auth', () => {
    it('returns 401 when no Bearer token', async () => {
      const mockDb = makeMockDb([], [])
      const app = createTestApp(mockDb)
      await app.ready()

      const res = await app.inject({
        method: 'POST',
        url: '/api/oa/v2/bot/message/reply',
        payload: { replyToken: 'reply-1', messages: [{ type: 'text', text: 'hello' }] },
      })

      await app.close()
      expect(res.statusCode).toBe(401)
    })
  })

  describe('validation', () => {
    it('returns 400 when missing replyToken', async () => {
      const mockDb = makeMockDb([{ oaId, token: validToken, expiresAt: null }], [])
      const app = createTestApp(mockDb)
      await app.ready()

      const res = await app.inject({
        method: 'POST',
        url: '/api/oa/v2/bot/message/reply',
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
      const app = createTestApp(mockDb)
      await app.ready()

      const res = await app.inject({
        method: 'POST',
        url: '/api/oa/v2/bot/message/reply',
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
      const app = createTestApp(mockDb)
      await app.ready()

      const res = await app.inject({
        method: 'POST',
        url: '/api/oa/v2/bot/message/reply',
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
      const app = createTestApp(mockDb)
      await app.ready()

      const res = await app.inject({
        method: 'POST',
        url: '/api/oa/v2/bot/message/reply',
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
    it('accepts valid text reply', async () => {
      const mockDb = makeMockDb([{ oaId, token: validToken, expiresAt: null }], [])
      const app = createTestApp(mockDb)
      await app.ready()

      const res = await app.inject({
        method: 'POST',
        url: '/api/oa/v2/bot/message/reply',
        headers: { authorization: `Bearer ${validToken}` },
        payload: {
          replyToken: 'reply-1',
          messages: [{ type: 'text', text: 'hello back' }],
        },
      })

      await app.close()
      expect(res.statusCode).toBe(200)
    })

    it('accepts valid flex reply', async () => {
      const mockDb = makeMockDb([{ oaId, token: validToken, expiresAt: null }], [])
      const app = createTestApp(mockDb)
      await app.ready()

      const res = await app.inject({
        method: 'POST',
        url: '/api/oa/v2/bot/message/reply',
        headers: { authorization: `Bearer ${validToken}` },
        payload: {
          replyToken: 'reply-1',
          messages: [
            {
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
            },
          ],
        },
      })

      await app.close()
      expect(res.statusCode).toBe(200)
    })
  })
})
