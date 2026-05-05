import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  createLiffIframeSrc,
  createLiffBootstrap,
  getEndpointOrigin,
  isAllowedLiffMessageOrigin,
  canSendMessages,
  buildNativeAckJavaScript,
  buildLiffRuntimeContext,
  type LiffRuntimeContext,
} from '~/features/liff/liffRuntimeHelpers'

const BASE: LiffRuntimeContext = {
  apiBaseUrl: 'https://api.example.com',
  liffId: 'liff-abc',
  endpointUrl: 'https://app.example.com/page?q=1#section=top',
  endpointOrigin: 'https://app.example.com',
  accessToken: 'tok_123',
  chatId: 'chat_99',
  contextType: 'utou',
  scopes: ['profile', 'chat_message.write'],
  lineVersion: '14.0.0',
}

describe('LIFF runtime host helpers', () => {
  it('builds web iframe src without runtime bootstrap in the URL fragment', () => {
    const src = createLiffIframeSrc(BASE)
    expect(src).toBe('https://app.example.com/page?q=1#section=top')
    expect(src).not.toContain('access_token')
    expect(src).not.toContain('bootstrap')
  })

  it('returns bootstrap payload for valid liff:bootstrap requests', () => {
    const bootstrap = createLiffBootstrap(BASE)
    expect(bootstrap).toEqual({
      apiBaseUrl: 'https://api.example.com',
      liffId: 'liff-abc',
      endpointOrigin: 'https://app.example.com',
      accessToken: 'tok_123',
      chatId: 'chat_99',
      contextType: 'utou',
      scopes: ['profile', 'chat_message.write'],
      lineVersion: '14.0.0',
    })
  })

  it('computes endpoint origin from endpointUrl', () => {
    expect(getEndpointOrigin('https://app.example.com/page?q=1#hash')).toBe(
      'https://app.example.com',
    )
    expect(getEndpointOrigin('https://other.io')).toBe('https://other.io')
  })

  it('accepts host events from the endpoint origin', () => {
    expect(
      isAllowedLiffMessageOrigin('https://app.example.com', 'https://app.example.com'),
    ).toBe(true)
  })

  it('ignores host events from a different origin', () => {
    expect(
      isAllowedLiffMessageOrigin('https://evil.com', 'https://app.example.com'),
    ).toBe(false)
  })

  it('rejects sendMessages without chat context', () => {
    const noChat: LiffRuntimeContext = { ...BASE, chatId: undefined }
    const result = canSendMessages(noChat)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('chat')
    }
  })

  it('rejects sendMessages without chat_message.write scope', () => {
    const noScope: LiffRuntimeContext = {
      ...BASE,
      scopes: ['profile'],
    }
    const result = canSendMessages(noScope)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('chat_message.write')
    }
  })

  it('builds native ack JS with an object literal for data', () => {
    const ack = { type: 'liff:sendMessages:done', requestId: 'req-1' }
    const js = buildNativeAckJavaScript(ack)
    expect(js).toContain('data: {"')
    expect(js).not.toContain('data: "{')
  })
})

const appConfig = {
  liffId: 'liff-abc',
  viewType: 'full',
  endpointUrl: 'https://app.example.com/page',
  moduleMode: false,
  scopes: ['profile', 'chat_message.write'],
  botPrompt: 'none',
  qrCode: false,
}

function mockFetch(handler: (url: string, init?: RequestInit) => Response) {
  const fn = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(
    async (url, init) => handler(url, init),
  )
  vi.stubGlobal('fetch', fn)
  return fn
}

describe('buildLiffRuntimeContext', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('uses external context without a launch token', async () => {
    mockFetch((url) => {
      if (url === 'https://api.example.com/liff/v1/apps/liff-abc') {
        return Response.json(appConfig)
      }
      if (url === 'https://api.example.com/liff/v1/access-token') {
        return Response.json({ accessToken: 'acc-tok', expiresIn: 900 })
      }
      return new Response('Not found', { status: 404 })
    })

    const ctx = await buildLiffRuntimeContext({
      apiBaseUrl: 'https://api.example.com',
      liffId: 'liff-abc',
    })

    expect(ctx.contextType).toBe('external')
    expect(ctx.chatId).toBeUndefined()
    expect(ctx.scopes).toEqual(['profile', 'chat_message.write'])
    expect(ctx.accessToken).toBe('acc-tok')
  })

  it('uses launch context when the server resolves a valid token', async () => {
    mockFetch((url) => {
      if (url === 'https://api.example.com/liff/v1/apps/liff-abc') {
        return Response.json(appConfig)
      }
      if (url === 'https://api.example.com/liff/v1/access-token') {
        return Response.json({ accessToken: 'acc-tok', expiresIn: 900 })
      }
      if (url.startsWith('https://api.example.com/liff/v1/launch-context')) {
        return Response.json({ chatId: 'chat-1', contextType: 'group' })
      }
      return new Response('Not found', { status: 404 })
    })

    const ctx = await buildLiffRuntimeContext({
      apiBaseUrl: 'https://api.example.com',
      liffId: 'liff-abc',
      launchToken: 'valid-token',
    })

    expect(ctx.contextType).toBe('group')
    expect(ctx.chatId).toBe('chat-1')
  })

  it('falls back to external context for invalid launch token responses', async () => {
    mockFetch((url) => {
      if (url === 'https://api.example.com/liff/v1/apps/liff-abc') {
        return Response.json(appConfig)
      }
      if (url === 'https://api.example.com/liff/v1/access-token') {
        return Response.json({ accessToken: 'acc-tok', expiresIn: 900 })
      }
      if (url.startsWith('https://api.example.com/liff/v1/launch-context')) {
        return new Response('Forbidden', { status: 403 })
      }
      return new Response('Not found', { status: 404 })
    })

    const ctx = await buildLiffRuntimeContext({
      apiBaseUrl: 'https://api.example.com',
      liffId: 'liff-abc',
      launchToken: 'bad-token',
    })

    expect(ctx.contextType).toBe('external')
    expect(ctx.chatId).toBeUndefined()
  })
})
