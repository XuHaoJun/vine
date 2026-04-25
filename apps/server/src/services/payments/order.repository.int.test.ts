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

  it('transitions paid -> refund_pending -> refunded', async () => {
    await withRollbackDb(async (db) => {
      const repo = createStickerOrderRepository(db)

      await repo.create(db, {
        id: 'int_order_refund',
        userId: 'user-int-1',
        packageId: 'pkg-int-1',
        amountMinor: 3000,
        currency: 'TWD',
        connectorName: 'ecpay',
      })
      await repo.transitionToPaid(db, 'int_order_refund', {
        connectorChargeId: 'charge-int-1',
        paidAt: new Date('2026-04-25T00:00:00Z'),
      })

      const refundCount = await repo.beginRefund(db, 'int_order_refund', {
        refundId: 'refund-int-1',
        refundAmountMinor: 3000,
        refundReason: 'admin_exception',
        refundRequestedByUserId: 'admin-1',
        connectorChargeId: 'charge-int-1',
        paidAt: new Date('2026-04-25T00:00:00Z'),
        allowedStatuses: ['paid', 'refund_failed'],
      })
      const refundedCount = await repo.markRefunded(db, 'int_order_refund', {
        refundedAt: new Date('2026-04-25T01:01:00Z'),
      })
      const order = await repo.findById(db, 'int_order_refund')

      expect(refundCount).toBe(1)
      expect(refundedCount).toBe(1)
      expect(order).toMatchObject({
        status: 'refunded',
        refundId: 'refund-int-1',
        refundAmountMinor: 3000,
        refundReason: 'admin_exception',
        refundRequestedByUserId: 'admin-1',
      })
    })
  })

  it('transitions refund_pending -> refund_failed', async () => {
    await withRollbackDb(async (db) => {
      const repo = createStickerOrderRepository(db)

      await repo.create(db, {
        id: 'int_order_refund_fail',
        userId: 'user-int-1',
        packageId: 'pkg-int-1',
        amountMinor: 3000,
        currency: 'TWD',
        connectorName: 'ecpay',
      })
      await repo.transitionToPaid(db, 'int_order_refund_fail', {
        connectorChargeId: 'charge-int-1',
        paidAt: new Date('2026-04-25T00:00:00Z'),
      })
      await repo.beginRefund(db, 'int_order_refund_fail', {
        refundId: 'refund-int-2',
        refundAmountMinor: 3000,
        refundReason: 'admin_exception',
        refundRequestedByUserId: 'admin-1',
        connectorChargeId: 'charge-int-1',
        paidAt: new Date('2026-04-25T00:00:00Z'),
        allowedStatuses: ['paid', 'refund_failed'],
      })

      const count = await repo.markRefundFailed(db, 'int_order_refund_fail', {
        refundFailureReason: 'denied',
      })
      const order = await repo.findById(db, 'int_order_refund_fail')

      expect(count).toBe(1)
      expect(order?.status).toBe('refund_failed')
      expect(order?.refundFailureReason).toBe('denied')
    })
  })

  it('updateReconciliation updates last reconciled fields', async () => {
    await withRollbackDb(async (db) => {
      const repo = createStickerOrderRepository(db)

      await repo.create(db, {
        id: 'int_order_reconcile',
        userId: 'user-int-1',
        packageId: 'pkg-int-1',
        amountMinor: 3000,
        currency: 'TWD',
        connectorName: 'ecpay',
      })

      await repo.updateReconciliation(db, 'int_order_reconcile', {
        connectorStatus: 'paid',
        mismatch: 'local created, connector paid',
      })
      const order = await repo.findById(db, 'int_order_reconcile')

      expect(order?.lastConnectorStatus).toBe('paid')
      expect(order?.lastReconciliationMismatch).toBe('local created, connector paid')
      expect(order?.lastReconciledAt).toBeDefined()
    })
  })
})
