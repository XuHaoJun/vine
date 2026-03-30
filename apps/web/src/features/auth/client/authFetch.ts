import { createFetch } from '@better-fetch/fetch'

import { SERVER_URL } from '~/constants/urls'
import { authState } from './authClient'

export const authFetch = createFetch({
  baseURL: SERVER_URL,
  auth: {
    type: 'Bearer',
    token: () => {
      const sessionToken = authState.value?.session?.token
      if (!sessionToken) {
        console.warn(`No session token, authFetch will fail`)
      }
      return sessionToken
    },
  },
})
