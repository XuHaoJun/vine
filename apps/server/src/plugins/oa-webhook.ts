import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { schema } from '@vine/db'
import { oaWebhook } from '@vine/db/schema-oa'
import { chatMember } from '@vine/db/schema-public'
import { and, eq } from 'drizzle-orm'
import { getAuthDataFromRequest } from '@take-out/better-auth-utils/server'
import type { createOAService } from '../services/oa'
import type { createAuthServer } from './auth'
import { toWebRequest } from '../utils'

type WebhookPluginDeps = {
  oa: ReturnType<typeof createOAService>
  db: NodePgDatabase<typeof schema>
  auth: ReturnType<typeof createAuthServer>
}

type DispatchResult =
  | { kind: 'oa-not-found' }
  | { kind: 'webhook-not-ready' }
  | { kind: 'delivery-failed'; status: number }
  | { kind: 'delivery-timeout' }
  | { kind: 'ok' }

/**
 * Resolve the OA + verified webhook for `oaId`, then sign and POST the payload
 * built by `buildPayload`. The builder is only invoked after both pre-flight
 * checks pass, so callers can do extra work inside it (e.g. registering a
 * reply token) without paying the cost on early-exit error paths.
 *
 * Side effect: on a non-2xx response from the OA's webhook URL, the OA's
 * `oaWebhook.status` is flipped to `'failed'` so subsequent dispatches
 * short-circuit at the verified-check.
 */
async function dispatchSignedWebhook(args: {
  oa: ReturnType<typeof createOAService>
  db: NodePgDatabase<typeof schema>
  oaId: string
  buildPayload: () => Promise<unknown> | unknown
}): Promise<DispatchResult> {
  const { oa, db, oaId } = args
  const account = await oa.getOfficialAccount(oaId)
  if (!account) return { kind: 'oa-not-found' }

  const webhook = await oa.getWebhook(oaId)
  if (!webhook || webhook.status !== 'verified') {
    return { kind: 'webhook-not-ready' }
  }

  const payload = await args.buildPayload()
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
      await db.update(oaWebhook).set({ status: 'failed' }).where(eq(oaWebhook.oaId, oaId))
      return { kind: 'delivery-failed', status: response.status }
    }

    return { kind: 'ok' }
  } catch {
    return { kind: 'delivery-timeout' }
  }
}

/** Map a DispatchResult onto an HTTP response. */
function sendDispatchResult(reply: FastifyReply, result: DispatchResult) {
  switch (result.kind) {
    case 'oa-not-found':
      return reply.code(404).send({ message: 'OA not found' })
    case 'webhook-not-ready':
      return reply.code(400).send({ message: 'Webhook not configured or not verified' })
    case 'delivery-failed':
      return reply
        .code(502)
        .send({ message: 'Webhook delivery failed', status: result.status })
    case 'delivery-timeout':
      return reply.code(504).send({ message: 'Webhook delivery timeout' })
    case 'ok':
      return reply.send({ success: true })
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
  const { oa, db, auth } = deps

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

      const result = await dispatchSignedWebhook({
        oa,
        db,
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

      const result = await dispatchSignedWebhook({
        oa,
        db,
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
