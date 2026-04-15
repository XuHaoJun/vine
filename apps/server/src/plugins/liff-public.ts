import type { FastifyInstance } from 'fastify'
import type { createLiffService } from '../services/liff'

type LiffPublicDeps = {
  liff: ReturnType<typeof createLiffService>
}

export async function liffPublicPlugin(
  app: FastifyInstance,
  deps: LiffPublicDeps,
): Promise<void> {
  app.get<{ Params: { liffId: string } }>(
    '/liff/v1/apps/:liffId',
    async (request, reply) => {
      const { liffId } = request.params
      const app = await deps.liff.getLiffApp(liffId)
      if (!app) {
        return reply.status(404).send({ error: 'LIFF app not found' })
      }
      return reply.send({
        liffId: app.liffId,
        viewType: app.viewType,
        endpointUrl: app.endpointUrl,
        moduleMode: app.moduleMode ?? false,
        scopes: app.scopes ?? [],
        botPrompt: app.botPrompt ?? 'none',
        qrCode: app.qrCode ?? false,
      })
    },
  )
}
