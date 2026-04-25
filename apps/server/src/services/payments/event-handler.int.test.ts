import { describe, expect, it } from 'vitest'
import { entitlement, stickerPackage } from '@vine/db/schema-public'
import { withRollbackDb } from '../../test/integration-db'
import { createEntitlementRepository } from './entitlement.repository'
import { handlePaymentEvent } from './event-handler'
import { createStickerOrderRepository } from './order.repository'

const silentLog = {
  warn: () => {},
  error: () => {},
  info: () => {},
}

async function seedPackage(db: any) {
  await db.insert(stickerPackage).values({
    id: 'pkg-event-int-1',
    name: 'Integration Pack',
    description: '',
    priceMinor: 3000,
    currency: 'TWD',
    coverDriveKey: 'stickers/pkg-event-int-1/cover.png',
    tabIconDriveKey: 'stickers/pkg-event-int-1/tab.png',
    stickerCount: 8,
  })
}

describe('handlePaymentEvent DB integration', () => {
  it('charge.succeeded updates order and grants entitlement in one transaction', async () => {
    await withRollbackDb(async (db) => {
      await seedPackage(db)

      const orderRepo = createStickerOrderRepository(db)
      const entitlementRepo = createEntitlementRepository()
      await orderRepo.create(db, {
        id: 'order-event-int-1',
        userId: 'user-event-int-1',
        packageId: 'pkg-event-int-1',
        amountMinor: 3000,
        currency: 'TWD',
        connectorName: 'ecpay',
      })

      await handlePaymentEvent(
        { db, orderRepo, entitlementRepo },
        {
          kind: 'charge.succeeded',
          merchantTransactionId: 'order-event-int-1',
          connectorChargeId: 'charge-event-int-1',
          amount: { minorAmount: 3000, currency: 'TWD' },
          paidAt: new Date('2026-04-25T00:00:00Z'),
        },
        silentLog,
      )

      const order = await orderRepo.findById(db, 'order-event-int-1')
      const granted = await entitlementRepo.find(db, {
        userId: 'user-event-int-1',
        packageId: 'pkg-event-int-1',
      })

      expect(order?.status).toBe('paid')
      expect(order?.connectorChargeId).toBe('charge-event-int-1')
      expect(granted).toMatchObject({
        userId: 'user-event-int-1',
        packageId: 'pkg-event-int-1',
        grantedByOrderId: 'order-event-int-1',
      })
    })
  })

  it('rolls back order transition when entitlement grant fails', async () => {
    await withRollbackDb(async (db) => {
      await seedPackage(db)

      const orderRepo = createStickerOrderRepository(db)
      const entitlementRepo = {
        ...createEntitlementRepository(),
        async grant() {
          throw new Error('forced entitlement failure')
        },
      }

      await orderRepo.create(db, {
        id: 'order-event-int-rollback',
        userId: 'user-event-int-rollback',
        packageId: 'pkg-event-int-1',
        amountMinor: 3000,
        currency: 'TWD',
        connectorName: 'ecpay',
      })

      await expect(
        handlePaymentEvent(
          { db, orderRepo, entitlementRepo },
          {
            kind: 'charge.succeeded',
            merchantTransactionId: 'order-event-int-rollback',
            connectorChargeId: 'charge-event-int-rollback',
            amount: { minorAmount: 3000, currency: 'TWD' },
            paidAt: new Date('2026-04-25T00:00:00Z'),
          },
          silentLog,
        ),
      ).rejects.toThrow('forced entitlement failure')

      const order = await orderRepo.findById(db, 'order-event-int-rollback')
      const rows = await db.select().from(entitlement)

      expect(order?.status).toBe('created')
      expect(order?.connectorChargeId).toBeNull()
      expect(rows).toHaveLength(0)
    })
  })
})
