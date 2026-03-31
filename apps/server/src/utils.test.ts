import { describe, expect, it } from 'vitest'
import { toWebRequest } from './utils'

describe('toWebRequest', () => {
  it('converts a basic GET request', () => {
    const req = toWebRequest({
      method: 'GET',
      url: '/api/test',
      headers: { 'content-type': 'application/json' },
    })

    expect(req.method).toBe('GET')
    expect(req.url).toContain('/api/test')
  })

  it('converts a POST request with body', () => {
    const req = toWebRequest({
      method: 'POST',
      url: '/api/test',
      headers: { 'content-type': 'application/json' },
      body: { key: 'value' },
    })

    expect(req.method).toBe('POST')
    expect(req.url).toContain('/api/test')
  })

  it('handles array header values', () => {
    const req = toWebRequest({
      method: 'GET',
      url: '/api/test',
      headers: { accept: ['text/html', 'application/json'] },
    })

    expect(req.headers.get('accept')).toBe('text/html, application/json')
  })
})
