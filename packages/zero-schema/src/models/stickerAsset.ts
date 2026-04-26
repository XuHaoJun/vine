import { number, string, table } from '@rocicorp/zero'
import { mutations, serverWhere } from 'on-zero'

import type { TableInsertRow } from 'on-zero'

export type StickerAsset = TableInsertRow<typeof schema>

export const schema = table('stickerAsset')
  .columns({
    id: string(),
    packageId: string(),
    number: number(),
    driveKey: string(),
    width: number(),
    height: number(),
    sizeBytes: number(),
    mimeType: string(),
    resourceType: string(),
    keywords: string(),
    createdAt: number(),
  })
  .primaryKey('id')

export const stickerAssetReadPermission = serverWhere('stickerAsset', (eb, auth) => {
  return eb.or(
    eb.exists('package', (q) => q.where('status', 'on_sale')),
    eb.exists('package', (q) =>
      q.whereExists('creator', (cq) => cq.where('userId', auth?.id || '')),
    ),
  )
})

export const mutate = mutations({})
