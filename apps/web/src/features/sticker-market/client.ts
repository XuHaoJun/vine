import { createClient } from '@connectrpc/connect'
import {
  StickerMarketDiscoveryService,
  StickerMarketUserService,
} from '@vine/proto/stickerMarket'
import { connectTransport } from '~/features/auth/client/connectTransport'

export const stickerMarketUserClient = createClient(
  StickerMarketUserService,
  connectTransport,
)

export const stickerMarketDiscoveryClient = createClient(
  StickerMarketDiscoveryService,
  connectTransport,
)
