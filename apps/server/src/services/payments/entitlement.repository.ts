import { and, eq } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { entitlement } from '@vine/db/schema-public'

type EntitlementRow = typeof entitlement.$inferSelect

export type EntitlementRepository = {
  grant(
    tx: any,
    input: { userId: string; packageId: string; grantedByOrderId: string },
  ): Promise<void>
  find(
    tx: any,
    input: { userId: string; packageId: string },
  ): Promise<EntitlementRow | null>
}

export function createEntitlementRepository(): EntitlementRepository {
  return {
    async grant(tx, input) {
      await tx
        .insert(entitlement)
        .values({
          id: randomUUID(),
          userId: input.userId,
          packageId: input.packageId,
          grantedByOrderId: input.grantedByOrderId,
        })
        .onConflictDoNothing({ target: [entitlement.userId, entitlement.packageId] })
    },

    async find(tx, input) {
      const rows = await tx
        .select()
        .from(entitlement)
        .where(and(eq(entitlement.userId, input.userId), eq(entitlement.packageId, input.packageId)))
        .limit(1)
      return (rows[0] as EntitlementRow | undefined) ?? null
    },
  }
}
