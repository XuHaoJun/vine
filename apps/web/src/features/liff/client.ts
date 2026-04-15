import { createClient } from '@connectrpc/connect'
import { LIFFService, LoginChannelService } from '@vine/proto/liff'
import { connectTransport } from '~/features/auth/client/connectTransport'

export const loginChannelClient = createClient(LoginChannelService, connectTransport)
export const liffClient = createClient(LIFFService, connectTransport)
