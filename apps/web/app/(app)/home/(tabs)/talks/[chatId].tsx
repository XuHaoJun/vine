import { useLocalSearchParams } from 'one'
import { memo, useEffect, useRef } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ScrollView, SizableText, XStack, YStack } from 'tamagui'

import { useMessages } from '~/features/chat/useMessages'
import { MessageBubble } from '~/features/chat/ui/MessageBubble'
import { MessageInput } from '~/features/chat/ui/MessageInput'
import { useAuth } from '~/features/auth/client/authClient'
import { Avatar } from '~/interface/avatars/Avatar'
import { Button } from '~/interface/buttons/Button'
import { H3 } from '~/interface/text/Headings'

export const ChatRoomPage = memo(() => {
  const { chatId } = useLocalSearchParams<{ chatId: string }>()
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const insets = useSafeAreaInsets()
  const scrollRef = useRef<ScrollView>(null)

  const { messages, isLoading, otherMember, sendMessage, markRead } = useMessages(chatId!)

  useEffect(() => {
    if (messages?.length) {
      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true })
      }, 100)
    }
  }, [messages])

  useEffect(() => {
    if (messages?.length) {
      const latest = messages[messages.length - 1]
      if (latest && latest.senderId !== userId) {
        markRead(latest.id)
      }
    }
  }, [messages, userId, markRead])

  const otherName = otherMember?.user?.name ?? '未知用戶'
  const otherImage = otherMember?.user?.image ?? null

  if (!chatId) {
    return null
  }

  return (
    <YStack flex={1} bg="$background">
      <XStack px="$3" py="$2" gap="$3" items="center" borderBottomWidth={1} borderBottomColor="$color4">
        <Button variant="transparent" onPress={() => window.history.back()} px="$2">
          ←
        </Button>
        <Avatar size={32} image={otherImage} name={otherName} />
        <H3 flex={1}>{otherName}</H3>
      </XStack>

      <ScrollView ref={scrollRef} flex={1} pb={insets.bottom}>
        {isLoading ? (
          <YStack p="$6" items="center">
            <SizableText color="$color9">載入中...</SizableText>
          </YStack>
        ) : messages?.length === 0 ? (
          <YStack p="$6" items="center">
            <H3 color="$color9">還沒有訊息，傳送第一則吧！</H3>
          </YStack>
        ) : (
          messages?.map((msg) => {
            const isMine = msg.senderId === userId
            const isRead = isMine && otherMember?.lastReadMessageId === msg.id

            return (
              <MessageBubble
                key={msg.id}
                text={msg.text ?? ''}
                isMine={isMine}
                createdAt={msg.createdAt}
                isRead={isRead}
              />
            )
          })
        )}
      </ScrollView>

      <MessageInput onSend={sendMessage} />
    </YStack>
  )
})

export default ChatRoomPage
