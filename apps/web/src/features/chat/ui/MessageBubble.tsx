import { memo } from 'react'
import { SizableText, XStack, YStack } from 'tamagui'

type Props = {
  text: string
  isMine: boolean
  createdAt: number
  isRead?: boolean
}

export const MessageBubble = memo(({ text, isMine, createdAt, isRead }: Props) => {
  const time = new Date(createdAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <XStack justify={isMine ? 'flex-end' : 'flex-start'} px="$3" py="$1">
      <YStack
        maxW="75%"
        bg={isMine ? '$green9' : '$color3'}
        rounded="$4"
        px="$3"
        py="$2"
        gap="$1"
      >
        <SizableText size="$3" color={isMine ? 'white' : '$color12'}>
          {text}
        </SizableText>
        <XStack gap="$2" items="center" justify="flex-end">
          <SizableText size="$1" color={isMine ? 'rgba(255,255,255,0.7)' : '$color9'}>
            {time}
          </SizableText>
          {isMine && isRead && (
            <SizableText size="$1" color="rgba(255,255,255,0.7)">
              已讀
            </SizableText>
          )}
        </XStack>
      </YStack>
    </XStack>
  )
})
