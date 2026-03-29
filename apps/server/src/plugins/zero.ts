import { getAuthDataFromRequest } from '@take-out/better-auth-utils/server'
import { assertString } from '@take-out/helpers'
import type { FastifyInstance } from 'fastify'
import { createZeroServer } from 'on-zero/server'

import { models, queries, schema, createServerActions } from '@vine/zero-schema'
import { getAuthServer } from './auth'

const ZERO_UPSTREAM_DB = process.env['ZERO_UPSTREAM_DB']
const DB_CONFIGURED = Boolean(ZERO_UPSTREAM_DB)

let _zeroServer: ReturnType<typeof createZeroServer> | null = null

function getZeroServer() {
  if (!DB_CONFIGURED) return null
  if (!_zeroServer) {
    _zeroServer = createZeroServer({
      schema,
      models,
      createServerActions,
      queries,
      database: assertString(ZERO_UPSTREAM_DB, `no ZERO_UPSTREAM_DB`),
      defaultAllowAdminRole: 'all',
    })
  }
  return _zeroServer
}

/** Fastify plugin that mounts Zero sync endpoints at /api/zero/* */
export async function zeroPlugin(fastify: FastifyInstance) {
  if (!DB_CONFIGURED) {
    fastify.post('/api/zero/pull', async (_req, reply) => reply.status(503).send({ error: 'Database not configured' }))
    fastify.post('/api/zero/push', async (_req, reply) => reply.status(503).send({ error: 'Database not configured' }))
    return
  }

  // Zero pull (synced queries)
  fastify.post('/api/zero/pull', async (request, reply) => {
    try {
      const zero = getZeroServer()!
      const auth = getAuthServer()!
      const webReq = toWebRequest(request)
      const authData = await getAuthDataFromRequest(auth, webReq)
      const { response } = await zero.handleQueryRequest({ authData, request: webReq })
      return reply.send(response)
    } catch (err) {
      console.error('[zero] pull error', err)
      return reply.status(500).send({ err: String(err) })
    }
  })

  // Zero push (custom mutators)
  fastify.post('/api/zero/push', async (request, reply) => {
    try {
      const zero = getZeroServer()!
      const auth = getAuthServer()!
      const webReq = toWebRequest(request)
      const authData = await getAuthDataFromRequest(auth, webReq)
      const { response } = await zero.handleMutationRequest({ authData, request: webReq })
      return reply.send(response)
    } catch (err) {
      console.error('[zero] push error', err)
      return reply.status(500).send({ err: String(err) })
    }
  })
}

function toWebRequest(fastifyReq: {
  method: string
  url: string
  headers: Record<string, string | string[] | undefined>
  body?: unknown
}): Request {
  const baseUrl = process.env['BETTER_AUTH_URL'] ?? 'http://localhost:3001'
  const url = new URL(fastifyReq.url, baseUrl)
  const headers = new Headers()
  for (const [key, value] of Object.entries(fastifyReq.headers)) {
    if (value !== undefined) {
      headers.set(key, Array.isArray(value) ? value.join(', ') : value)
    }
  }
  const body =
    fastifyReq.method !== 'GET' && fastifyReq.method !== 'HEAD' && fastifyReq.body != null
      ? JSON.stringify(fastifyReq.body)
      : undefined

  return new Request(url.toString(), {
    method: fastifyReq.method,
    headers,
    body,
  })
}
