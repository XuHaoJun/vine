import { describe, it, expect, vi } from 'vitest'
import { createStickerOrderRepository } from './order.repository'

// Build a Drizzle-shaped mock tx without any real DB connection.
// The mock controls what rowCount / rows come back so tests can
// verify both the happy path and the pass-through of 0 (idempotent).
function makeTx(opts: { rows?: object[]; rowCount?: number } = {}) {
  const rows = opts.rows ?? []
  const rowCount = opts.rowCount ?? 0

  const whereChain = { where: vi.fn().mockResolvedValue({ rowCount }) }
  const setChain = { set: vi.fn().mockReturnValue(whereChain) }
  const limitChain = { limit: vi.fn().mockResolvedValue(rows) }
  const orderByChain = { orderBy: vi.fn().mockReturnValue(limitChain) }
  const fromChain = { where: vi.fn().mockReturnValue({ ...orderByChain, ...limitChain }) }

  return {
    insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) }),
    select: vi.fn().mockReturnValue({ from: vi.fn().mockReturnValue(fromChain) }),
    update: vi.fn().mockReturnValue(setChain),
    // exposed for assertions
    _setChain: setChain,
    _whereChain: whereChain,
    _fromChain: fromChain,
  }
}

const INPUT = {
  id: 'order-1',
  userId: 'user-1',
  packageId: 'pkg-1',
  amountMinor: 3000,
  currency: 'TWD' as const,
  connectorName: 'ecpay' as const,
}

const repo = createStickerOrderRepository({} as any)

describe('StickerOrderRepository', () => {
  it('create inserts a row with status=created', async () => {
    const tx = makeTx()
    await repo.create(tx, INPUT)

    expect(tx.insert).toHaveBeenCalledOnce()
    const valuesArg = (tx.insert.mock.results[0]!.value as any).values.mock.calls[0][0]
    expect(valuesArg).toMatchObject({
      id: 'order-1',
      userId: 'user-1',
      packageId: 'pkg-1',
      amountMinor: 3000,
      currency: 'TWD',
      connectorName: 'ecpay',
      status: 'created',
    })
  })

  it('findById returns the matching row', async () => {
    const row = { id: 'order-1', status: 'created', amountMinor: 3000 }
    const tx = makeTx({ rows: [row] })
    const result = await repo.findById(tx, 'order-1')
    expect(result).toEqual(row)
  })

  it('findById returns null when no row found', async () => {
    const tx = makeTx({ rows: [] })
    const result = await repo.findById(tx, 'missing')
    expect(result).toBeNull()
  })

  it('transitionToPaid sets status=paid and returns rowCount', async () => {
    const tx = makeTx({ rowCount: 1 })
    const count = await repo.transitionToPaid(tx, 'order-1', {
      connectorChargeId: 'charge-abc',
      paidAt: new Date('2026-04-23T10:00:00Z'),
    })

    expect(count).toBe(1)
    const setArg = tx._setChain.set.mock.calls[0]![0]
    expect(setArg).toMatchObject({
      status: 'paid',
      connectorChargeId: 'charge-abc',
      paidAt: '2026-04-23T10:00:00.000Z',
    })
  })

  it('transitionToPaid propagates rowCount=0 (idempotent / already paid)', async () => {
    const tx = makeTx({ rowCount: 0 })
    const count = await repo.transitionToPaid(tx, 'order-1', {
      connectorChargeId: 'charge-abc',
      paidAt: new Date('2026-04-23T10:00:00Z'),
    })
    expect(count).toBe(0)
  })

  it('transitionToFailed sets status=failed and returns rowCount', async () => {
    const tx = makeTx({ rowCount: 1 })
    const count = await repo.transitionToFailed(tx, 'order-1', {
      failureReason: 'timeout',
    })

    expect(count).toBe(1)
    const setArg = tx._setChain.set.mock.calls[0]![0]
    expect(setArg).toMatchObject({ status: 'failed', failureReason: 'timeout' })
  })

  it('transitionToFailed propagates rowCount=0 (blocked when already paid)', async () => {
    const tx = makeTx({ rowCount: 0 })
    const count = await repo.transitionToFailed(tx, 'order-1', {
      failureReason: 'some-error',
    })
    expect(count).toBe(0)
  })

  it('beginRefund sets status=refund_pending and returns rowCount', async () => {
    const tx = makeTx({ rowCount: 1 })
    const count = await repo.beginRefund(tx, 'order-1', {
      refundId: 'refund-order-1',
      refundAmountMinor: 3000,
      refundReason: 'admin_exception',
      refundRequestedByUserId: 'admin-1',
      connectorChargeId: 'charge-abc',
      paidAt: new Date('2026-04-25T01:00:00Z'),
      allowedStatuses: ['paid', 'refund_failed'],
    })

    expect(count).toBe(1)
    const setArg = tx._setChain.set.mock.calls[0]![0]
    expect(setArg).toMatchObject({
      status: 'refund_pending',
      refundId: 'refund-order-1',
      refundAmountMinor: 3000,
      refundReason: 'admin_exception',
      refundRequestedByUserId: 'admin-1',
    })
    expect(setArg.refundRequestedAt).toBeDefined()
    expect(setArg.updatedAt).toBeDefined()
  })

  it('markRefunded sets status=refunded and returns rowCount', async () => {
    const tx = makeTx({ rowCount: 1 })
    const count = await repo.markRefunded(tx, 'order-1', {
      refundedAt: new Date('2026-04-25T01:01:00Z'),
    })

    expect(count).toBe(1)
    const setArg = tx._setChain.set.mock.calls[0]![0]
    expect(setArg).toMatchObject({
      status: 'refunded',
      refundedAt: '2026-04-25T01:01:00.000Z',
      refundFailureReason: null,
    })
  })

  it('markRefundFailed sets status=refund_failed and returns rowCount', async () => {
    const tx = makeTx({ rowCount: 1 })
    const count = await repo.markRefundFailed(tx, 'order-1', {
      refundFailureReason: 'denied',
    })

    expect(count).toBe(1)
    const setArg = tx._setChain.set.mock.calls[0]![0]
    expect(setArg).toMatchObject({
      status: 'refund_failed',
      refundFailureReason: 'denied',
    })
  })

  it('updateReconciliation sets last reconciled fields', async () => {
    const tx = makeTx({ rowCount: 1 })
    await repo.updateReconciliation(tx, 'order-1', {
      connectorStatus: 'paid',
      mismatch: 'local created, connector paid',
    })

    const setArg = tx._setChain.set.mock.calls[0]![0]
    expect(setArg.lastReconciledAt).toBeDefined()
    expect(setArg.lastConnectorStatus).toBe('paid')
    expect(setArg.lastReconciliationMismatch).toBe('local created, connector paid')
  })

  it('findForReconciliation calls select with correct filters, order, and limit', async () => {
    const rows = [
      { id: 'order-1', status: 'paid', createdAt: '2026-04-24T10:00:00.000Z' },
      { id: 'order-2', status: 'failed', createdAt: '2026-04-24T11:00:00.000Z' },
    ]
    const tx = makeTx({ rows })
    const since = new Date('2026-04-24T00:00:00Z')
    const result = await repo.findForReconciliation(tx, { since, limit: 10 })

    expect(result).toEqual(rows)
    expect(tx.select).toHaveBeenCalledOnce()
    expect(tx.select.mock.results[0]!.value.from).toHaveBeenCalledOnce()
    const fromArg = tx.select.mock.results[0]!.value.from.mock.calls[0][0]
    expect(fromArg).toBeDefined()

    const whereChain = tx.select.mock.results[0]!.value.from.mock.results[0]!.value
    expect(whereChain.where).toHaveBeenCalledOnce()

    const orderByChain = whereChain.where.mock.results[0]!.value
    expect(orderByChain.orderBy).toHaveBeenCalledOnce()

    const limitChain = orderByChain.orderBy.mock.results[0]!.value
    expect(limitChain.limit).toHaveBeenCalledOnce()
    expect(limitChain.limit.mock.calls[0][0]).toBe(10)
  })
})
