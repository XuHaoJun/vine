import { number, string, table } from '@rocicorp/zero'
import { mutations, serverWhere } from 'on-zero'

import type { TableInsertRow } from 'on-zero'

export type CreatorProfile = TableInsertRow<typeof schema>

export const schema = table('creatorProfile')
  .columns({
    id: string(),
    userId: string(),
    displayName: string(),
    country: string(),
    bio: string(),
    avatarDriveKey: string().optional(),
    kycTier: string(),
    status: string(),
    createdAt: number(),
    updatedAt: number(),
  })
  .primaryKey('id')

export const creatorProfilePermission = serverWhere('creatorProfile', (_, auth) => {
  return _.cmp('userId', auth?.id || '')
})

export const mutate = mutations({})
