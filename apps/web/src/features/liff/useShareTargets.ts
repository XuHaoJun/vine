import { useMemo } from 'react'

import { chatsByUserId } from '@vine/zero-schema/queries/chat'
import { friendsByUserId } from '@vine/zero-schema/queries/friendship'
import { useAuth } from '~/features/auth/client/authClient'
import { useZeroQuery } from '~/zero/client'

type ShareFriend = {
  kind: 'friend'
  userId: string
  name: string
  image: string | null | undefined
  chatId: string | undefined
}

type ShareChat = {
  kind: 'chat'
  chatId: string
  name: string
  image: string | null | undefined
  lastMessageText: string | null | undefined
}

export function useShareTargets() {
  const { user } = useAuth()
  const userId = user?.id ?? ''

  const [friends] = useZeroQuery(
    friendsByUserId,
    { userId },
    { enabled: Boolean(userId) },
  )

  const [chats] = useZeroQuery(chatsByUserId, { userId }, { enabled: Boolean(userId) })

  const shareFriends = useMemo<ShareFriend[]>(() => {
    if (!friends) return []
    return friends.map((f) => {
      const other = f.requesterId === userId ? f.addressee : f.requester
      return {
        kind: 'friend' as const,
        userId: other?.id ?? '',
        name: other?.name ?? other?.username ?? 'Unknown',
        image: other?.image ?? null,
        chatId: undefined,
      }
    })
  }, [friends, userId])

  const shareChats = useMemo<ShareChat[]>(() => {
    if (!chats) return []
    return chats
      .filter((c) => c.type === 'direct')
      .map((c) => {
        const otherMember = c.members?.find((m) => m.userId !== userId && m.user)
        const otherUser = otherMember?.user
        return {
          kind: 'chat' as const,
          chatId: c.id,
          name: otherUser?.name ?? otherUser?.username ?? 'Chat',
          image: otherUser?.image ?? null,
          lastMessageText: c.lastMessage?.text ?? null,
        }
      })
  }, [chats, userId])

  return {
    friends: shareFriends,
    chats: shareChats,
    isLoading: !friends || !chats,
  }
}
