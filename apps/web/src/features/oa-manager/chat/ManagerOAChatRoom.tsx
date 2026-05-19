import { useEffect, useRef, useState } from 'react'
import { ScrollView, SizableText, XStack, YStack } from 'tamagui'
import { RichMessageEditor } from '~/features/rich-message/RichMessageEditor'
import type { MessageDraft } from '~/features/rich-message/core/types'
import { Avatar } from '~/interface/avatars/Avatar'
import { Button } from '~/interface/buttons/Button'
import { Input } from '~/interface/forms/Input'
import { MessageBubbleFactory } from '~/interface/message/MessageBubbleFactory'
import { showToast } from '~/interface/toast/Toast'
import { useManagerOAMessages } from './useManagerOAMessages'

type Props = {
  oaId: string
  chatId?: string
  emptyStateLabel?: string
}

export function ManagerOAChatRoom({ oaId, chatId, emptyStateLabel }: Props) {
  const scrollRef = useRef<ScrollView>(null)
  const [draft, setDraft] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [richOpen, setRichOpen] = useState(false)
  const [richDrafts, setRichDrafts] = useState<MessageDraft[]>([])
  const { messages, isLoading, userMember, sendMessage, sendRichMessages, markRead } =
    useManagerOAMessages(
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
          {emptyStateLabel ?? 'Select a chat'}
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

      {richOpen ? (
        <YStack p="$3" borderTopWidth={1} borderColor="$borderColor" gap="$2">
          <RichMessageEditor value={richDrafts} onChange={setRichDrafts} />
          <XStack justify="flex-end" gap="$2">
            <Button size="$2" variant="outlined" onPress={() => setRichOpen(false)}>
              Cancel
            </Button>
            <Button
              size="$2"
              onPress={async () => {
                setIsSending(true)
                try {
                  await sendRichMessages(richDrafts)
                  setRichDrafts([])
                  setRichOpen(false)
                } catch (err) {
                  showToast(
                    err instanceof Error ? err.message : 'Rich message failed to send',
                    { type: 'error' },
                  )
                } finally {
                  setIsSending(false)
                }
              }}
              disabled={richDrafts.length === 0 || isSending}
            >
              Send rich message
            </Button>
          </XStack>
        </YStack>
      ) : (
        <XStack px="$3" pt="$3">
          <Button size="$2" variant="outlined" onPress={() => setRichOpen(true)}>
            Open rich message editor
          </Button>
        </XStack>
      )}

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
