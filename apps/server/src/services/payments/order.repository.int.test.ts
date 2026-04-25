import { describe, expect, it } from 'vitest'
import { withRollbackDb } from '../../test/integration-db'
import { createStickerOrderRepository } from './order.repository'

describe('StickerOrderRepository DB integration', () => {
  it('transitions created -> paid once and returns rowCount=0 after already paid', async () => {
    await withRollbackDb(async (db) => {
      const repo = createStickerOrderRepository(db)

      await repo.create(db, {
        id: 'int_order_paid_once',
        userId: 'user-int-1',
        packageId: 'pkg-int-1',
        amountMinor: 3000,
        currency: 'TWD',
        connectorName: 'ecpay',
      })

      const first = await repo.transitionToPaid(db, 'int_order_paid_once', {
        connectorChargeId: 'charge-int-1',
        paidAt: new Date('2026-04-25T00:00:00Z'),
      })
      const second = await repo.transitionToPaid(db, 'int_order_paid_once', {
        connectorChargeId: 'charge-int-2',
        paidAt: new Date('2026-04-25T00:01:00Z'),
      })
      const order = await repo.findById(db, 'int_order_paid_once')

      expect(first).toBe(1)
      expect(second).toBe(0)
      expect(order).toMatchObject({
        id: 'int_order_paid_once',
        status: 'paid',
        connectorChargeId: 'charge-int-1',
      })
    })
  })

  it('does not transition paid -> failed', async () => {
    await withRollbackDb(async (db) => {
      const repo = createStickerOrderRepository(db)

      await repo.create(db, {
        id: 'int_order_paid_not_failed',
        userId: 'user-int-1',
        packageId: 'pkg-int-1',
        amountMinor: 3000,
        currency: 'TWD',
        connectorName: 'ecpay',
      })
      await repo.transitionToPaid(db, 'int_order_paid_not_failed', {
        connectorChargeId: 'charge-int-1',
        paidAt: new Date('2026-04-25T00:00:00Z'),
      })

      const failed = await repo.transitionToFailed(db, 'int_order_paid_not_failed', {
        failureReason: 'late failure webhook',
      })
      const order = await repo.findById(db, 'int_order_paid_not_failed')

      expect(failed).toBe(0)
      expect(order?.status).toBe('paid')
      expect(order?.failureReason).toBeNull()
    })
  })
})
