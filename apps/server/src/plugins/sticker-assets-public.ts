import { resolve } from 'node:path'
import fastifyStatic from '@fastify/static'
import type { FastifyInstance } from 'fastify'

export async function stickerAssetsPublicPlugin(
  app: FastifyInstance,
  deps: { uploadRoot: string },
) {
  await app.register(fastifyStatic, {
    root: resolve(deps.uploadRoot),
    prefix: '/uploads/',
    decorateReply: false,
  })
}
