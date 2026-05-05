import { describe, expect, it, vi } from 'vitest'
import Fastify from 'fastify'
import { miniAppPublicPlugin } from './mini-app-public'

function fakeMiniAppService(rows: Record<string, any>) {
  return {
    getMiniApp: vi.fn(async (id: string) => rows[id] ?? null),
    listLinkedOaIds: vi.fn(async () => ['oa-1', 'oa-2']),
    getMiniAppByLiffAppId: vi.fn(),
    getMiniAppByLoginChannelId: vi.fn(),
    listMiniAppsLinkedToOa: vi.fn(),
    listMiniApps: vi.fn(),
    createMiniApp: vi.fn(),
    updateMiniApp: vi.fn(),
    publishMiniApp: vi.fn(),
    unpublishMiniApp: vi.fn(),
    deleteMiniApp: vi.fn(),
    linkOa: vi.fn(),
    unlinkOa: vi.fn(),
  } as any
}

function fakeLiffService() {
  return {
    getLiffAppByDbId: vi.fn(async (_id: string) => ({
      id: 'liff-app-1',
      liffId: '1234567890-abcd',
      endpointUrl: 'https://app.example.com',
    })),
  } as any
}

describe('GET /api/liff/v1/mini-app/:miniAppId', () => {
  it('returns mini app metadata when found', async () => {
    const app = Fastify()
    await app.register((instance) =>
      miniAppPublicPlugin(instance, {
        miniApp: fakeMiniAppService({
          'ma-1': {
            id: 'ma-1',
            providerId: 'p',
            liffAppId: 'liff-app-1',
            name: 'Pizza',
            iconUrl: 'https://x/icon.png',
            description: 'Order pizza',
            category: 'delivery',
            isPublished: true,
            publishedAt: '2026-05-05T00:00:00Z',
            createdAt: '2026-05-05T00:00:00Z',
            updatedAt: '2026-05-05T00:00:00Z',
          },
        }),
        liff: fakeLiffService(),
        auth: {} as any,
      }),
    )
    const res = await app.inject({ method: 'GET', url: '/api/liff/v1/mini-app/ma-1' })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.name).toBe('Pizza')
    expect(body.liffId).toBe('1234567890-abcd')
    expect(body.linkedOaIds).toEqual(['oa-1', 'oa-2'])
    await app.close()
  })

  it('returns 404 when not found', async () => {
    const app = Fastify()
    await app.register((instance) =>
      miniAppPublicPlugin(instance, {
        miniApp: fakeMiniAppService({}),
        liff: fakeLiffService(),
        auth: {} as any,
      }),
    )
    const res = await app.inject({ method: 'GET', url: '/api/liff/v1/mini-app/missing' })
    expect(res.statusCode).toBe(404)
    await app.close()
  })
})
