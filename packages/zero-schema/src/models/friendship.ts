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

export const mutate = mutations(schema, friendshipPermission, {
  // accept: cross-table operation — defined in Task 8
})
