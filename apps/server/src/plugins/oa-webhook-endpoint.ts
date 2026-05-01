import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { schema } from '@vine/db'
import { oaAccessToken } from '@vine/db/schema-oa'
import { eq } from 'drizzle-orm'
import type { createOAService } from '../services/oa'
import { oaApiPath } from './oa-routes'

class MissingBearerTokenError extends Error {}
class InvalidAccessTokenError extends Error {}
class AccessTokenExpiredError extends Error {}

type WebhookEndpointPluginDeps = {
  oa: ReturnType<typeof createOAService>
  db: NodePgDatabase<typeof schema>
}

async function extractOaFromToken(
  request: FastifyRequest,
  db: NodePgDatabase<typeof schema>,
): Promise<string> {
  const authHeader = request.headers['authorization']
  if (!authHeader?.startsWith('Bearer ')) {
    throw new MissingBearerTokenError()
  }
  const token = authHeader.slice(7)

  const [tokenRecord] = await db
    .select()
    .from(oaAccessToken)
    .where(eq(oaAccessToken.token, token))
    .limit(1)

  if (!tokenRecord) throw new InvalidAccessTokenError()
  if (tokenRecord.expiresAt && new Date(tokenRecord.expiresAt) < new Date()) {
    throw new AccessTokenExpiredError()
  }

  return tokenRecord.oaId
}

export async function oaWebhookEndpointPlugin(
  fastify: FastifyInstance,
  deps: WebhookEndpointPluginDeps,
) {
  const { oa, db } = deps

  fastify.setErrorHandler((err, _request, reply) => {
    if (err instanceof MissingBearerTokenError) {
      return reply
        .code(401)
        .send({ message: 'Missing Bearer token', code: 'INVALID_TOKEN' })
    }
    if (err instanceof InvalidAccessTokenError) {
      return reply
        .code(401)
        .send({ message: 'Invalid access token', code: 'INVALID_TOKEN' })
    }
    if (err instanceof AccessTokenExpiredError) {
      return reply
        .code(401)
        .send({ message: 'Access token expired', code: 'TOKEN_EXPIRED' })
    }
    return reply.code(500).send({ message: 'Internal server error' })
  })

  fastify.put(
    oaApiPath('/bot/channel/webhook/endpoint'),
    async (request: FastifyRequest, reply: FastifyReply) => {
      const oaId = await extractOaFromToken(request, db)
      const body = request.body as { endpoint?: string }

      if (!body.endpoint) {
        return reply.code(400).send({ message: 'Invalid webhook endpoint URL' })
      }
      if (body.endpoint.length > 500) {
        return reply.code(400).send({ message: 'Invalid webhook endpoint URL' })
      }
      try {
        new URL(body.endpoint)
      } catch {
        return reply.code(400).send({ message: 'Invalid webhook endpoint URL' })
      }
      if (!body.endpoint.startsWith('https://')) {
        return reply.code(400).send({ message: 'Invalid webhook endpoint URL' })
      }

      await oa.setWebhook(oaId, body.endpoint)
      return reply.send({})
    },
  )

  fastify.get(
    oaApiPath('/bot/channel/webhook/endpoint'),
    async (request: FastifyRequest, reply: FastifyReply) => {
      const oaId = await extractOaFromToken(request, db)

      const webhook = await oa.getWebhook(oaId)
      if (!webhook) {
        return reply.code(404).send({ message: 'Webhook endpoint not found' })
      }

      return reply.send({
        endpoint: webhook.url,
        active: webhook.status === 'verified',
      })
    },
  )

  fastify.post(
    oaApiPath('/bot/channel/webhook/test'),
    async (request: FastifyRequest, reply: FastifyReply) => {
      const oaId = await extractOaFromToken(request, db)
      const body = request.body as { endpoint?: string }

      const targetUrl = body.endpoint ?? (await oa.getWebhook(oaId))?.url
      if (!targetUrl) {
        return reply.code(404).send({ message: 'Webhook endpoint not found' })
      }

      if (body.endpoint) {
        try {
          new URL(body.endpoint)
        } catch {
          return reply.code(400).send({ message: 'Invalid webhook endpoint URL' })
        }
        if (!body.endpoint.startsWith('https://')) {
          return reply.code(400).send({ message: 'Invalid webhook endpoint URL' })
        }
      }

      const account = await oa.getOfficialAccount(oaId)
      if (!account) {
        return reply.code(404).send({ message: 'Official account not found' })
      }

      const testPayload = JSON.stringify({ destination: oaId, events: [] })
      const signature = oa.generateWebhookSignature(testPayload, account.channelSecret)

      const timestamp = Date.now()
      try {
        const response = await fetch(targetUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'x-line-signature': signature,
          },
          body: testPayload,
          signal: AbortSignal.timeout(10000),
        })

        return reply.send({
          success: response.ok,
          timestamp,
          statusCode: response.status,
          reason: response.statusText || (response.ok ? 'OK' : 'Failed'),
        })
      } catch {
        return reply.send({
          success: false,
          timestamp,
          statusCode: 0,
          reason: 'Connection failed',
        })
      }
    },
  )
}
