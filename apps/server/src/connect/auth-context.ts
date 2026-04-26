import type { DescMethod, DescService } from '@bufbuild/protobuf'
import type { HandlerContext, ServiceImpl } from '@connectrpc/connect'
import { Code, ConnectError } from '@connectrpc/connect'
import { createContextKey } from '@connectrpc/connect'
import { getAuthDataFromRequest } from '@take-out/better-auth-utils/server'
import type { AuthData, AuthServer } from '@take-out/better-auth-utils/server'

/**
 * Shared `AuthData` slot on {@link HandlerContext.values}.
 * {@link ensureAuthInContext} / {@link withAuth} set it; handlers use {@link requireAuthData} to read it.
 */
export const connectAuthDataKey = createContextKey<AuthData | null>(null)

/** Requires {@link connectAuthDataKey} (e.g. after {@link ensureAuthInContext}). */
export function requireAuthData(ctx: HandlerContext): AuthData {
  const data = ctx.values.get(connectAuthDataKey)
  if (!data) {
    throw new ConnectError('Unauthenticated', Code.Unauthenticated)
  }
  return data
}

/**
 * Resolves Better Auth session/JWT from the Connect request and sets {@link connectAuthDataKey}.
 */
export async function ensureAuthInContext(
  auth: AuthServer,
  ctx: HandlerContext,
): Promise<void> {
  const webReq = new Request(ctx.url, {
    method: ctx.requestMethod,
    headers: ctx.requestHeader,
    signal: ctx.signal,
  })
  const authData = await getAuthDataFromRequest(auth, webReq)
  if (!authData) {
    throw new ConnectError('Unauthenticated', Code.Unauthenticated)
  }
  ctx.values.set(connectAuthDataKey, authData)
}

/**
 * Tries to authenticate optionally. Returns auth data if session is present,
 * undefined otherwise. Unlike ensureAuthInContext, this does NOT throw.
 */
export async function tryGetAuthData(
  auth: AuthServer,
  ctx: HandlerContext,
): Promise<AuthData | undefined> {
  const webReq = new Request(ctx.url, {
    method: ctx.requestMethod,
    headers: ctx.requestHeader,
    signal: ctx.signal,
  })
  const authData = await getAuthDataFromRequest(auth, webReq)
  if (authData) {
    ctx.values.set(connectAuthDataKey, authData)
  }
  return authData ?? undefined
}

/**
 * Wraps a unary Connect handler: runs {@link ensureAuthInContext}, then `impl`.
 */
export function withAuth<I, O>(
  auth: AuthServer,
  impl: (req: I, ctx: HandlerContext) => Promise<O> | O,
): (req: I, ctx: HandlerContext) => Promise<O> | O {
  return async (req, ctx) => {
    await ensureAuthInContext(auth, ctx)
    return impl(req, ctx)
  }
}

function wrapAuthServerStreaming(
  auth: AuthServer,
  impl: (req: unknown, ctx: HandlerContext) => AsyncIterable<unknown>,
): (req: unknown, ctx: HandlerContext) => AsyncIterable<unknown> {
  return async function* (req, ctx) {
    await ensureAuthInContext(auth, ctx)
    yield* impl(req, ctx)
  }
}

function wrapAuthClientStreaming(
  auth: AuthServer,
  impl: (requests: AsyncIterable<unknown>, ctx: HandlerContext) => Promise<unknown>,
): (requests: AsyncIterable<unknown>, ctx: HandlerContext) => Promise<unknown> {
  return async (requests, ctx) => {
    await ensureAuthInContext(auth, ctx)
    return impl(requests, ctx)
  }
}

function wrapAuthBidiStreaming(
  auth: AuthServer,
  impl: (requests: AsyncIterable<unknown>, ctx: HandlerContext) => AsyncIterable<unknown>,
): (requests: AsyncIterable<unknown>, ctx: HandlerContext) => AsyncIterable<unknown> {
  return async function* (requests, ctx) {
    await ensureAuthInContext(auth, ctx)
    yield* impl(requests, ctx)
  }
}

/**
 * Wraps **every** RPC on a service implementation: runs auth once before the handler,
 * using each method's protobuf {@link DescMethod.methodKind} (unary and all streaming kinds).
 *
 * Requires the **service descriptor** (e.g. `OAService`) so method kind is known at runtime.
 */
export function withAuthService<S extends DescService>(
  service: S,
  auth: AuthServer,
  impl: ServiceImpl<S>,
): ServiceImpl<S> {
  const out = {} as ServiceImpl<S>
  for (const key of Object.keys(impl) as (keyof ServiceImpl<S>)[]) {
    const handler = impl[key]
    if (typeof handler !== 'function') {
      continue
    }
    const desc = service.method[key as string]
    if (!desc) {
      out[key] = withAuth(
        auth,
        handler as (req: unknown, ctx: HandlerContext) => unknown,
      ) as ServiceImpl<S>[typeof key]
      continue
    }
    switch (desc.methodKind) {
      case 'unary':
        out[key] = withAuth(
          auth,
          handler as (req: unknown, ctx: HandlerContext) => unknown,
        ) as ServiceImpl<S>[typeof key]
        break
      case 'server_streaming':
        out[key] = wrapAuthServerStreaming(
          auth,
          handler as (req: unknown, ctx: HandlerContext) => AsyncIterable<unknown>,
        ) as ServiceImpl<S>[typeof key]
        break
      case 'client_streaming':
        out[key] = wrapAuthClientStreaming(
          auth,
          handler as (
            requests: AsyncIterable<unknown>,
            ctx: HandlerContext,
          ) => Promise<unknown>,
        ) as ServiceImpl<S>[typeof key]
        break
      case 'bidi_streaming':
        out[key] = wrapAuthBidiStreaming(
          auth,
          handler as (
            requests: AsyncIterable<unknown>,
            ctx: HandlerContext,
          ) => AsyncIterable<unknown>,
        ) as ServiceImpl<S>[typeof key]
        break
      default: {
        throw new Error(`unknown methodKind: ${(desc as DescMethod).methodKind}`)
      }
    }
  }
  return out
}
