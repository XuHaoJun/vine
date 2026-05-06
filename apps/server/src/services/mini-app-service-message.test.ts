import { describe, expect, it } from 'vitest'
import {
  renderTemplate,
  validateParams,
  RateLimitError,
  TemplateValidationError,
} from './mini-app-service-message'

describe('mini-app service message renderer', () => {
  it('substitutes ${name} placeholders', () => {
    const out = renderTemplate(
      { type: 'bubble', body: { type: 'text', text: 'Hello ${name}' } },
      { name: 'Noah' },
    )
    expect(out).toEqual({
      type: 'bubble',
      body: { type: 'text', text: 'Hello Noah' },
    })
  })

  it('rejects missing required params', () => {
    expect(() =>
      validateParams([{ name: 'title', required: true, kind: 'text' }], {}),
    ).toThrowError(TemplateValidationError)
  })

  it('hard-cap fails when text exceeds limit', () => {
    expect(() =>
      validateParams([{ name: 'x', required: true, kind: 'text', hard: 5 }], {
        x: '123456',
      }),
    ).toThrowError(/hard limit/)
  })

  it('rejects non-https uri params', () => {
    expect(() =>
      validateParams([{ name: 'u', required: true, kind: 'uri' }], {
        u: 'javascript:alert(1)',
      }),
    ).toThrowError(/uri/i)
  })
})
