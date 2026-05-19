import type { MessageDraft, RichMessageExtension, ValidationResult } from './types'

function extensionByType(extensions: RichMessageExtension[]) {
  return new Map(extensions.map((extension) => [extension.type, extension]))
}

export function validateMessageDrafts(
  drafts: MessageDraft[],
  extensions: RichMessageExtension[],
): ValidationResult {
  const byType = extensionByType(extensions)
  for (const draft of drafts) {
    const extension = byType.get(draft.type)
    if (!extension || extension.status === 'disabled') {
      return { ok: false, message: `Unsupported message type: ${draft.type}` }
    }
    const result = extension.validate(draft as never)
    if (!result.ok) return result
  }
  return { ok: true }
}

export function toMessagingApiMessages(
  drafts: MessageDraft[],
  extensions: RichMessageExtension[],
): unknown[] {
  const validation = validateMessageDrafts(drafts, extensions)
  if (!validation.ok) throw new Error(validation.message)
  const byType = extensionByType(extensions)
  return drafts.map((draft) => byType.get(draft.type)!.toMessagingApi(draft as never))
}

export function fromMessagingApiMessages(
  messages: unknown[],
  extensions: RichMessageExtension[],
): MessageDraft[] {
  return messages.map((message) => {
    const raw =
      typeof message === 'object' && message !== null
        ? (message as Record<string, unknown>)
        : null
    if (raw) {
      for (const extension of extensions) {
        const draft = extension.fromMessagingApi(message)
        if (draft) return draft
      }
    }
    return {
      id: crypto.randomUUID(),
      type: typeof raw?.type === 'string' ? raw.type : 'unknown',
      raw: message,
    }
  })
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
  return messages.length > 1
    ? `${messages.length} messages: ${firstSummary}`
    : firstSummary
}
