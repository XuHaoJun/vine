import { getAuthDataFromRequest } from '@take-out/better-auth-utils/server'
import type { FastifyInstance } from 'fastify'
import type { createMiniAppService } from '../services/mini-app'
import type { createLiffService } from '../services/liff'
import { toWebRequest } from '../utils'

type MiniAppPublicDeps = {
  miniApp: ReturnType<typeof createMiniAppService>
  liff: Pick<ReturnType<typeof createLiffService>, 'getLiffAppByDbId'>
  auth: { api: any }
}

export async function miniAppPublicPlugin(
  app: FastifyInstance,
  deps: MiniAppPublicDeps,
): Promise<void> {
  app.get<{ Params: { miniAppId: string } }>(
    '/api/liff/v1/mini-app/:miniAppId',
    async (request, reply) => {
      const { miniAppId } = request.params
      const m = await deps.miniApp.getMiniApp(miniAppId)
      if (!m) return reply.status(404).send({ error: 'Mini App not found' })
      const [linkedOaIds, liffAppRow] = await Promise.all([
        deps.miniApp.listLinkedOaIds(miniAppId),
        deps.liff.getLiffAppByDbId(m.liffAppId),
      ])

      const webReq = toWebRequest(request)
      const authData = await getAuthDataFromRequest(deps.auth, webReq).catch(() => null)
      if (authData?.id && m.isPublished) {
        await deps.miniApp.recordRecent({ userId: authData.id, miniAppId })
      }

      return reply.send({
        id: m.id,
        name: m.name,
        iconUrl: m.iconUrl ?? null,
        description: m.description ?? null,
        category: m.category ?? null,
        liffId: liffAppRow?.liffId ?? null,
        isPublished: m.isPublished,
        linkedOaIds,
      })
    },
  )
}
