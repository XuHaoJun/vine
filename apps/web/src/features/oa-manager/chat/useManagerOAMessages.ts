import { oaChatMembersByChatId } from '@vine/zero-schema/queries/chat'
import { oaMessagesByChatId } from '@vine/zero-schema/queries/message'
import { useCallback, useMemo } from 'react'
import { toMessagingApiMessages } from '~/features/rich-message/core/serialization'
import { RichMessageStarterKit } from '~/features/rich-message/RichMessageStarterKit'
import type { MessageDraft } from '~/features/rich-message/core/types'
import { zero, useZeroQuery } from '~/zero/client'

export function useManagerOAMessages(
  oaId: string | undefined,
  chatId: string | undefined,
) {
  const enabled = Boolean(oaId && chatId)

  const [messages, { type: messagesType }] = useZeroQuery(
    oaMessagesByChatId,
    { oaId: oaId ?? '', chatId: chatId ?? '' },
    { enabled },
  )

  const [members] = useZeroQuery(
    oaChatMembersByChatId,
    { oaId: oaId ?? '', chatId: chatId ?? '' },
    { enabled },
  )

  const userMember = useMemo(
    () => members?.find((member) => member.userId) ?? null,
    [members],
  )
  const oaMember = useMemo(
    () => members?.find((member) => member.oaId === oaId) ?? null,
    [members, oaId],
  )

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!oaId || !chatId || !trimmed) return
      await zero.mutate.message.sendAsOA({
        id: crypto.randomUUID(),
        chatId,
        oaId,
        text: trimmed,
        createdAt: Date.now(),
      })
    },
    [chatId, oaId],
  )

  const sendRichMessages = useCallback(
    async (drafts: MessageDraft[]) => {
      if (!oaId || !chatId || drafts.length === 0) return
      const extensions = RichMessageStarterKit.configure()
      const apiMessages = toMessagingApiMessages(drafts, extensions)
      await zero.mutate.message.sendRichAsOA({
        chatId,
        oaId,
        createdAt: Date.now(),
        messages: apiMessages.map((message) => {
          const raw = message as Record<string, unknown>
          const { type, text, ...metadata } = raw
          return {
            id: crypto.randomUUID(),
            type: type as any,
            text: typeof text === 'string' ? text : null,
            metadata: Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : null,
          }
        }),
      })
    },
    [chatId, oaId],
  )

  const markRead = useCallback(
    (lastReadMessageId: string) => {
      if (!oaId || !chatId || !lastReadMessageId) return
      if (oaMember?.lastReadMessageId === lastReadMessageId) return
      zero.mutate.chatMember.markOARead({
        chatId,
        oaId,
        lastReadMessageId,
        lastReadAt: Date.now(),
      })
    },
    [chatId, oaId, oaMember?.lastReadMessageId],
  )

  return {
    messages: messages ?? [],
    isLoading: messagesType === 'unknown',
    userMember,
    oaMember,
    sendMessage,
    sendRichMessages,
    markRead,
  }
}
