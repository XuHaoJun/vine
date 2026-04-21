import { memo, useCallback, useMemo, useState } from 'react'
import type { LayoutChangeEvent } from 'react-native'
import { Pressable } from 'react-native'
import { SizableText, YStack } from 'tamagui'
import type { ImagemapAction, ImagemapVideo } from '@vine/imagemap-schema'
import {
  useActionDispatcher,
  type DispatchableAction,
} from '~/features/chat/useActionDispatcher'

const WIDTHS = [240, 300, 460, 700, 1040] as const

type Props = {
  baseUrl: string
  baseSize: { width: number; height: number }
  altText: string
  actions: ImagemapAction[]
  video?: ImagemapVideo
  chatId: string
  otherMemberOaId: string | null
  sendMessage: (text: string) => void
  isMine: boolean
}

function imagemapActionToDispatchable(action: ImagemapAction): DispatchableAction {
  switch (action.type) {
    case 'uri':
      return { type: 'uri', label: action.label, uri: action.linkUri }
    case 'message':
      return { type: 'message', label: action.label, text: action.text }
    case 'clipboard':
      return {
        type: 'clipboard',
        label: action.label,
        clipboardText: action.clipboardText,
      }
  }
}

function pickWidth(cssWidth: number): number {
  const dpr =
    typeof window !== 'undefined' && window.devicePixelRatio ? window.devicePixelRatio : 1
  const target = cssWidth * dpr
  for (const w of WIDTHS) if (w >= target) return w
  return 1040
}

export const ImagemapBubble = memo(
  ({
    baseUrl,
    baseSize,
    altText,
    actions,
    video,
    chatId,
    otherMemberOaId,
    sendMessage,
  }: Props) => {
    const [containerW, setContainerW] = useState(280)
    const [imageError, setImageError] = useState(false)

    const onLayout = useCallback((e: LayoutChangeEvent) => {
      const w = e.nativeEvent.layout.width
      if (w > 0) setContainerW(w)
    }, [])

    const dispatch = useActionDispatcher({ chatId, otherMemberOaId, sendMessage })
    const chosenWidth = useMemo(() => pickWidth(containerW), [containerW])
    const scale = containerW / baseSize.width
    const height = containerW * (baseSize.height / baseSize.width)
    const imageUrl = `${baseUrl}/${chosenWidth}`

    return (
      <YStack
        onLayout={onLayout}
        maxW={280}
        width="100%"
        style={{
          position: 'relative',
          borderRadius: 18,
          overflow: 'hidden',
          backgroundColor: '#eceff3',
        }}
        height={height}
      >
        {imageError ? (
          <YStack
            position="absolute"
            t={0}
            l={0}
            r={0}
            b={0}
            items="center"
            justify="center"
            bg="$color3"
          >
            <SizableText fontSize={13} color="$gray10">
              {altText || '圖片載入失敗'}
            </SizableText>
          </YStack>
        ) : (
          <img
            src={imageUrl}
            alt={altText}
            onError={() => setImageError(true)}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              display: 'block',
              objectFit: 'cover',
            }}
          />
        )}

        {actions.map((action, i) => (
          <Pressable
            key={i}
            accessibilityLabel={action.label ?? action.type}
            onPress={() => dispatch(imagemapActionToDispatchable(action))}
            style={{
              position: 'absolute',
              left: action.area.x * scale,
              top: action.area.y * scale,
              width: action.area.width * scale,
              height: action.area.height * scale,
            }}
          />
        ))}

        {video && (
          <VideoOverlay
            video={video}
            scale={scale}
            onExternalLinkTap={(uri) =>
              dispatch({
                type: 'uri',
                uri,
                label: undefined,
              } satisfies DispatchableAction)
            }
          />
        )}
      </YStack>
    )
  },
)

type VideoOverlayProps = {
  video: ImagemapVideo
  scale: number
  onExternalLinkTap: (linkUri: string) => void
}

const VideoOverlay = memo(({ video, scale, onExternalLinkTap }: VideoOverlayProps) => {
  const [ended, setEnded] = useState(false)

  const style = {
    position: 'absolute' as const,
    left: video.area.x * scale,
    top: video.area.y * scale,
    width: video.area.width * scale,
    height: video.area.height * scale,
  }

  if (ended && video.externalLink) {
    return (
      <Pressable
        accessibilityLabel={video.externalLink.label}
        onPress={() => onExternalLinkTap(video.externalLink!.linkUri)}
        style={{
          ...style,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(0,0,0,0.55)',
        }}
      >
        <SizableText color="white" fontSize={14} fontWeight="600">
          {video.externalLink.label}
        </SizableText>
      </Pressable>
    )
  }

  return (
    <YStack style={style}>
      <video
        src={video.originalContentUrl}
        poster={video.previewImageUrl}
        controls
        playsInline
        onEnded={() => setEnded(true)}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
    </YStack>
  )
})
