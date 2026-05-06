import { number, string, table } from '@rocicorp/zero'
import { mutations, serverWhere } from 'on-zero'

import type { TableInsertRow } from 'on-zero'

export type OAProvider = TableInsertRow<typeof schema>

export const schema = table('oaProvider')
  .columns({
    id: string(),
    name: string(),
    ownerId: string(),
    createdAt: number(),
    updatedAt: number(),
  })
  .primaryKey('id')

export const oaProviderOwnerPermission = serverWhere('oaProvider', (_, auth) => {
  return _.cmp('ownerId', auth?.id || '')
})

export const mutate = mutations(schema, oaProviderOwnerPermission)
