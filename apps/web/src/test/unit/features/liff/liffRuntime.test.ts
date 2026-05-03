import { describe, expect, it } from 'vitest'
import {
  createLiffIframeSrc,
  createLiffBootstrap,
  getEndpointOrigin,
  isAllowedLiffMessageOrigin,
  canSendMessages,
  type LiffRuntimeContext,
} from '~/features/liff/liffRuntime'

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
    expect(isAllowedLiffMessageOrigin('https://app.example.com', 'https://app.example.com')).toBe(
      true,
    )
  })

  it('ignores host events from a different origin', () => {
    expect(isAllowedLiffMessageOrigin('https://evil.com', 'https://app.example.com')).toBe(false)
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
})
