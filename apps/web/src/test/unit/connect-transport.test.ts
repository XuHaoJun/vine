import { beforeEach, describe, expect, it, vi } from 'vitest'

const createConnectTransport = vi.fn()
const authFetch = vi.fn(async () => new Response(null, { status: 204 }))

vi.mock('@connectrpc/connect-web', () => ({
  createConnectTransport,
}))

vi.mock('~/features/auth/client/authFetch', () => ({
  authFetch,
}))

vi.mock('~/constants/urls', () => ({
  SERVER_URL: 'https://api.example.com',
}))

describe('connectTransport', () => {
  beforeEach(() => {
    createConnectTransport.mockReset()
    authFetch.mockClear()
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

    expect(authFetch).toHaveBeenCalledWith('https://api.example.com/greet', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
    })
  })
})
