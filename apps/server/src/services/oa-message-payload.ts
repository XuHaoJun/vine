import { FlexMessageSchema, QuickReplySchema } from '@vine/flex-schema'
import { ImagemapMessageSchema } from '@vine/imagemap-schema'
import * as v from 'valibot'

export type NormalizedOAMessage = {
  type: string
  text: string | null
  metadata: string | null
}

function stringifyMetadata(value: Record<string, unknown> | null): string | null {
  return value ? JSON.stringify(value) : null
}

function attachQuickReply(
  baseMetadata: Record<string, unknown> | null,
  rawQuickReply: unknown,
): string | null {
  if (rawQuickReply === undefined) return stringifyMetadata(baseMetadata)
  const result = v.safeParse(QuickReplySchema, rawQuickReply)
  if (!result.success) {
    const flat = v.flatten<typeof QuickReplySchema>(result.issues)
    throw new Error(`Invalid quickReply: ${JSON.stringify(flat.nested)}`)
  }
  return stringifyMetadata({ ...(baseMetadata ?? {}), quickReply: result.output })
}

export function normalizeMessagingApiMessage(msg: unknown): NormalizedOAMessage {
  if (typeof msg !== 'object' || msg === null) {
    throw new Error('Message must be an object')
  }

  const { type, text, ...rest } = msg as Record<string, unknown>
  if (!type || typeof type !== 'string') {
    throw new Error('Message must have a "type" field')
  }

  const { quickReply, ...restWithoutQuickReply } = rest as Record<string, unknown>

  switch (type) {
    case 'text': {
      if (typeof text !== 'string') throw new Error('Text message must have a "text" field')
      const trimmed = text.trim()
      if (!trimmed) throw new Error('Text message must have a non-empty "text" field')
      if (trimmed.length > 5000) throw new Error('Text message must not exceed 5000 characters')
      return { type, text: trimmed, metadata: attachQuickReply(null, quickReply) }
    }
    case 'image':
    case 'video': {
      const originalContentUrl = restWithoutQuickReply.originalContentUrl
      const previewImageUrl = restWithoutQuickReply.previewImageUrl
      if (typeof originalContentUrl !== 'string' || !originalContentUrl.startsWith('https://')) {
        throw new Error(`Invalid ${type} originalContentUrl`)
      }
      if (typeof previewImageUrl !== 'string' || !previewImageUrl.startsWith('https://')) {
        throw new Error(`Invalid ${type} previewImageUrl`)
      }
      return { type, text: null, metadata: attachQuickReply(restWithoutQuickReply, quickReply) }
    }
    case 'audio': {
      const originalContentUrl = restWithoutQuickReply.originalContentUrl
      const duration = restWithoutQuickReply.duration
      if (typeof originalContentUrl !== 'string' || !originalContentUrl.startsWith('https://')) {
        throw new Error('Invalid audio originalContentUrl')
      }
      if (duration !== undefined && typeof duration !== 'number') {
        throw new Error('Audio duration must be a number')
      }
      return { type, text: null, metadata: attachQuickReply(restWithoutQuickReply, quickReply) }
    }
    case 'flex': {
      const result = v.safeParse(FlexMessageSchema, msg)
      if (!result.success) {
        const flat = v.flatten<typeof FlexMessageSchema>(result.issues)
        throw new Error(`Invalid flex message: ${JSON.stringify(flat.nested)}`)
      }
      return { type, text: null, metadata: attachQuickReply(result.output as Record<string, unknown>, quickReply) }
    }
    case 'imagemap': {
      const result = v.safeParse(ImagemapMessageSchema, msg)
      if (!result.success) {
        const flat = v.flatten<typeof ImagemapMessageSchema>(result.issues)
        throw new Error(`Invalid imagemap message: ${JSON.stringify(flat.nested)}`)
      }
      return { type, text: null, metadata: attachQuickReply(result.output as Record<string, unknown>, quickReply) }
    }
    case 'sticker':
    case 'location': {
      return { type, text: null, metadata: attachQuickReply(restWithoutQuickReply, quickReply) }
    }
    case 'template':
      throw new Error('Unsupported message type: "template"')
    default:
      throw new Error(`Unsupported message type: "${type}"`)
  }
}

export function normalizeMessagingApiMessages(messages: unknown[]): NormalizedOAMessage[] {
  if (!Array.isArray(messages)) throw new Error('messages must be an array')
  if (messages.length === 0) throw new Error('messages must not be empty')
  return messages.map(normalizeMessagingApiMessage)
}

export function summarizeMessagingMessages(messages: unknown[]): string {
  const first = messages[0] as Record<string, unknown> | undefined
  if (!first) return ''
  const firstSummary =
    first.type === 'text' && typeof first.text === 'string'
      ? first.text.trim().slice(0, 80)
      : first.type === 'flex' && typeof first.altText === 'string'
        ? `Flex: ${first.altText}`
        : first.type === 'imagemap' && typeof first.altText === 'string'
          ? `Imagemap: ${first.altText}`
          : `${String(first.type ?? 'Message')} message`
  return messages.length > 1 ? `${messages.length} messages: ${firstSummary}` : firstSummary
}
