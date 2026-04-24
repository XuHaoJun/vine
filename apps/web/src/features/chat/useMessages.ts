import { useCallback, useMemo } from 'react'

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
    zero.mutate.message.send({
      id: crypto.randomUUID(),
      chatId,
      senderId: userId,
      senderType: 'user',
      type: 'text',
      text: text.trim(),
      createdAt: Date.now(),
    })
  }

  const sendSticker = useCallback(
    (packageId: string, stickerId: number) => {
      if (!userId) return
      zero.mutate.message.sendSticker({
        id: crypto.randomUUID(),
        chatId,
        senderId: userId,
        senderType: 'user',
        type: 'sticker',
        metadata: JSON.stringify({ packageId, stickerId }),
        createdAt: Date.now(),
      })
    },
    [chatId, userId],
  )

  const sendMedia = useCallback(
    (type: 'image' | 'video' | 'audio', url: string, extra?: Record<string, unknown>) => {
      if (!userId) return
      zero.mutate.message.send({
        id: crypto.randomUUID(),
        chatId,
        senderId: userId,
        senderType: 'user',
        type,
        text: null,
        metadata: JSON.stringify({ ...(extra ?? {}), originalContentUrl: url }),
        createdAt: Date.now(),
      })
    },
    [chatId, userId],
  )

  const markRead = useCallback(
    (latestMessageId: string) => {
      if (!myMembership) return
      if (myMembership.lastReadMessageId === latestMessageId) return
      zero.mutate.chatMember.markRead({
        id: myMembership.id,
        lastReadMessageId: latestMessageId,
        lastReadAt: Date.now(),
      })
    },
    [myMembership],
  )

  return {
    messages: messages ?? [],
    isLoading,
    myMembership,
    otherMember,
    members: members ?? [],
    sendMessage,
    sendMedia,
    sendSticker,
    markRead,
  }
}
