import { describe, expect, it, vi } from 'vitest'
import { createSalesReportService } from './sales-report.service'

function makeService(rows: any[], profile: any = { id: 'creator_1', userId: 'user_1' }) {
  return createSalesReportService({
    db: {},
    creatorRepo: {
      findByUserId: vi.fn().mockResolvedValue(profile),
    } as any,
    salesReportRepo: {
      listReportableOrders: vi.fn().mockResolvedValue(rows),
    } as any,
  })
}

describe('createSalesReportService', () => {
  it('rejects invalid report months', async () => {
    const service = makeService([])

    await expect(
      service.getCreatorSalesReport({ userId: 'user_1', month: '2026-4' }),
    ).rejects.toThrow('invalid report month')
  })

  it('returns an empty current-month report when the user has no creator profile', async () => {
    const service = makeService([], undefined)

    const report = await service.getCreatorSalesReport({
      userId: 'user_1',
      month: '2026-04',
    })

    expect(report.summary).toMatchObject({
      grossSalesMinor: 0,
      confirmedRevenueMinor: 0,
      soldCount: 0,
      refundedCount: 0,
      refundedMinor: 0,
      refundPendingCount: 0,
      refundPendingMinor: 0,
      currency: 'TWD',
    })
    expect(report.dailyRows).toHaveLength(30)
    expect(report.packageRows).toEqual([])
  })

  it('includes paid and refund_failed orders in confirmed totals', async () => {
    const service = makeService([
      {
        orderId: 'order_1',
        packageId: 'pkg_1',
        packageName: 'Cats',
        amountMinor: 100,
        currency: 'TWD',
        status: 'paid',
        createdAt: '2026-04-03T10:00:00Z',
      },
      {
        orderId: 'order_2',
        packageId: 'pkg_1',
        packageName: 'Cats',
        amountMinor: 200,
        currency: 'TWD',
        status: 'refund_failed',
        createdAt: '2026-04-03T11:00:00Z',
      },
    ])

    const report = await service.getCreatorSalesReport({
      userId: 'user_1',
      month: '2026-04',
    })

    expect(report.summary.grossSalesMinor).toBe(300)
    expect(report.summary.confirmedRevenueMinor).toBe(210)
    expect(report.summary.soldCount).toBe(2)
    expect(report.packageRows[0]).toMatchObject({
      packageId: 'pkg_1',
      packageName: 'Cats',
      grossSalesMinor: 300,
      confirmedRevenueMinor: 210,
      soldCount: 2,
      refundedCount: 0,
    })
  })

  it('separates refunded and refund_pending orders from confirmed totals', async () => {
    const service = makeService([
      {
        orderId: 'order_paid',
        packageId: 'pkg_1',
        packageName: 'Cats',
        amountMinor: 300,
        currency: 'TWD',
        status: 'paid',
        createdAt: '2026-04-04T10:00:00Z',
      },
      {
        orderId: 'order_refunded',
        packageId: 'pkg_1',
        packageName: 'Cats',
        amountMinor: 100,
        currency: 'TWD',
        status: 'refunded',
        createdAt: '2026-04-04T11:00:00Z',
      },
      {
        orderId: 'order_pending',
        packageId: 'pkg_2',
        packageName: 'Dogs',
        amountMinor: 200,
        currency: 'TWD',
        status: 'refund_pending',
        createdAt: '2026-04-05T10:00:00Z',
      },
    ])

    const report = await service.getCreatorSalesReport({
      userId: 'user_1',
      month: '2026-04',
    })

    expect(report.summary).toMatchObject({
      grossSalesMinor: 300,
      confirmedRevenueMinor: 210,
      soldCount: 1,
      refundedCount: 1,
      refundedMinor: 100,
      refundPendingCount: 1,
      refundPendingMinor: 200,
    })
  })

  it('sorts package rows by confirmed gross, sold count, then package name', async () => {
    const service = makeService([
      {
        orderId: 'order_b1',
        packageId: 'pkg_b',
        packageName: 'Beta',
        amountMinor: 100,
        currency: 'TWD',
        status: 'paid',
        createdAt: '2026-04-01T10:00:00Z',
      },
      {
        orderId: 'order_a1',
        packageId: 'pkg_a',
        packageName: 'Alpha',
        amountMinor: 100,
        currency: 'TWD',
        status: 'paid',
        createdAt: '2026-04-01T11:00:00Z',
      },
      {
        orderId: 'order_c1',
        packageId: 'pkg_c',
        packageName: 'Gamma',
        amountMinor: 200,
        currency: 'TWD',
        status: 'paid',
        createdAt: '2026-04-01T12:00:00Z',
      },
    ])

    const report = await service.getCreatorSalesReport({
      userId: 'user_1',
      month: '2026-04',
    })

    expect(report.packageRows.map((row) => row.packageId)).toEqual([
      'pkg_c',
      'pkg_a',
      'pkg_b',
    ])
  })
})
