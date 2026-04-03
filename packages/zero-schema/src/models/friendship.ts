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
  // accept: cross-table operation — defined in Task 8
})
