import { number, string, table } from '@rocicorp/zero'
import { mutations, serverWhere } from 'on-zero'
import type { TableInsertRow } from 'on-zero'

export type OaFriendship = TableInsertRow<typeof schema>

export const schema = table('oaFriendship')
  .columns({
    id: string(),
    oaId: string(),
    userId: string(),
    status: string(),
    createdAt: number(),
  })
  .primaryKey('id')

export const managerOwnedOaFriendshipPermission = serverWhere(
  'oaFriendship',
  (eb, auth) => {
    const userId = auth?.id || ''
    return eb.exists('oa', (oaQ) =>
      oaQ.whereExists('provider', (providerQ) => providerQ.where('ownerId', userId)),
    )
  },
)

const rejectDirectOaFriendshipMutation = async () => {
  throw new Error('Use an OA contact action')
}

export const mutate = mutations(schema, managerOwnedOaFriendshipPermission, {
  insert: rejectDirectOaFriendshipMutation,
  update: rejectDirectOaFriendshipMutation,
  upsert: rejectDirectOaFriendshipMutation,
  delete: rejectDirectOaFriendshipMutation,
})
