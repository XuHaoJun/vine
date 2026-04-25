import { describe, it, expect, vi } from 'vitest'
import { createEntitlementRepository } from './entitlement.repository'

function createMockTx(existingRows: any[] = []) {
  return {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
      }),
    }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(existingRows),
        }),
      }),
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue({ rowCount: 1 }),
    }),
  }
}

describe('entitlementRepository', () => {
  it('grants new entitlement', async () => {
    const tx = createMockTx()
    const repo = createEntitlementRepository()

    await repo.grant(tx, {
      userId: 'u1',
      packageId: 'pkg_cat_01',
      grantedByOrderId: 'o1',
    })

    expect(tx.insert).toHaveBeenCalledOnce()
    const insertValues = tx.insert.mock.results[0].value.values.mock.calls[0][0]
    expect(insertValues.userId).toBe('u1')
    expect(insertValues.packageId).toBe('pkg_cat_01')
    expect(insertValues.grantedByOrderId).toBe('o1')
    expect(typeof insertValues.id).toBe('string')
  })

  it('find returns row when match exists', async () => {
    const row = {
      id: 'ent-1',
      userId: 'u1',
      packageId: 'pkg_cat_01',
      grantedByOrderId: 'o1',
      grantedAt: '2026-04-23T00:00:00Z',
    }
    const tx = createMockTx([row])
    const repo = createEntitlementRepository()

    const found = await repo.find(tx, { userId: 'u1', packageId: 'pkg_cat_01' })

    expect(found).toBeDefined()
    expect(found!.userId).toBe('u1')
    expect(found!.packageId).toBe('pkg_cat_01')
  })

  it('find returns null when no match', async () => {
    const tx = createMockTx([])
    const repo = createEntitlementRepository()

    const found = await repo.find(tx, { userId: 'u1', packageId: 'pkg_cat_01' })

    expect(found).toBeNull()
  })

  it('is idempotent on duplicate (userId, packageId) via onConflictDoNothing', async () => {
    const tx = createMockTx()
    const repo = createEntitlementRepository()

    await repo.grant(tx, {
      userId: 'u1',
      packageId: 'pkg_cat_01',
      grantedByOrderId: 'o1',
    })
    await repo.grant(tx, {
      userId: 'u1',
      packageId: 'pkg_cat_01',
      grantedByOrderId: 'o2',
    })

    const onConflictDoNothing =
      tx.insert.mock.results[0].value.values.mock.results[0].value.onConflictDoNothing
    expect(onConflictDoNothing).toHaveBeenCalledTimes(2)
    // Both calls use onConflictDoNothing, ensuring duplicates are silently ignored
    const [call1, call2] = onConflictDoNothing.mock.calls
    expect(call1[0]).toHaveProperty('target')
    expect(call2[0]).toHaveProperty('target')
  })

  it('revokeByOrder deletes by grantedByOrderId', async () => {
    const tx = createMockTx()
    const repo = createEntitlementRepository()

    await repo.revokeByOrder(tx, 'order-1')

    expect(tx.delete).toHaveBeenCalledOnce()
    const whereArg = tx.delete.mock.results[0].value.where.mock.calls[0][0]
    expect(whereArg).toBeDefined()
  })
})
