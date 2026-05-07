import { number, string, table } from '@rocicorp/zero'
import { mutations, serverWhere } from 'on-zero'

import type { TableInsertRow } from 'on-zero'

export type OfficialAccount = TableInsertRow<typeof schema>

export const schema = table('officialAccount')
  .columns({
    id: string(),
    providerId: string(),
    name: string(),
    uniqueId: string(),
    description: string().optional(),
    imageUrl: string().optional(),
    status: string(),
    kind: string(),
    email: string().optional(),
    country: string().optional(),
    company: string().optional(),
    industry: string().optional(),
    createdAt: number(),
    updatedAt: number(),
  })
  .primaryKey('id')

export const officialAccountOwnerPermission = serverWhere(
  'officialAccount',
  (eb, auth) => {
    return eb.exists('provider', (q) => q.where('ownerId', auth?.id || ''))
  },
)

export const mutate = mutations({})
