import { number, string, table } from '@rocicorp/zero'
import { mutations, serverWhere } from 'on-zero'

import type { TableInsertRow } from 'on-zero'

export type Friendship = TableInsertRow<typeof schema>

export const schema = table('friendship')
  .columns({
    id: string(),
    requesterId: string(),
    addresseeId: string(),
    status: string(),
    createdAt: number(),
    updatedAt: number(),
  })
  .primaryKey('id')

// Both parties can read their own friendships
export const friendshipPermission = serverWhere('friendship', (eb, auth) => {
  return eb.or(
    eb.cmp('requesterId', auth?.id || ''),
    eb.cmp('addresseeId', auth?.id || ''),
  )
})

// Insert permission: only the requester can create a friendship
const friendshipInsertPermission = serverWhere('friendship', (eb, auth) => {
  return eb.cmp('requesterId', auth?.id || '')
})

export const mutate = mutations(schema, friendshipPermission, {
  insert: async ({ authData, can, tx }, friendship: Friendship) => {
    if (!authData) throw new Error('Unauthorized')
    if (friendship.requesterId !== authData.id) throw new Error('Unauthorized')
    await can(friendshipInsertPermission, authData.id)
    await tx.mutate.friendship.insert(friendship)
  },
  accept: async (
    { authData, tx },
    args: {
      friendshipId: string
      chatId: string
      member1Id: string
      member2Id: string
      requesterId: string
    },
  ) => {
    if (!authData) throw new Error('Unauthorized')

    const now = Date.now()

    await tx.mutate.friendship.update({
      id: args.friendshipId,
      status: 'accepted',
      updatedAt: now,
    })

    await tx.mutate.chat.insert({
      id: args.chatId,
      type: 'direct',
      createdAt: now,
    })

    await tx.mutate.chatMember.insert({
      id: args.member1Id,
      chatId: args.chatId,
      userId: authData.id,
      joinedAt: now,
    })

    await tx.mutate.chatMember.insert({
      id: args.member2Id,
      chatId: args.chatId,
      userId: args.requesterId,
      joinedAt: now,
    })
  },
})
