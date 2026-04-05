import type { AuthServer } from '@take-out/better-auth-utils/server'
import { ConnectRouter } from '@connectrpc/connect'
import { greeterHandler } from './greeter'
import { oaHandler } from './oa'
import type { createOAService } from '../services/oa'

type ConnectDeps = {
  oa: ReturnType<typeof createOAService>
  auth: AuthServer
}

export function connectRoutes(deps: ConnectDeps) {
  return (router: ConnectRouter) => {
    greeterHandler(router)
    oaHandler(deps)(router)
  }
}
