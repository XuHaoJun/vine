import { oaContactsByOfficialAccountId } from '@vine/zero-schema/queries/oaFriendship'
import { useMemo } from 'react'
import { useZeroQuery } from '~/zero/client'
import type { ManagerOAChatListItem } from './useManagerOAChats'

export type ManagerOAContactTag = {
  id: string
  name: string
  color: string | null
}

export type ManagerOAContactListItem = {
  id: string
  userId: string
  contactId: string
  userName: string
  userImage: string | null
  friendshipStatus: string
  lastInteractionAt: number | null
  chatId: string | null
  hasUnread: boolean
  chatStatus: 'unread' | 'active' | 'no_chat'
  profileId: string | null
  noteText: string
  noteUpdatedAt: number | null
  tags: ManagerOAContactTag[]
}

export function useManagerOAContacts(
  oaId: string | undefined,
  searchQuery: string,
  chats: ManagerOAChatListItem[],
) {
  const [contacts, { type }] = useZeroQuery(
    oaContactsByOfficialAccountId,
    { oaId: oaId ?? '', limit: 100 },
    { enabled: Boolean(oaId) },
  )

  const items = useMemo<ManagerOAContactListItem[]>(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase()
    const chatsByUserId = new Map(chats.map((chat) => [chat.userId, chat]))

    return (contacts ?? [])
      .map((contact) => {
        const user = contact.user
        const chat = chatsByUserId.get(contact.userId)
        const name = user?.name ?? 'Unknown user'
        const hasUnread = chat?.hasUnread ?? false

        const tags =
          contact.tagAssignments
            ?.map((assignment) => assignment.tag)
            .filter((tag): tag is NonNullable<typeof tag> => Boolean(tag))
            .map((tag) => ({
              id: tag.id,
              name: tag.name,
              color: tag.color ?? null,
            })) ?? []

        return {
          id: contact.id,
          userId: contact.userId,
          contactId: contact.userId,
          userName: name,
          userImage: user?.image ?? null,
          friendshipStatus: contact.status,
          lastInteractionAt: chat?.lastMessageAt ?? null,
          chatId: chat?.id ?? null,
          hasUnread,
          chatStatus: (hasUnread
            ? 'unread'
            : chat
              ? 'active'
              : 'no_chat') as ManagerOAContactListItem['chatStatus'],
          profileId: contact.profile?.id ?? null,
          noteText: contact.profile?.noteText ?? '',
          noteUpdatedAt: contact.profile?.noteUpdatedAt ?? null,
          tags,
        }
      })
      .filter((item) => {
        if (!normalizedSearch) return true
        return (
          item.userName.toLowerCase().includes(normalizedSearch) ||
          item.contactId.toLowerCase().includes(normalizedSearch)
        )
      })
  }, [chats, contacts, searchQuery])

  return {
    contacts: items,
    isLoading: type === 'unknown',
  }
}
