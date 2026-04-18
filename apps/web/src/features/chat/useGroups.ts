import { useMemo } from 'react'

import { useZeroQuery } from '~/zero/client'
import { chatsByUserId, chatMembersByChatId } from '@vine/zero-schema/queries/chat'
import { useAuth } from '~/features/auth/client/authClient'

export function useGroups() {
  const { user } = useAuth()
  const userId = user?.id ?? ''

  const [allChats] = useZeroQuery(chatsByUserId, { userId })

  const groups = useMemo(
    () => allChats?.filter((c) => c.type === 'group') ?? [],
    [allChats],
  )

  return { groups, isLoading: false }
}

export function useGroupMembers(chatId: string) {
  const [members] = useZeroQuery(chatMembersByChatId, { chatId })

  const memberNames = useMemo(
    () => members?.filter((m) => m.userId).map((m) => m.user?.name ?? '?') ?? [],
    [members],
  )

  return { members, memberNames, isLoading: false }
}
