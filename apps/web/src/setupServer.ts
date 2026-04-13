import { logger } from '~/lib/logger'

async function setup() {
  if (process.env.ONE_RENDER_MODE === 'ssg') {
    return
  } else {
    logger.info(`[server] start (SHA: ${process.env.GIT_SHA})`)
  }
}

await setup()

export {}
