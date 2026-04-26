import { createClient } from '@connectrpc/connect'
import { StickerMarketAdminService } from '@vine/proto/stickerMarket'
import { connectTransport } from '~/features/auth/client/connectTransport'

export const stickerMarketAdminClient = createClient(
  StickerMarketAdminService,
  connectTransport,
)
