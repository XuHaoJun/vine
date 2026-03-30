import { createConnectTransport } from '@connectrpc/connect-web'
import { SERVER_URL } from '~/constants/urls'
import { authFetch } from './authFetch'

const connectAuthFetch = Object.assign(
  (
    input: Parameters<typeof fetch>[0],
    init?: Parameters<typeof fetch>[1],
  ): Promise<Response> => authFetch(input as never, init as never) as Promise<Response>,
  globalThis.fetch,
) satisfies typeof fetch

export const connectTransport = createConnectTransport({
  baseUrl: SERVER_URL,
  fetch: connectAuthFetch,
})
