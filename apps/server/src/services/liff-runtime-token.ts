import { createHmac } from 'node:crypto'

export type LiffAccessTokenContext = {
  kind: 'access'
  liffId: string
  userId: string
  scopes: string[]
  exp: number
}

export type LiffLaunchContext = {
  kind: 'launch'
  liffId: string
  chatId: string
  userId: string
  contextType: 'utou' | 'group'
  exp: number
}

type AccessPayload = Omit<LiffAccessTokenContext, 'kind' | 'exp'>
type LaunchPayload = Omit<LiffLaunchContext, 'kind' | 'exp'>

function sign(payload: object, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = createHmac('sha256', secret).update(body).digest('base64url')
  return `${body}.${sig}`
}

function verify<T>(token: string, secret: string): T | null {
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [body, sig] = parts as [string, string]
  const expected = createHmac('sha256', secret).update(body!).digest('base64url')
  if (sig !== expected) return null
  return JSON.parse(Buffer.from(body!, 'base64url').toString()) as T
}

export function createLiffRuntimeTokenService(input: {
  secret: string
  now?: () => number
  accessTtlMs?: number
  launchTtlMs?: number
}) {
  const { secret, accessTtlMs = 15 * 60 * 1000, launchTtlMs = 5 * 60 * 1000 } = input
  const now = input.now ?? (() => Date.now())

  function createAccessToken(ctx: AccessPayload): string {
    const payload: LiffAccessTokenContext = {
      kind: 'access',
      ...ctx,
      exp: now() + accessTtlMs,
    }
    return sign(payload, secret)
  }

  function resolveAccessToken(token: string, liffId: string): LiffAccessTokenContext | null {
    const ctx = verify<LiffAccessTokenContext>(token, secret)
    if (!ctx) return null
    if (ctx.kind !== 'access') return null
    if (ctx.liffId !== liffId) return null
    if (ctx.exp < now()) return null
    return ctx
  }

  function createLaunchToken(ctx: LaunchPayload): string {
    const payload: LiffLaunchContext = {
      kind: 'launch',
      ...ctx,
      exp: now() + launchTtlMs,
    }
    return sign(payload, secret)
  }

  function resolveLaunchToken(token: string, liffId: string): LiffLaunchContext | null {
    const ctx = verify<LiffLaunchContext>(token, secret)
    if (!ctx) return null
    if (ctx.kind !== 'launch') return null
    if (ctx.liffId !== liffId) return null
    if (ctx.exp < now()) return null
    return ctx
  }

  return { createAccessToken, resolveAccessToken, createLaunchToken, resolveLaunchToken }
}
