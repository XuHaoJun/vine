import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { and, eq } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { schema } from '@vine/db'
import { message } from '@vine/db/schema-public'
import { oaAccessToken, oaFriendship } from '@vine/db/schema-oa'
import { FlexMessageSchema } from '@vine/flex-schema'
import * as v from 'valibot'
import type { DriveService } from '@vine/drive'
import type { createOAService } from '../services/oa'

const CONTENT_TYPE_MAP: Record<string, { ext: string; mimeTypes: string[] }> = {
  image: { ext: 'jpg', mimeTypes: ['image/jpeg', 'image/png'] },
  video: { ext: 'mp4', mimeTypes: ['video/mp4'] },
  audio: { ext: 'm4a', mimeTypes: ['audio/m4a', 'audio/mp4', 'audio/x-m4a'] },
}

function getExtensionForContentType(contentType: string, msgType: string): string | null {
  const config = CONTENT_TYPE_MAP[msgType]
  if (!config) return null
  if (config.mimeTypes.includes(contentType)) return config.ext
  return null
}

type MessagingPluginDeps = {
  oa: ReturnType<typeof createOAService>
  db: NodePgDatabase<typeof schema>
  drive: DriveService
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
    case 'video': {
      const { originalContentUrl, previewImageUrl } = rest as Record<string, unknown>
      if (typeof originalContentUrl !== 'string') {
        return {
          valid: false,
          error: `${type} message must have "originalContentUrl" field`,
        }
      }
      if (!originalContentUrl.startsWith('https://')) {
        return { valid: false, error: `"originalContentUrl" must be an HTTPS URL` }
      }
      if (typeof previewImageUrl !== 'string') {
        return {
          valid: false,
          error: `${type} message must have "previewImageUrl" field`,
        }
      }
      if (!previewImageUrl.startsWith('https://')) {
        return { valid: false, error: `"previewImageUrl" must be an HTTPS URL` }
      }
      return {
        valid: true,
        type,
        text: null,
        metadata: JSON.stringify(rest),
      }
    }

    case 'audio': {
      const { originalContentUrl, duration } = rest as Record<string, unknown>
      if (typeof originalContentUrl !== 'string') {
        return {
          valid: false,
          error: 'audio message must have "originalContentUrl" field',
        }
      }
      if (!originalContentUrl.startsWith('https://')) {
        return { valid: false, error: `"originalContentUrl" must be an HTTPS URL` }
      }
      if (duration !== undefined && typeof duration !== 'number') {
        return { valid: false, error: '"duration" must be a number (milliseconds)' }
      }
      return {
        valid: true,
        type,
        text: null,
        metadata: JSON.stringify(rest),
      }
    }

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
  const { oa, db, drive } = deps

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

        // Deliver messages
        const validMessages = validated as ValidationSuccess[]

        const tokenResult = await oa.resolveReplyToken(body.replyToken)
        if (!tokenResult.valid) {
          const statusMap = {
            not_found: 400,
            already_used: 400,
            expired: 400,
          }
          return await reply.code(statusMap[tokenResult.reason] ?? 400).send({
            message: `Reply token ${tokenResult.reason}`,
            code: 'INVALID_REPLY_TOKEN',
          })
        }

        for (const msg of validMessages) {
          await oa.sendOAMessage(oaId, tokenResult.record.userId, {
            type: msg.type,
            text: msg.text,
            metadata: msg.metadata,
          })
        }

        await oa.markReplyTokenUsed(tokenResult.record.id)

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

        // Check and increment quota
        const allowed = await oa.checkAndIncrementUsage(oaId)
        if (!allowed) {
          return await reply.code(429).send({
            message: 'You have reached your monthly limit.',
            code: 'QUOTA_EXCEEDED',
          })
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

  // Get Quota
  fastify.get(
    '/api/oa/v2/bot/message/quota',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const oaId = await extractOaFromToken(request, db)
        const quota = await oa.getQuota(oaId)
        return await reply.send(quota)
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

  // Get Quota Consumption
  fastify.get(
    '/api/oa/v2/bot/message/quota/consumption',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const oaId = await extractOaFromToken(request, db)
        const consumption = await oa.getConsumption(oaId)
        return await reply.send(consumption)
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

  // Upload Message Content (image/video/audio)
  fastify.post(
    '/api/oa/v2/bot/message/:messageId/content',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const oaId = await extractOaFromToken(request, db)
        const { messageId } = request.params as { messageId: string }
        const contentType = request.headers['content-type']

        const [msg] = await db
          .select()
          .from(message)
          .where(eq(message.id, messageId))
          .limit(1)

        if (!msg || msg.oaId !== oaId) {
          return reply.code(404).send({ message: 'Message not found' })
        }

        const msgType = msg.type
        if (!['image', 'video', 'audio'].includes(msgType)) {
          return reply
            .code(400)
            .send({ message: 'Message type does not support content upload' })
        }

        const ext = getExtensionForContentType(contentType ?? '', msgType)
        if (!ext) {
          return reply.code(415).send({ message: 'Unsupported media type' })
        }

        const body = request.body as Buffer
        if (body.length > 20 * 1024 * 1024) {
          return reply.code(400).send({ message: 'Content size exceeds 20MB limit' })
        }

        const key = `message/${oaId}/${messageId}.${ext}`
        await drive.put(key, Buffer.from(body), contentType ?? 'application/octet-stream')

        return reply.send({})
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

  // Get Message Content (image/video/audio)
  fastify.get(
    '/api/oa/v2/bot/message/:messageId/content',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const oaId = await extractOaFromToken(request, db)
        const { messageId } = request.params as { messageId: string }
        const query = request.query as { fileExtension?: string }

        const [msg] = await db
          .select()
          .from(message)
          .where(eq(message.id, messageId))
          .limit(1)

        if (!msg || msg.oaId !== oaId) {
          return reply.code(404).send({ message: 'Message not found' })
        }

        const msgType = msg.type
        if (!['image', 'video', 'audio'].includes(msgType)) {
          return reply
            .code(400)
            .send({ message: 'Message type does not support content retrieval' })
        }

        const ext = query.fileExtension ?? CONTENT_TYPE_MAP[msgType]?.ext ?? 'bin'
        const key = `message/${oaId}/${messageId}.${ext}`

        const fileExists = await drive.exists(key)
        if (!fileExists) {
          return reply.code(404).send({ message: 'Content not found' })
        }

        const file = await drive.get(key)
        return reply
          .header('Content-Type', file.mimeType ?? 'application/octet-stream')
          .header('Content-Length', file.size)
          .send(file.content)
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
