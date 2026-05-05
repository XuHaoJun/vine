import type { AuthServer } from '@take-out/better-auth-utils/server'
import { ConnectRouter } from '@connectrpc/connect'
import { greeterHandler } from './greeter'
import { oaHandler } from './oa'
import { liffHandler } from './liff'
import { miniAppHandler } from './mini-app'
import type { createOAService } from '../services/oa'
import type { createOAWebhookDeliveryService } from '../services/oa-webhook-delivery'
import type { createLiffService } from '../services/liff'
import type { createMiniAppService } from '../services/mini-app'
import type { DriveService } from '@vine/drive'
import {
  StickerMarketUserService,
  StickerMarketAdminService,
  StickerMarketCreatorService,
  StickerMarketDiscoveryService,
} from '@vine/proto/stickerMarket'
import type { StickerMarketUserHandlerDeps } from './stickerMarketUser'
import { createStickerMarketUserHandler } from './stickerMarketUser'
import type { StickerMarketAdminHandlerDeps } from './stickerMarketAdmin'
import { createStickerMarketAdminHandler } from './stickerMarketAdmin'
import type { StickerMarketCreatorHandlerDeps } from './stickerMarketCreator'
import { createStickerMarketCreatorHandler } from './stickerMarketCreator'
import type { StickerMarketDiscoveryHandlerDeps } from './stickerMarketDiscovery'
import { createStickerMarketDiscoveryHandler } from './stickerMarketDiscovery'
import { withAuthService } from './auth-context'

type ConnectDeps = {
  oa: ReturnType<typeof createOAService>
  webhookDelivery: ReturnType<typeof createOAWebhookDeliveryService>
  liff: ReturnType<typeof createLiffService>
  miniApp: ReturnType<typeof createMiniAppService>
  auth: AuthServer
  drive: DriveService
  stickerMarketUser: StickerMarketUserHandlerDeps
  stickerMarketAdmin: StickerMarketAdminHandlerDeps
  stickerMarketCreator: StickerMarketCreatorHandlerDeps
  stickerMarketDiscovery: StickerMarketDiscoveryHandlerDeps
}

export function connectRoutes(deps: ConnectDeps) {
  return (router: ConnectRouter) => {
    greeterHandler(router)
    oaHandler(deps)(router)
    liffHandler(deps)(router)
    miniAppHandler({ miniApp: deps.miniApp, auth: deps.auth })(router)
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
    router.service(
      StickerMarketCreatorService,
      withAuthService(
        StickerMarketCreatorService,
        deps.auth,
        createStickerMarketCreatorHandler(deps.stickerMarketCreator),
      ),
    )
    router.service(
      StickerMarketDiscoveryService,
      createStickerMarketDiscoveryHandler(deps.stickerMarketDiscovery),
    )
  }
}
