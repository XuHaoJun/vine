import type { AuthServer } from '@take-out/better-auth-utils/server'
import { ConnectRouter } from '@connectrpc/connect'
import { greeterHandler } from './greeter'
import { oaHandler } from './oa'
import { liffHandler } from './liff'
import type { createOAService } from '../services/oa'
import type { createLiffService } from '../services/liff'
import type { DriveService } from '@vine/drive'
import {
  StickerMarketUserService,
  StickerMarketAdminService,
} from '@vine/proto/stickerMarket'
import type { StickerMarketUserHandlerDeps } from './stickerMarketUser'
import { createStickerMarketUserHandler } from './stickerMarketUser'
import type { StickerMarketAdminHandlerDeps } from './stickerMarketAdmin'
import { createStickerMarketAdminHandler } from './stickerMarketAdmin'
import { withAuthService } from './auth-context'

type ConnectDeps = {
  oa: ReturnType<typeof createOAService>
  liff: ReturnType<typeof createLiffService>
  auth: AuthServer
  drive: DriveService
  stickerMarketUser: StickerMarketUserHandlerDeps
  stickerMarketAdmin: StickerMarketAdminHandlerDeps
}

export function connectRoutes(deps: ConnectDeps) {
  return (router: ConnectRouter) => {
    greeterHandler(router)
    oaHandler(deps)(router)
    liffHandler(deps)(router)
    router.service(
      StickerMarketUserService,
      withAuthService(
        StickerMarketUserService,
        deps.auth,
        createStickerMarketUserHandler(deps.stickerMarketUser),
      ),
    )
    router.service(
      StickerMarketAdminService,
      withAuthService(
        StickerMarketAdminService,
        deps.auth,
        createStickerMarketAdminHandler(deps.stickerMarketAdmin),
      ),
    )
  }
}
