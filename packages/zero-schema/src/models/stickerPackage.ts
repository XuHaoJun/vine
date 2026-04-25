import { boolean, number, string, table } from '@rocicorp/zero'
import { mutations, serverWhere } from 'on-zero'

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
    creatorId: string().optional(),
    status: string(),
    stickerType: string(),
    locale: string(),
    tags: string(),
    copyrightText: string(),
    licenseConfirmedAt: number().optional(),
    autoPublish: boolean(),
    submittedAt: number().optional(),
    reviewedAt: number().optional(),
    publishedAt: number().optional(),
    reviewReasonCategory: string().optional(),
    reviewReasonText: string().optional(),
    reviewSuggestion: string().optional(),
    reviewProblemAssetNumbers: string(),
    createdAt: number(),
    updatedAt: number(),
  })
  .primaryKey('id')

export const publicStickerPackagePermission = serverWhere(
  'stickerPackage',
  (_, _auth) => _.cmp('status', 'on_sale'),
)

export const creatorStickerPackagePermission = serverWhere(
  'stickerPackage',
  (eb, auth) =>
    eb.or(
      eb.cmp('status', 'on_sale'),
      eb.exists('creator', (q) => q.where('userId', auth?.id || '')),
    ),
)

export const mutate = mutations({})
