import { describe, expect, it } from 'vitest'
import * as v from 'valibot'
import { FlexHttpsUrlSchema, FlexUrlSchema } from './primitives'

describe('FlexHttpsUrlSchema', () => {
  it('accepts https URL', () => {
    expect(v.safeParse(FlexHttpsUrlSchema, 'https://example.com/a').success).toBe(true)
  })
  it('rejects http URL', () => {
    expect(v.safeParse(FlexHttpsUrlSchema, 'http://example.com/a').success).toBe(false)
  })
  it('rejects non-URL string', () => {
    expect(v.safeParse(FlexHttpsUrlSchema, 'not-a-url').success).toBe(false)
  })
})

describe('FlexUrlSchema', () => {
  it('accepts https URL', () => {
    expect(v.safeParse(FlexUrlSchema, 'https://example.com').success).toBe(true)
  })
  it('accepts http URL', () => {
    expect(v.safeParse(FlexUrlSchema, 'http://example.com').success).toBe(true)
  })
  it('rejects empty string', () => {
    expect(v.safeParse(FlexUrlSchema, '').success).toBe(false)
  })
})
