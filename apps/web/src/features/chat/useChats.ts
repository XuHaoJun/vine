import { useMemo } from 'react'

import { chatsByUserId } from '@vine/zero-schema/queries/chat'
import { pendingRequestsByUserId } from '@vine/zero-schema/queries/friendship'
import { useAuth } from '~/features/auth/client/authClient'
import { useZeroQuery } from '~/zero/client'

export function useChats() {
  const { user } = useAuth()
  const userId = user?.id ?? ''

  const [chats, { type: chatsType }] = useZeroQuery(
    chatsByUserId,
    { userId },
    {
      enabled: Boolean(userId),
    },
  )

  const [pendingRequests] = useZeroQuery(
    pendingRequestsByUserId,
    { userId },
    { enabled: Boolean(userId) },
  )

  const isLoading = chatsType === 'unknown'

  const pendingCount = useMemo(
    () => pendingRequests?.filter((f) => f.addresseeId === userId).length ?? 0,
    [pendingRequests, userId],
  )

  return {
    chats: chats ?? [],
    isLoading,
    pendingCount,
  }
}
