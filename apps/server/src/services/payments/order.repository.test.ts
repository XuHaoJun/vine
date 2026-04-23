import { describe, it, expect, beforeEach } from 'vitest'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { stickerOrder } from '@vine/db/schema-private'
import { createStickerOrderRepository } from './order.repository'

const TEST_DB_URL =
  process.env['ZERO_UPSTREAM_DB'] ?? 'postgresql://user:password@localhost:5533/postgres'

const pool = new Pool({ connectionString: TEST_DB_URL, max: 5 })
const db = drizzle({ client: pool })

const repo = createStickerOrderRepository(db)

beforeEach(async () => {
  await db.delete(stickerOrder)
})

describe('StickerOrderRepository', () => {
  it('create inserts a row with status=created', async () => {
    await repo.create(db, {
      id: 'order-1',
      userId: 'user-1',
      packageId: 'pkg-1',
      amountMinor: 3000,
      currency: 'TWD',
      connectorName: 'ecpay',
    })

    const row = await repo.findById(db, 'order-1')
    expect(row).not.toBeNull()
    expect(row!.status).toBe('created')
    expect(row!.amountMinor).toBe(3000)
  })

  it('transitionToPaid updates created→paid and returns 1', async () => {
    await repo.create(db, {
      id: 'order-2',
      userId: 'user-1',
      packageId: 'pkg-1',
      amountMinor: 3000,
      currency: 'TWD',
      connectorName: 'ecpay',
    })

    const count = await repo.transitionToPaid(db, 'order-2', {
      connectorChargeId: 'charge-abc',
      paidAt: new Date('2026-04-23T10:00:00Z'),
    })

    expect(count).toBe(1)
    const row = await repo.findById(db, 'order-2')
    expect(row!.status).toBe('paid')
    expect(row!.connectorChargeId).toBe('charge-abc')
  })

  it('transitionToPaid is idempotent when already paid (returns 0)', async () => {
    await repo.create(db, {
      id: 'order-3',
      userId: 'user-1',
      packageId: 'pkg-1',
      amountMinor: 3000,
      currency: 'TWD',
      connectorName: 'ecpay',
    })

    await repo.transitionToPaid(db, 'order-3', {
      connectorChargeId: 'charge-abc',
      paidAt: new Date('2026-04-23T10:00:00Z'),
    })

    const count = await repo.transitionToPaid(db, 'order-3', {
      connectorChargeId: 'charge-abc',
      paidAt: new Date('2026-04-23T10:00:00Z'),
    })

    expect(count).toBe(0)
  })

  it('transitionToPaid allows failed→paid', async () => {
    await repo.create(db, {
      id: 'order-4',
      userId: 'user-1',
      packageId: 'pkg-1',
      amountMinor: 3000,
      currency: 'TWD',
      connectorName: 'ecpay',
    })

    await repo.transitionToFailed(db, 'order-4', { failureReason: 'timeout' })
    const count = await repo.transitionToPaid(db, 'order-4', {
      connectorChargeId: 'charge-xyz',
      paidAt: new Date('2026-04-23T10:00:00Z'),
    })

    expect(count).toBe(1)
    const row = await repo.findById(db, 'order-4')
    expect(row!.status).toBe('paid')
  })

  it('transitionToFailed blocks already-paid orders (returns 0)', async () => {
    await repo.create(db, {
      id: 'order-5',
      userId: 'user-1',
      packageId: 'pkg-1',
      amountMinor: 3000,
      currency: 'TWD',
      connectorName: 'ecpay',
    })

    await repo.transitionToPaid(db, 'order-5', {
      connectorChargeId: 'charge-abc',
      paidAt: new Date('2026-04-23T10:00:00Z'),
    })

    const count = await repo.transitionToFailed(db, 'order-5', {
      failureReason: 'some-error',
    })

    expect(count).toBe(0)
    const row = await repo.findById(db, 'order-5')
    expect(row!.status).toBe('paid')
  })
})
