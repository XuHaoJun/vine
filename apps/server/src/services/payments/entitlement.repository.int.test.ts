import { describe, expect, it } from 'vitest'
import { entitlement } from '@vine/db/schema-public'
import { withRollbackDb } from '../../test/integration-db'
import { createEntitlementRepository } from './entitlement.repository'

describe('EntitlementRepository DB integration', () => {
  it('is idempotent through the real unique index and onConflictDoNothing', async () => {
    await withRollbackDb(async (db) => {
      const repo = createEntitlementRepository()

      await repo.grant(db, {
        userId: 'user-int-1',
        packageId: 'pkg-int-1',
        grantedByOrderId: 'order-int-1',
      })
      await repo.grant(db, {
        userId: 'user-int-1',
        packageId: 'pkg-int-1',
        grantedByOrderId: 'order-int-2',
      })

      const rows = await db.select().from(entitlement)
      const found = await repo.find(db, {
        userId: 'user-int-1',
        packageId: 'pkg-int-1',
      })

      expect(rows).toHaveLength(1)
      expect(found).toMatchObject({
        userId: 'user-int-1',
        packageId: 'pkg-int-1',
        grantedByOrderId: 'order-int-1',
      })
    })
  })
})
