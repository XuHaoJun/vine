import { router } from 'one'
import { memo, useState } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ScrollView, SizableText, XStack, YStack } from 'tamagui'

import { useChats } from '~/features/chat/useChats'
import { useFriends } from '~/features/chat/useFriendship'
import { ChatListItem } from '~/features/chat/ui/ChatListItem'
import { FriendListItem } from '~/features/chat/ui/FriendListItem'
import { TalksHeader } from '~/features/chat/ui/TalksHeader'
import { useAuth } from '~/features/auth/client/authClient'
import { oaClient } from '~/features/oa/client'
import { useTanQuery } from '~/query'
import { H3 } from '~/interface/text/Headings'
import { showToast } from '~/interface/toast/Toast'
import { zero } from '~/zero/client'

type Tab = 'chats' | 'friends'
type FriendsSubTab = 'personal' | 'official'

export const TalksPage = memo(() => {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const [activeTab, setActiveTab] = useState<Tab>('chats')
  const [friendsSubTab, setFriendsSubTab] = useState<FriendsSubTab>('personal')
  const [searchQuery, setSearchQuery] = useState('')
  const insets = useSafeAreaInsets()

  const { chats, pendingCount } = useChats()
  const { friends } = useFriends()

  const { data: oaFriendsData } = useTanQuery({
    queryKey: ['oa', 'myFriends'],
    queryFn: () => oaClient.listMyOAFriends({}),
  })

  const filteredChats = chats.filter((chat) => {
    if (!searchQuery) return true
    if (chat.type === 'oa') {
      const oaMember = chat.members?.find((m) => m.oaId)
      const oaFriend = oaFriendsData?.friendships?.find(
        (f) => f.officialAccountId === oaMember?.oaId,
      )
      return (oaFriend?.oaName ?? '').toLowerCase().includes(searchQuery.toLowerCase())
    }
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
    if (!chatId) return
    router.push(`/home/talks/${chatId}`)
  }

  const handleOAFriendPress = (oaFriend: {
    officialAccountId: string
    oaName: string
    id: string
  }) => {
    const existingChat = chats.find(
      (c) =>
        c.type === 'oa' && c.members?.some((m) => m.oaId === oaFriend.officialAccountId),
    )

    if (existingChat?.id) {
      router.push(`/home/talks/${existingChat.id}`)
      return
    }

    const chatId = crypto.randomUUID()
    const now = Date.now()
    zero.mutate.chat.insertOAChat({
      chatId,
      userId,
      oaId: oaFriend.officialAccountId,
      member1Id: crypto.randomUUID(),
      member2Id: crypto.randomUUID(),
      createdAt: now,
    })
    router.push(`/home/talks/${chatId}`)
  }

  const handleFriendPress = (friendship: {
    id: string
    requesterId: string
    addresseeId: string
  }) => {
    const friendId =
      friendship.requesterId === userId ? friendship.addresseeId : friendship.requesterId
    const existingChat = chats.find(
      (c) =>
        c.members?.some((m) => m.userId === friendId) &&
        c.members?.some((m) => m.userId === userId),
    )

    if (existingChat?.id) {
      router.push(`/home/talks/${existingChat.id}`)
      return
    }

    const newChatId = crypto.randomUUID()
    zero.mutate.friendship.accept({
      friendshipId: friendship.id,
      chatId: newChatId,
      member1Id: crypto.randomUUID(),
      member2Id: crypto.randomUUID(),
      requesterId: friendId,
    })

    router.push(`/home/talks/${newChatId}`)
  }

  return (
    <YStack flex={1} bg="$background">
      <TalksHeader
        activeTab={activeTab}
        onTabChange={setActiveTab}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        pendingCount={pendingCount}
      />

      {/* Note: flex={1} is on outer YStack, NOT on ScrollView, to avoid display:contents issue on web */}
      <YStack flex={1}>
        <ScrollView pb={insets.bottom}>
          {activeTab === 'chats' ? (
            filteredChats.length === 0 ? (
              <YStack p="$6" items="center" justify="center">
                <H3 color="$color9">
                  {searchQuery ? '找不到符合的聊天' : '還沒有聊天，先加好友吧！'}
                </H3>
              </YStack>
            ) : (
              filteredChats.map((chat) => {
                const myMembership = chat.members?.find((m) => m.userId !== userId)
                const lastMsg = chat.lastMessage

                const hasUnread =
                  lastMsg &&
                  myMembership?.lastReadMessageId !== lastMsg.id &&
                  lastMsg.senderId !== userId

                let name = '未知用戶'
                let image: string | undefined | null = undefined

                if (chat.type === 'oa') {
                  const oaMember = chat.members?.find((m) => m.oaId)
                  const oaFriend = oaFriendsData?.friendships?.find(
                    (f) => f.officialAccountId === oaMember?.oaId,
                  )
                  name = oaFriend?.oaName ?? '官方帳號'
                  image = oaFriend?.oaImageUrl || undefined
                } else {
                  const otherMember = chat.members?.find((m) => m.userId !== userId)
                  name = otherMember?.user?.name ?? '未知用戶'
                  image = otherMember?.user?.image
                }

                return (
                  <ChatListItem
                    key={chat.id}
                    name={name}
                    image={image}
                    type={chat.type}
                    lastMessageText={lastMsg?.text ?? null}
                    lastMessageAt={chat.lastMessageAt}
                    unreadCount={hasUnread ? 1 : 0}
                    onPress={() => handleChatPress(chat.id)}
                  />
                )
              })
            )
          ) : (
            <>
              {/* Friends Sub-Tab Bar */}
              <XStack px="$4" py="$3" gap="$2">
                <YStack
                  flex={1}
                  py="$2"
                  rounded="$2"
                  bg={friendsSubTab === 'personal' ? '$color3' : 'transparent'}
                  items="center"
                  cursor="pointer"
                  onPress={() => setFriendsSubTab('personal')}
                >
                  <SizableText
                    size="$3"
                    fontWeight={friendsSubTab === 'personal' ? '700' : '600'}
                    color={friendsSubTab === 'personal' ? '$color12' : '$color10'}
                  >
                    好友
                  </SizableText>
                </YStack>
                <YStack
                  flex={1}
                  py="$2"
                  rounded="$2"
                  bg={friendsSubTab === 'official' ? '$color3' : 'transparent'}
                  items="center"
                  cursor="pointer"
                  onPress={() => setFriendsSubTab('official')}
                >
                  <SizableText
                    size="$3"
                    fontWeight={friendsSubTab === 'official' ? '700' : '600'}
                    color={friendsSubTab === 'official' ? '$color12' : '$color10'}
                  >
                    官方帳號
                  </SizableText>
                </YStack>
              </XStack>

              {/* Friends Sub-Tab Content */}
              {friendsSubTab === 'personal' ? (
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
              ) : oaFriendsData?.friendships?.filter((oa) =>
                  searchQuery
                    ? oa.oaName.toLowerCase().includes(searchQuery.toLowerCase())
                    : true,
                ).length === 0 ? (
                <YStack p="$6" items="center" justify="center">
                  <H3 color="$color9">
                    {searchQuery ? '找不到符合的官方帳號' : '還沒有關注的官方帳號'}
                  </H3>
                </YStack>
              ) : (
                oaFriendsData?.friendships
                  ?.filter((oa) =>
                    searchQuery
                      ? oa.oaName.toLowerCase().includes(searchQuery.toLowerCase())
                      : true,
                  )
                  .map((oa) => (
                    <FriendListItem
                      key={oa.id}
                      name={oa.oaName}
                      image={oa.oaImageUrl || undefined}
                      onPress={() => handleOAFriendPress(oa)}
                    />
                  ))
              )}
            </>
          )}
        </ScrollView>
      </YStack>
    </YStack>
  )
})

export default TalksPage
