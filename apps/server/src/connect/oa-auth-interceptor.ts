import type { Interceptor } from '@connectrpc/connect'
import { Code, ConnectError } from '@connectrpc/connect'
import { OAService } from '@vine/proto/oa'
import { getAuthDataFromRequest } from '@take-out/better-auth-utils/server'

import type { AuthServer } from '@take-out/better-auth-utils/server'

import { connectAuthDataKey } from './auth-context'

/**
 * Requires a valid Better Auth session or JWT for all {@link OAService} RPCs.
 * Other services (e.g. Greeter) are unchanged.
 */
export function createOaAuthInterceptor(auth: AuthServer): Interceptor {
  return (next) => async (req) => {
    if (req.service !== OAService) {
      return next(req)
    }

    const webReq = new Request(req.url, {
      method: req.requestMethod,
      headers: req.header,
      signal: req.signal,
    })

    const authData = await getAuthDataFromRequest(auth, webReq)
    if (!authData) {
      throw new ConnectError('Unauthenticated', Code.Unauthenticated)
    }

    req.contextValues.set(connectAuthDataKey, authData)
    return next(req)
  }
}
