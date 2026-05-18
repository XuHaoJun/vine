import { ConnectRouter } from '@connectrpc/connect'
import {
  StickerMarketUserService,
  StickerMarketAdminService,
  StickerMarketCreatorService,
  StickerMarketDiscoveryService,
} from '@vine/proto/stickerMarket'
import { withAuthService } from './auth-context'
import { greeterHandler } from './greeter'
import { liffHandler } from './liff'
import { miniAppHandler } from './mini-app'
import { oaHandler } from './oa'
import { createStickerMarketAdminHandler } from './stickerMarketAdmin'
import { createStickerMarketCreatorHandler } from './stickerMarketCreator'
import { createStickerMarketDiscoveryHandler } from './stickerMarketDiscovery'
import { createStickerMarketUserHandler } from './stickerMarketUser'
import type { createLiffService } from '../services/liff'
import type { createMiniAppService } from '../services/mini-app'
import type { createMiniAppServiceMessageService } from '../services/mini-app-service-message'
import type { createMiniAppTemplateService } from '../services/mini-app-service-message-templates'
import type { createOAService } from '../services/oa'
import type { createOAAudienceService } from '../services/oa-audience'
import type { createOACampaignService } from '../services/oa-campaign'
import type { createOAWebhookDeliveryService } from '../services/oa-webhook-delivery'
import type { RichMenuDisplayScheduler } from '../workers/rich-menu-scheduler'
import type { StickerMarketAdminHandlerDeps } from './stickerMarketAdmin'
import type { StickerMarketCreatorHandlerDeps } from './stickerMarketCreator'
import type { StickerMarketDiscoveryHandlerDeps } from './stickerMarketDiscovery'
import type { StickerMarketUserHandlerDeps } from './stickerMarketUser'
import type { AuthServer } from '@take-out/better-auth-utils/server'
import type { DriveService } from '@vine/drive'

type ConnectDeps = {
  oa: ReturnType<typeof createOAService>
  oaAudience: ReturnType<typeof createOAAudienceService>
  oaCampaign: ReturnType<typeof createOACampaignService>
  webhookDelivery: ReturnType<typeof createOAWebhookDeliveryService>
  liff: ReturnType<typeof createLiffService>
  miniApp: ReturnType<typeof createMiniAppService>
  miniAppTemplate: ReturnType<typeof createMiniAppTemplateService>
  miniAppSvcMsg: ReturnType<typeof createMiniAppServiceMessageService>
  auth: AuthServer
  drive: DriveService
  richMenuDisplayScheduler: RichMenuDisplayScheduler
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
    miniAppHandler({
      miniApp: deps.miniApp,
      template: deps.miniAppTemplate,
      serviceMessage: deps.miniAppSvcMsg,
      oa: deps.oa,
      liff: deps.liff,
      auth: deps.auth,
    })(router)
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
