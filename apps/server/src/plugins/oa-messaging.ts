import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { and, eq } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { schema } from '@vine/db'
import { oaAccessToken, oaFriendship } from '@vine/db/schema-oa'
import { FlexMessageSchema } from '@vine/flex-schema'
import * as v from 'valibot'
import type { createOAService } from '../services/oa'

type MessagingPluginDeps = {
  oa: ReturnType<typeof createOAService>
  db: NodePgDatabase<typeof schema>
}

// ============ Message Validation ============

export type ValidationSuccess = {
  valid: true
  type: string
  text: string | null
  metadata: string | null
}
export type ValidationFailure = { valid: false; error: string }

export function validateMessage(msg: unknown): ValidationSuccess | ValidationFailure {
  if (typeof msg !== 'object' || msg === null) {
    return { valid: false, error: 'Message must be an object' }
  }

  const { type, text, ...rest } = msg as Record<string, unknown>

  if (!type || typeof type !== 'string') {
    return { valid: false, error: 'Message must have a "type" field' }
  }

  switch (type) {
    case 'text': {
      if (typeof text !== 'string') {
        return { valid: false, error: 'Text message must have a "text" field' }
      }
      if (text.length > 5000) {
        return { valid: false, error: 'Text message must not exceed 5000 characters' }
      }
      return { valid: true, type, text, metadata: null }
    }

    case 'flex': {
      const result = v.safeParse(FlexMessageSchema, msg)
      if (!result.success) {
        const flatResult = v.flatten<typeof FlexMessageSchema>(result.issues)
        return {
          valid: false,
          error: `Invalid flex message: ${JSON.stringify(flatResult.nested)}`,
        }
      }
      return {
        valid: true,
        type,
        text: null,
        metadata: JSON.stringify(result.output),
      }
    }

    case 'image':
    case 'video':
    case 'audio':
    case 'sticker':
    case 'location':
    case 'template': {
      return {
        valid: true,
        type,
        text: null,
        metadata: JSON.stringify(rest),
      }
    }

    default:
      return { valid: false, error: `Unsupported message type: "${type}"` }
  }
}

// ============ Token Extraction ============

async function extractOaFromToken(
  request: FastifyRequest,
  db: NodePgDatabase<typeof schema>,
): Promise<string> {
  const authHeader = request.headers['authorization']
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Missing Bearer token')
  }
  const token = authHeader.slice(7)

  const [tokenRecord] = await db
    .select()
    .from(oaAccessToken)
    .where(eq(oaAccessToken.token, token))
    .limit(1)

  if (!tokenRecord) throw new Error('Invalid access token')
  if (tokenRecord.expiresAt && new Date(tokenRecord.expiresAt) < new Date()) {
    throw new Error('Access token expired')
  }

  return tokenRecord.oaId
}

// ============ Plugin ============

type MessageItem = { type: string; text?: string; [key: string]: unknown }

export async function oaMessagingPlugin(
  fastify: FastifyInstance,
  deps: MessagingPluginDeps,
) {
  const { oa, db } = deps

  // Reply Messages
  fastify.post(
    '/api/oa/v2/bot/message/reply',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const oaId = await extractOaFromToken(request, db)
        const body = request.body as { replyToken: string; messages: MessageItem[] }

        if (!body.replyToken || !body.messages?.length) {
          return await reply.code(400).send({
            message: 'replyToken and messages are required',
            code: 'INVALID_REQUEST',
          })
        }

        // Validate all messages first
        const validated = body.messages.map((msg) => {
          const result = validateMessage(msg)
          if (!result.valid) return result
          return result
        })

        const failed = validated.find((r) => !r.valid)
        if (failed && !failed.valid) {
          return await reply.code(400).send({
            message: failed.error,
            code: 'INVALID_MESSAGE_TYPE',
          })
        }

        // Deliver messages (reply token tracking is a future enhancement)
        const validMessages = validated as ValidationSuccess[]
        for (const msg of validMessages) {
          // Reply requires knowing the chat from the replyToken.
          // For now, reply delivery is deferred until reply token tracking is implemented.
          // Messages are validated but not yet delivered on reply.
        }

        return await reply.send({})
      } catch (err) {
        if (err instanceof Error && err.message === 'Missing Bearer token') {
          return reply
            .code(401)
            .send({ message: 'Missing Bearer token', code: 'INVALID_TOKEN' })
        }
        if (err instanceof Error && err.message === 'Invalid access token') {
          return reply
            .code(401)
            .send({ message: 'Invalid access token', code: 'INVALID_TOKEN' })
        }
        if (err instanceof Error && err.message === 'Access token expired') {
          return reply
            .code(401)
            .send({ message: 'Access token expired', code: 'TOKEN_EXPIRED' })
        }
        return reply.code(500).send({ message: 'Internal server error' })
      }
    },
  )

  // Push Messages
  fastify.post(
    '/api/oa/v2/bot/message/push',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const oaId = await extractOaFromToken(request, db)
        const body = request.body as { to: string; messages: MessageItem[] }

        if (!body.to || !body.messages?.length) {
          return await reply
            .code(400)
            .send({ message: 'to and messages are required', code: 'INVALID_REQUEST' })
        }

        const [friendship] = await db
          .select()
          .from(oaFriendship)
          .where(and(eq(oaFriendship.oaId, oaId), eq(oaFriendship.userId, body.to)))
          .limit(1)

        if (!friendship || friendship.status !== 'friend') {
          return await reply
            .code(403)
            .send({ message: 'User is not a friend of this OA', code: 'NOT_FRIEND' })
        }

        // Validate all messages first
        const validated = body.messages.map((msg) => validateMessage(msg))

        const failed = validated.find((r) => !r.valid)
        if (failed && !failed.valid) {
          return await reply.code(400).send({
            message: failed.error,
            code: 'INVALID_MESSAGE_TYPE',
          })
        }

        // Deliver messages
        const validMessages = validated as ValidationSuccess[]
        for (const msg of validMessages) {
          await oa.sendOAMessage(oaId, body.to, {
            type: msg.type,
            text: msg.text,
            metadata: msg.metadata,
          })
        }

        return await reply.send({})
      } catch (err) {
        if (err instanceof Error && err.message === 'Missing Bearer token') {
          return reply
            .code(401)
            .send({ message: 'Missing Bearer token', code: 'INVALID_TOKEN' })
        }
        if (err instanceof Error && err.message === 'Invalid access token') {
          return reply
            .code(401)
            .send({ message: 'Invalid access token', code: 'INVALID_TOKEN' })
        }
        if (err instanceof Error && err.message === 'Access token expired') {
          return reply
            .code(401)
            .send({ message: 'Access token expired', code: 'TOKEN_EXPIRED' })
        }
        return reply.code(500).send({ message: 'Internal server error' })
      }
    },
  )

  // Get Profile
  fastify.get(
    '/api/oa/v2/bot/profile/:userId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        await extractOaFromToken(request, db)
        const params = request.params as { userId: string }

        return await reply.send({
          userId: params.userId,
          displayName: 'User',
          pictureUrl: '',
        })
      } catch (err) {
        if (err instanceof Error && err.message === 'Invalid access token') {
          return reply
            .code(401)
            .send({ message: 'Invalid access token', code: 'INVALID_TOKEN' })
        }
        return reply.code(500).send({ message: 'Internal server error' })
      }
    },
  )

  // OAuth: Issue Access Token (short-lived)
  fastify.post(
    '/api/oa/v2/oauth/accessToken',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = request.body as Record<string, string>

        if (body.grant_type === 'client_credentials' && body.client_assertion_type) {
          // JWT v2.1 flow — MVP: return placeholder
          return await reply.code(501).send({ message: 'JWT v2.1 not yet implemented' })
        }

        // Short-lived token flow
        const { client_id: oaId, client_secret: channelSecret } = body
        if (!oaId || !channelSecret) {
          return await reply
            .code(400)
            .send({ message: 'client_id and client_secret required' })
        }

        const account = await oa.getOfficialAccount(oaId)
        if (!account || account.channelSecret !== channelSecret) {
          return await reply.code(401).send({ message: 'Invalid credentials' })
        }

        const result = await oa.issueAccessToken({
          oaId: account.id,
          type: 'short_lived',
        })
        return await reply.send(result)
      } catch {
        return reply.code(500).send({ message: 'Internal server error' })
      }
    },
  )

  // OAuth: Revoke Access Token
  fastify.post(
    '/api/oa/v2/oauth/revoke',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = request.body as { access_token: string }
        const [tokenRecord] = await db
          .select({ id: oaAccessToken.id })
          .from(oaAccessToken)
          .where(eq(oaAccessToken.token, body.access_token))
          .limit(1)

        if (tokenRecord) {
          await oa.revokeAccessToken(tokenRecord.id)
        }
        return await reply.send({})
      } catch {
        return reply.code(500).send({ message: 'Internal server error' })
      }
    },
  )
}
