import { SizableText } from 'tamagui'
import type { MessageDraft, RichMessageExtension } from '../core/types'

function DisabledIcon() {
  return <SizableText size="$2">-</SizableText>
}

export function createDisabledMessageExtension(
  type: 'imagemap' | 'sticker' | 'location',
  label: string,
): RichMessageExtension<MessageDraft> {
  return {
    type,
    label,
    icon: DisabledIcon,
    group: 'disabled',
    status: 'disabled',
    priority: 0,
    createDraft: () => ({ id: crypto.randomUUID(), type, raw: null }),
    validate: () => ({ ok: false, message: `${label} messages are not enabled yet.` }),
    toMessagingApi: () => {
      throw new Error(`${label} messages are not enabled yet.`)
    },
    fromMessagingApi: () => null,
    renderEditor: () => null,
    renderPreview: () => null,
  }
}
