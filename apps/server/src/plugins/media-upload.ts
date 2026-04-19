import { randomUUID } from 'node:crypto'
import { getAuthDataFromRequest } from '@take-out/better-auth-utils/server'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import type { DriveService } from '@vine/drive'

import { toWebRequest } from '../utils'
import { logger } from '../lib/logger'
import type { createAuthServer } from './auth'

type MediaUploadPluginDeps = {
  auth: ReturnType<typeof createAuthServer>
  drive: DriveService
}

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'audio/mp4',
  'audio/m4a',
  'audio/x-m4a',
  'audio/mpeg',
  'audio/ogg',
  'audio/webm',
])

const MAX_FILE_SIZE = 25 * 1024 * 1024

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
  'audio/mp4': 'm4a',
  'audio/m4a': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/mpeg': 'mp3',
  'audio/ogg': 'ogg',
  'audio/webm': 'webm',
}

// Strip codec/charset parameters off a MIME type so values like
// `audio/webm;codecs=opus` (Chrome MediaRecorder) match our allow-list.
function stripMimeParams(mime: string): string {
  const base = mime.split(';')[0]?.trim()
  return base && base.length > 0 ? base : mime
}

export async function mediaUploadPlugin(
  fastify: FastifyInstance,
  deps: MediaUploadPluginDeps,
) {
  await fastify.register(import('@fastify/multipart'), {
    limits: { fileSize: MAX_FILE_SIZE, files: 1 },
  })

  fastify.post(
    '/api/v1/media/upload',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const webReq = toWebRequest(request)
      const authData = await getAuthDataFromRequest(deps.auth, webReq).catch(() => null)
      if (!authData?.id) {
        return reply.code(401).send({ message: 'Unauthorized' })
      }

      let data
      try {
        data = await request.file()
      } catch (err) {
        if (err instanceof Error && err.message.toLowerCase().includes('file too large')) {
          return reply.code(413).send({ message: 'File too large' })
        }
        logger.error({ err }, '[media-upload] file() failed')
        return reply.code(400).send({ message: 'Invalid multipart body' })
      }

      if (!data) {
        return reply.code(400).send({ message: 'No file provided' })
      }

      const baseMime = stripMimeParams(data.mimetype)

      if (!ALLOWED_MIME_TYPES.has(baseMime)) {
        return reply.code(415).send({ message: 'Unsupported file type' })
      }

      let buffer: Buffer
      try {
        buffer = await data.toBuffer()
      } catch (err) {
        if (err instanceof Error && err.message.toLowerCase().includes('file too large')) {
          return reply.code(413).send({ message: 'File too large' })
        }
        logger.error({ err }, '[media-upload] toBuffer failed')
        return reply.code(500).send({ message: 'Upload failed' })
      }

      const ext = EXT_BY_MIME[baseMime] ?? 'bin'
      const key = `media/${authData.id}/${randomUUID()}.${ext}`

      try {
        await deps.drive.put(key, buffer, baseMime)
        const url = await deps.drive.getUrl(key)
        return reply.send({ url })
      } catch (err) {
        logger.error({ err }, '[media-upload] drive write failed')
        return reply.code(500).send({ message: 'Upload failed' })
      }
    },
  )
}
