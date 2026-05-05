import { createClient } from '@connectrpc/connect'
import { MiniAppService } from '@vine/proto/mini-app'
import { connectTransport } from '~/features/auth/client/connectTransport'

export const miniAppClient = createClient(MiniAppService, connectTransport)
