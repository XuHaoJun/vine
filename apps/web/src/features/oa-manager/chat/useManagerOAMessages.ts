import { useCallback, useMemo } from 'react'

import { oaChatMembersByChatId } from '@vine/zero-schema/queries/chat'
import { oaMessagesByChatId } from '@vine/zero-schema/queries/message'
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
    markRead,
  }
}
