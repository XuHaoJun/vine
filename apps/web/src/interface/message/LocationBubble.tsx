import { memo, useState } from 'react'
import { Pressable } from 'react-native'
import { SizableText, XStack, YStack } from 'tamagui'

import { Image } from '~/interface/image/Image'

type Props = {
  messageId: string
  metadata: string
  chatId: string
  isMine: boolean
}

type LocationMeta = {
  latitude?: number
  longitude?: number
  title?: string
  address?: string
}

function parseMetadata(raw: string): LocationMeta {
  try {
    return JSON.parse(raw) as LocationMeta
  } catch {
    return {}
  }
}

function buildMapUrl(messageId: string, chatId: string): string {
  const base = typeof window !== 'undefined' ? window.location.origin : ''
  return `${base}/api/location-map/${messageId}?chatId=${chatId}`
}

function buildOsmUrl(lat: number, lng: number): string {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}`
}

export const LocationBubble = memo(({ messageId, metadata, chatId, isMine }: Props) => {
  const meta = parseMetadata(metadata)
  const { latitude, longitude, title, address } = meta

  const [imageError, setImageError] = useState(false)

  const mapUrl = buildMapUrl(messageId, chatId)
  const osmUrl =
    typeof latitude === 'number' && typeof longitude === 'number'
      ? buildOsmUrl(latitude, longitude)
      : null

  const content = (
    <Pressable
      onPress={() => {
        if (osmUrl) {
          window.open(osmUrl, '_blank', 'noopener,noreferrer')
        }
      }}
    >
      <YStack
        maxW={280}
        style={{ borderRadius: 18, overflow: 'hidden' }}
        bg={isMine ? '#8be872' : 'white'}
      >
        {imageError ? (
          <YStack items="center" justify="center" py="$4" px="$3" gap="$1">
            <SizableText fontSize={13} color="$gray10" fontWeight="bold">
              {title ?? '位置'}
            </SizableText>
            {address && (
              <SizableText fontSize={11} color="$gray9">
                {address}
              </SizableText>
            )}
          </YStack>
        ) : (
          <Image
            source={{ uri: mapUrl }}
            style={{ width: 280, height: 140 }}
            resizeMode="cover"
            onError={() => setImageError(true)}
          />
        )}

        <XStack py="$1" px="$2" gap="$1">
          <SizableText fontSize={12} color={isMine ? '$white' : '$gray11'}>
            {title ?? '位置'}
          </SizableText>
        </XStack>
        {address && (
          <XStack pb="$1" px="$2">
            <SizableText
              fontSize={10}
              color={isMine ? '$white' : '$gray10'}
              opacity={0.8}
            >
              {address}
            </SizableText>
          </XStack>
        )}
      </YStack>
    </Pressable>
  )

  return content
})
