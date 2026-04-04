import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { schema } from '@vine/db'
import { oaWebhook } from '@vine/db/schema-oa'
import { eq } from 'drizzle-orm'
import type { createOAService } from '../services/oa'

type WebhookPluginDeps = {
  oa: ReturnType<typeof createOAService>
  db: NodePgDatabase<typeof schema>
}

export async function oaWebhookPlugin(fastify: FastifyInstance, deps: WebhookPluginDeps) {
  const { oa, db } = deps

  // Internal dispatch endpoint for testing
  fastify.post(
    '/api/oa/internal/dispatch',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as {
        oaId: string
        userId: string
        messageId: string
        text: string
        replyToken: string
      }

      const account = await oa.getOfficialAccount(body.oaId)
      if (!account) return reply.code(404).send({ message: 'OA not found' })

      const webhook = await oa.getWebhook(body.oaId)
      if (!webhook || webhook.status !== 'verified') {
        return reply.code(400).send({ message: 'Webhook not configured or not verified' })
      }

      const payload = oa.buildMessageEvent({
        oaId: body.oaId,
        userId: body.userId,
        messageId: body.messageId,
        text: body.text,
        replyToken: body.replyToken,
      })
      const payloadBody = JSON.stringify(payload)
      const signature = oa.generateWebhookSignature(payloadBody, account.channelSecret)

      try {
        const response = await fetch(webhook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'x-line-signature': signature,
          },
          body: payloadBody,
          signal: AbortSignal.timeout(10000),
        })

        if (!response.ok) {
          await db
            .update(oaWebhook)
            .set({ status: 'failed' })
            .where(eq(oaWebhook.oaId, body.oaId))
          return reply
            .code(502)
            .send({ message: 'Webhook delivery failed', status: response.status })
        }

        return reply.send({ success: true })
      } catch {
        return reply.code(504).send({ message: 'Webhook delivery timeout' })
      }
    },
  )
}
