import { describe, expect, it } from 'vitest'
import { creatorProfile, stickerAsset, stickerPackage } from '@vine/db/schema-public'
import { stickerReviewEvent } from '@vine/db/schema-private'
import { eq } from 'drizzle-orm'
import { withRollbackDb } from '../../test/integration-db'

describe('creator submission database behavior', () => {
  it('keeps non-on-sale packages out of store query shape', async () => {
    await withRollbackDb(async (db) => {
      await db.insert(creatorProfile).values({
        id: 'creator_int_1',
        userId: 'user_int_1',
        displayName: 'Creator',
        country: 'TW',
      })
      await db.insert(stickerPackage).values({
        id: 'pkg_draft_int_1',
        creatorId: 'creator_int_1',
        name: 'Draft Pack',
        description: 'draft',
        priceMinor: 75,
        currency: 'TWD',
        coverDriveKey: 'stickers/pkg_draft_int_1/cover.png',
        tabIconDriveKey: 'stickers/pkg_draft_int_1/tab_icon.png',
        stickerCount: 8,
        status: 'draft',
      })

      const rows = await db
        .select()
        .from(stickerPackage)
        .where(eq(stickerPackage.status, 'on_sale'))

      expect(rows.some((row: typeof stickerPackage.$inferSelect) => row.id === 'pkg_draft_int_1')).toBe(false)
    })
  })

  it('enforces one asset number per package', async () => {
    await withRollbackDb(async (db) => {
      await db.insert(stickerPackage).values({
        id: 'pkg_int_1',
        name: 'Test Pack',
        description: 'test',
        priceMinor: 75,
        currency: 'TWD',
        coverDriveKey: 'stickers/pkg_int_1/cover.png',
        tabIconDriveKey: 'stickers/pkg_int_1/tab_icon.png',
        stickerCount: 8,
        status: 'draft',
      })
      await db.insert(stickerAsset).values({
        id: 'asset_int_1',
        packageId: 'pkg_int_1',
        number: 1,
        driveKey: 'stickers/pkg_int_1/01.png',
        width: 320,
        height: 320,
        sizeBytes: 100,
        mimeType: 'image/png',
      })

      await expect(
        db.insert(stickerAsset).values({
          id: 'asset_int_2',
          packageId: 'pkg_int_1',
          number: 1,
          driveKey: 'stickers/pkg_int_1/01-copy.png',
          width: 320,
          height: 320,
          sizeBytes: 100,
          mimeType: 'image/png',
        }),
      ).rejects.toThrow()
    })
  })

  it('records review events', async () => {
    await withRollbackDb(async (db) => {
      await db.insert(stickerPackage).values({
        id: 'pkg_int_1',
        name: 'Test Pack',
        description: 'test',
        priceMinor: 75,
        currency: 'TWD',
        coverDriveKey: 'stickers/pkg_int_1/cover.png',
        tabIconDriveKey: 'stickers/pkg_int_1/tab_icon.png',
        stickerCount: 8,
        status: 'draft',
      })
      await db.insert(stickerReviewEvent).values({
        id: 'review_evt_int_1',
        packageId: 'pkg_int_1',
        actorUserId: 'admin_int_1',
        action: 'approved',
      })
      const rows = await db
        .select()
        .from(stickerReviewEvent)
        .where(eq(stickerReviewEvent.packageId, 'pkg_int_1'))
      expect(rows).toHaveLength(1)
    })
  })
})
