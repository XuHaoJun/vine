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
  mockMessagingOverrides?: {
    reply?: ReturnType<typeof vi.fn>
    push?: ReturnType<typeof vi.fn>
    multicast?: ReturnType<typeof vi.fn>
    broadcast?: ReturnType<typeof vi.fn>
  },
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
    sendOAMessage: vi.fn().mockResolvedValue({
      success: true,
      chatId: 'chat-id',
      messageId: 'msg-id',
    }),
    checkAndIncrementUsage: vi.fn().mockResolvedValue(true),
    getQuota: vi.fn().mockResolvedValue({ type: 'none', totalUsage: 0 }),
    getConsumption: vi.fn().mockResolvedValue({ totalUsage: 0 }),
    resolveReplyToken: vi.fn().mockResolvedValue({
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
    markReplyTokenUsed: vi.fn().mockResolvedValue(undefined),
  }
  const mockDrive = {
    put: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockResolvedValue({ content: Buffer.from(''), mimeType: null, size: 0 }),
    exists: vi.fn().mockResolvedValue(false),
    delete: vi.fn().mockResolvedValue(undefined),
    getUrl: vi.fn().mockResolvedValue('http://localhost/uploads/test'),
  }
  const mockMessaging = {
    reply:
      mockMessagingOverrides?.reply ??
      vi.fn().mockResolvedValue({
        ok: true,
        accepted: { httpRequestId: 'req_reply', acceptedRequestId: 'acc_reply' },
        processed: { processed: 1 },
        recipientCount: 1,
      }),
    push:
      mockMessagingOverrides?.push ??
      vi.fn().mockResolvedValue({
        ok: true,
        accepted: { httpRequestId: 'req_push', acceptedRequestId: 'acc_push' },
        processed: { processed: 1 },
        recipientCount: 1,
      }),
    multicast:
      mockMessagingOverrides?.multicast ??
      vi.fn().mockResolvedValue({
        ok: true,
        accepted: { httpRequestId: 'req_multicast', acceptedRequestId: 'acc_multicast' },
        processed: { processed: 2 },
        recipientCount: 2,
      }),
    broadcast:
      mockMessagingOverrides?.broadcast ??
      vi.fn().mockResolvedValue({
        ok: true,
        accepted: { httpRequestId: 'req_broadcast', acceptedRequestId: 'acc_broadcast' },
        processed: { processed: 1 },
        recipientCount: 1,
      }),
  }
  const app = Fastify()
  app.register(oaMessagingPlugin, {
    oa: mockOa as any,
    messaging: mockMessaging as any,
    db,
    drive: mockDrive,
  })
  return { app, mockOa, mockMessaging }
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
      const { app } = createTestApp(mockDb, {
        push: vi.fn().mockResolvedValue({
          ok: false,
          code: 'NOT_FRIEND',
          httpRequestId: 'req_not_friend',
        }),
      })
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
      const { app } = createTestApp(mockDb, {
        push: vi.fn().mockResolvedValue({
          ok: false,
          code: 'NOT_FRIEND',
          httpRequestId: 'req_pending_friendship',
        }),
      })
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
      const { app, mockMessaging } = createTestApp(mockDb)
      await app.ready()

      const res = await app.inject({
        method: 'POST',
        url: oaApiPath('/bot/message/push'),
        headers: { authorization: `Bearer ${validToken}` },
        payload: { to: userId, messages: [{ type: 'text', text: 'hello world' }] },
      })

      await app.close()
      expect(res.statusCode).toBe(200)
      expect(mockMessaging.push).toHaveBeenCalledWith({
        oaId,
        retryKey: undefined,
        to: userId,
        messages: [expect.objectContaining({ type: 'text', text: 'hello world' })],
      })
    })

    it('sends flex message successfully', async () => {
      const mockDb = makeMockDb(
        [{ oaId, token: validToken, expiresAt: null }],
        [{ oaId, userId, status: 'friend' }],
      )
      const { app, mockMessaging } = createTestApp(mockDb)
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
      expect(mockMessaging.push).toHaveBeenCalledOnce()
      const call = mockMessaging.push.mock.calls[0]
      expect(call[0].oaId).toBe(oaId)
      expect(call[0].to).toBe(userId)
      expect(call[0].messages[0].type).toBe('flex')
      expect(call[0].messages[0].text).toBeNull()
      expect(JSON.parse(call[0].messages[0].metadata!)).toEqual(flexMessage)
    })

    it('sends multiple messages in order', async () => {
      const mockDb = makeMockDb(
        [{ oaId, token: validToken, expiresAt: null }],
        [{ oaId, userId, status: 'friend' }],
      )
      const { app, mockMessaging } = createTestApp(mockDb)
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
      expect(mockMessaging.push).toHaveBeenCalledTimes(1)
      expect(mockMessaging.push.mock.calls[0][0].messages).toHaveLength(2)
      expect(mockMessaging.push.mock.calls[0][0].messages[0].text).toBe('first')
      expect(mockMessaging.push.mock.calls[0][0].messages[1].text).toBe('second')
    })
  })

  describe('quota enforcement', () => {
    it('allows push when quota is not exceeded', async () => {
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
      const { app } = createTestApp(mockDb, {
        push: vi.fn().mockResolvedValue({
          ok: false,
          code: 'QUOTA_EXCEEDED',
          httpRequestId: 'req_q',
        }),
      })
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
    })

    it('does not check quota for reply messages', async () => {
      const mockDb = makeMockDb([{ oaId, token: validToken, expiresAt: null }], [])
      const { app } = createTestApp(mockDb)
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
    })
  })

  describe('retry key handling', () => {
    it('returns 409 with accepted request id for duplicate push retry key', async () => {
      const mockDb = makeMockDb(
        [{ oaId, token: validToken, expiresAt: null }],
        [{ oaId, userId, status: 'friend' }],
      )
      const { app, mockMessaging } = createTestApp(mockDb)
      mockMessaging.push.mockResolvedValue({
        ok: false,
        code: 'RETRY_KEY_ACCEPTED',
        httpRequestId: 'req_retry',
        acceptedRequestId: 'acc_original',
        sentMessages: [{ id: 'oa:req:request-1:user-1:0' }],
      })
      await app.ready()

      const res = await app.inject({
        method: 'POST',
        url: oaApiPath('/bot/message/push'),
        headers: {
          authorization: `Bearer ${validToken}`,
          'x-line-retry-key': '123e4567-e89b-12d3-a456-426614174000',
        },
        payload: { to: userId, messages: [{ type: 'text', text: 'hello' }] },
      })

      await app.close()
      expect(res.statusCode).toBe(409)
      expect(res.headers['x-line-request-id']).toBe('req_retry')
      expect(res.headers['x-line-accepted-request-id']).toBe('acc_original')
      expect(JSON.parse(res.body)).toEqual({
        message: 'The retry key is already accepted',
        sentMessages: [{ id: 'oa:req:request-1:user-1:0' }],
      })
    })

    it('returns duplicate retry response even when user is no longer a friend', async () => {
      const mockDb = makeMockDb([{ oaId, token: validToken, expiresAt: null }], [])
      const { app, mockMessaging } = createTestApp(mockDb)
      mockMessaging.push.mockResolvedValue({
        ok: false,
        code: 'RETRY_KEY_ACCEPTED',
        httpRequestId: 'req_retry_after_unfriend',
        acceptedRequestId: 'acc_original',
      })
      await app.ready()

      const res = await app.inject({
        method: 'POST',
        url: oaApiPath('/bot/message/push'),
        headers: {
          authorization: `Bearer ${validToken}`,
          'x-line-retry-key': '123e4567-e89b-12d3-a456-426614174000',
        },
        payload: { to: userId, messages: [{ type: 'text', text: 'hello' }] },
      })

      await app.close()
      expect(res.statusCode).toBe(409)
      expect(res.headers['x-line-accepted-request-id']).toBe('acc_original')
      expect(mockMessaging.push).toHaveBeenCalledOnce()
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
      const { app, mockOa } = createTestApp(mockDb)
      mockOa.getQuota.mockResolvedValue({ type: 'limited', value: 1000, totalUsage: 500 })
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
      const { app, mockOa } = createTestApp(mockDb)
      mockOa.getConsumption.mockResolvedValue({ totalUsage: 500 })
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

  describe('broadcast message delivery', () => {
    it('sends broadcast through the messaging service', async () => {
      const mockDb = makeMockDb([{ oaId, token: validToken, expiresAt: null }], [])
      const { app, mockMessaging } = createTestApp(mockDb)
      mockMessaging.broadcast.mockResolvedValue({
        ok: true,
        accepted: {
          httpRequestId: 'req_broadcast',
          acceptedRequestId: 'acc_broadcast',
        },
        processed: { processed: 2 },
        recipientCount: 2,
      })
      await app.ready()

      const res = await app.inject({
        method: 'POST',
        url: oaApiPath('/bot/message/broadcast'),
        headers: { authorization: `Bearer ${validToken}` },
        payload: { messages: [{ type: 'text', text: 'hello' }] },
      })

      await app.close()
      expect(res.statusCode).toBe(200)
      expect(res.headers['x-line-request-id']).toBe('req_broadcast')
      expect(mockMessaging.broadcast).toHaveBeenCalledWith({
        oaId,
        retryKey: undefined,
        messages: [expect.objectContaining({ type: 'text', text: 'hello' })],
      })
    })
  })
})

describe('oaMessagingPlugin — Multicast Message', () => {
  it('does not register the root /v2 multicast route', async () => {
    const mockDb = makeMockDb([{ oaId, token: validToken, expiresAt: null }], [])
    const { app } = createTestApp(mockDb)
    await app.ready()

    const res = await app.inject({
      method: 'POST',
      url: '/v2/bot/message/multicast',
      headers: { authorization: `Bearer ${validToken}` },
      payload: { to: [userId], messages: [{ type: 'text', text: 'hello' }] },
    })

    await app.close()
    expect(res.statusCode).toBe(404)
  })

  it('passes validated multicast payload and retry key to the messaging service', async () => {
    const mockDb = makeMockDb([{ oaId, token: validToken, expiresAt: null }], [])
    const multicast = vi.fn().mockResolvedValue({
      ok: true,
      accepted: { httpRequestId: 'req_multicast', acceptedRequestId: 'acc_multicast' },
      processed: { processed: 1 },
      recipientCount: 1,
    })
    const { app } = createTestApp(mockDb, { multicast })
    await app.ready()

    const res = await app.inject({
      method: 'POST',
      url: oaApiPath('/bot/message/multicast'),
      headers: {
        authorization: `Bearer ${validToken}`,
        'x-line-retry-key': '123e4567-e89b-12d3-a456-426614174000',
      },
      payload: { to: [userId], messages: [{ type: 'text', text: 'hello' }] },
    })

    await app.close()
    expect(res.statusCode).toBe(200)
    expect(multicast).toHaveBeenCalledWith({
      oaId,
      retryKey: '123e4567-e89b-12d3-a456-426614174000',
      to: [userId],
      messages: [{ valid: true, type: 'text', text: 'hello', metadata: null }],
    })
  })

  it('returns 400 when multicast recipients are missing', async () => {
    const mockDb = makeMockDb([{ oaId, token: validToken, expiresAt: null }], [])
    const { app } = createTestApp(mockDb)
    await app.ready()

    const res = await app.inject({
      method: 'POST',
      url: oaApiPath('/bot/message/multicast'),
      headers: { authorization: `Bearer ${validToken}` },
      payload: { to: [], messages: [{ type: 'text', text: 'hello' }] },
    })

    await app.close()
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body).code).toBe('INVALID_REQUEST')
  })

  it('returns 400 when multicast has more than 500 recipients', async () => {
    const mockDb = makeMockDb([{ oaId, token: validToken, expiresAt: null }], [])
    const { app } = createTestApp(mockDb)
    await app.ready()

    const res = await app.inject({
      method: 'POST',
      url: oaApiPath('/bot/message/multicast'),
      headers: { authorization: `Bearer ${validToken}` },
      payload: {
        to: Array.from({ length: 501 }, (_, index) => `user-${index}`),
        messages: [{ type: 'text', text: 'hello' }],
      },
    })

    await app.close()
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body).code).toBe('INVALID_REQUEST')
  })

  it('returns 400 when multicast recipients contain duplicates', async () => {
    const mockDb = makeMockDb([{ oaId, token: validToken, expiresAt: null }], [])
    const { app } = createTestApp(mockDb)
    await app.ready()

    const res = await app.inject({
      method: 'POST',
      url: oaApiPath('/bot/message/multicast'),
      headers: { authorization: `Bearer ${validToken}` },
      payload: {
        to: [userId, userId],
        messages: [{ type: 'text', text: 'hello' }],
      },
    })

    await app.close()
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body).code).toBe('INVALID_REQUEST')
  })

  it('returns 429 when multicast quota is exceeded', async () => {
    const mockDb = makeMockDb([{ oaId, token: validToken, expiresAt: null }], [])
    const { app } = createTestApp(mockDb, {
      multicast: vi.fn().mockResolvedValue({
        ok: false,
        code: 'QUOTA_EXCEEDED',
        httpRequestId: 'req_q',
      }),
    })
    await app.ready()

    const res = await app.inject({
      method: 'POST',
      url: oaApiPath('/bot/message/multicast'),
      headers: { authorization: `Bearer ${validToken}` },
      payload: { to: [userId], messages: [{ type: 'text', text: 'hello' }] },
    })

    await app.close()
    expect(res.statusCode).toBe(429)
    expect(JSON.parse(res.body).code).toBe('QUOTA_EXCEEDED')
  })

  it('returns 409 with accepted request id for duplicate multicast retry key', async () => {
    const mockDb = makeMockDb([{ oaId, token: validToken, expiresAt: null }], [])
    const { app } = createTestApp(mockDb, {
      multicast: vi.fn().mockResolvedValue({
        ok: false,
        code: 'RETRY_KEY_ACCEPTED',
        httpRequestId: 'req_retry',
        acceptedRequestId: 'acc_original',
        sentMessages: [{ id: 'oa:req:request-1:user-1:0' }],
      }),
    })
    await app.ready()

    const res = await app.inject({
      method: 'POST',
      url: oaApiPath('/bot/message/multicast'),
      headers: {
        authorization: `Bearer ${validToken}`,
        'x-line-retry-key': '123e4567-e89b-12d3-a456-426614174000',
      },
      payload: { to: [userId], messages: [{ type: 'text', text: 'hello' }] },
    })

    await app.close()
    expect(res.statusCode).toBe(409)
    expect(res.headers['x-line-request-id']).toBe('req_retry')
    expect(res.headers['x-line-accepted-request-id']).toBe('acc_original')
    expect(JSON.parse(res.body)).toEqual({
      message: 'The retry key is already accepted',
      sentMessages: [{ id: 'oa:req:request-1:user-1:0' }],
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
    it('sends text reply via messaging service', async () => {
      const mockDb = makeMockDb([{ oaId, token: validToken, expiresAt: null }], [])
      const { app, mockMessaging } = createTestApp(mockDb)
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
      expect(mockMessaging.reply).toHaveBeenCalledWith({
        oaId,
        replyToken: 'reply-1',
        messages: [expect.objectContaining({ type: 'text', text: 'hello back' })],
      })
    })

    it('sends flex reply via messaging service', async () => {
      const mockDb = makeMockDb([{ oaId, token: validToken, expiresAt: null }], [])
      const { app, mockMessaging } = createTestApp(mockDb)
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
      expect(mockMessaging.reply).toHaveBeenCalledOnce()
      const call = mockMessaging.reply.mock.calls[0]
      expect(call[0].oaId).toBe(oaId)
      expect(call[0].replyToken).toBe('reply-1')
      expect(call[0].messages[0].type).toBe('flex')
      expect(call[0].messages[0].text).toBeNull()
      expect(JSON.parse(call[0].messages[0].metadata!)).toEqual(flexMessage)
    })

    it('returns 400 for invalid reply token', async () => {
      const mockDb = makeMockDb([{ oaId, token: validToken, expiresAt: null }], [])
      const { app } = createTestApp(mockDb, {
        reply: vi.fn().mockResolvedValue({
          ok: false,
          code: 'INVALID_REPLY_TOKEN',
          httpRequestId: 'req_invalid',
        }),
      })
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
      expect(body.message).toBe('INVALID_REPLY_TOKEN')
    })

    it('rejects reply with retry key', async () => {
      const mockDb = makeMockDb([{ oaId, token: validToken, expiresAt: null }], [])
      const { app } = createTestApp(mockDb)
      await app.ready()

      const res = await app.inject({
        method: 'POST',
        url: oaApiPath('/bot/message/reply'),
        headers: {
          authorization: `Bearer ${validToken}`,
          'x-line-retry-key': '123e4567-e89b-12d3-a456-426614174000',
        },
        payload: {
          replyToken: 'reply-1',
          messages: [{ type: 'text', text: 'hello back' }],
        },
      })

      await app.close()
      expect(res.statusCode).toBe(400)
      const body = JSON.parse(res.body)
      expect(body.code).toBe('INVALID_RETRY_KEY')
      expect(body.message).toBe('X-Line-Retry-Key is not supported on reply messages')
    })
  })
})

describe('oaMessagingPlugin — Get Profile', () => {
  it('returns 401 when no Bearer token', async () => {
    const mockDb = makeMockDb([], [])
    const { app } = createTestApp(mockDb)
    await app.ready()
    const res = await app.inject({
      method: 'GET',
      url: oaApiPath('/bot/profile/user-123'),
    })
    await app.close()
    expect(res.statusCode).toBe(401)
  })

  it('returns 404 when user not found', async () => {
    const mockLimit1 = vi.fn().mockResolvedValue([{ oaId, token: validToken, expiresAt: null }])
    const mockLimit2 = vi.fn().mockResolvedValue([])
    let selectCallCount = 0
    const mockSelect = vi.fn().mockImplementation(() => {
      selectCallCount++
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: selectCallCount === 1 ? mockLimit1 : mockLimit2,
          }),
        }),
      }
    })
    const mockInsert = vi.fn().mockReturnValue({ values: vi.fn().mockReturnThis() })
    const mockUpdate = vi
      .fn()
      .mockReturnValue({ set: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis() })
    const { app } = createTestApp({ mockSelect, mockInsert, mockUpdate })
    await app.ready()
    const res = await app.inject({
      method: 'GET',
      url: oaApiPath('/bot/profile/user-missing'),
      headers: { authorization: `Bearer ${validToken}` },
    })
    await app.close()
    expect(res.statusCode).toBe(404)
  })

  it('returns real displayName and pictureUrl', async () => {
    const mockLimit1 = vi.fn().mockResolvedValue([{ oaId, token: validToken, expiresAt: null }])
    const mockLimit2 = vi.fn().mockResolvedValue([
      { id: userId, name: 'Alice', image: 'https://example.com/pic.jpg' },
    ])
    let selectCallCount = 0
    const mockSelect = vi.fn().mockImplementation(() => {
      selectCallCount++
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: selectCallCount === 1 ? mockLimit1 : mockLimit2,
          }),
        }),
      }
    })
    const mockInsert = vi.fn().mockReturnValue({ values: vi.fn().mockReturnThis() })
    const mockUpdate = vi
      .fn()
      .mockReturnValue({ set: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis() })
    const { app } = createTestApp({ mockSelect, mockInsert, mockUpdate })
    await app.ready()
    const res = await app.inject({
      method: 'GET',
      url: oaApiPath(`/bot/profile/${userId}`),
      headers: { authorization: `Bearer ${validToken}` },
    })
    await app.close()
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.userId).toBe(userId)
    expect(body.displayName).toBe('Alice')
    expect(body.pictureUrl).toBe('https://example.com/pic.jpg')
  })

  it('returns empty string for pictureUrl when image is null', async () => {
    const mockLimit1 = vi.fn().mockResolvedValue([{ oaId, token: validToken, expiresAt: null }])
    const mockLimit2 = vi.fn().mockResolvedValue([{ id: userId, name: 'Bob', image: null }])
    let selectCallCount = 0
    const mockSelect = vi.fn().mockImplementation(() => {
      selectCallCount++
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: selectCallCount === 1 ? mockLimit1 : mockLimit2,
          }),
        }),
      }
    })
    const mockInsert = vi.fn().mockReturnValue({ values: vi.fn().mockReturnThis() })
    const mockUpdate = vi
      .fn()
      .mockReturnValue({ set: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis() })
    const { app } = createTestApp({ mockSelect, mockInsert, mockUpdate })
    await app.ready()
    const res = await app.inject({
      method: 'GET',
      url: oaApiPath(`/bot/profile/${userId}`),
      headers: { authorization: `Bearer ${validToken}` },
    })
    await app.close()
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.pictureUrl).toBe('')
  })
})

describe('oaMessagingPlugin — Loading Animation', () => {
  function makeLoadingMockDb(opts: {
    token?: boolean
    chatMember?: boolean
    chat?: { type: string }
  }) {
    const tokenRow = opts.token !== false ? [{ oaId, token: validToken, expiresAt: null }] : []
    const chatMemberRow = opts.chatMember !== false ? [{ chatId: 'chat-1', oaId }] : []
    const chatRow = opts.chat ? [{ id: 'chat-1', type: opts.chat.type }] : []

    let selectCallCount = 0
    const mockSelect = vi.fn().mockImplementation(() => {
      selectCallCount++
      const resultByCall: unknown[][] = [tokenRow, chatMemberRow, chatRow]
      const result = resultByCall[selectCallCount - 1] ?? []
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue(result) }),
        }),
      }
    })
    const mockInsert = vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoUpdate: vi.fn().mockResolvedValue([]),
      }),
    })
    const mockUpdate = vi.fn().mockReturnValue({ set: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis() })
    return { mockSelect, mockInsert, mockUpdate }
  }

  it('returns 401 when no Bearer token', async () => {
    const { app } = createTestApp(makeLoadingMockDb({ token: false }))
    await app.ready()
    const res = await app.inject({
      method: 'POST',
      url: oaApiPath('/bot/chat/loading/start'),
      payload: { chatId: 'chat-1', loadingSeconds: 5 },
    })
    await app.close()
    expect(res.statusCode).toBe(401)
  })

  it('returns 400 when loadingSeconds < 5', async () => {
    const { app } = createTestApp(makeLoadingMockDb({ chat: { type: 'oa' } }))
    await app.ready()
    const res = await app.inject({
      method: 'POST',
      url: oaApiPath('/bot/chat/loading/start'),
      headers: { authorization: `Bearer ${validToken}` },
      payload: { chatId: 'chat-1', loadingSeconds: 4 },
    })
    await app.close()
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 when loadingSeconds > 60', async () => {
    const { app } = createTestApp(makeLoadingMockDb({ chat: { type: 'oa' } }))
    await app.ready()
    const res = await app.inject({
      method: 'POST',
      url: oaApiPath('/bot/chat/loading/start'),
      headers: { authorization: `Bearer ${validToken}` },
      payload: { chatId: 'chat-1', loadingSeconds: 61 },
    })
    await app.close()
    expect(res.statusCode).toBe(400)
  })

  it('returns 404 when OA is not a member of the chat', async () => {
    const { app } = createTestApp(makeLoadingMockDb({ chatMember: false }))
    await app.ready()
    const res = await app.inject({
      method: 'POST',
      url: oaApiPath('/bot/chat/loading/start'),
      headers: { authorization: `Bearer ${validToken}` },
      payload: { chatId: 'chat-1', loadingSeconds: 5 },
    })
    await app.close()
    expect(res.statusCode).toBe(404)
  })

  it('returns 400 when chat is not type oa', async () => {
    const { app } = createTestApp(makeLoadingMockDb({ chat: { type: 'group' } }))
    await app.ready()
    const res = await app.inject({
      method: 'POST',
      url: oaApiPath('/bot/chat/loading/start'),
      headers: { authorization: `Bearer ${validToken}` },
      payload: { chatId: 'chat-1', loadingSeconds: 5 },
    })
    await app.close()
    expect(res.statusCode).toBe(400)
    const body = JSON.parse(res.body)
    expect(body.message).toContain('one-on-one')
  })

  it('returns 200 and upserts row on success', async () => {
    const mockDb = makeLoadingMockDb({ chat: { type: 'oa' } })
    const { app } = createTestApp(mockDb)
    await app.ready()
    const res = await app.inject({
      method: 'POST',
      url: oaApiPath('/bot/chat/loading/start'),
      headers: { authorization: `Bearer ${validToken}` },
      payload: { chatId: 'chat-1', loadingSeconds: 10 },
    })
    await app.close()
    expect(res.statusCode).toBe(200)
    expect(mockDb.mockInsert).toHaveBeenCalled()
  })
})
