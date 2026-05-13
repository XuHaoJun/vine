import { getAuthDataFromRequest } from '@take-out/better-auth-utils/server'
import { logger } from '../lib/logger'
import { toWebRequest } from '../utils'
import type { createOAContactExportService } from '../services/oa-contact-export'
import type { createAuthServer } from './auth'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'

type OAContactExportPluginDeps = {
  auth: ReturnType<typeof createAuthServer>
  contactExport: ReturnType<typeof createOAContactExportService>
}

type ExportParams = {
  oaId: string
}

export async function oaContactExportPlugin(
  fastify: FastifyInstance,
  deps: OAContactExportPluginDeps,
) {
  fastify.get(
    '/api/manager/oa/:oaId/contacts/export.csv',
    async (request: FastifyRequest<{ Params: ExportParams }>, reply: FastifyReply) => {
      const webReq = toWebRequest(request)
      const authData = await getAuthDataFromRequest(deps.auth, webReq).catch(() => null)
      if (!authData?.id) {
        return reply.code(401).send({ message: 'Unauthorized' })
      }

      try {
        const result = await deps.contactExport.exportContactsCsv({
          oaId: request.params.oaId,
          ownerId: authData.id,
          exportedAt: new Date(),
        })

        if (!result) {
          return reply.code(404).send({ message: 'Official account not found' })
        }

        return reply
          .header('Content-Type', 'text/csv; charset=utf-8')
          .header('Content-Disposition', `attachment; filename="${result.filename}"`)
          .send(result.csv)
      } catch (err) {
        logger.error(
          { err, oaId: request.params.oaId },
          '[oa-contact-export] export failed',
        )
        return reply.code(500).send({ message: 'Export failed' })
      }
    },
  )
}
