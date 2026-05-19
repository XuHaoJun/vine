import { SizableText } from 'tamagui'
import { Input } from '~/interface/forms/Input'
import type { RichMessageExtension, TextMessageDraft } from '../core/types'

function TextIcon() {
  return <SizableText size="$2">T</SizableText>
}

export function createTextExtension(): RichMessageExtension<TextMessageDraft> {
  return {
    type: 'text',
    label: 'Text',
    icon: TextIcon,
    group: 'basic',
    status: 'enabled',
    priority: 1000,
    createDraft: () => ({ id: crypto.randomUUID(), type: 'text', text: '' }),
    validate: (draft) =>
      draft.text.trim()
        ? { ok: true }
        : { ok: false, message: 'Text message cannot be empty.' },
    toMessagingApi: (draft) => ({
      type: 'text',
      text: draft.text,
      ...(draft.quickReply ? { quickReply: draft.quickReply } : {}),
    }),
    fromMessagingApi: (message) => {
      const raw = message as Record<string, unknown>
      return raw.type === 'text' && typeof raw.text === 'string'
        ? { id: crypto.randomUUID(), type: 'text', text: raw.text }
        : null
    },
    renderEditor: ({ draft, update }) => (
      <Input
        value={draft.text}
        onChangeText={(text) => update({ ...draft, text })}
        placeholder="Message text"
      />
    ),
    renderPreview: () => null,
  }
}
