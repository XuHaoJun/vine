import { memo, useMemo } from 'react'
import { SizableText, YStack } from 'tamagui'
import { LfBubble, LfCarousel } from '@vine/line-flex'
import type { LFexBubble, LFexCarousel } from '@vine/line-flex'
import { TextBubble } from './TextBubble'

type MessageBubbleFactoryProps = {
  type: string
  text?: string
  metadata?: string
  isMine: boolean
}

export const MessageBubbleFactory = memo(
  ({ type, text, metadata, isMine }: MessageBubbleFactoryProps) => {
    if (type === 'text') {
      return <TextBubble text={text ?? ''} isMine={isMine} />
    }

    if (type === 'flex') {
      return <FlexBubbleContent metadata={metadata ?? ''} isMine={isMine} />
    }

    return <UnsupportedBubble type={type} />
  },
)

type FlexBubbleContentProps = {
  metadata: string
  isMine: boolean
}

const FlexBubbleContent = memo(({ metadata }: FlexBubbleContentProps) => {
  const contents = useMemo(() => {
    try {
      const parsed = JSON.parse(metadata)
      if (parsed?.type === 'flex' && parsed?.contents) {
        return parsed.contents
      }
      if (parsed?.type === 'bubble') {
        return parsed as LFexBubble
      }
      if (parsed?.type === 'carousel') {
        return parsed as LFexCarousel
      }
      return null
    } catch {
      return null
    }
  }, [metadata])

  if (!contents) {
    return (
      <YStack bg="white" px="$3" py="$2" style={{ borderRadius: 18 }}>
        <SizableText fontSize={13} color="$red10">
          無法解析此 flex 訊息
        </SizableText>
      </YStack>
    )
  }

  if (contents.type === 'carousel') {
    return <LfCarousel {...contents} />
  }

  return <LfBubble {...contents} />
})

type UnsupportedBubbleProps = {
  type: string
}

const UnsupportedBubble = memo(({ type }: UnsupportedBubbleProps) => {
  return (
    <YStack bg="white" px="$3" py="$2" style={{ borderRadius: 18 }}>
      <SizableText fontSize={13} color="$gray8">
        不支援的訊息類型: {type}
      </SizableText>
    </YStack>
  )
})
