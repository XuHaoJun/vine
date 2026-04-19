import { createRoute, useActiveParams } from 'one'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Linking, Platform } from 'react-native'
import { ScrollView, SizableText, XStack, YStack } from 'tamagui'

import { useZeroQuery } from '~/zero/client'
import { useMessages } from '~/features/chat/useMessages'
import { DateSeparator } from '~/features/chat/ui/DateSeparator'
import { MessageBubbleFactory } from '~/interface/message/MessageBubbleFactory'
import { MessageInput } from '~/features/chat/ui/MessageInput'
import { useAuth } from '~/features/auth/client/authClient'
import { oaClient } from '~/features/oa/client'
import { Avatar } from '~/interface/avatars/Avatar'
import { Button } from '~/interface/buttons/Button'
import { GroupInfoSheet } from '~/interface/dialogs/GroupInfoSheet'
import { H3 } from '~/interface/text/Headings'
import { useTanQuery } from '~/query'
import { chatById } from '@vine/zero-schema/queries/chat'
import { showToast } from '~/interface/toast/Toast'
import { useRichMenu } from '~/features/chat/useRichMenu'
import { RichMenu } from '~/features/chat/ui/RichMenu'
import { RichMenuBar } from '~/features/chat/ui/RichMenuBar'
import type { QuickReply, QuickReplyAction, QuickReplyItem } from '@vine/flex-schema'
import { QuickReplyBar } from '~/interface/message/QuickReplyBar'
import {
  useActionDispatcher,
  type DispatchableAction,
} from '~/features/chat/useActionDispatcher'

const AVATAR_COLORS = ['#7a9cbf', '#c4aed0', '#a0c4a0', '#e0b98a']

function parseMetadata(metadata?: string | null): Record<string, unknown> | null {
  if (!metadata) return null
  try {
    return JSON.parse(metadata) as Record<string, unknown>
  } catch {
    return null
  }
}

const route = createRoute<'/(app)/home/(tabs)/talks/[chatId]'>()

export const ChatRoomPage = memo(() => {
  const { chatId } = useActiveParams<{ chatId: string }>()
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const scrollRef = useRef<ScrollView>(null)

  const {
    messages,
    isLoading,
    members,
    otherMember,
    sendMessage,
    sendMedia,
    markRead,
    myMembership,
  } = useMessages(chatId!)

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

  const otherName = isOAChat
    ? (oaFriend?.oaName ?? '官方帳號')
    : (otherMember?.user?.name ?? '未知用戶')
  const otherImage = isOAChat
    ? oaFriend?.oaImageUrl || null
    : (otherMember?.user?.image ?? null)

  const { richMenu, imageUrl } = useRichMenu(otherMemberOaId ?? undefined)
  const hasRichMenu = !!richMenu && !!imageUrl

  const [inputMode, setInputMode] = useState<'normal' | 'richmenu'>(
    hasRichMenu ? 'richmenu' : 'normal',
  )
  const [richMenuExpanded, setRichMenuExpanded] = useState(richMenu?.selected ?? false)
  const [showGroupInfo, setShowGroupInfo] = useState(false)
  const [requireApproval, setRequireApproval] = useState(false)
  const [dismissedFor, setDismissedFor] = useState<string | null>(null)

  const activeQuickReply = useMemo<QuickReply | null>(() => {
    const latest = messages?.[messages.length - 1]
    if (!latest) return null
    if (latest.id === dismissedFor) return null
    if (latest.senderType !== 'oa') return null
    const meta = parseMetadata(latest.metadata)
    const qr = meta?.['quickReply']
    if (!qr || typeof qr !== 'object') return null
    const items = (qr as { items?: unknown }).items
    if (!Array.isArray(items) || items.length === 0) return null
    return qr as QuickReply
  }, [messages, dismissedFor])

  // Reset dismissal when a new message arrives — the next bar can render.
  useEffect(() => {
    setDismissedFor(null)
  }, [messages?.length])

  const [chat] = useZeroQuery(chatById, { chatId: chatId! }, { enabled: Boolean(chatId) })

  useEffect(() => {
    if (chat?.[0]?.requireApproval !== undefined) {
      setRequireApproval(chat[0].requireApproval === 1)
    }
  }, [chat])

  const isGroupChat = members.length > 2
  const myRole = myMembership?.role as 'owner' | 'admin' | 'member' | null
  const groupName = chat?.[0]?.name ?? otherName
  const groupImage = chat?.[0]?.image ?? null

  useEffect(() => {
    if (hasRichMenu) {
      setInputMode('richmenu')
      setRichMenuExpanded(richMenu?.selected ?? false)
    } else {
      setInputMode('normal')
    }
  }, [hasRichMenu, richMenu?.selected])

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

  const handleRichMenuAreaTap = useCallback(
    (area: { action: { type: string; uri?: string; data?: string; text?: string } }) => {
      const { action } = area
      switch (action.type) {
        case 'uri':
          if (action.uri) {
            Linking.openURL(action.uri)
          }
          break
        case 'message':
          if (action.text) {
            sendMessage(action.text)
          }
          break
        case 'postback':
          showToast('Postback action', { type: 'info' })
          break
        default:
          showToast(`Action: ${action.type}`, { type: 'info' })
      }
    },
    [sendMessage],
  )

  const dispatchAction = useActionDispatcher({
    chatId: chatId ?? '',
    otherMemberOaId: otherMemberOaId ?? null,
    sendMessage,
  })

  const handleQuickReplyAction = useCallback(
    (action: QuickReplyAction) => {
      const latestId = messages?.[messages.length - 1]?.id
      // Disappear rule: datetimepicker / clipboard keep the bar visible,
      // everything else dismisses immediately on tap.
      const keepBar = action.type === 'datetimepicker' || action.type === 'clipboard'
      if (!keepBar && latestId) setDismissedFor(latestId)
      dispatchAction(action as DispatchableAction)
    },
    [messages, dispatchAction],
  )

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
        cursor={isGroupChat ? 'pointer' : 'default'}
        onPress={isGroupChat ? () => setShowGroupInfo(true) : undefined}
      >
        <Button variant="transparent" onPress={() => window.history.back()} px="$2">
          ←
        </Button>
        <Avatar
          size={32}
          image={isGroupChat ? groupImage : otherImage}
          name={isGroupChat ? groupName : otherName}
        />
        <H3 flex={1}>{isGroupChat ? groupName : otherName}</H3>
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
                          chatId={chatId ?? ''}
                          otherMemberOaId={otherMemberOaId ?? null}
                          sendMessage={sendMessage}
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

      {inputMode === 'richmenu' && hasRichMenu && richMenuExpanded && imageUrl && (
        <YStack shrink={0}>
          <RichMenu
            imageUrl={imageUrl}
            sizeWidth={richMenu.sizeWidth}
            sizeHeight={richMenu.sizeHeight}
            areas={richMenu.areas}
            onAreaTap={handleRichMenuAreaTap}
          />
        </YStack>
      )}

      {activeQuickReply && inputMode !== 'richmenu' && (
        <QuickReplyBar
          items={activeQuickReply.items as QuickReplyItem[]}
          onAction={handleQuickReplyAction}
        />
      )}

      <YStack shrink={0}>
        {inputMode === 'richmenu' && hasRichMenu ? (
          <RichMenuBar
            chatBarText={richMenu.chatBarText}
            isExpanded={richMenuExpanded}
            onToggleExpand={() => setRichMenuExpanded((prev) => !prev)}
            onSwitchToKeyboard={() => {
              setInputMode('normal')
              setRichMenuExpanded(false)
            }}
          />
        ) : (
          <MessageInput
            onSend={sendMessage}
            onSendMedia={sendMedia}
            hasRichMenu={hasRichMenu}
            onSwitchToRichMenu={() => {
              setInputMode('richmenu')
              setRichMenuExpanded(false)
            }}
          />
        )}
      </YStack>

      {isGroupChat && (
        <GroupInfoSheet
          chatId={chatId!}
          groupName={groupName}
          groupImage={groupImage}
          myRole={myRole}
          open={showGroupInfo}
          onOpenChange={setShowGroupInfo}
          groupDescription={chat?.[0]?.description}
          requireApproval={requireApproval}
          onUpdateRequireApproval={setRequireApproval}
        />
      )}
    </YStack>
  )
})

export default ChatRoomPage
