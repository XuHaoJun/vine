import { and, eq } from 'drizzle-orm'
import { getAuthDataFromRequest } from '@take-out/better-auth-utils/server'
import type { FastifyInstance } from 'fastify'
import { toWebRequest } from '../utils'
import type { createLiffService } from '../services/liff'
import { oaFriendship } from '@vine/db/schema-oa'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { schema } from '@vine/db'

type LiffPublicDeps = {
  liff: ReturnType<typeof createLiffService>
  auth: ReturnType<typeof import('../plugins/auth').createAuthServer>
  db: NodePgDatabase<typeof schema>
}

export async function liffPublicPlugin(
  app: FastifyInstance,
  deps: LiffPublicDeps,
): Promise<void> {
  app.get<{ Params: { liffId: string } }>(
    '/liff/v1/apps/:liffId',
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
    '/liff/v1/friendship',
    async (request, reply) => {
      const token = request.headers.authorization?.replace('Bearer ', '')
      if (!token) {
        return reply.status(401).send({ error: 'Unauthorized' })
      }

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
}
