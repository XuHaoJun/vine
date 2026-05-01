import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { schema } from '@vine/db'
import { chatMember } from '@vine/db/schema-public'
import { and, eq } from 'drizzle-orm'
import { getAuthDataFromRequest } from '@take-out/better-auth-utils/server'
import type { createOAService } from '../services/oa'
import type { createAuthServer } from './auth'
import type {
  createOAWebhookDeliveryService,
  WebhookDispatchResult,
} from '../services/oa-webhook-delivery'
import { toWebRequest } from '../utils'

type WebhookPluginDeps = {
  oa: ReturnType<typeof createOAService>
  db: NodePgDatabase<typeof schema>
  auth: ReturnType<typeof createAuthServer>
  webhookDelivery: ReturnType<typeof createOAWebhookDeliveryService>
}

/** Map a WebhookDispatchResult onto an HTTP response. */
function sendDispatchResult(reply: FastifyReply, result: WebhookDispatchResult) {
  switch (result.kind) {
    case 'oa-not-found':
      return reply.code(404).send({ message: 'OA not found' })
    case 'webhook-not-ready':
      return reply.code(400).send({ message: 'Webhook not configured or not verified' })
    case 'webhook-disabled':
      return reply.send({ success: true, skipped: true })
    case 'delivery-failed':
      if (result.reason === 'request_timeout') {
        return reply.code(504).send({ message: 'Webhook delivery timeout' })
      }
      return reply
        .code(502)
        .send({ message: 'Webhook delivery failed', status: result.statusCode ?? 0 })
    case 'ok':
      return reply.send({ success: true })
    default:
      return reply.code(500).send({ message: 'Unexpected dispatch result' })
  }
}

/**
 * Authenticate the request and verify the session user is a member of
 * `chatId`. Returns the resolved `userId` on success; on failure, sends an
 * appropriate HTTP error response and returns `null`.
 *
 * The membership check is the linchpin that prevents a logged-in user from
 * forging postbacks/messages into chats they don't belong to.
 */
async function authorizeChatMember(args: {
  db: NodePgDatabase<typeof schema>
  auth: ReturnType<typeof createAuthServer>
  request: FastifyRequest
  reply: FastifyReply
  chatId: string
}): Promise<string | null> {
  const webReq = toWebRequest(args.request)
  const authData = await getAuthDataFromRequest(args.auth, webReq).catch(() => null)
  if (!authData?.id) {
    await args.reply.code(401).send({ message: 'Unauthorized' })
    return null
  }

  const [member] = await args.db
    .select({ id: chatMember.id })
    .from(chatMember)
    .where(and(eq(chatMember.chatId, args.chatId), eq(chatMember.userId, authData.id)))
    .limit(1)

  if (!member) {
    await args.reply.code(403).send({ message: 'Forbidden: not a member of this chat' })
    return null
  }

  return authData.id
}

export async function oaWebhookPlugin(fastify: FastifyInstance, deps: WebhookPluginDeps) {
  const { oa, db, auth, webhookDelivery } = deps

  // Internal dispatch endpoint for message events.
  // Auth: requires a valid session AND that the session user is a member of `chatId`.
  // The `userId` placed into the dispatched event is derived from the session,
  // NOT the request body, to prevent identity forgery.
  fastify.post(
    '/api/oa/internal/dispatch',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as {
        oaId: string
        chatId: string
        messageId: string
        text: string
        replyToken?: string
      }

      const userId = await authorizeChatMember({
        db,
        auth,
        request,
        reply,
        chatId: body.chatId,
      })
      if (userId === null) return

      const result = await webhookDelivery.deliverRealEvent({
        oaId: body.oaId,
        buildPayload: async () => {
          const replyTokenRecord = await oa.registerReplyToken({
            oaId: body.oaId,
            userId,
            chatId: body.chatId,
            messageId: body.messageId,
          })
          return oa.buildMessageEvent({
            oaId: body.oaId,
            userId,
            messageId: body.messageId,
            text: body.text,
            replyToken: replyTokenRecord.token,
          })
        },
      })

      return sendDispatchResult(reply, result)
    },
  )

  // Internal dispatch endpoint for postback events (quick reply, future template/flex buttons).
  // Same auth model as /dispatch above: session-required + chat-member check.
  fastify.post(
    '/api/oa/internal/dispatch-postback',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as {
        oaId: string
        chatId: string
        data: string
        params?: { date?: string; time?: string; datetime?: string }
      }

      const userId = await authorizeChatMember({
        db,
        auth,
        request,
        reply,
        chatId: body.chatId,
      })
      if (userId === null) return

      const result = await webhookDelivery.deliverRealEvent({
        oaId: body.oaId,
        buildPayload: async () => {
          const replyTokenRecord = await oa.registerReplyToken({
            oaId: body.oaId,
            userId,
            chatId: body.chatId,
            messageId: null,
          })
          return oa.buildPostbackEvent({
            oaId: body.oaId,
            userId,
            replyToken: replyTokenRecord.token,
            data: body.data,
            params: body.params,
          })
        },
      })

      return sendDispatchResult(reply, result)
    },
  )
}
