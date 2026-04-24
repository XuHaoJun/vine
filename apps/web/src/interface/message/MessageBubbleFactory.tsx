import { memo, useMemo } from 'react'
import { SizableText, YStack } from 'tamagui'
import { LfBubble, LfCarousel } from '@vine/line-flex'
import type { LFexBubble, LFexCarousel } from '@vine/line-flex'
import type { ImagemapAction, ImagemapVideo } from '@vine/imagemap-schema'
import { AudioBubble } from './AudioBubble'
import { ImageBubble } from './ImageBubble'
import { ImagemapBubble } from './ImagemapBubble'
import { LocationBubble } from './LocationBubble'
import { TextBubble } from './TextBubble'
import { VideoBubble } from './VideoBubble'

function parseMetadata(metadata?: string): Record<string, unknown> {
  if (!metadata) return {}
  try {
    return JSON.parse(metadata) as Record<string, unknown>
  } catch {
    return {}
  }
}

type MessageBubbleFactoryProps = {
  type: string
  text?: string
  metadata?: string
  isMine: boolean
  chatId: string
  messageId?: string
  otherMemberOaId: string | null
  sendMessage: (text: string) => void
}

export const MessageBubbleFactory = memo(
  ({
    type,
    text,
    metadata,
    isMine,
    chatId,
    messageId,
    otherMemberOaId,
    sendMessage,
  }: MessageBubbleFactoryProps) => {
    if (type === 'text') {
      return <TextBubble text={text ?? ''} isMine={isMine} />
    }

    if (type === 'flex') {
      return <FlexBubbleContent metadata={metadata ?? ''} isMine={isMine} />
    }

    if (type === 'image') {
      const meta = parseMetadata(metadata)
      const url =
        typeof meta.originalContentUrl === 'string' ? meta.originalContentUrl : ''
      if (!url) return <UnsupportedBubble type={type} />
      return <ImageBubble url={url} isMine={isMine} />
    }

    if (type === 'video') {
      const meta = parseMetadata(metadata)
      const url =
        typeof meta.originalContentUrl === 'string' ? meta.originalContentUrl : ''
      if (!url) return <UnsupportedBubble type={type} />
      return <VideoBubble url={url} isMine={isMine} />
    }

    if (type === 'audio') {
      const meta = parseMetadata(metadata)
      const url =
        typeof meta.originalContentUrl === 'string' ? meta.originalContentUrl : ''
      const duration = typeof meta.duration === 'number' ? meta.duration : undefined
      if (!url) return <UnsupportedBubble type={type} />
      return <AudioBubble url={url} duration={duration} isMine={isMine} />
    }

    if (type === 'sticker') {
      const meta = parseMetadata(metadata)
      const packageId = typeof meta.packageId === 'string' ? meta.packageId : ''
      const stickerId = typeof meta.stickerId === 'number' ? meta.stickerId : 0
      if (!packageId || !stickerId) return <UnsupportedBubble type={type} />
      return <StickerBubble packageId={packageId} stickerId={stickerId} />
    }

    if (type === 'imagemap') {
      const meta = parseMetadata(metadata)
      const baseUrl = typeof meta.baseUrl === 'string' ? meta.baseUrl : ''
      const baseSize = meta.baseSize as { width: number; height: number } | undefined
      const actions = Array.isArray(meta.actions)
        ? (meta.actions as ImagemapAction[])
        : null
      const video = meta.video as ImagemapVideo | undefined
      if (!baseUrl || !baseSize || !actions) return <UnsupportedBubble type={type} />
      return (
        <ImagemapBubble
          baseUrl={baseUrl}
          baseSize={baseSize}
          altText={(meta.altText as string) ?? ''}
          actions={actions}
          video={video}
          chatId={chatId}
          otherMemberOaId={otherMemberOaId}
          sendMessage={sendMessage}
          isMine={isMine}
        />
      )
    }

    if (type === 'location') {
      if (!messageId) return <UnsupportedBubble type={type} />
      return (
        <LocationBubble
          messageId={messageId}
          metadata={metadata ?? ''}
          chatId={chatId}
          isMine={isMine}
        />
      )
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

const StickerBubble = memo(
  ({ packageId, stickerId }: { packageId: string; stickerId: number }) => (
    <YStack p="$1">
      <img
        src={`/uploads/stickers/${packageId}/${stickerId}.png`}
        width={120}
        height={120}
        alt="sticker"
        style={{ objectFit: 'contain' }}
      />
    </YStack>
  ),
)
