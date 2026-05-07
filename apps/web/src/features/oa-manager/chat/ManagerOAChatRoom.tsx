import { useEffect, useRef, useState } from 'react'
import { ScrollView, SizableText, XStack, YStack } from 'tamagui'
import { Avatar } from '~/interface/avatars/Avatar'
import { Button } from '~/interface/buttons/Button'
import { Input } from '~/interface/forms/Input'
import { MessageBubbleFactory } from '~/interface/message/MessageBubbleFactory'
import { showToast } from '~/interface/toast/Toast'
import { useManagerOAMessages } from './useManagerOAMessages'

type Props = {
  oaId: string
  chatId?: string
}

export function ManagerOAChatRoom({ oaId, chatId }: Props) {
  const scrollRef = useRef<ScrollView>(null)
  const [draft, setDraft] = useState('')
  const [isSending, setIsSending] = useState(false)
  const { messages, isLoading, userMember, sendMessage, markRead } = useManagerOAMessages(
    oaId,
    chatId,
  )

  const user = userMember?.user
  const userName = user?.name ?? 'Unknown user'
  const userImage = user?.image ?? null

  useEffect(() => {
    const latest = messages[messages.length - 1]
    if (latest?.senderType === 'user') {
      markRead(latest.id)
    }
  }, [markRead, messages])

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50)
    }
  }, [messages.length])

  if (!chatId) {
    return (
      <YStack flex={1} items="center" justify="center">
        <SizableText size="$3" color="$color10">
          Select a chat
        </SizableText>
      </YStack>
    )
  }

  const submit = async () => {
    const text = draft.trim()
    if (!text || isSending) return

    setIsSending(true)
    try {
      await sendMessage(text)
      setDraft('')
    } catch {
      showToast('Message failed to send', { type: 'error' })
    } finally {
      setIsSending(false)
    }
  }

  return (
    <YStack flex={1} minW={0}>
      <XStack
        height="$6"
        px="$4"
        items="center"
        gap="$3"
        borderBottomWidth={1}
        borderColor="$borderColor"
      >
        <Avatar size={36} image={userImage} name={userName} />
        <SizableText size="$4" fontWeight="700" numberOfLines={1}>
          {userName}
        </SizableText>
      </XStack>

      <ScrollView ref={scrollRef} flex={1} bg="$color1">
        {isLoading ? (
          <YStack p="$4">
            <SizableText size="$2" color="$color10">
              Loading messages...
            </SizableText>
          </YStack>
        ) : messages.length === 0 ? (
          <YStack p="$4" items="center">
            <SizableText size="$2" color="$color10">
              No messages
            </SizableText>
          </YStack>
        ) : (
          <YStack p="$3" gap="$2">
            {messages.map((message) => (
              <MessageBubbleFactory
                key={message.id}
                type={message.type}
                text={message.text ?? ''}
                metadata={message.metadata ?? undefined}
                isMine={message.senderType === 'oa'}
                chatId={message.chatId}
                messageId={message.id}
                otherMemberOaId={oaId}
                sendMessage={sendMessage}
                miniAppId={message.miniAppId ?? null}
              />
            ))}
          </YStack>
        )}
      </ScrollView>

      <XStack p="$3" gap="$2" borderTopWidth={1} borderColor="$borderColor">
        <Input
          flex={1}
          value={draft}
          onChangeText={setDraft}
          placeholder="Aa"
          onSubmitEditing={submit}
        />
        <Button onPress={submit} disabled={!draft.trim() || isSending}>
          Send
        </Button>
      </XStack>
    </YStack>
  )
}
