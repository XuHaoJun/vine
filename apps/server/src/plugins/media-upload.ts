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

type MediaKind = 'image' | 'video' | 'audio'

type MediaRule = {
  kind: MediaKind
  ext: string
  /** Per-type max size in bytes. Aligned with LINE Messaging API spec where
   *  practical (image: 10 MB), and clamped to a v1-safe in-memory cap for
   *  video/audio (LINE allows 200 MB; we cap at 25 MB until DriveService
   *  grows a putStream API — see spec "Future Work"). */
  maxSize: number
}

const MB = 1024 * 1024

// MIME allow-list. Matches LINE Messaging API
// (https://developers.line.biz/en/reference/messaging-api/) for image and
// video. Audio is LINE-strict (mp3, m4a) PLUS a small set of browser
// MediaRecorder outputs (webm/ogg/opus) since vine is a LINE-clone, not an
// integration — we control both ends and want web mic recording to work
// without server-side transcoding. The audio extension is kept stable so
// the file lands on disk with a recognizable name regardless of source.
const MEDIA_RULES: Record<string, MediaRule> = {
  // image — LINE: JPEG, PNG, 10 MB
  'image/jpeg': { kind: 'image', ext: 'jpg', maxSize: 10 * MB },
  'image/png': { kind: 'image', ext: 'png', maxSize: 10 * MB },
  // video — LINE: mp4, 200 MB. We cap at 25 MB for v1 (in-memory upload).
  'video/mp4': { kind: 'video', ext: 'mp4', maxSize: 25 * MB },
  // audio LINE-strict — mp3, m4a, 200 MB. We cap at 25 MB for v1.
  'audio/mpeg': { kind: 'audio', ext: 'mp3', maxSize: 25 * MB },
  'audio/mp4': { kind: 'audio', ext: 'm4a', maxSize: 25 * MB },
  'audio/x-m4a': { kind: 'audio', ext: 'm4a', maxSize: 25 * MB },
  // audio browser-recorder pragma — Chrome/Firefox MediaRecorder output.
  'audio/webm': { kind: 'audio', ext: 'webm', maxSize: 25 * MB },
  'audio/ogg': { kind: 'audio', ext: 'ogg', maxSize: 25 * MB },
}

const MAX_FILE_SIZE = Object.values(MEDIA_RULES).reduce(
  (max, r) => Math.max(max, r.maxSize),
  0,
)

/** Strip codec/charset parameters off a MIME type so values like
 *  `audio/webm;codecs=opus` (Chrome MediaRecorder) match our allow-list.
 *  Exported for unit testing. */
export function stripMimeParams(mime: string): string {
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
      const rule = MEDIA_RULES[baseMime]

      if (!rule) {
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

      // Per-type size cap. multipart's global cap rejects payloads above the
      // largest type's limit; this enforces the smaller per-type limits
      // (e.g. images > 10 MB, even though videos up to 25 MB are allowed).
      if (buffer.byteLength > rule.maxSize) {
        const limitMb = Math.round(rule.maxSize / MB)
        return reply.code(413).send({
          message: `${rule.kind} exceeds the ${limitMb} MB limit`,
        })
      }

      const key = `media/${authData.id}/${randomUUID()}.${rule.ext}`

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
