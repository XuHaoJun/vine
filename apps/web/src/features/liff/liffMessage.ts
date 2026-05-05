export type LiffMessageMethod = 'sendMessages' | 'shareTargetPicker'

export type ConvertedLiffMessage = {
  type: 'text' | 'image' | 'video' | 'audio' | 'sticker' | 'location' | 'flex'
  text: string | null
  metadata: string | null
}

export type LiffMessageValidationError = {
  code: 'INVALID_ARGUMENT' | 'UNSUPPORTED_MESSAGE' | 'PERMISSION_DENIED'
  message: string
}

type Result =
  | { ok: true; messages: ConvertedLiffMessage[] }
  | { ok: false; error: LiffMessageValidationError }

function err(code: LiffMessageValidationError['code'], message: string): Result {
  return { ok: false, error: { code, message } }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function isHttpsUrl(v: unknown): v is string {
  return typeof v === 'string' && v.startsWith('https://')
}

const SEND_MESSAGES_ALLOWED = new Set([
  'text',
  'sticker',
  'image',
  'video',
  'audio',
  'location',
  'flex',
])
const SHARE_TARGET_ALLOWED = new Set([
  'text',
  'image',
  'video',
  'audio',
  'location',
  'flex',
])
const DISALLOWED_KEYS = new Set(['quickReply', 'quoteToken'])
const SYSTEM_PACKAGE_RE = /^\d+$/

function hasDisallowedKeys(msg: Record<string, unknown>): boolean {
  for (const key of DISALLOWED_KEYS) {
    if (key in msg) return true
  }
  return false
}

function hasTextEmojis(msg: Record<string, unknown>): boolean {
  return 'emojis' in msg
}

function hasVideoTrackingId(msg: Record<string, unknown>): boolean {
  return 'trackingId' in msg
}

function containsNonUriAction(node: unknown): boolean {
  if (!isRecord(node)) return false
  if ('action' in node && isRecord(node.action)) {
    if (node.action.type !== 'uri') return true
  }
  for (const value of Object.values(node)) {
    if (isRecord(value)) {
      if (containsNonUriAction(value)) return true
    } else if (Array.isArray(value)) {
      for (const item of value) {
        if (containsNonUriAction(item)) return true
      }
    }
  }
  return false
}

function convertMessage(msg: Record<string, unknown>): ConvertedLiffMessage | null {
  const type = msg.type as string
  if (type === 'text') {
    return {
      type: 'text',
      text: typeof msg.text === 'string' ? msg.text : null,
      metadata: null,
    }
  }
  if (type === 'sticker') {
    return {
      type: 'sticker',
      text: null,
      metadata: JSON.stringify({ packageId: msg.packageId, stickerId: msg.stickerId }),
    }
  }
  if (type === 'image') {
    return {
      type: 'image',
      text: null,
      metadata: JSON.stringify({
        originalContentUrl: msg.originalContentUrl,
        previewImageUrl: msg.previewImageUrl,
      }),
    }
  }
  if (type === 'video') {
    return {
      type: 'video',
      text: null,
      metadata: JSON.stringify({
        originalContentUrl: msg.originalContentUrl,
        previewImageUrl: msg.previewImageUrl,
      }),
    }
  }
  if (type === 'audio') {
    return {
      type: 'audio',
      text: null,
      metadata: JSON.stringify({
        originalContentUrl: msg.originalContentUrl,
        duration: msg.duration,
      }),
    }
  }
  if (type === 'location') {
    return {
      type: 'location',
      text: null,
      metadata: JSON.stringify({
        title: msg.title,
        address: msg.address,
        latitude: msg.latitude,
        longitude: msg.longitude,
      }),
    }
  }
  if (type === 'flex') {
    return { type: 'flex', text: null, metadata: JSON.stringify(msg.contents ?? msg) }
  }
  return null
}

export function validateAndConvertLiffMessages(input: {
  method: LiffMessageMethod
  messages: unknown
  canUseStickerPackage?: (packageId: string) => boolean
}): Result {
  const { method, messages, canUseStickerPackage } = input

  if (!Array.isArray(messages) || messages.length === 0) {
    return err('INVALID_ARGUMENT', 'messages must be a non-empty array')
  }
  if (messages.length > 5) {
    return err('INVALID_ARGUMENT', 'messages must contain at most 5 entries')
  }

  const allowed = method === 'sendMessages' ? SEND_MESSAGES_ALLOWED : SHARE_TARGET_ALLOWED
  const converted: ConvertedLiffMessage[] = []

  for (const raw of messages) {
    if (!isRecord(raw)) {
      return err('INVALID_ARGUMENT', 'each message must be an object')
    }

    if (hasDisallowedKeys(raw)) {
      return err(
        'INVALID_ARGUMENT',
        'message contains unsupported properties (quickReply/quoteToken)',
      )
    }
    if (hasTextEmojis(raw)) {
      return err('INVALID_ARGUMENT', 'text.emojis is not supported in LIFF messages')
    }
    if (hasVideoTrackingId(raw)) {
      return err('INVALID_ARGUMENT', 'video.trackingId is not supported in LIFF messages')
    }

    const type = raw.type as string
    if (type === 'template' || type === 'imagemap') {
      return err('UNSUPPORTED_MESSAGE', `message type "${type}" is not supported in LIFF`)
    }
    if (!allowed.has(type)) {
      if (type === 'sticker' && method === 'shareTargetPicker') {
        return err(
          'UNSUPPORTED_MESSAGE',
          'sticker is not supported for shareTargetPicker',
        )
      }
      return err('UNSUPPORTED_MESSAGE', `message type "${type}" is not supported`)
    }

    if (type === 'image' || type === 'video') {
      if (!isHttpsUrl(raw.originalContentUrl)) {
        return err('INVALID_ARGUMENT', `${type} originalContentUrl must be an HTTPS URL`)
      }
    }
    if (type === 'audio') {
      if (!isHttpsUrl(raw.originalContentUrl)) {
        return err('INVALID_ARGUMENT', 'audio originalContentUrl must be an HTTPS URL')
      }
    }

    if (type === 'sticker') {
      const pkgId = raw.packageId as string
      if (typeof pkgId !== 'string' || typeof raw.stickerId !== 'number') {
        return err('INVALID_ARGUMENT', 'sticker requires packageId and stickerId')
      }
      if (!SYSTEM_PACKAGE_RE.test(pkgId)) {
        if (!canUseStickerPackage || !canUseStickerPackage(pkgId)) {
          return err('PERMISSION_DENIED', `no entitlement for sticker package "${pkgId}"`)
        }
      }
    }

    if (type === 'flex' && containsNonUriAction(raw.contents)) {
      return err('INVALID_ARGUMENT', 'flex actions must be of type "uri" only')
    }

    const c = convertMessage(raw)
    if (!c) {
      return err('INVALID_ARGUMENT', `unexpected message type "${type}"`)
    }
    converted.push(c)
  }

  return { ok: true, messages: converted }
}
