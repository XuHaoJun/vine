import { describe, expect, it } from 'vitest'
import { resolveLiffPermanentUrl } from '~/features/liff/resolveLiffPermanentUrl'

describe('resolveLiffPermanentUrl', () => {
  it('preserves the endpoint URL for bare /liff/{liffId}', () => {
    const result = resolveLiffPermanentUrl({
      endpointUrl: 'https://app.example.com/page',
    })
    expect(result).toBe('https://app.example.com/page')
  })

  it('appends path to an endpoint with no base path', () => {
    const result = resolveLiffPermanentUrl({
      endpointUrl: 'https://app.example.com',
      permanentPath: '/foo/bar',
    })
    expect(result).toBe('https://app.example.com/foo/bar')
  })

  it('appends path to an endpoint with an existing base path', () => {
    const result = resolveLiffPermanentUrl({
      endpointUrl: 'https://app.example.com/base',
      permanentPath: '/sub/page',
    })
    expect(result).toBe('https://app.example.com/base/sub/page')
  })

  it('preserves query and hash', () => {
    const result = resolveLiffPermanentUrl({
      endpointUrl: 'https://app.example.com/page',
      permanentPath: '/nested',
      search: '?a=1&b=2',
      hash: '#section=top',
    })
    expect(result).toBe('https://app.example.com/page/nested?a=1&b=2#section=top')
  })

  it('does not duplicate slashes between base path and permanent path', () => {
    const result = resolveLiffPermanentUrl({
      endpointUrl: 'https://app.example.com/base/',
      permanentPath: '/extra',
    })
    expect(result).toBe('https://app.example.com/base/extra')
  })

  it('handles endpoint URL with query string and permanent path', () => {
    const result = resolveLiffPermanentUrl({
      endpointUrl: 'https://app.example.com/fixtures/liff/app?liffId=test-123',
      permanentPath: '/foo',
      search: '?x=1',
      hash: '#bar',
    })
    expect(result).toBe('https://app.example.com/fixtures/liff/app/foo?x=1#bar')
  })
})
