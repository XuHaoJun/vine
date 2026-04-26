import { describe, expect, it } from 'vitest'
import { creatorProfile, stickerPackage } from '@vine/db/schema-public'
import { stickerOrder } from '@vine/db/schema-private'
import { withRollbackDb } from '../../test/integration-db'
import { createSalesReportRepository } from './sales-report.repository'

describe('SalesReportRepository DB integration', () => {
  it('returns only current-month reportable orders for creator-owned packages', async () => {
    await withRollbackDb(async (db) => {
      const repo = createSalesReportRepository()
      await insertCreator(db, 'creator_a', 'user_a')
      await insertCreator(db, 'creator_b', 'user_b')
      await insertPackage(db, 'pkg_a', 'creator_a', 'Cats')
      await insertPackage(db, 'pkg_b', 'creator_b', 'Dogs')
      await insertPackage(db, 'pkg_seed', null, 'Seed')

      await insertOrder(db, 'order_paid', 'pkg_a', 'paid', 100, '2026-04-03T10:00:00Z')
      await insertOrder(
        db,
        'order_refund_failed',
        'pkg_a',
        'refund_failed',
        200,
        '2026-04-03T11:00:00Z',
      )
      await insertOrder(
        db,
        'order_refund_pending',
        'pkg_a',
        'refund_pending',
        300,
        '2026-04-03T12:00:00Z',
      )
      await insertOrder(
        db,
        'order_refunded',
        'pkg_a',
        'refunded',
        400,
        '2026-04-03T13:00:00Z',
      )
      await insertOrder(db, 'order_created', 'pkg_a', 'created', 500, '2026-04-03T14:00:00Z')
      await insertOrder(db, 'order_failed', 'pkg_a', 'failed', 600, '2026-04-03T15:00:00Z')
      await insertOrder(db, 'order_other_creator', 'pkg_b', 'paid', 700, '2026-04-03T16:00:00Z')
      await insertOrder(db, 'order_seed', 'pkg_seed', 'paid', 800, '2026-04-03T17:00:00Z')
      await insertOrder(db, 'order_other_month', 'pkg_a', 'paid', 900, '2026-05-01T00:00:00Z')

      const rows = await repo.listReportableOrders(db, {
        creatorId: 'creator_a',
        monthStart: new Date('2026-04-01T00:00:00Z'),
        nextMonthStart: new Date('2026-05-01T00:00:00Z'),
      })

      expect(rows.map((row) => row.orderId)).toEqual([
        'order_paid',
        'order_refund_failed',
        'order_refund_pending',
        'order_refunded',
      ])
      expect(rows.every((row) => row.packageId === 'pkg_a')).toBe(true)
    })
  })
})

async function insertCreator(db: any, id: string, userId: string) {
  await db.insert(creatorProfile).values({
    id,
    userId,
    displayName: id,
    country: 'TW',
    bio: '',
    createdAt: '2026-04-01T00:00:00Z',
    updatedAt: '2026-04-01T00:00:00Z',
  })
}

async function insertPackage(
  db: any,
  id: string,
  creatorId: string | null,
  name: string,
) {
  await db.insert(stickerPackage).values({
    id,
    creatorId,
    name,
    description: '',
    priceMinor: 75,
    currency: 'TWD',
    coverDriveKey: 'cover.png',
    tabIconDriveKey: 'tab.png',
    stickerCount: 8,
    status: 'on_sale',
    stickerType: 'static',
    locale: 'zh-TW',
    tags: '[]',
    copyrightText: '',
    autoPublish: true,
    reviewProblemAssetNumbers: '[]',
    createdAt: '2026-04-01T00:00:00Z',
    updatedAt: '2026-04-01T00:00:00Z',
  })
}

async function insertOrder(
  db: any,
  id: string,
  packageId: string,
  status: 'created' | 'paid' | 'failed' | 'refund_pending' | 'refunded' | 'refund_failed',
  amountMinor: number,
  createdAt: string,
) {
  await db.insert(stickerOrder).values({
    id,
    userId: `${id}_user`,
    packageId,
    amountMinor,
    currency: 'TWD',
    status,
    connectorName: 'ecpay',
    createdAt,
    updatedAt: createdAt,
  })
}
