import { describe, expect, it } from 'vitest'
import { parseOAScanResult } from '~/features/oa/parse-qr'

describe('parseOAScanResult', () => {
  it('extracts unique_id from Vine URL', () => {
    expect(parseOAScanResult('https://vine.app/oa/@my-oa')).toBe('@my-oa')
  })

  it('handles URL-encoded unique_id', () => {
    expect(parseOAScanResult('https://vine.app/oa/%40my-oa')).toBe('@my-oa')
  })

  it('returns raw unique_id when not a URL', () => {
    expect(parseOAScanResult('@my-oa')).toBe('@my-oa')
  })

  it('returns raw unique_id without @ prefix', () => {
    expect(parseOAScanResult('my-oa')).toBe('my-oa')
  })

  it('handles URL with trailing slash', () => {
    expect(parseOAScanResult('https://vine.app/oa/@my-oa/')).toBe('@my-oa/')
  })

  it('returns non-Vine URLs as-is', () => {
    expect(parseOAScanResult('https://example.com/foo')).toBe('https://example.com/foo')
  })
})
