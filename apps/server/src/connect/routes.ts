import type { AuthServer } from '@take-out/better-auth-utils/server'
import { ConnectRouter } from '@connectrpc/connect'
import { greeterHandler } from './greeter'
import { oaHandler } from './oa'
import { liffHandler } from './liff'
import type { createOAService } from '../services/oa'
import type { createLiffService } from '../services/liff'
import type { DriveService } from '@vine/drive'

type ConnectDeps = {
  oa: ReturnType<typeof createOAService>
  liff: ReturnType<typeof createLiffService>
  auth: AuthServer
  drive: DriveService
}

export function connectRoutes(deps: ConnectDeps) {
  return (router: ConnectRouter) => {
    greeterHandler(router)
    oaHandler(deps)(router)
    liffHandler(deps)(router)
  }
}
