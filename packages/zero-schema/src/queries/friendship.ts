import { zql } from 'on-zero'

import { friendshipPermission } from '../models/friendship'

// Accepted friends for the current user
export const friendsByUserId = (props: { userId: string }) => {
  return zql.friendship
    .where(friendshipPermission)
    .where((eb) =>
      eb.or(eb.cmp('requesterId', props.userId), eb.cmp('addresseeId', props.userId)),
    )
    .where('status', 'accepted')
    .related('requester')
    .related('addressee')
    .orderBy('updatedAt', 'desc')
}

// Pending friend requests (both sent and received)
export const pendingRequestsByUserId = (props: { userId: string }) => {
  return zql.friendship
    .where(friendshipPermission)
    .where((eb) =>
      eb.or(eb.cmp('requesterId', props.userId), eb.cmp('addresseeId', props.userId)),
    )
    .where('status', 'pending')
    .related('requester')
    .related('addressee')
    .orderBy('createdAt', 'desc')
}

// Search users by username prefix (for friend search)
export const usersByUsername = (props: { query: string }) => {
  return zql.userPublic
    .where('username', 'LIKE', `${props.query}%`)
    .limit(20)
}
