import { createConnectTransport } from '@connectrpc/connect-web'

import { SERVER_URL } from '~/constants/urls'

import { authState } from './authClient'

/**
 * Connect must receive a real `Response` (with `.headers`, `.status`, `.json()`, …).
 * `createFetch` from `@better-fetch/fetch` returns `{ data, error }` on success, which
 * breaks `@connectrpc/connect-web` (validateResponse calls `headers.get`).
 */
const connectFetch = Object.assign(
  (
    input: Parameters<typeof fetch>[0],
    init?: Parameters<typeof fetch>[1],
  ): Promise<Response> => {
    const headers = new Headers(init?.headers)
    // Opaque session id from Better Auth (`session` table), not a JWT. The server
    // `bearer()` plugin accepts `Authorization: Bearer <sessionToken>` and maps it
    // to the session cookie for the auth handler. For a real JWT, enable `useJWT`
    // in `createBetterAuthClient` and prefer `authState.value.token` here.
    const token = authState.value?.session?.token
    if (token) {
      headers.set('Authorization', `Bearer ${token}`)
    }
    return fetch(input, { ...init, headers })
  },
  globalThis.fetch,
) satisfies typeof fetch

export const connectTransport = createConnectTransport({
  baseUrl: SERVER_URL,
  fetch: connectFetch,
})
