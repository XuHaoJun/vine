import { createClient } from '@connectrpc/connect'
import { OAService } from '@vine/proto/oa'
import { connectTransport } from '~/features/auth/client/connectTransport'

export const oaClient = createClient(OAService, connectTransport)
