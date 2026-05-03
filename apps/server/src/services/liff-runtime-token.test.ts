import { describe, expect, it } from 'vitest'
import { createLiffRuntimeTokenService } from './liff-runtime-token'

const secret = 'test-secret-for-liff-runtime-token'

describe('createLiffRuntimeTokenService', () => {
  it('signs and resolves a valid short-lived LIFF access token', () => {
    const now = Date.now()
    const svc = createLiffRuntimeTokenService({ secret, now: () => now })

    const token = svc.createAccessToken({
      liffId: 'app-1',
      userId: 'user-1',
      scopes: ['profile', 'chat_message.write'],
    })

    const resolved = svc.resolveAccessToken(token, 'app-1')
    expect(resolved).toEqual({
      kind: 'access',
      liffId: 'app-1',
      userId: 'user-1',
      scopes: ['profile', 'chat_message.write'],
      exp: now + 15 * 60 * 1000,
    })
  })

  it('signs and resolves a valid short-lived launch token', () => {
    const now = Date.now()
    const svc = createLiffRuntimeTokenService({ secret, now: () => now })

    const token = svc.createLaunchToken({
      liffId: 'app-1',
      chatId: 'chat-1',
      userId: 'user-1',
      contextType: 'group',
    })

    const resolved = svc.resolveLaunchToken(token, 'app-1')
    expect(resolved).toEqual({
      kind: 'launch',
      liffId: 'app-1',
      chatId: 'chat-1',
      userId: 'user-1',
      contextType: 'group',
      exp: now + 5 * 60 * 1000,
    })
  })

  it('rejects an access token with a mismatched liffId', () => {
    const svc = createLiffRuntimeTokenService({ secret })

    const token = svc.createAccessToken({
      liffId: 'app-1',
      userId: 'user-1',
      scopes: ['profile'],
    })

    const resolved = svc.resolveAccessToken(token, 'app-2')
    expect(resolved).toBeNull()
  })

  it('rejects expired tokens', () => {
    let now = Date.now()
    const svc = createLiffRuntimeTokenService({ secret, now: () => now })

    const token = svc.createAccessToken({
      liffId: 'app-1',
      userId: 'user-1',
      scopes: ['profile'],
    })

    // Advance time past expiry
    now += 16 * 60 * 1000

    const resolved = svc.resolveAccessToken(token, 'app-1')
    expect(resolved).toBeNull()
  })

  it('rejects tokens with a mismatched liffId', () => {
    const svc = createLiffRuntimeTokenService({ secret })

    const token = svc.createLaunchToken({
      liffId: 'app-1',
      chatId: 'chat-1',
      userId: 'user-1',
      contextType: 'utou',
    })

    const resolved = svc.resolveLaunchToken(token, 'wrong-app')
    expect(resolved).toBeNull()
  })

  it('rejects tampered tokens', () => {
    const svc = createLiffRuntimeTokenService({ secret })

    const token = svc.createAccessToken({
      liffId: 'app-1',
      userId: 'user-1',
      scopes: ['profile'],
    })

    // Tamper with the payload (first segment)
    const parts = token.split('.')
    const payload = JSON.parse(Buffer.from(parts[0]!, 'base64url').toString())
    payload.userId = 'attacker'
    parts[0] = Buffer.from(JSON.stringify(payload)).toString('base64url')
    const tampered = parts.join('.')

    const resolved = svc.resolveAccessToken(tampered, 'app-1')
    expect(resolved).toBeNull()
  })
})
