import { memo } from 'react'
import { SizableText, XStack, YStack } from 'tamagui'

import { Avatar } from '~/interface/avatars/Avatar'
import { Pressable } from '~/interface/buttons/Pressable'

type Props = {
  name: string
  image?: string | null
  lastMessageText?: string | null
  lastMessageAt?: number | null
  unreadCount?: number
  onPress: () => void
}

export const ChatListItem = memo(({ name, image, lastMessageText, lastMessageAt, unreadCount, onPress }: Props) => {
  const timeLabel = lastMessageAt
    ? formatChatTime(lastMessageAt)
    : ''

  return (
    <Pressable onPress={onPress}>
      <XStack px="$4" py="$3" gap="$3" items="center" hoverStyle={{ bg: '$color2' }}>
        <Avatar size={44} image={image ?? null} name={name} />
        <YStack flex={1} gap="$1">
          <XStack justify="space-between" items="center">
            <SizableText size="$3" fontWeight="600" numberOfLines={1}>
              {name}
            </SizableText>
            <SizableText size="$1" color="$color10">
              {timeLabel}
            </SizableText>
          </XStack>
          <XStack justify="space-between" items="center">
            <SizableText size="$1" color="$color10" numberOfLines={1} flex={1}>
              {lastMessageText ?? ''}
            </SizableText>
            {(unreadCount ?? 0) > 0 && (
              <XStack
                bg="$green9"
                rounded="$10"
                minW={20}
                height={20}
                items="center"
                justify="center"
                px="$1"
              >
                <SizableText size="$1" color="white" fontWeight="bold">
                  {unreadCount}
                </SizableText>
              </XStack>
            )}
          </XStack>
        </YStack>
      </XStack>
    </Pressable>
  )
})

function formatChatTime(ts: number): string {
  const date = new Date(ts)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  if (diffDays === 1) return '昨天'
  if (diffDays < 7) {
    return (['週日', '週一', '週二', '週三', '週四', '週五', '週六'][date.getDay()] ?? `${date.getMonth() + 1}/${date.getDate()}`)
  }
  return `${date.getMonth() + 1}/${date.getDate()}`
}
