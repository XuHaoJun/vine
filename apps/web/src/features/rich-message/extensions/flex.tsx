import { SizableText } from 'tamagui'
import type { FlexMessageDraft, RichMessageExtension } from '../core/types'

function FlexIcon() {
  return <SizableText size="$2">F</SizableText>
}

export function createFlexExtension(): RichMessageExtension<FlexMessageDraft> {
  return {
    type: 'flex',
    label: 'Flex',
    icon: FlexIcon,
    group: 'interactive',
    status: 'enabled',
    priority: 800,
    createDraft: () => ({
      id: crypto.randomUUID(),
      type: 'flex',
      altText: 'Flex Message',
      contents: { type: 'bubble', body: { type: 'box', layout: 'vertical', contents: [] } },
    }),
    validate: (draft) =>
      draft.altText.trim() && draft.contents
        ? { ok: true }
        : { ok: false, message: 'Flex message requires altText and contents.' },
    toMessagingApi: (draft) => ({
      type: 'flex',
      altText: draft.altText,
      contents: draft.contents,
      ...(draft.quickReply ? { quickReply: draft.quickReply } : {}),
    }),
    fromMessagingApi: () => null,
    renderEditor: () => null,
    renderPreview: () => null,
  }
}
