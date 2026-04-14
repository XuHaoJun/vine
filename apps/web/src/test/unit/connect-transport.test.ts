import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const originalFetch = globalThis.fetch
const createConnectTransport = vi.fn()
const mockFetch = vi.fn<typeof originalFetch>()
globalThis.fetch = mockFetch

vi.mock('@connectrpc/connect-web', () => ({
  createConnectTransport,
}))

vi.mock('~/constants/urls', () => ({
  SERVER_URL: 'https://api.example.com',
}))

vi.mock('~/features/auth/client/authClient', () => ({
  authState: {
    value: {
      session: {
        token: 'test-token',
      },
    },
  },
}))

describe('connectTransport', () => {
  beforeEach(() => {
    createConnectTransport.mockReset()
    mockFetch.mockClear()
    mockFetch.mockResolvedValue(new Response(null, { status: 204 }))
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('configures the Connect transport to use authFetch', async () => {
    await import('~/features/auth/client/connectTransport')

    expect(createConnectTransport).toHaveBeenCalledTimes(1)
    const options = createConnectTransport.mock.calls[0]?.[0]

    expect(options?.baseUrl).toBe('https://api.example.com')
    expect(typeof options?.fetch).toBe('function')

    await options?.fetch('https://api.example.com/greet', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
    })

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const firstCall = mockFetch.mock.calls[0]
    expect(firstCall).toBeDefined()
    const [url, init] = firstCall as [string, RequestInit]
    expect(url).toBe('https://api.example.com/greet')
    expect(init.method).toBe('POST')
    const headers = init.headers
    expect(headers instanceof Headers || Array.isArray(headers)).toBe(true)
    if (headers instanceof Headers) {
      expect(headers.get('content-type')).toBe('application/json')
      expect(headers.get('authorization')).toBe('Bearer test-token')
    }
  })
})
