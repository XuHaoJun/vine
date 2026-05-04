import { and, eq } from 'drizzle-orm'
import { getAuthDataFromRequest } from '@take-out/better-auth-utils/server'
import type { FastifyInstance } from 'fastify'
import { toWebRequest } from '../utils'
import type { createLiffService } from '../services/liff'
import type { createLiffRuntimeTokenService } from '../services/liff-runtime-token'
import { oaFriendship } from '@vine/db/schema-oa'
import { userPublic, chat, chatMember } from '@vine/db/schema-public'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { schema } from '@vine/db'

type LiffPublicDeps = {
  liff: ReturnType<typeof createLiffService>
  auth: ReturnType<typeof import('../plugins/auth').createAuthServer>
  db: NodePgDatabase<typeof schema>
  liffRuntimeToken: ReturnType<typeof createLiffRuntimeTokenService>
}

const ACCESS_TOKEN_EXPIRES_IN = 15 * 60

async function sendUserProfile(
  db: NodePgDatabase<typeof schema>,
  userId: string,
  reply: import('fastify').FastifyReply,
) {
  const [row] = await db
    .select()
    .from(userPublic)
    .where(eq(userPublic.id, userId))
    .limit(1)
  if (!row) {
    return reply.status(404).send({ error: 'User not found' })
  }
  return reply.send({
    userId: row.id,
    displayName: row.name ?? '',
    pictureUrl: row.image ?? '',
    statusMessage: '',
  })
}

export async function liffPublicPlugin(
  app: FastifyInstance,
  deps: LiffPublicDeps,
): Promise<void> {
  app.get<{ Params: { liffId: string } }>(
    '/api/liff/v1/apps/:liffId',
    async (request, reply) => {
      const { liffId } = request.params
      const appRecord = await deps.liff.getLiffApp(liffId)
      if (!appRecord) {
        return reply.status(404).send({ error: 'LIFF app not found' })
      }
      return reply.send({
        liffId: appRecord.liffId,
        viewType: appRecord.viewType,
        endpointUrl: appRecord.endpointUrl,
        moduleMode: appRecord.moduleMode ?? false,
        scopes: appRecord.scopes ?? [],
        botPrompt: appRecord.botPrompt ?? 'none',
        qrCode: appRecord.qrCode ?? false,
      })
    },
  )

  app.get<{ Querystring: { liffId?: string } }>(
    '/api/liff/v1/friendship',
    async (request, reply) => {
      const liffId = request.query.liffId
      if (!liffId) {
        return reply.status(400).send({ error: 'liffId is required' })
      }

      const webReq = toWebRequest(request)
      const authData = await getAuthDataFromRequest(deps.auth, webReq)
      if (!authData?.id) {
        return reply.status(401).send({ error: 'Unauthorized' })
      }

      const liffApp = await deps.liff.getLiffApp(liffId)
      if (!liffApp) {
        return reply.status(404).send({ error: 'LIFF app not found' })
      }

      const oaId = await deps.liff.getLinkedOA(liffApp.loginChannelId)
      if (!oaId) {
        return reply.send({ friendFlag: false })
      }

      const [friendship] = await deps.db
        .select()
        .from(oaFriendship)
        .where(and(eq(oaFriendship.oaId, oaId), eq(oaFriendship.userId, authData.id)))
        .limit(1)

      return reply.send({ friendFlag: !!friendship && friendship.status === 'friend' })
    },
  )

  app.get<{ Querystring: { liffId?: string } }>(
    '/api/liff/v1/me',
    async (request, reply) => {
      const liffId = request.query.liffId
      if (!liffId) {
        return reply.status(400).send({ error: 'liffId is required' })
      }

      const authHeader = request.headers.authorization
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.slice(7)
        const ctx = deps.liffRuntimeToken.resolveAccessToken(token, liffId)
        if (ctx) {
          return sendUserProfile(deps.db, ctx.userId, reply)
        }
        // Bearer token invalid — fall through to session auth for same-origin development
      }

      // Fallback: same-origin Vine session auth for development
      const webReq = toWebRequest(request)
      const authData = await getAuthDataFromRequest(deps.auth, webReq)
      if (!authData?.id) {
        return reply.status(401).send({ error: 'Unauthorized' })
      }
      return sendUserProfile(deps.db, authData.id, reply)
    },
  )

  app.post<{ Body: { liffId: string } }>(
    '/api/liff/v1/access-token',
    async (request, reply) => {
      const webReq = toWebRequest(request)
      const authData = await getAuthDataFromRequest(deps.auth, webReq)
      if (!authData?.id) {
        return reply.status(401).send({ error: 'Unauthorized' })
      }

      const { liffId } = request.body
      const appRecord = await deps.liff.getLiffApp(liffId)
      if (!appRecord) {
        return reply.status(404).send({ error: 'LIFF app not found' })
      }

      const accessToken = deps.liffRuntimeToken.createAccessToken({
        liffId,
        userId: authData.id,
        scopes: appRecord.scopes ?? [],
      })

      return reply.send({ accessToken, expiresIn: ACCESS_TOKEN_EXPIRES_IN })
    },
  )

  app.post<{ Body: { liffId: string; chatId: string } }>(
    '/api/liff/v1/launch',
    async (request, reply) => {
      const webReq = toWebRequest(request)
      const authData = await getAuthDataFromRequest(deps.auth, webReq)
      if (!authData?.id) {
        return reply.status(401).send({ error: 'Unauthorized' })
      }

      const { liffId, chatId } = request.body
      const appRecord = await deps.liff.getLiffApp(liffId)
      if (!appRecord) {
        return reply.status(404).send({ error: 'LIFF app not found' })
      }

      const [member] = await deps.db
        .select()
        .from(chatMember)
        .where(
          and(
            eq(chatMember.chatId, chatId),
            eq(chatMember.userId, authData.id),
            eq(chatMember.status, 'accepted'),
          ),
        )
        .limit(1)
      if (!member) {
        return reply.status(403).send({ error: 'Not a chat member' })
      }

      const [chatRow] = await deps.db
        .select()
        .from(chat)
        .where(eq(chat.id, chatId))
        .limit(1)

      if (!chatRow) {
        return reply.status(404).send({ error: 'Chat not found' })
      }
      const contextType = chatRow.type === 'group' ? 'group' : 'utou'

      const launchToken = deps.liffRuntimeToken.createLaunchToken({
        liffId,
        chatId,
        userId: authData.id,
        contextType,
      })

      return reply.send({ launchToken, contextType, chatId })
    },
  )

  app.get<{
    Querystring: { liffId?: string; launchToken?: string }
  }>('/api/liff/v1/launch-context', async (request, reply) => {
    const { liffId, launchToken } = request.query
    if (!liffId || !launchToken) {
      return reply.status(400).send({ error: 'liffId and launchToken are required' })
    }

    const webReq = toWebRequest(request)
    const authData = await getAuthDataFromRequest(deps.auth, webReq)
    if (!authData?.id) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    const appRecord = await deps.liff.getLiffApp(liffId)
    if (!appRecord) {
      return reply.status(404).send({ error: 'LIFF app not found' })
    }

    const ctx = deps.liffRuntimeToken.resolveLaunchToken(launchToken, liffId)
    if (!ctx || ctx.userId !== authData.id) {
      return reply.status(403).send({ error: 'Invalid or mismatched launch token' })
    }

    const [member] = await deps.db
      .select()
      .from(chatMember)
      .where(
        and(
          eq(chatMember.chatId, ctx.chatId),
          eq(chatMember.userId, authData.id),
          eq(chatMember.status, 'accepted'),
        ),
      )
      .limit(1)
    if (!member) {
      return reply.status(403).send({ error: 'Not a chat member' })
    }

    return reply.send({ chatId: ctx.chatId, contextType: ctx.contextType })
  })
}
