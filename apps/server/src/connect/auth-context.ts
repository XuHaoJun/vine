import type { HandlerContext } from '@connectrpc/connect'
import { Code, ConnectError } from '@connectrpc/connect'
import { createContextKey } from '@connectrpc/connect'

import type { AuthData } from '@take-out/better-auth-utils/server'

/**
 * Shared `AuthData` slot on {@link HandlerContext.values}. Any auth interceptor
 * can `set` this key; handlers use {@link requireAuthData} to read it.
 *
 * Currently populated by {@link createOaAuthInterceptor} for `OAService` only.
 * If another service needs the same session/JWT, extend that interceptor (or
 * add one) to set this key for those RPCs too — no change needed here.
 */
export const connectAuthDataKey = createContextKey<AuthData | null>(null)

/** Requires {@link connectAuthDataKey} to have been set by an auth interceptor. */
export function requireAuthData(ctx: HandlerContext): AuthData {
  const data = ctx.values.get(connectAuthDataKey)
  if (!data) {
    throw new ConnectError('Unauthenticated', Code.Unauthenticated)
  }
  return data
}
