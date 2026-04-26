import { and, eq, gte, inArray, lt } from 'drizzle-orm'
import { stickerPackage } from '@vine/db/schema-public'
import { stickerOrder } from '@vine/db/schema-private'

import type { SalesReportOrderRow } from './sales-report.service'

const REPORTABLE_ORDER_STATUSES = [
  'paid',
  'refund_failed',
  'refund_pending',
  'refunded',
] as const

export function createSalesReportRepository() {
  return {
    async listReportableOrders(
      db: any,
      input: { creatorId: string; monthStart: Date; nextMonthStart: Date },
    ): Promise<SalesReportOrderRow[]> {
      const rows = await db
        .select({
          orderId: stickerOrder.id,
          packageId: stickerPackage.id,
          packageName: stickerPackage.name,
          amountMinor: stickerOrder.amountMinor,
          currency: stickerOrder.currency,
          status: stickerOrder.status,
          createdAt: stickerOrder.createdAt,
        })
        .from(stickerOrder)
        .innerJoin(stickerPackage, eq(stickerOrder.packageId, stickerPackage.id))
        .where(
          and(
            eq(stickerPackage.creatorId, input.creatorId),
            gte(stickerOrder.createdAt, input.monthStart.toISOString()),
            lt(stickerOrder.createdAt, input.nextMonthStart.toISOString()),
            inArray(stickerOrder.status, REPORTABLE_ORDER_STATUSES),
          ),
        )
        .orderBy(stickerOrder.createdAt)

      return rows as SalesReportOrderRow[]
    },
  }
}
