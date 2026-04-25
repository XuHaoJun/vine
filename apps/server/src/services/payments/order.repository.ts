import { and, eq, inArray, sql } from 'drizzle-orm'
import { stickerOrder } from '@vine/db/schema-private'

export type StickerOrderRow = typeof stickerOrder.$inferSelect

export type CreateOrderInput = {
  id: string
  userId: string
  packageId: string
  amountMinor: number
  currency: 'TWD'
  connectorName: 'ecpay'
}

export type StickerOrderRepository = {
  create(tx: any, input: CreateOrderInput): Promise<void>
  findById(tx: any, id: string): Promise<StickerOrderRow | null>
  transitionToPaid(
    tx: any,
    id: string,
    input: { connectorChargeId: string; paidAt: Date },
  ): Promise<number>
  transitionToFailed(
    tx: any,
    id: string,
    input: { failureReason: string },
  ): Promise<number>
  beginRefund(
    tx: any,
    id: string,
    input: {
      refundId: string
      refundAmountMinor: number
      refundReason: string
      refundRequestedByUserId: string | undefined
      connectorChargeId: string
      paidAt: Date | undefined
      allowedStatuses: Array<'paid' | 'refund_failed' | 'created' | 'failed'>
    },
  ): Promise<number>
  markRefunded(tx: any, id: string, input: { refundedAt: Date }): Promise<number>
  markRefundFailed(tx: any, id: string, input: { refundFailureReason: string }): Promise<number>
  updateReconciliation(
    tx: any,
    id: string,
    input: { connectorStatus: string; mismatch: string | undefined },
  ): Promise<void>
  findForReconciliation(tx: any, input: { since: Date; limit: number }): Promise<StickerOrderRow[]>
}

export function createStickerOrderRepository(_db: any): StickerOrderRepository {
  return {
    async create(tx, input) {
      await tx.insert(stickerOrder).values({
        id: input.id,
        userId: input.userId,
        packageId: input.packageId,
        amountMinor: input.amountMinor,
        currency: input.currency,
        connectorName: input.connectorName,
        status: 'created',
      })
    },

    async findById(tx, id) {
      const rows = await tx
        .select()
        .from(stickerOrder)
        .where(eq(stickerOrder.id, id))
        .limit(1)
      return (rows[0] as StickerOrderRow | undefined) ?? null
    },

    async transitionToPaid(tx, id, input) {
      const result = await tx
        .update(stickerOrder)
        .set({
          status: 'paid',
          connectorChargeId: input.connectorChargeId,
          paidAt: input.paidAt.toISOString(),
          updatedAt: sql`now()`,
        })
        .where(
          and(
            eq(stickerOrder.id, id),
            inArray(stickerOrder.status, ['created', 'failed']),
          ),
        )
      return (result.rowCount as number | undefined) ?? 0
    },

    async transitionToFailed(tx, id, input) {
      const result = await tx
        .update(stickerOrder)
        .set({
          status: 'failed',
          failureReason: input.failureReason,
          updatedAt: sql`now()`,
        })
        .where(and(eq(stickerOrder.id, id), eq(stickerOrder.status, 'created')))
      return (result.rowCount as number | undefined) ?? 0
    },

    async beginRefund(tx, id, input) {
      const result = await tx
        .update(stickerOrder)
        .set({
          status: 'refund_pending',
          refundId: input.refundId,
          refundAmountMinor: input.refundAmountMinor,
          refundReason: input.refundReason,
          refundRequestedByUserId: input.refundRequestedByUserId,
          refundRequestedAt: new Date().toISOString(),
          connectorChargeId: input.connectorChargeId ?? undefined,
          paidAt: input.paidAt?.toISOString() ?? undefined,
          updatedAt: sql`now()`,
        })
        .where(and(eq(stickerOrder.id, id), inArray(stickerOrder.status, input.allowedStatuses)))
      return (result.rowCount as number | undefined) ?? 0
    },

    async markRefunded(tx, id, input) {
      const result = await tx
        .update(stickerOrder)
        .set({
          status: 'refunded',
          refundedAt: input.refundedAt.toISOString(),
          refundFailureReason: null,
          updatedAt: sql`now()`,
        })
        .where(and(eq(stickerOrder.id, id), eq(stickerOrder.status, 'refund_pending')))
      return (result.rowCount as number | undefined) ?? 0
    },

    async markRefundFailed(tx, id, input) {
      const result = await tx
        .update(stickerOrder)
        .set({
          status: 'refund_failed',
          refundFailureReason: input.refundFailureReason,
          updatedAt: sql`now()`,
        })
        .where(and(eq(stickerOrder.id, id), eq(stickerOrder.status, 'refund_pending')))
      return (result.rowCount as number | undefined) ?? 0
    },

    async updateReconciliation(tx, id, input) {
      await tx
        .update(stickerOrder)
        .set({
          lastReconciledAt: new Date().toISOString(),
          lastConnectorStatus: input.connectorStatus,
          lastReconciliationMismatch: input.mismatch ?? null,
          updatedAt: sql`now()`,
        })
        .where(eq(stickerOrder.id, id))
    },

    async findForReconciliation(tx, input) {
      const rows = await tx
        .select()
        .from(stickerOrder)
        .where(
          and(
            sql`${stickerOrder.createdAt} >= ${input.since.toISOString()}`,
            inArray(stickerOrder.status, [
              'created',
              'paid',
              'failed',
              'refund_pending',
              'refund_failed',
            ]),
          ),
        )
        .orderBy(stickerOrder.createdAt)
        .limit(input.limit)
      return rows as StickerOrderRow[]
    },
  }
}
