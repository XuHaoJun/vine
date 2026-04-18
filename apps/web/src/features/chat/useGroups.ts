import { useMemo } from 'react'

import { useZeroQuery } from '~/zero/client'
import { chatsByUserId, chatMembersByChatId } from '@vine/zero-schema/queries/chat'
import { useAuth } from '~/features/auth/client/authClient'

export function useGroups() {
  const { user } = useAuth()
  const userId = user?.id ?? ''

  const { rows: allChats, isLoading } = useZeroQuery({
    query: chatsByUserId,
    args: { userId },
  })

  const groups = useMemo(
    () => allChats?.filter((c) => c.type === 'group') ?? [],
    [allChats],
  )

  return { groups, isLoading }
}

export function useGroupMembers(chatId: string) {
  const { rows: members, isLoading } = useZeroQuery({
    query: chatMembersByChatId,
    args: { chatId },
  })

  const memberNames = useMemo(
    () => members?.filter((m) => m.userId).map((m) => m.user?.name ?? '?') ?? [],
    [members],
  )

  return { members, memberNames, isLoading }
}
