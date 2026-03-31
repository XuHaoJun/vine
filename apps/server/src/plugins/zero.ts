import { getAuthDataFromRequest } from '@take-out/better-auth-utils/server'
import { assertString } from '@take-out/helpers'
import type { FastifyInstance } from 'fastify'
import { createZeroServer } from 'on-zero/server'

import { models, queries, schema, createServerActions } from '@vine/zero-schema'
import { toWebRequest } from '../utils'
import { createAuthServer } from './auth'

const ZERO_UPSTREAM_DB = process.env['ZERO_UPSTREAM_DB']

type ZeroDeps = {
  auth: ReturnType<typeof createAuthServer>
  zeroUpstreamDb: string
}

export function createZeroService(deps: ZeroDeps) {
  return createZeroServer({
    schema,
    models,
    createServerActions,
    queries,
    database: assertString(deps.zeroUpstreamDb, 'no ZERO_UPSTREAM_DB'),
    defaultAllowAdminRole: 'all',
  })
}

type ZeroPluginDeps = {
  auth: ReturnType<typeof createAuthServer>
  zero: ReturnType<typeof createZeroService>
}

export async function zeroPlugin(fastify: FastifyInstance, deps: ZeroPluginDeps) {
  const { auth, zero } = deps

  fastify.post('/api/zero/pull', async (request, reply) => {
    try {
      const webReq = toWebRequest(request)
      const authData = await getAuthDataFromRequest(auth, webReq)
      const { response } = await zero.handleQueryRequest({ authData, request: webReq })
      reply.send(response)
    } catch (err) {
      console.error('[zero] pull error', err)
      reply.status(500).send({ err: String(err) })
    }
  })

  fastify.post('/api/zero/push', async (request, reply) => {
    try {
      const webReq = toWebRequest(request)
      const authData = await getAuthDataFromRequest(auth, webReq)
      const { response } = await zero.handleMutationRequest({ authData, request: webReq })
      reply.send(response)
    } catch (err) {
      console.error('[zero] push error', err)
      reply.status(500).send({ err: String(err) })
    }
  })
}
