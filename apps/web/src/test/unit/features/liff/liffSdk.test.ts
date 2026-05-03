import { describe, expect, it, vi, beforeEach } from 'vitest'
import liff from '@vine/liff'

function setupWindow() {
  const original = globalThis.window
  const parentPostMessage = vi.fn()
  const handlers = new Map<string, Set<Function>>()

  const addEventListener = vi.fn((type: string, handler: Function) => {
    if (!handlers.has(type)) handlers.set(type, new Set())
    handlers.get(type)!.add(handler)
  })
  const removeEventListener = vi.fn((type: string, handler: Function) => {
    handlers.get(type)?.delete(handler)
  })

  const win = {
    location: {
      origin: 'https://app.example.com',
      pathname: '/page',
      search: '?q=1',
      hash: '#foo=bar',
      href: 'https://app.example.com/page?q=1#foo=bar',
    },
    parent: { postMessage: parentPostMessage },
    addEventListener,
    removeEventListener,
    history: { replaceState: vi.fn() },
    sessionStorage: {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    },
    _dispatch(type: string, event: MessageEvent) {
      for (const handler of handlers.get(type) ?? []) {
        handler(event)
      }
    },
  }

  ;(globalThis as any).window = win
  ;(globalThis as any).sessionStorage = win.sessionStorage

  return {
    parentPostMessage,
    addEventListener,
    removeEventListener,
    dispatch(type: string, event: MessageEvent) {
      win._dispatch(type, event)
    },
    restore() {
      ;(globalThis as any).window = original
      delete (globalThis as any).sessionStorage
    },
  }
}

function resetLiff() {
  ;(liff as any)._initialized = false
  ;(liff as any)._liffId = null
  ;(liff as any)._accessToken = null
  ;(liff as any)._idToken = null
  ;(liff as any)._accessTokenHash = ''
  ;(liff as any)._appConfig = null
}

beforeEach(() => {
  vi.restoreAllMocks()
  resetLiff()
})

describe('@vine/liff runtime bootstrap', () => {
  it('uses window.VineLIFF.apiBaseUrl for init, getProfile, and getFriendship', async () => {
    const { restore } = setupWindow()
    ;(globalThis as any).window.VineLIFF = {
      apiBaseUrl: 'https://vine.example.com',
      liffId: 'liff-123',
      accessToken: 'tok_bootstrap',
    }

    const fetchSpy = vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue(
      new Response(
        JSON.stringify({
          liffId: 'liff-123',
          viewType: 'full',
          endpointUrl: 'https://app.example.com',
          scopes: [],
          moduleMode: false,
          botPrompt: 'none',
        }),
        { status: 200 },
      ),
    )

    await liff.init({ liffId: 'liff-123' })

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://vine.example.com/liff/v1/apps/liff-123',
    )

    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          userId: 'u1',
          displayName: 'Test',
          pictureUrl: undefined,
          statusMessage: undefined,
        }),
        { status: 200 },
      ),
    )
    await liff.getProfile()
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://vine.example.com/liff/v1/me?liffId=liff-123',
      { headers: { Authorization: 'Bearer tok_bootstrap' } },
    )

    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ friendFlag: true }), { status: 200 }),
    )
    await liff.getFriendship()
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://vine.example.com/liff/v1/friendship?liffId=liff-123',
      { headers: { Authorization: 'Bearer tok_bootstrap' } },
    )

    restore()
  })

  it('uses parent postMessage bootstrap when window.VineLIFF is absent', async () => {
    const { parentPostMessage, dispatch, restore } = setupWindow()

    const fetchSpy = vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue(
      new Response(
        JSON.stringify({
          liffId: 'liff-456',
          viewType: 'tall',
          endpointUrl: 'https://app.example.com',
          scopes: [],
          moduleMode: false,
          botPrompt: 'none',
        }),
        { status: 200 },
      ),
    )

    parentPostMessage.mockImplementation((msg: Record<string, unknown>) => {
      if (msg.type === 'liff:bootstrap') {
        setTimeout(() => {
          dispatch(
            'message',
            new MessageEvent('message', {
              data: {
                type: 'liff:bootstrap:done',
                requestId: msg.requestId,
                bootstrap: {
                  apiBaseUrl: 'https://vine.parent.com',
                  accessToken: 'tok_parent',
                  contextType: 'group',
                  chatId: 'chat_abc',
                },
              },
            }),
          )
        }, 0)
      }
    })

    await liff.init({ liffId: 'liff-456' })

    expect(parentPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'liff:bootstrap', liffId: 'liff-456' }),
      '*',
    )

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://vine.parent.com/liff/v1/apps/liff-456',
    )

    restore()
  })

  it('falls back to window.location.origin without bootstrap', async () => {
    const { parentPostMessage, dispatch, restore } = setupWindow()

    const fetchSpy = vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue(
      new Response(
        JSON.stringify({
          liffId: 'liff-789',
          viewType: 'full',
          endpointUrl: 'https://app.example.com',
          scopes: [],
          moduleMode: false,
          botPrompt: 'none',
        }),
        { status: 200 },
      ),
    )

    parentPostMessage.mockImplementation((msg: Record<string, unknown>) => {
      if (msg.type === 'liff:bootstrap') {
        setTimeout(() => {
          dispatch(
            'message',
            new MessageEvent('message', {
              data: {
                type: 'liff:bootstrap:done',
                requestId: msg.requestId,
                bootstrap: {},
              },
            }),
          )
        }, 0)
      }
    })

    await liff.init({ liffId: 'liff-789' })

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://app.example.com/liff/v1/apps/liff-789',
    )

    restore()
  })

  it('returns chat context from bootstrap for getContext', async () => {
    const { restore } = setupWindow()
    ;(globalThis as any).window.VineLIFF = {
      apiBaseUrl: 'https://vine.example.com',
      liffId: 'liff-ctx',
      contextType: 'group',
      chatId: 'chat_xyz',
    }

    vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue(
      new Response(
        JSON.stringify({
          liffId: 'liff-ctx',
          viewType: 'tall',
          endpointUrl: 'https://app.example.com',
          scopes: [],
          moduleMode: false,
          botPrompt: 'none',
        }),
        { status: 200 },
      ),
    )

    await liff.init({ liffId: 'liff-ctx' })

    const ctx = liff.getContext()
    expect(ctx.type).toBe('group')
    expect(ctx.liffId).toBe('liff-ctx')
    expect(ctx.viewType).toBe('tall')

    restore()
  })

  it('resolves sendMessages only after host acknowledgement', async () => {
    const { parentPostMessage, dispatch, restore } = setupWindow()
    ;(globalThis as any).window.VineLIFF = { apiBaseUrl: 'https://vine.example.com' }

    parentPostMessage.mockImplementation((msg: Record<string, unknown>) => {
      if (msg.type === 'liff:sendMessages') {
        setTimeout(() => {
          dispatch(
            'message',
            new MessageEvent('message', {
              data: {
                type: 'liff:sendMessages:done',
                requestId: msg.requestId,
              },
            }),
          )
        }, 0)
      }
    })

    const sendPromise = liff.sendMessages([{ type: 'text', text: 'hello' }])

    let resolved = false
    sendPromise.then(() => {
      resolved = true
    })

    await new Promise((r) => setTimeout(r, 10))
    expect(resolved).toBe(true)
    await expect(sendPromise).resolves.toBeUndefined()

    restore()
  })

  it('rejects sendMessages on host error acknowledgement', async () => {
    const { parentPostMessage, dispatch, restore } = setupWindow()
    ;(globalThis as any).window.VineLIFF = { apiBaseUrl: 'https://vine.example.com' }

    parentPostMessage.mockImplementation((msg: Record<string, unknown>) => {
      if (msg.type === 'liff:sendMessages') {
        setTimeout(() => {
          dispatch(
            'message',
            new MessageEvent('message', {
              data: {
                type: 'liff:sendMessages:error',
                requestId: msg.requestId,
                error: 'Host rejected messages',
              },
            }),
          )
        }, 0)
      }
    })

    await expect(
      liff.sendMessages([{ type: 'text', text: 'fail' }]),
    ).rejects.toThrow('Host rejected messages')

    restore()
  })

  it('does not consume or remove permanent-link URL hash values', async () => {
    const { restore } = setupWindow()

    ;(globalThis as any).window.location.hash = '#section=top&foo=bar'
    ;(globalThis as any).window.VineLIFF = {}

    vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue(
      new Response(
        JSON.stringify({
          liffId: 'liff-perm',
          viewType: 'full',
          endpointUrl: 'https://app.example.com',
          scopes: [],
          moduleMode: false,
          botPrompt: 'none',
        }),
        { status: 200 },
      ),
    )

    await liff.init({ liffId: 'liff-perm' })

    expect((globalThis as any).window.location.hash).toBe(
      '#section=top&foo=bar',
    )
    expect(
      (globalThis as any).window.history.replaceState,
    ).not.toHaveBeenCalled()

    restore()
  })
})
