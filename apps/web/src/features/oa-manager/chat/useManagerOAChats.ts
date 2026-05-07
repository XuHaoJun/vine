import { oaChatsByOfficialAccountId } from '@vine/zero-schema/queries/chat'
import { useMemo } from 'react'
import { useZeroQuery } from '~/zero/client'

export type ManagerOAChatListItem = {
  id: string
  userId: string
  userName: string
  userImage: string | null
  lastMessageText: string | null
  lastMessageAt: number | null
  hasUnread: boolean
}

export function useManagerOAChats(oaId: string | undefined, searchQuery: string) {
  const [chats, { type }] = useZeroQuery(
    oaChatsByOfficialAccountId,
    { oaId: oaId ?? '' },
    { enabled: Boolean(oaId) },
  )

  const items = useMemo<ManagerOAChatListItem[]>(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase()
    return (chats ?? [])
      .map((chat) => {
        const userMember = chat.members?.find((member) => member.userId)
        const oaMember = chat.members?.find((member) => member.oaId === oaId)
        const user = userMember?.user
        const name = user?.name ?? 'Unknown user'
        const lastMessage = chat.lastMessage
        const hasUnread =
          !!lastMessage &&
          lastMessage.senderType === 'user' &&
          oaMember?.lastReadMessageId !== lastMessage.id

        return {
          id: chat.id,
          userId: userMember?.userId ?? '',
          userName: name,
          userImage: user?.image ?? null,
          lastMessageText: lastMessage?.text ?? null,
          lastMessageAt: chat.lastMessageAt ?? null,
          hasUnread,
        }
      })
      .filter((item) => {
        if (!normalizedSearch) return true
        return item.userName.toLowerCase().includes(normalizedSearch)
      })
  }, [chats, oaId, searchQuery])

  return {
    chats: items,
    isLoading: type === 'unknown',
  }
}
