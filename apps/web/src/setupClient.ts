import '~/features/storage/setupStorage'
import '~/helpers/crypto/polyfill'

import { setupDev } from 'tamagui'
import { logger } from '~/lib/logger'

logger.info(`[client] start (SHA: ${process.env.GIT_SHA})`)

if (process.env.NODE_ENV === 'development') {
  // hold down option in dev mode to see Tamagui dev visualizer
  setupDev({
    visualizer: true,
  })
}
