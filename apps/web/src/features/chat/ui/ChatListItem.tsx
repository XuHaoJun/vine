import { memo } from 'react'
import { ListItem, SizableText, XStack, YStack } from 'tamagui'

import { Avatar } from '~/interface/avatars/Avatar'

type Props = {
  name: string
  image?: string | null
  lastMessageText?: string | null
  lastMessageAt?: number | null
  unreadCount?: number
  onPress: () => void
}

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
    return (
      ['週日', '週一', '週二', '週三', '週四', '週五', '週六'][date.getDay()] ??
      `${date.getMonth() + 1}/${date.getDate()}`
    )
  }
  return `${date.getMonth() + 1}/${date.getDate()}`
}

export const ChatListItem = memo(
  ({ name, image, lastMessageText, lastMessageAt, unreadCount, onPress }: Props) => {
    const timeLabel = lastMessageAt ? formatChatTime(lastMessageAt) : ''

    return (
      <ListItem
        gap="$3"
        icon={<Avatar size={44} image={image ?? null} name={name} />}
        onPress={onPress}
      >
        <YStack flex={1} gap="$1">
          <XStack justify="space-between" items="center">
            <SizableText size="$3" fontWeight="600" numberOfLines={1}>
              {name}
            </SizableText>
            <XStack items="center" gap="$2">
              <SizableText size="$1" color="$color10">
                {timeLabel}
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
          </XStack>
          <SizableText size="$2" color="$color10" numberOfLines={1}>
            {lastMessageText ?? ''}
          </SizableText>
        </YStack>
      </ListItem>
    )
  },
)
