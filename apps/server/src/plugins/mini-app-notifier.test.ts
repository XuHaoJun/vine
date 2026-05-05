import { describe, expect, it, vi } from 'vitest'
import Fastify from 'fastify'
import { miniAppNotifierPlugin } from './mini-app-notifier'

function deps(overrides: Partial<any> = {}) {
  return {
    miniApp: {
      getMiniAppByLiffAppId: vi.fn(async () => ({
        id: 'ma-1',
        liffAppId: 'liff-app-1',
        isPublished: true,
      })),
      getMiniApp: vi.fn(),
      ...overrides.miniApp,
    },
    template: {
      getTemplateByName: vi.fn(async () => ({
        id: 't-1',
        miniAppId: 'ma-1',
        name: 'reservation_confirmation_en',
        kind: 'reservation_confirmation',
        languageTag: 'en',
        flexJson: { type: 'bubble', body: { type: 'text', text: 'Hi ${name}' } },
        paramsSchema: [{ name: 'name', required: true, kind: 'text' }],
        useCase: 'reservation',
      })),
      ...overrides.template,
    },
    serviceMessage: {
      sendServiceMessage: vi.fn(async () => ({ messageId: 'mid-1', chatId: 'c-1' })),
      ...overrides.serviceMessage,
    },
    auth: {
      validateLoginChannelAccessToken: vi.fn(async (t: string) =>
        t === 'good-channel-token' ? { loginChannelId: 'lc-1' } : null,
      ),
      resolveLiffAccessToken: vi.fn(async (t: string) =>
        t === 'good-liff-token'
          ? { userId: 'u-1', liffAppId: 'liff-app-1', loginChannelId: 'lc-1' }
          : null,
      ),
      ...overrides.auth,
    },
  }
}

async function build(d: any) {
  const app = Fastify()
  await app.register((i) => miniAppNotifierPlugin(i, d))
  return app
}

describe('POST /api/oa/v2/mini-app/notifier/send', () => {
  it('sends a service message on the happy path', async () => {
    const d = deps()
    const app = await build(d)
    const res = await app.inject({
      method: 'POST',
      url: '/api/oa/v2/mini-app/notifier/send',
      headers: { Authorization: 'Bearer good-channel-token' },
      payload: {
        liffAccessToken: 'good-liff-token',
        templateName: 'reservation_confirmation_en',
        params: { name: 'Noah' },
      },
    })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toEqual({ status: 'sent', messageId: 'mid-1' })
    await app.close()
  })

  it('401 on bad channel token', async () => {
    const d = deps()
    const app = await build(d)
    const res = await app.inject({
      method: 'POST',
      url: '/api/oa/v2/mini-app/notifier/send',
      headers: { Authorization: 'Bearer bad' },
      payload: {
        liffAccessToken: 'good-liff-token',
        templateName: 'reservation_confirmation_en',
        params: { name: 'x' },
      },
    })
    expect(res.statusCode).toBe(401)
    await app.close()
  })

  it('403 when mini app not published', async () => {
    const d = deps({
      miniApp: {
        getMiniAppByLiffAppId: vi.fn(async () => ({
          id: 'ma-1',
          liffAppId: 'liff-app-1',
          isPublished: false,
        })),
      },
    })
    const app = await build(d)
    const res = await app.inject({
      method: 'POST',
      url: '/api/oa/v2/mini-app/notifier/send',
      headers: { Authorization: 'Bearer good-channel-token' },
      payload: {
        liffAccessToken: 'good-liff-token',
        templateName: 'reservation_confirmation_en',
        params: { name: 'x' },
      },
    })
    expect(res.statusCode).toBe(403)
    await app.close()
  })

  it('422 on missing required param', async () => {
    const d = deps()
    const app = await build(d)
    const res = await app.inject({
      method: 'POST',
      url: '/api/oa/v2/mini-app/notifier/send',
      headers: { Authorization: 'Bearer good-channel-token' },
      payload: {
        liffAccessToken: 'good-liff-token',
        templateName: 'reservation_confirmation_en',
        params: {},
      },
    })
    expect(res.statusCode).toBe(422)
    await app.close()
  })
})
