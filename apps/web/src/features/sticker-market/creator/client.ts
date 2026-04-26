import { createClient } from '@connectrpc/connect'
import { StickerMarketCreatorService } from '@vine/proto/stickerMarket'
import { connectTransport } from '~/features/auth/client/connectTransport'

export const stickerMarketCreatorClient = createClient(
  StickerMarketCreatorService,
  connectTransport,
)
