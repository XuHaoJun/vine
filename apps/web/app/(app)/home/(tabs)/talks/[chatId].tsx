import { createRoute, useActiveParams } from 'one'
import { memo, useEffect, useMemo, useRef } from 'react'
import { Platform } from 'react-native'
import { ScrollView, SizableText, XStack, YStack } from 'tamagui'

import { useMessages } from '~/features/chat/useMessages'
import { DateSeparator } from '~/features/chat/ui/DateSeparator'
import { MessageBubbleFactory } from '~/interface/message/MessageBubbleFactory'
import { MessageInput } from '~/features/chat/ui/MessageInput'
import { useAuth } from '~/features/auth/client/authClient'
import { oaClient } from '~/features/oa/client'
import { Avatar } from '~/interface/avatars/Avatar'
import { Button } from '~/interface/buttons/Button'
import { H3 } from '~/interface/text/Headings'
import { useTanQuery } from '~/query'

const AVATAR_COLORS = ['#7a9cbf', '#c4aed0', '#a0c4a0', '#e0b98a']

const route = createRoute<'/(app)/home/(tabs)/talks/[chatId]'>()

export const ChatRoomPage = memo(() => {
  const { chatId } = useActiveParams<{ chatId: string }>()
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const scrollRef = useRef<ScrollView>(null)

  const { messages, isLoading, members, otherMember, sendMessage, markRead } =
    useMessages(chatId!)

  const { data: oaFriendsData } = useTanQuery({
    queryKey: ['oa', 'myFriends'],
    queryFn: () => oaClient.listMyOAFriends({}),
  })

  // Determine if this is an OA chat and get the otherMember's oaId
  const otherMemberOaId = otherMember?.oaId
  const isOAChat = !!otherMemberOaId
  const oaFriend = isOAChat
    ? oaFriendsData?.friendships?.find((f) => f.officialAccountId === otherMemberOaId)
    : null

  // Build a lookup map: userId → { name, index } for sender display
  const memberMap = useMemo(() => {
    const map: Record<string, { name: string; index: number }> = {}
    members.forEach((m, i) => {
      if (m.userId) {
        map[m.userId] = { name: m.user?.name ?? '?', index: i }
      }
    })
    return map
  }, [members])

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

  // Web: keep scroll on the message list only — don't let the document grow a page scrollbar
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') {
      return
    }
    const prevHtml = document.documentElement.style.overflow
    const prevBody = document.body.style.overflow
    document.documentElement.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    return () => {
      document.documentElement.style.overflow = prevHtml
      document.body.style.overflow = prevBody
    }
  }, [])

  const otherName = isOAChat
    ? (oaFriend?.oaName ?? '官方帳號')
    : (otherMember?.user?.name ?? '未知用戶')
  const otherImage = isOAChat
    ? oaFriend?.oaImageUrl || null
    : (otherMember?.user?.image ?? null)

  if (!chatId) {
    return null
  }

  return (
    <YStack flex={1} bg="#84A1C4" $platform-web={{ minHeight: '100vh' }}>
      <XStack
        shrink={0}
        px="$3"
        py="$2"
        gap="$3"
        items="center"
        borderBottomWidth={1}
        borderBottomColor="$color4"
      >
        <Button variant="transparent" onPress={() => window.history.back()} px="$2">
          ←
        </Button>
        <Avatar size={32} image={otherImage} name={otherName} />
        <H3 flex={1}>{otherName}</H3>
      </XStack>

      <YStack flex={1} minH={0} $platform-web={{ overflow: 'hidden' }}>
        <ScrollView ref={scrollRef} showsVerticalScrollIndicator flex={1} minH={0}>
          {isLoading ? (
            <YStack p="$6" items="center">
              <SizableText color="rgba(255,255,255,0.7)">載入中...</SizableText>
            </YStack>
          ) : messages?.length === 0 ? (
            <YStack p="$6" items="center">
              <H3 color="rgba(255,255,255,0.7)">還沒有訊息，傳送第一則吧！</H3>
            </YStack>
          ) : (
            <YStack py="$2" pb="$3">
              <DateSeparator label="今天" />
              {messages?.map((msg) => {
                const isMine = msg.senderId === userId
                const senderType = msg.senderType as 'user' | 'oa'
                const senderInfo = msg.senderId ? memberMap[msg.senderId] : undefined

                return (
                  <XStack
                    key={msg.id}
                    justify={isMine ? 'flex-end' : 'flex-start'}
                    px="$3"
                    py="$1"
                  >
                    {!isMine &&
                      (senderType === 'oa' ? (
                        <XStack
                          width={38}
                          height={38}
                          mt={4}
                          shrink={0}
                          items="center"
                          justify="center"
                          style={{ borderRadius: 999, backgroundColor: '$color4' }}
                        >
                          <SizableText fontSize={14} fontWeight="600" color="white">
                            {(otherName ?? '?')[0]?.toUpperCase() ?? '?'}
                          </SizableText>
                        </XStack>
                      ) : (
                        <XStack
                          width={38}
                          height={38}
                          mt={4}
                          shrink={0}
                          items="center"
                          justify="center"
                          style={{
                            borderRadius: 999,
                            backgroundColor:
                              AVATAR_COLORS[
                                (senderInfo?.index ?? 0) % AVATAR_COLORS.length
                              ],
                          }}
                        >
                          <SizableText fontSize={14} fontWeight="600" color="white">
                            {(senderInfo?.name ?? '?')[0]?.toUpperCase() ?? '?'}
                          </SizableText>
                        </XStack>
                      ))}

                    <YStack maxW="75%">
                      {!isMine && (
                        <SizableText
                          fontSize={12}
                          color="rgba(255,255,255,0.85)"
                          mb={4}
                          ml={2}
                        >
                          {senderType === 'oa'
                            ? (otherName ?? '官方帳號')
                            : (senderInfo?.name ?? '')}
                        </SizableText>
                      )}

                      <XStack items="flex-end" gap="$1.5">
                        <YStack shrink={0} mb={2}>
                          <SizableText fontSize={10} color="rgba(255,255,255,0.85)">
                            {new Date(msg.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </SizableText>
                        </YStack>

                        <MessageBubbleFactory
                          type={msg.type}
                          text={msg.text ?? undefined}
                          metadata={msg.metadata ?? undefined}
                          isMine={isMine}
                        />
                      </XStack>
                    </YStack>
                  </XStack>
                )
              })}
            </YStack>
          )}
        </ScrollView>
      </YStack>

      <YStack shrink={0}>
        <MessageInput onSend={sendMessage} />
      </YStack>
    </YStack>
  )
})

export default ChatRoomPage
