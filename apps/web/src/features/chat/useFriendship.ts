import { useMemo } from 'react'

import {
  friendsByUserId,
  pendingRequestsByUserId,
  usersByUsername,
} from '@vine/zero-schema/queries/friendship'
import { useAuth } from '~/features/auth/client/authClient'
import { showError } from '~/interface/dialogs/actions'
import { zero, useZeroQuery } from '~/zero/client'

export function useFriends() {
  const { user } = useAuth()
  const userId = user?.id ?? ''

  const [friends] = useZeroQuery(
    friendsByUserId,
    { userId },
    { enabled: Boolean(userId) },
  )

  return { friends: friends ?? [] }
}

export function usePendingRequests() {
  const { user } = useAuth()
  const userId = user?.id ?? ''

  const [pending] = useZeroQuery(
    pendingRequestsByUserId,
    { userId },
    { enabled: Boolean(userId) },
  )

  const received = useMemo(
    () => pending?.filter((f) => f.addresseeId === userId) ?? [],
    [pending, userId],
  )

  const sent = useMemo(
    () => pending?.filter((f) => f.requesterId === userId) ?? [],
    [pending, userId],
  )

  return { received, sent }
}

export function useFriendshipActions() {
  const { user } = useAuth()
  const userId = user?.id ?? ''

  const sendRequest = (addresseeId: string) => {
    if (!userId) return
    zero.mutate.friendship.insert({
      id: crypto.randomUUID(),
      requesterId: userId,
      addresseeId,
      status: 'pending',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
  }

  const acceptRequest = (friendship: { id: string; requesterId: string }) => {
    if (!userId) return
    zero.mutate.friendship.accept({
      friendshipId: friendship.id,
      chatId: crypto.randomUUID(),
      member1Id: crypto.randomUUID(),
      member2Id: crypto.randomUUID(),
      requesterId: friendship.requesterId,
    })
  }

  const rejectRequest = (friendshipId: string) => {
    zero.mutate.friendship.update({
      id: friendshipId,
      status: 'rejected',
      updatedAt: Date.now(),
    })
  }

  return { sendRequest, acceptRequest, rejectRequest }
}

export function useUserSearch(query: string) {
  const [users] = useZeroQuery(usersByUsername, { query }, { enabled: query.length >= 2 })
  return { users: users ?? [] }
}
