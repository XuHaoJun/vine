import { number, string, table } from '@rocicorp/zero'
import { mutations } from 'on-zero'

import type { TableInsertRow } from 'on-zero'

export type StickerPackage = TableInsertRow<typeof schema>

export const schema = table('stickerPackage')
  .columns({
    id: string(),
    name: string(),
    description: string(),
    priceMinor: number(),
    currency: string(),
    coverDriveKey: string(),
    tabIconDriveKey: string(),
    stickerCount: number(),
    createdAt: number(),
    updatedAt: number(),
  })
  .primaryKey('id')

export const mutate = mutations({})
