import { createFetch } from '@better-fetch/fetch'
import { SERVER_URL } from '~/constants/urls'
import { logger } from '~/lib/logger'
import { authState } from './authClient'

export const authFetch = createFetch({
  baseURL: SERVER_URL,
  auth: {
    type: 'Bearer',
    token: () => {
      const sessionToken = authState.value?.session?.token
      if (!sessionToken) {
        logger.warn('No session token, authFetch will fail')
      }
      return sessionToken
    },
  },
})
