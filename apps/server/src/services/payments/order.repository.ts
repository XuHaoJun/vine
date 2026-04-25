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
  }
}
