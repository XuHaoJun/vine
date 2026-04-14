import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { and, eq } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { schema } from '@vine/db'
import { oaAccessToken } from '@vine/db/schema-oa'
import type { DriveService } from '@vine/drive'
import type { createOAService } from '../services/oa'
import { validateRichMenu } from '@vine/richmenu-schema'
import type { RichMenuArea } from '@vine/richmenu-schema'

class MissingBearerTokenError extends Error {}
class InvalidAccessTokenError extends Error {}
class AccessTokenExpiredError extends Error {}

type RichMenuPluginDeps = {
  oa: ReturnType<typeof createOAService>
  db: NodePgDatabase<typeof schema>
  drive: DriveService
}

type RichMenuObjectResponse = {
  size: { width: number; height: number }
  selected: boolean
  name: string
  chatBarText: string
  areas: RichMenuArea[]
}

async function extractOaFromToken(
  request: FastifyRequest,
  db: NodePgDatabase<typeof schema>,
): Promise<string> {
  const authHeader = request.headers['authorization']
  if (!authHeader?.startsWith('Bearer ')) {
    throw new MissingBearerTokenError()
  }
  const token = authHeader.slice(7)

  const [tokenRecord] = await db
    .select()
    .from(oaAccessToken)
    .where(eq(oaAccessToken.token, token))
    .limit(1)

  if (!tokenRecord) throw new InvalidAccessTokenError()
  if (tokenRecord.expiresAt && new Date(tokenRecord.expiresAt) < new Date()) {
    throw new AccessTokenExpiredError()
  }

  return tokenRecord.oaId
}

function buildRichMenuResponse(rm: {
  richMenuId: string
  name: string
  chatBarText: string
  selected: boolean
  sizeWidth: number
  sizeHeight: number
  areas: unknown
}): RichMenuObjectResponse {
  return {
    size: { width: rm.sizeWidth, height: rm.sizeHeight },
    selected: rm.selected,
    name: rm.name,
    chatBarText: rm.chatBarText,
    areas: rm.areas as RichMenuArea[],
  }
}

export async function oaRichMenuPlugin(
  fastify: FastifyInstance,
  deps: RichMenuPluginDeps,
) {
  const { oa, db, drive } = deps

  fastify.setErrorHandler((err, _request, reply) => {
    if (err instanceof MissingBearerTokenError) {
      return reply
        .code(401)
        .send({ message: 'Missing Bearer token', code: 'INVALID_TOKEN' })
    }
    if (err instanceof InvalidAccessTokenError) {
      return reply
        .code(401)
        .send({ message: 'Invalid access token', code: 'INVALID_TOKEN' })
    }
    if (err instanceof AccessTokenExpiredError) {
      return reply
        .code(401)
        .send({ message: 'Access token expired', code: 'TOKEN_EXPIRED' })
    }
    return reply.code(500).send({ message: 'Internal server error' })
  })

  fastify.post(
    '/v2/bot/richmenu',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const oaId = await extractOaFromToken(request, db)
      const body = request.body

      const validation = validateRichMenu(body)
      if (!validation.success) {
        const firstError = validation.errors[0]
        return reply.code(400).send({ message: firstError.message })
      }

      const menu = await oa.createRichMenu({
        oaId,
        name: validation.data.name,
        chatBarText: validation.data.chatBarText,
        selected: validation.data.selected,
        sizeWidth: validation.data.size.width,
        sizeHeight: validation.data.size.height,
        areas: validation.data.areas,
      })

      return reply.send({ richMenuId: menu.richMenuId })
    },
  )

  fastify.post(
    '/v2/bot/richmenu/validate',
    async (request: FastifyRequest, reply: FastifyReply) => {
      await extractOaFromToken(request, db)
      const body = request.body

      const validation = validateRichMenu(body)
      if (!validation.success) {
        const firstError = validation.errors[0]
        return reply.code(400).send({
          message: 'The request body has 1 error(s)',
          details: [{ message: firstError.message, property: firstError.path }],
        })
      }

      return reply.send({})
    },
  )

  fastify.post(
    '/v2/bot/richmenu/:richMenuId/content',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const oaId = await extractOaFromToken(request, db)
      const { richMenuId } = request.params as { richMenuId: string }

      const menu = await oa.getRichMenu(oaId, richMenuId)
      if (!menu) {
        return reply.code(404).send({ message: 'Not found' })
      }

      const contentType = request.headers['content-type']
      if (
        !contentType ||
        (!contentType.includes('image/png') && !contentType.includes('image/jpeg'))
      ) {
        return reply.code(415).send({ message: 'Unsupported media type' })
      }

      const body = request.body as Buffer
      if (body.length > 1024 * 1024) {
        return reply.code(400).send({ message: 'Image size exceeds 1MB limit' })
      }

      const key = `richmenu/${oaId}/${richMenuId}.${contentType.includes('jpeg') ? 'jpg' : 'png'}`
      await drive.put(key, Buffer.from(body), contentType)

      await oa.setRichMenuImage(oaId, richMenuId, true)

      return reply.send({})
    },
  )

  fastify.get(
    '/v2/bot/richmenu/:richMenuId/content',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const oaId = await extractOaFromToken(request, db)
      const { richMenuId } = request.params as { richMenuId: string }

      const menu = await oa.getRichMenu(oaId, richMenuId)
      if (!menu) {
        return reply.code(404).send({ message: 'Not found' })
      }

      if (!menu.hasImage) {
        return reply.code(404).send({ message: 'Not found' })
      }

      const exts = ['jpg', 'png']
      let file = null
      for (const ext of exts) {
        const key = `richmenu/${oaId}/${richMenuId}.${ext}`
        if (await drive.exists(key)) {
          file = await drive.get(key)
          break
        }
      }
      if (!file) {
        return reply.code(404).send({ message: 'Not found' })
      }
      return reply
        .header('Content-Type', file.mimeType ?? 'image/jpeg')
        .header('Content-Length', file.size)
        .send(file.content)
    },
  )

  fastify.get(
    '/v2/bot/richmenu/list',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const oaId = await extractOaFromToken(request, db)

      const menus = await oa.getRichMenuList(oaId)
      const richmenus = menus.map((m) => ({
        richMenuId: m.richMenuId,
        ...buildRichMenuResponse(m),
      }))

      return reply.send({ richmenus })
    },
  )

  fastify.get(
    '/v2/bot/richmenu/:richMenuId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const oaId = await extractOaFromToken(request, db)
      const { richMenuId } = request.params as { richMenuId: string }

      const menu = await oa.getRichMenu(oaId, richMenuId)
      if (!menu) {
        return reply.code(404).send({ message: 'Not found' })
      }

      return reply.send({
        richMenuId: menu.richMenuId,
        ...buildRichMenuResponse(menu),
      })
    },
  )

  fastify.delete(
    '/v2/bot/richmenu/:richMenuId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const oaId = await extractOaFromToken(request, db)
      const { richMenuId } = request.params as { richMenuId: string }

      const menu = await oa.getRichMenu(oaId, richMenuId)
      if (!menu) {
        return reply.code(404).send({ message: 'Not found' })
      }

      await oa.deleteRichMenu(oaId, richMenuId)

      for (const ext of ['jpg', 'png']) {
        await drive.delete(`richmenu/${oaId}/${richMenuId}.${ext}`).catch(() => {})
      }

      return reply.send({})
    },
  )

  fastify.post(
    '/v2/bot/user/all/richmenu/:richMenuId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const oaId = await extractOaFromToken(request, db)
      const { richMenuId } = request.params as { richMenuId: string }

      const menu = await oa.getRichMenu(oaId, richMenuId)
      if (!menu) {
        return reply.code(404).send({ message: 'Not found' })
      }

      if (!menu.hasImage) {
        return reply.code(400).send({
          message: 'must upload richmenu image before applying it to user',
          details: [],
        })
      }

      await oa.setDefaultRichMenu(oaId, richMenuId)

      return reply.send({})
    },
  )

  fastify.delete(
    '/v2/bot/user/all/richmenu',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const oaId = await extractOaFromToken(request, db)
      await oa.clearDefaultRichMenu(oaId)
      return reply.send({})
    },
  )

  fastify.get(
    '/v2/bot/user/all/richmenu',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const oaId = await extractOaFromToken(request, db)
      const defaultMenu = await oa.getDefaultRichMenu(oaId)

      if (!defaultMenu) {
        return reply.code(404).send({ message: 'no default richmenu', details: [] })
      }

      return reply.send({ richMenuId: defaultMenu.richMenuId })
    },
  )

  fastify.post(
    '/v2/bot/user/:userId/richmenu/:richMenuId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const oaId = await extractOaFromToken(request, db)
      const { userId, richMenuId } = request.params as {
        userId: string
        richMenuId: string
      }

      const userIdRegex = /^U[0-9a-f]{32}$/
      if (!userIdRegex.test(userId)) {
        return reply
          .code(400)
          .send({ message: "The value for the 'userId' parameter is invalid" })
      }

      const menu = await oa.getRichMenu(oaId, richMenuId)
      if (!menu) {
        return reply.code(404).send({ message: 'Not found' })
      }

      if (!menu.hasImage) {
        return reply.code(400).send({
          message: 'must upload richmenu image before applying it to user',
          details: [],
        })
      }

      await oa.linkRichMenuToUser(oaId, userId, richMenuId)

      return reply.send({})
    },
  )

  fastify.delete(
    '/v2/bot/user/:userId/richmenu',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const oaId = await extractOaFromToken(request, db)
      const { userId } = request.params as { userId: string }

      const userIdRegex = /^U[0-9a-f]{32}$/
      if (!userIdRegex.test(userId)) {
        return reply
          .code(400)
          .send({ message: "The value for the 'userId' parameter is invalid" })
      }

      await oa.unlinkRichMenuFromUser(oaId, userId)

      return reply.send({})
    },
  )

  fastify.get(
    '/v2/bot/user/:userId/richmenu',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const oaId = await extractOaFromToken(request, db)
      const { userId } = request.params as { userId: string }

      const userIdRegex = /^U[0-9a-f]{32}$/
      if (!userIdRegex.test(userId)) {
        return reply
          .code(400)
          .send({ message: "The value for the 'userId' parameter is invalid" })
      }

      const link = await oa.getRichMenuIdOfUser(oaId, userId)

      if (!link) {
        return reply.code(404).send({ message: 'the user has no richmenu', details: [] })
      }

      return reply.send({ richMenuId: link.richMenuId })
    },
  )

  fastify.post(
    '/v2/bot/richmenu/bulk/link',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const oaId = await extractOaFromToken(request, db)
      const body = request.body as { richMenuId: string; userIds: string[] }

      if (!body.richMenuId || !Array.isArray(body.userIds)) {
        return reply.code(400).send({ message: 'Invalid request body' })
      }
      if (body.userIds.length > 500) {
        return reply.code(400).send({ message: 'userIds must not exceed 500' })
      }

      const menu = await oa.getRichMenu(oaId, body.richMenuId)
      if (!menu) {
        return reply.code(404).send({ message: 'richmenu not found', details: [] })
      }

      const batchSize = 50
      for (let i = 0; i < body.userIds.length; i += batchSize) {
        const batch = body.userIds.slice(i, i + batchSize)
        await Promise.all(
          batch.map((userId) => oa.linkRichMenuToUser(oaId, userId, body.richMenuId)),
        )
      }

      return reply.code(202).send({})
    },
  )

  fastify.post(
    '/v2/bot/richmenu/bulk/unlink',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const oaId = await extractOaFromToken(request, db)
      const body = request.body as { userIds: string[] }

      if (!Array.isArray(body.userIds)) {
        return reply.code(400).send({ message: 'Invalid request body' })
      }
      if (body.userIds.length > 500) {
        return reply.code(400).send({ message: 'userIds must not exceed 500' })
      }

      for (const userId of body.userIds) {
        await oa.unlinkRichMenuFromUser(oaId, userId)
      }

      return reply.code(202).send({})
    },
  )

  fastify.post(
    '/v2/bot/richmenu/alias',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const oaId = await extractOaFromToken(request, db)
      const body = request.body as { richMenuAliasId: string; richMenuId: string }

      if (!body.richMenuAliasId || typeof body.richMenuAliasId !== 'string') {
        return reply.code(400).send({ message: 'Invalid richMenuAliasId' })
      }
      if (body.richMenuAliasId.length > 32) {
        return reply
          .code(400)
          .send({ message: 'richMenuAliasId must be at most 32 characters' })
      }
      const aliasIdRegex = /^[a-zA-Z0-9_-]+$/
      if (!aliasIdRegex.test(body.richMenuAliasId)) {
        return reply.code(400).send({ message: 'Invalid richMenuAliasId format' })
      }

      const menu = await oa.getRichMenu(oaId, body.richMenuId)
      if (!menu) {
        return reply.code(400).send({ message: 'richmenu not found', details: [] })
      }

      if (!menu.hasImage) {
        return reply.code(400).send({ message: 'richmenu not found', details: [] })
      }

      await oa.createRichMenuAlias({
        oaId,
        richMenuAliasId: body.richMenuAliasId,
        richMenuId: body.richMenuId,
      })

      return reply.send({})
    },
  )

  fastify.post(
    '/v2/bot/richmenu/alias/:richMenuAliasId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const oaId = await extractOaFromToken(request, db)
      const { richMenuAliasId } = request.params as { richMenuAliasId: string }
      const body = request.body as { richMenuId: string }

      const alias = await oa.getRichMenuAlias(oaId, richMenuAliasId)
      if (!alias) {
        return reply.code(404).send({ message: 'richmenu alias not found', details: [] })
      }

      const menu = await oa.getRichMenu(oaId, body.richMenuId)
      if (!menu || !menu.hasImage) {
        return reply.code(400).send({ message: 'richmenu not found', details: [] })
      }

      await oa.updateRichMenuAlias({
        oaId,
        richMenuAliasId,
        richMenuId: body.richMenuId,
      })

      return reply.send({})
    },
  )

  fastify.delete(
    '/v2/bot/richmenu/alias/:richMenuAliasId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const oaId = await extractOaFromToken(request, db)
      const { richMenuAliasId } = request.params as { richMenuAliasId: string }

      const alias = await oa.getRichMenuAlias(oaId, richMenuAliasId)
      if (!alias) {
        return reply.code(404).send({ message: 'richmenu alias not found', details: [] })
      }

      await oa.deleteRichMenuAlias(oaId, richMenuAliasId)

      return reply.send({})
    },
  )

  fastify.get(
    '/v2/bot/richmenu/alias/list',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const oaId = await extractOaFromToken(request, db)

      const aliases = await oa.getRichMenuAliasList(oaId)

      return reply.send({
        aliases: aliases.map((a) => ({
          richMenuAliasId: a.richMenuAliasId,
          richMenuId: a.richMenuId,
        })),
      })
    },
  )

  fastify.get(
    '/v2/bot/richmenu/alias/:richMenuAliasId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const oaId = await extractOaFromToken(request, db)
      const { richMenuAliasId } = request.params as { richMenuAliasId: string }

      const alias = await oa.getRichMenuAlias(oaId, richMenuAliasId)
      if (!alias) {
        return reply.code(404).send({ message: 'richmenu alias not found', details: [] })
      }

      return reply.send({
        richMenuAliasId: alias.richMenuAliasId,
        richMenuId: alias.richMenuId,
      })
    },
  )

  fastify.post(
    '/v2/bot/richmenu/batch',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const oaId = await extractOaFromToken(request, db)
      const body = request.body as {
        operations: Array<{ type: string; from?: string; to?: string }>
        resumeRequestKey?: string
      }

      if (!Array.isArray(body.operations) || body.operations.length > 1000) {
        return reply.code(400).send({
          message: 'The request body has 1 error(s)',
          details: [
            {
              message: 'operations must have at most 1000 objects',
              property: 'operations',
            },
          ],
        })
      }

      const hasUnlinkAll = body.operations.some((op) => op.type === 'unlinkAll')
      if (hasUnlinkAll && body.operations.length > 1) {
        return reply.code(400).send({
          message: "'unlinkAll' type can't be combined with other type",
          details: [
            {
              message: "'unlinkAll' type can't be combined with other type",
              property: 'operations[].type',
            },
          ],
        })
      }

      for (const op of body.operations) {
        if (op.type === 'link' || op.type === 'unlink') {
          if (!op.from) {
            return reply.code(400).send({
              message: 'The request body has 1 error(s)',
              details: [{ message: 'from is required', property: 'operations[].from' }],
            })
          }
          const menu = await oa.getRichMenu(oaId, op.from)
          if (!menu) {
            return reply.code(404).send({
              message: 'richmenu not found',
              details: [],
            })
          }
        }
        if (op.type === 'link' && !op.to) {
          return reply.code(400).send({
            message: 'The request body has 1 error(s)',
            details: [
              {
                message: 'to is required for link operation',
                property: 'operations[].to',
              },
            ],
          })
        }
      }

      if (hasUnlinkAll) {
        await oa.unlinkAllRichMenuFromUsers(oaId)
      } else {
        for (const op of body.operations) {
          if (op.type === 'link' && op.to) {
            await oa.linkRichMenuToUser(oaId, op.from!, op.to)
          } else if (op.type === 'unlink') {
            await oa.unlinkRichMenuFromUser(oaId, op.to!)
          }
        }
      }

      return reply.send({})
    },
  )

  fastify.get(
    '/v2/bot/richmenu/progress/batch',
    async (request: FastifyRequest, reply: FastifyReply) => {
      await extractOaFromToken(request, db)
      const { requestId } = request.query as { requestId?: string }

      if (!requestId) {
        return reply.code(400).send({ message: 'requestId is required' })
      }

      return reply.send({
        phase: 'succeeded',
        acceptedTime: new Date().toISOString(),
        completedTime: new Date().toISOString(),
      })
    },
  )

  fastify.post(
    '/v2/bot/richmenu/validate/batch',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const oaId = await extractOaFromToken(request, db)
      const body = request.body as {
        operations: Array<{ type: string; from?: string; to?: string }>
      }

      if (!Array.isArray(body.operations) || body.operations.length > 1000) {
        return reply.code(400).send({
          message: 'The request body has 1 error(s)',
          details: [
            {
              message: 'operations must have at most 1000 objects',
              property: 'operations',
            },
          ],
        })
      }

      const hasUnlinkAll = body.operations.some((op) => op.type === 'unlinkAll')
      if (hasUnlinkAll && body.operations.length > 1) {
        return reply.code(400).send({
          message: "'unlinkAll' type can't be combined with other type",
          details: [
            {
              message: "'unlinkAll' type can't be combined with other type",
              property: 'operations[].type',
            },
          ],
        })
      }

      for (const op of body.operations) {
        if (op.type === 'link' || op.type === 'unlink') {
          if (!op.from) {
            return reply.code(400).send({
              message: 'The request body has 1 error(s)',
              details: [{ message: 'from is required', property: 'operations[].from' }],
            })
          }
          const menu = await oa.getRichMenu(oaId, op.from)
          if (!menu) {
            return reply.code(404).send({
              message: 'The request body has 1 error(s)',
              details: [
                {
                  message: `Richmenu (${op.from}) is not found`,
                  property: 'operations[].from',
                },
              ],
            })
          }
        }
        if (op.type === 'link' && !op.to) {
          return reply.code(400).send({
            message: 'The request body has 1 error(s)',
            details: [
              {
                message: 'to is required for link operation',
                property: 'operations[].to',
              },
            ],
          })
        }
      }

      return reply.send({})
    },
  )
}
