import { router } from 'one'
import { memo, useState } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ScrollView, SizableText, XStack, YStack } from 'tamagui'

import { useChats } from '~/features/chat/useChats'
import { useFriends } from '~/features/chat/useFriendship'
import { ChatListItem } from '~/features/chat/ui/ChatListItem'
import { FriendListItem } from '~/features/chat/ui/FriendListItem'
import { useAuth } from '~/features/auth/client/authClient'
import { Button } from '~/interface/buttons/Button'
import { Input } from '~/interface/forms/Input'
import { H3 } from '~/interface/text/Headings'

type Tab = 'chats' | 'friends'

export const TalksPage = memo(() => {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const [activeTab, setActiveTab] = useState<Tab>('chats')
  const [searchQuery, setSearchQuery] = useState('')
  const insets = useSafeAreaInsets()

  const { chats, pendingCount } = useChats()
  const { friends } = useFriends()

  const filteredChats = chats.filter((chat) => {
    if (!searchQuery) return true
    const otherMember = chat.members?.find((m) => m.userId !== userId)
    const name = otherMember?.user?.name ?? ''
    return name.toLowerCase().includes(searchQuery.toLowerCase())
  })

  const filteredFriends = friends.filter((f) => {
    if (!searchQuery) return true
    const otherUser = f.requesterId === userId ? f.addressee : f.requester
    const name = otherUser?.name ?? ''
    return name.toLowerCase().includes(searchQuery.toLowerCase())
  })

  const handleChatPress = (chatId: string) => {
    router.push(`/home/talks/${chatId}`)
  }

  const handleFriendPress = (friendship: { requesterId: string; addresseeId: string }) => {
    const friendId = friendship.requesterId === userId ? friendship.addresseeId : friendship.requesterId
    const chat = chats.find((c) =>
      c.members?.some((m) => m.userId === friendId) &&
      c.members?.some((m) => m.userId === userId)
    )
    if (chat) {
      router.push(`/home/talks/${chat.id}`)
    }
  }

  return (
    <YStack flex={1} bg="$background">
      <XStack px="$3" py="$2" gap="$2" items="center">
        <Input
          flex={1}
          placeholder={activeTab === 'chats' ? '搜尋聊天' : '搜尋好友'}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {pendingCount > 0 && activeTab === 'friends' && (
          <Button
            variant="transparent"
            onPress={() => router.push('/home/talks/requests')}
            px="$2"
          >
            <XStack
              bg="$red9"
              rounded="$10"
              minW={20}
              height={20}
              items="center"
              justify="center"
              px="$1"
            >
              <SizableText size="$1" color="white" fontWeight="bold">
                {pendingCount}
              </SizableText>
            </XStack>
          </Button>
        )}
        <Button
          variant="transparent"
          onPress={() => router.push('/home/talks/requests')}
          px="$2"
        >
          <SizableText size="$3">＋</SizableText>
        </Button>
      </XStack>

      <XStack px="$3" pb="$2" gap="$2">
        <Button
          bg={activeTab === 'chats' ? '$color3' : 'transparent'}
          variant={activeTab === 'chats' ? undefined : 'outlined'}
          onPress={() => setActiveTab('chats')}
          rounded="$10"
          px="$4"
          py="$1"
        >
          聊天
        </Button>
        <Button
          bg={activeTab === 'friends' ? '$color3' : 'transparent'}
          variant={activeTab === 'friends' ? undefined : 'outlined'}
          onPress={() => setActiveTab('friends')}
          rounded="$10"
          px="$4"
          py="$1"
        >
          好友
        </Button>
      </XStack>

      <ScrollView flex={1} pb={insets.bottom}>
        {activeTab === 'chats' ? (
          filteredChats.length === 0 ? (
            <YStack p="$6" items="center" justify="center">
              <H3 color="$color9">
                {searchQuery ? '找不到符合的聊天' : '還沒有聊天，先加好友吧！'}
              </H3>
            </YStack>
          ) : (
            filteredChats.map((chat) => {
              const otherMember = chat.members?.find((m) => m.userId !== userId)
              const myMembership = chat.members?.find((m) => m.userId === userId)
              const lastMsg = chat.lastMessage

              const hasUnread =
                lastMsg &&
                myMembership?.lastReadMessageId !== lastMsg.id &&
                lastMsg.senderId !== userId

              return (
                <ChatListItem
                  key={chat.id}
                  name={otherMember?.user?.name ?? '未知用戶'}
                  image={otherMember?.user?.image}
                  lastMessageText={lastMsg?.text ?? null}
                  lastMessageAt={chat.lastMessageAt}
                  unreadCount={hasUnread ? 1 : 0}
                  onPress={() => handleChatPress(chat.id)}
                />
              )
            })
          )
        ) : (
          filteredFriends.length === 0 ? (
            <YStack p="$6" items="center" justify="center">
              <H3 color="$color9">
                {searchQuery ? '找不到符合的好友' : '還沒有好友，點 ＋ 新增！'}
              </H3>
            </YStack>
          ) : (
            filteredFriends.map((f) => {
              const otherUser = f.requesterId === userId ? f.addressee : f.requester
              return (
                <FriendListItem
                  key={f.id}
                  name={otherUser?.name ?? '未知用戶'}
                  image={otherUser?.image}
                  onPress={() => handleFriendPress(f)}
                />
              )
            })
          )
        )}
      </ScrollView>
    </YStack>
  )
})

export default TalksPage
