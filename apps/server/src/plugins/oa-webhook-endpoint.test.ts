import { describe, expect, it, vi } from 'vitest'
import Fastify from 'fastify'
import { oaApiPath } from './oa-routes'
import { oaWebhookEndpointPlugin } from './oa-webhook-endpoint'

const validToken = 'valid-test-token'
const oaId = '550e8400-e29b-41d4-a716-446655440000'

function makeMockDb(tokenResult: unknown[]) {
  const mockLimit = vi.fn().mockResolvedValue(tokenResult)
  const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit })
  const mockFrom = vi.fn().mockReturnValue({ where: mockWhere })
  const mockSelect = vi.fn().mockReturnValue({ from: mockFrom })
  return { select: mockSelect } as any
}

function createTestApp() {
  const db = makeMockDb([{ oaId, token: validToken, expiresAt: null }])
  const oa = {
    setWebhook: vi.fn().mockResolvedValue(undefined),
    getWebhook: vi.fn().mockResolvedValue({
      url: 'https://example.com/webhook',
      status: 'verified',
    }),
    getOfficialAccount: vi.fn().mockResolvedValue({
      id: oaId,
      channelSecret: 'channel-secret',
    }),
    generateWebhookSignature: vi.fn().mockReturnValue('signature'),
  }
  const app = Fastify()
  app.register(oaWebhookEndpointPlugin, { oa: oa as any, db })
  return { app, oa }
}

describe('oaWebhookEndpointPlugin route namespace', () => {
  it('serves webhook endpoint settings under /api/oa/v2', async () => {
    const { app } = createTestApp()
    await app.ready()

    const res = await app.inject({
      method: 'GET',
      url: oaApiPath('/bot/channel/webhook/endpoint'),
      headers: { authorization: `Bearer ${validToken}` },
    })

    await app.close()
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toEqual({
      endpoint: 'https://example.com/webhook',
      active: true,
    })
  })

  it('does not register root /v2 webhook endpoint settings', async () => {
    const { app } = createTestApp()
    await app.ready()

    const res = await app.inject({
      method: 'GET',
      url: '/v2/bot/channel/webhook/endpoint',
      headers: { authorization: `Bearer ${validToken}` },
    })

    await app.close()
    expect(res.statusCode).toBe(404)
  })
})
