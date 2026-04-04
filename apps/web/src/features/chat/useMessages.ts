import { useMemo } from 'react'

import { chatMembersByChatId } from '@vine/zero-schema/queries/chat'
import { messagesByChatId } from '@vine/zero-schema/queries/message'
import { useAuth } from '~/features/auth/client/authClient'
import { zero, useZeroQuery } from '~/zero/client'

export function useMessages(chatId: string) {
  const { user } = useAuth()
  const userId = user?.id ?? ''

  const [messages, { type }] = useZeroQuery(
    messagesByChatId,
    { chatId },
    { enabled: Boolean(chatId) },
  )

  const [members] = useZeroQuery(
    chatMembersByChatId,
    { chatId },
    { enabled: Boolean(chatId) },
  )

  const isLoading = type === 'unknown'

  // Find the current user's chatMember record (for read marker updates)
  const myMembership = useMemo(
    () => members?.find((m) => m.userId === userId) ?? null,
    [members, userId],
  )

  const otherMember = useMemo(
    () => members?.find((m) => m.userId !== userId) ?? null,
    [members, userId],
  )

  const sendMessage = (text: string) => {
    if (!userId || !text.trim()) return
    // Omit optional fields (metadata, replyToMessageId) — Zero maps undefined → NULL
    zero.mutate.message.send({
      id: crypto.randomUUID(),
      chatId,
      senderId: userId,
      type: 'text',
      text: text.trim(),
      createdAt: Date.now(),
    })
  }

  const markRead = (latestMessageId: string) => {
    if (!myMembership) return
    // Only update if this message is newer than the last read
    zero.mutate.chatMember.markRead({
      id: myMembership.id,
      lastReadMessageId: latestMessageId,
      lastReadAt: Date.now(),
    })
  }

  return {
    messages: messages ?? [],
    isLoading,
    myMembership,
    otherMember,
    members: members ?? [],
    sendMessage,
    markRead,
  }
}
