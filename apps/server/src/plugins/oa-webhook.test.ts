import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import Fastify from 'fastify'
import { oaWebhookPlugin } from './oa-webhook'

vi.mock('@take-out/better-auth-utils/server', () => ({
  getAuthDataFromRequest: vi.fn(),
}))

import { getAuthDataFromRequest } from '@take-out/better-auth-utils/server'

const mockedAuth = vi.mocked(getAuthDataFromRequest)

const oaId = 'oa-1'
const userId = 'user-1'
const chatId = 'chat-1'
const channelSecret = 'secret'

type AppOpts = {
  account?: unknown
  webhook?: unknown
  /** chatMember rows returned for the user lookup. Defaults to a single
   *  matching row so the membership check passes. */
  chatMember?: Array<{ id: string }>
}

function createTestApp(opts: AppOpts = {}) {
  const oa = {
    getOfficialAccount: vi.fn().mockResolvedValue(opts.account ?? null),
    getWebhook: vi.fn().mockResolvedValue(opts.webhook ?? null),
    registerReplyToken: vi.fn().mockResolvedValue({
      id: 'token-1',
      oaId,
      token: 'reply-token-xyz',
      userId,
      chatId,
      messageId: null,
      used: false,
      expiresAt: new Date(Date.now() + 1800_000).toISOString(),
    }),
    buildMessageEvent: vi.fn().mockImplementation((input) => ({
      destination: input.oaId,
      events: [
        {
          type: 'message',
          replyToken: input.replyToken,
          source: { type: 'user', userId: input.userId },
          message: { type: 'text', id: input.messageId, text: input.text },
        },
      ],
    })),
    buildPostbackEvent: vi.fn().mockImplementation((input) => ({
      destination: input.oaId,
      events: [
        {
          type: 'postback',
          replyToken: input.replyToken,
          source: { type: 'user', userId: input.userId },
          postback: input.params
            ? { data: input.data, params: input.params }
            : { data: input.data },
        },
      ],
    })),
    generateWebhookSignature: vi.fn().mockReturnValue('sig-fake'),
  }

  const memberRows = opts.chatMember ?? [{ id: 'cm-1' }]
  const db = {
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(undefined),
    }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(memberRows),
        }),
      }),
    }),
  }

  const auth = {} as any
  const webhookDelivery = {
    deliverRealEvent: vi.fn().mockResolvedValue({ kind: 'ok' }),
    verifyWebhook: vi.fn(),
    sendTestWebhookEvent: vi.fn(),
    listDeliveries: vi.fn(),
    getDelivery: vi.fn(),
    redeliver: vi.fn(),
    cleanupExpiredDeliveries: vi.fn(),
  }

  const app = Fastify()
  app.register(oaWebhookPlugin, { oa: oa as any, db: db as any, auth, webhookDelivery })
  return { app, oa, db, webhookDelivery }
}

beforeEach(() => {
  mockedAuth.mockReset()
  // Default: authenticated as `userId`. Individual tests override as needed.
  mockedAuth.mockResolvedValue({ id: userId } as any)
  vi.unstubAllGlobals()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('POST /api/oa/internal/dispatch-postback', () => {
  it('dispatches a postback event to the OA webhook via delivery service', async () => {
    const { app, oa, webhookDelivery } = createTestApp({
      account: { id: oaId, channelSecret },
      webhook: { oaId, url: 'https://hook.example/bot', status: 'verified' },
    })
    await app.ready()

    const res = await app.inject({
      method: 'POST',
      url: '/api/oa/internal/dispatch-postback',
      payload: { oaId, chatId, data: 'action=buy&id=1' },
    })

    await app.close()
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toEqual({ success: true })

    expect(webhookDelivery.deliverRealEvent).toHaveBeenCalledWith({
      oaId,
      buildPayload: expect.any(Function),
    })

    const buildPayload = webhookDelivery.deliverRealEvent.mock.calls[0]![0].buildPayload
    const payload = await buildPayload()
    expect(oa.registerReplyToken).toHaveBeenCalledWith({
      oaId,
      userId,
      chatId,
      messageId: null,
    })
    expect(payload).toEqual({
      destination: oaId,
      events: [
        {
          type: 'postback',
          replyToken: 'reply-token-xyz',
          source: { type: 'user', userId },
          postback: { data: 'action=buy&id=1' },
        },
      ],
    })
  })

  it('forwards datetimepicker params', async () => {
    const { app, oa, webhookDelivery } = createTestApp({
      account: { id: oaId, channelSecret },
      webhook: { oaId, url: 'https://hook.example/bot', status: 'verified' },
    })
    await app.ready()

    await app.inject({
      method: 'POST',
      url: '/api/oa/internal/dispatch-postback',
      payload: {
        oaId,
        chatId,
        data: 'action=pick',
        params: { datetime: '2026-04-19T14:30' },
      },
    })
    await app.close()

    const buildPayload = webhookDelivery.deliverRealEvent.mock.calls[0]![0].buildPayload
    const payload = await buildPayload()
    expect(oa.registerReplyToken).toHaveBeenCalledWith({
      oaId,
      userId,
      chatId,
      messageId: null,
    })
    expect(payload).toEqual({
      destination: oaId,
      events: [
        {
          type: 'postback',
          replyToken: 'reply-token-xyz',
          source: { type: 'user', userId },
          postback: { data: 'action=pick', params: { datetime: '2026-04-19T14:30' } },
        },
      ],
    })
  })

  it('returns 401 when there is no session', async () => {
    mockedAuth.mockResolvedValue(null as any)
    const { app, oa, webhookDelivery } = createTestApp({
      account: { id: oaId, channelSecret },
      webhook: { oaId, url: 'https://hook.example/bot', status: 'verified' },
    })
    await app.ready()

    const res = await app.inject({
      method: 'POST',
      url: '/api/oa/internal/dispatch-postback',
      payload: { oaId, chatId, data: 'x' },
    })
    await app.close()
    expect(res.statusCode).toBe(401)
    // Critical: no side effects when unauthenticated.
    expect(oa.registerReplyToken).not.toHaveBeenCalled()
    expect(webhookDelivery.deliverRealEvent).not.toHaveBeenCalled()
  })

  it('returns 403 when the session user is not a member of chatId', async () => {
    const { app, oa, webhookDelivery } = createTestApp({
      account: { id: oaId, channelSecret },
      webhook: { oaId, url: 'https://hook.example/bot', status: 'verified' },
      chatMember: [], // membership lookup returns no rows
    })
    await app.ready()

    const res = await app.inject({
      method: 'POST',
      url: '/api/oa/internal/dispatch-postback',
      payload: { oaId, chatId, data: 'x' },
    })
    await app.close()
    expect(res.statusCode).toBe(403)
    // Critical: no postback dispatched when membership check fails.
    expect(oa.registerReplyToken).not.toHaveBeenCalled()
    expect(webhookDelivery.deliverRealEvent).not.toHaveBeenCalled()
  })

  it('returns 404 when OA does not exist', async () => {
    const { app, webhookDelivery } = createTestApp()
    webhookDelivery.deliverRealEvent.mockResolvedValueOnce({ kind: 'oa-not-found' })
    await app.ready()

    const res = await app.inject({
      method: 'POST',
      url: '/api/oa/internal/dispatch-postback',
      payload: { oaId, chatId, data: 'x' },
    })
    await app.close()
    expect(res.statusCode).toBe(404)
  })

  it('returns 400 when webhook is not configured', async () => {
    const { app, webhookDelivery } = createTestApp()
    webhookDelivery.deliverRealEvent.mockResolvedValueOnce({ kind: 'webhook-not-ready' })
    await app.ready()

    const res = await app.inject({
      method: 'POST',
      url: '/api/oa/internal/dispatch-postback',
      payload: { oaId, chatId, data: 'x' },
    })
    await app.close()
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 when webhook is not verified', async () => {
    const { app, webhookDelivery } = createTestApp()
    webhookDelivery.deliverRealEvent.mockResolvedValueOnce({ kind: 'webhook-not-ready' })
    await app.ready()

    const res = await app.inject({
      method: 'POST',
      url: '/api/oa/internal/dispatch-postback',
      payload: { oaId, chatId, data: 'x' },
    })
    await app.close()
    expect(res.statusCode).toBe(400)
  })

  it('returns 502 when webhook delivery fails (non-2xx)', async () => {
    const { app, webhookDelivery } = createTestApp()
    webhookDelivery.deliverRealEvent.mockResolvedValueOnce({
      kind: 'delivery-failed',
      reason: 'error_status_code',
      detail: 'HTTP 500',
      statusCode: 500,
    })
    await app.ready()

    const res = await app.inject({
      method: 'POST',
      url: '/api/oa/internal/dispatch-postback',
      payload: { oaId, chatId, data: 'x' },
    })
    await app.close()
    expect(res.statusCode).toBe(502)
    expect(JSON.parse(res.body)).toEqual({ message: 'Webhook delivery failed', status: 500 })
  })

  it('returns 504 when webhook fetch throws / times out', async () => {
    const { app, webhookDelivery } = createTestApp()
    webhookDelivery.deliverRealEvent.mockResolvedValueOnce({
      kind: 'delivery-failed',
      reason: 'request_timeout',
      detail: 'Request timeout',
    })
    await app.ready()

    const res = await app.inject({
      method: 'POST',
      url: '/api/oa/internal/dispatch-postback',
      payload: { oaId, chatId, data: 'x' },
    })
    await app.close()
    expect(res.statusCode).toBe(504)
    expect(JSON.parse(res.body)).toEqual({ message: 'Webhook delivery timeout' })
  })
})

describe('POST /api/oa/internal/dispatch (message events)', () => {
  it('dispatches with session-derived userId, ignoring any body userId', async () => {
    const { app, oa, webhookDelivery } = createTestApp({
      account: { id: oaId, channelSecret },
      webhook: { oaId, url: 'https://hook.example/bot', status: 'verified' },
    })
    await app.ready()

    const res = await app.inject({
      method: 'POST',
      url: '/api/oa/internal/dispatch',
      payload: {
        oaId,
        chatId,
        messageId: 'msg-1',
        text: 'hello',
        // Attempt to forge identity — server must ignore this and use the session id.
        userId: 'attacker-spoofed-id',
      },
    })
    await app.close()
    expect(res.statusCode).toBe(200)

    expect(webhookDelivery.deliverRealEvent).toHaveBeenCalledWith({
      oaId,
      buildPayload: expect.any(Function),
    })

    const buildPayload = webhookDelivery.deliverRealEvent.mock.calls[0]![0].buildPayload
    const payload = await buildPayload()
    expect(oa.registerReplyToken).toHaveBeenCalledWith({
      oaId,
      userId, // session id, NOT 'attacker-spoofed-id'
      chatId,
      messageId: 'msg-1',
    })
    expect(payload).toEqual({
      destination: oaId,
      events: [
        {
          type: 'message',
          replyToken: 'reply-token-xyz',
          source: { type: 'user', userId },
          message: { type: 'text', id: 'msg-1', text: 'hello' },
        },
      ],
    })
  })

  it('returns 401 when there is no session', async () => {
    mockedAuth.mockResolvedValue(null as any)
    const { app, oa, webhookDelivery } = createTestApp({
      account: { id: oaId, channelSecret },
      webhook: { oaId, url: 'https://hook.example/bot', status: 'verified' },
    })
    await app.ready()

    const res = await app.inject({
      method: 'POST',
      url: '/api/oa/internal/dispatch',
      payload: { oaId, chatId, messageId: 'm', text: 't' },
    })
    await app.close()
    expect(res.statusCode).toBe(401)
    expect(oa.registerReplyToken).not.toHaveBeenCalled()
    expect(webhookDelivery.deliverRealEvent).not.toHaveBeenCalled()
  })

  it('returns 403 when the session user is not a member of chatId', async () => {
    const { app, oa, webhookDelivery } = createTestApp({
      account: { id: oaId, channelSecret },
      webhook: { oaId, url: 'https://hook.example/bot', status: 'verified' },
      chatMember: [],
    })
    await app.ready()

    const res = await app.inject({
      method: 'POST',
      url: '/api/oa/internal/dispatch',
      payload: { oaId, chatId, messageId: 'm', text: 't' },
    })
    await app.close()
    expect(res.statusCode).toBe(403)
    expect(oa.registerReplyToken).not.toHaveBeenCalled()
    expect(webhookDelivery.deliverRealEvent).not.toHaveBeenCalled()
  })

  it('acks internal dispatch when webhook delivery is disabled', async () => {
    const { app, oa, webhookDelivery } = createTestApp()
    webhookDelivery.deliverRealEvent.mockResolvedValueOnce({ kind: 'webhook-disabled' })
    await app.ready()

    const res = await app.inject({
      method: 'POST',
      url: '/api/oa/internal/dispatch',
      payload: { oaId, chatId, messageId: 'm1', text: 'hello' },
    })
    await app.close()
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toEqual({ success: true, skipped: true })
    expect(oa.registerReplyToken).not.toHaveBeenCalled()
  })
})
