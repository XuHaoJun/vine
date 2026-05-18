import { memo } from 'react'
import { SizableText, YStack } from 'tamagui'
import { MessageBubbleFactory } from '~/interface/message/MessageBubbleFactory'
import type { MessageDraft } from './core/types'

function draftToBubble(draft: MessageDraft) {
  switch (draft.type) {
    case 'text': {
      const t = draft as import('./core/types').TextMessageDraft
      return { type: 'text', text: t.text, metadata: undefined }
    }
    case 'flex': {
      const f = draft as import('./core/types').FlexMessageDraft
      return {
        type: 'flex',
        text: '',
        metadata: JSON.stringify({
          type: 'flex',
          altText: f.altText,
          contents: f.contents,
        }),
      }
    }
    case 'image':
    case 'video': {
      const m = draft as import('./core/types').ImageMessageDraft
      return {
        type: draft.type,
        text: '',
        metadata: JSON.stringify({
          originalContentUrl: m.originalContentUrl,
          previewImageUrl: m.previewImageUrl,
        }),
      }
    }
    case 'audio': {
      const a = draft as import('./core/types').AudioMessageDraft
      return {
        type: 'audio',
        text: '',
        metadata: JSON.stringify({
          originalContentUrl: a.originalContentUrl,
          duration: a.duration,
        }),
      }
    }
    case 'imagemap':
      return { type: 'imagemap', text: '', metadata: JSON.stringify(draft) }
    default:
      return { type: draft.type, text: '', metadata: undefined }
  }
}

type RichMessagePreviewProps = {
  drafts: MessageDraft[]
  onSelectDraft(id: string): void
}

export const RichMessagePreview = memo(
  ({ drafts, onSelectDraft }: RichMessagePreviewProps) => (
    <YStack flex={1} bg="$color1" p="$3" gap="$2" minH={240}>
      <SizableText size="$2" color="$color10" fontWeight="700">
        Live preview
      </SizableText>
      {drafts.length === 0 ? (
        <YStack flex={1} items="center" justify="center">
          <SizableText size="$2" color="$color10">
            Add a message from the toolbar
          </SizableText>
        </YStack>
      ) : (
        drafts.map((draft) => {
          const bubble = draftToBubble(draft)
          return (
            <YStack
              key={draft.id}
              onPress={() => onSelectDraft(draft.id)}
              cursor="pointer"
            >
              <MessageBubbleFactory
                type={bubble.type}
                text={bubble.text}
                metadata={bubble.metadata}
                isMine={false}
                chatId="preview"
                otherMemberOaId={null}
                sendMessage={() => undefined}
              />
            </YStack>
          )
        })
      )}
    </YStack>
  ),
)
