import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import type { FastifyInstance } from 'fastify'
import { getLiffFixturesDistDir } from '@vine/liff-fixtures/paths'

/**
 * Serves built LIFF integration-test fixtures from `@vine/liff-fixtures` (see `packages/liff-fixtures`).
 * Paths are stable for Playwright `endpointUrl` values.
 */
export async function liffFixturesPublicPlugin(app: FastifyInstance): Promise<void> {
  const dist = getLiffFixturesDistDir()

  app.get('/fixtures/liff/mock-share-target-picker', async (_request, reply) => {
    const html = await readFile(join(dist, 'mock-share-target-picker.html'), 'utf8')
    return reply.type('text/html; charset=utf-8').send(html)
  })

  app.get('/fixtures/liff/mock-share-target-picker.js', async (_request, reply) => {
    const buf = await readFile(join(dist, 'mock-share-target-picker.js'))
    return reply.type('application/javascript; charset=utf-8').send(buf)
  })
}
