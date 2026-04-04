import { memo } from 'react'
import { SizableText, XStack, YStack } from 'tamagui'

const AVATAR_COLORS = ['#7a9cbf', '#c4aed0', '#a0c4a0', '#e0b98a']

type Props = {
  text: string
  isMine: boolean
  createdAt: number
  senderName?: string
  senderIndex?: number
}

export const MessageBubble = memo(({ text, isMine, createdAt, senderName, senderIndex }: Props) => {
  const time = new Date(createdAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })

  if (isMine) {
    return (
      <XStack justify="flex-end" px="$3" py="$1">
        <YStack items="flex-end" maxW="75%">
          <XStack items="flex-end" gap="$1.5">
            <YStack shrink={0} mb={2}>
              <SizableText fontSize={10} color="rgba(255,255,255,0.85)">
                {time}
              </SizableText>
            </YStack>
            <YStack
              bg="#8be872"
              px="$3"
              py="$2"
              maxW="100%"
              style={{ borderRadius: 18, borderBottomRightRadius: 4 }}
            >
              <SizableText fontSize={15} color="$gray9" lineHeight={22}>
                {text}
              </SizableText>
            </YStack>
          </XStack>
        </YStack>
      </XStack>
    )
  }

  const avatarColor = AVATAR_COLORS[(senderIndex ?? 0) % AVATAR_COLORS.length]
  const avatarLetter = (senderName ?? '?')[0]?.toUpperCase() ?? '?'

  return (
    <XStack gap="$2.5" px="$3" py="$1">
      <XStack
        width={38}
        height={38}
        mt={4}
        shrink={0}
        items="center"
        justify="center"
        style={{ borderRadius: 999, backgroundColor: avatarColor }}
      >
        <SizableText fontSize={14} fontWeight="600" color="white">
          {avatarLetter}
        </SizableText>
      </XStack>
      <YStack maxW="75%">
        <SizableText fontSize={12} color="rgba(255,255,255,0.85)" mb={4} ml={2}>
          {senderName ?? ''}
        </SizableText>
        <XStack items="flex-end" gap="$1.5">
          <YStack
            bg="white"
            px="$3"
            py="$2"
            maxW="100%"
            style={{ borderRadius: 18, borderTopLeftRadius: 4 }}
          >
            <SizableText fontSize={15} color="$gray8" lineHeight={22}>
              {text}
            </SizableText>
          </YStack>
          <YStack shrink={0} mb={2}>
            <SizableText fontSize={10} color="rgba(255,255,255,0.85)">
              {time}
            </SizableText>
          </YStack>
        </XStack>
      </YStack>
    </XStack>
  )
})
