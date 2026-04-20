import { getAuthDataFromRequest } from '@take-out/better-auth-utils/server'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { and, eq } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { schema } from '@vine/db'
import { chatMember, message } from '@vine/db/schema-public'
import { toWebRequest } from '../utils'
import { logger } from '../lib/logger'
import type { createAuthServer } from './auth'

type LocationMapPluginDeps = {
  db: NodePgDatabase<typeof schema>
  auth: ReturnType<typeof createAuthServer>
}

type LocationMetadata = {
  latitude?: number
  longitude?: number
  title?: string
  address?: string
}

const GEOAPIFY_API_KEY = process.env['GEOAPIFY_API_KEY']

function buildGeoapifyUrl(lat: number, lng: number): string {
  const marker = `lonlat:${lng},${lat};color:%23ff0000;size:medium`
  const params = new URLSearchParams({
    center: `lonlat:${lng},${lat}`,
    zoom: '15',
    width: '280',
    height: '140',
    format: 'png',
    marker,
  })
  return `https://maps.geoapify.com/v1/staticmap?${params}&apiKey=${GEOAPIFY_API_KEY}`
}

function buildSvgFallback(meta: LocationMetadata): Buffer {
  const title = meta.title ?? '位置'
  const address = meta.address ?? ''
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="280" height="140" viewBox="0 0 280 140">
  <rect width="280" height="140" fill="#f0f0f0"/>
  <text x="140" y="55" text-anchor="middle" font-family="sans-serif" font-size="14" font-weight="bold" fill="#333">${escapeXml(title)}</text>
  <text x="140" y="75" text-anchor="middle" font-family="sans-serif" font-size="11" fill="#666">${escapeXml(address)}</text>
  <text x="140" y="105" text-anchor="middle" font-family="sans-serif" font-size="10" fill="#999">地圖服務不可用</text>
</svg>`
  return Buffer.from(svg, 'utf8')
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export async function locationMapPlugin(
  fastify: FastifyInstance,
  deps: LocationMapPluginDeps,
) {
  const { db, auth } = deps

  fastify.get(
    '/api/location-map/:messageId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const webReq = toWebRequest(request)
      const authData = await getAuthDataFromRequest(auth, webReq).catch(() => null)
      if (!authData?.id) {
        return reply.code(401).send({ message: 'Unauthorized' })
      }

      const { messageId } = request.params as { messageId: string }
      const { chatId } = request.query as { chatId?: string }

      if (!chatId) {
        return reply.code(400).send({ message: 'chatId is required' })
      }

      const [msg] = await db
        .select()
        .from(message)
        .where(eq(message.id, messageId))
        .limit(1)

      if (!msg) {
        return reply.code(404).send({ message: 'Message not found' })
      }

      if (msg.chatId !== chatId) {
        return reply.code(404).send({ message: 'Message not found' })
      }

      if (msg.type !== 'location') {
        return reply.code(403).send({ message: 'Message is not a location type' })
      }

      const [member] = await db
        .select({ id: chatMember.id })
        .from(chatMember)
        .where(and(eq(chatMember.chatId, chatId), eq(chatMember.userId, authData.id)))
        .limit(1)

      if (!member) {
        return reply.code(403).send({ message: 'Forbidden: not a member of this chat' })
      }

      let meta: LocationMetadata = {}
      try {
        if (msg.metadata) {
          meta = JSON.parse(msg.metadata) as LocationMetadata
        }
      } catch {
        // ignore parse error
      }

      const { latitude, longitude, title, address } = meta

      if (typeof latitude !== 'number' || typeof longitude !== 'number') {
        return reply.code(404).send({ message: 'Location coordinates not found' })
      }

      if (!GEOAPIFY_API_KEY) {
        logger.warn(
          '[location-map] GEOAPIFY_API_KEY not configured, returning SVG fallback',
        )
        return reply
          .header('Content-Type', 'image/svg+xml')
          .header(
            'Content-Length',
            buildSvgFallback({ latitude, longitude, title, address }).length,
          )
          .send(buildSvgFallback({ latitude, longitude, title, address }))
      }

      const geoapifyUrl = buildGeoapifyUrl(latitude, longitude)

      let geoapifyResponse: Response
      try {
        geoapifyResponse = await fetch(geoapifyUrl, { signal: AbortSignal.timeout(5000) })
      } catch (err) {
        logger.warn(
          { err, messageId },
          '[location-map] Geoapify fetch failed, returning SVG fallback',
        )
        return reply
          .header('Content-Type', 'image/svg+xml')
          .send(buildSvgFallback({ latitude, longitude, title, address }))
      }

      if (!geoapifyResponse.ok) {
        const status = geoapifyResponse.status
        logger.warn(
          { status, messageId },
          '[location-map] Geoapify returned non-OK, returning SVG fallback',
        )
        return reply
          .header('Content-Type', 'image/svg+xml')
          .send(buildSvgFallback({ latitude, longitude, title, address }))
      }

      const imageBuffer = Buffer.from(await geoapifyResponse.arrayBuffer())
      return reply
        .header('Content-Type', 'image/png')
        .header('Content-Length', imageBuffer.length)
        .send(imageBuffer)
    },
  )
}
