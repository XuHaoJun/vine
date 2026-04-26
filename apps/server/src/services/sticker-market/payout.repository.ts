import { and, eq, inArray } from 'drizzle-orm'
import { creatorProfile } from '@vine/db/schema-public'
import {
  creatorPayoutAccount,
  creatorPayoutBatch,
  creatorPayoutLedger,
  creatorPayoutRequest,
} from '@vine/db/schema-private'

export function createPayoutRepository() {
  return {
    async getCreatorPayoutOverview(db: any, input: { userId: string }) {
      const [creator] = await db
        .select()
        .from(creatorProfile)
        .where(eq(creatorProfile.userId, input.userId))
        .limit(1)
      if (!creator) {
        return { creator: undefined, account: undefined, availableLedgers: [], history: [] }
      }
      const [account] = await db
        .select()
        .from(creatorPayoutAccount)
        .where(
          and(
            eq(creatorPayoutAccount.creatorId, creator.id),
            eq(creatorPayoutAccount.status, 'active'),
          ),
        )
        .limit(1)
      const availableLedgers = await db
        .select()
        .from(creatorPayoutLedger)
        .where(
          and(
            eq(creatorPayoutLedger.creatorId, creator.id),
            eq(creatorPayoutLedger.status, 'available'),
          ),
        )
      const history = await db
        .select()
        .from(creatorPayoutRequest)
        .where(eq(creatorPayoutRequest.creatorId, creator.id))
      return { creator, account, availableLedgers, history }
    },

    async createRequestForLedgers(db: any, input: any) {
      const [request] = await db
        .insert(creatorPayoutRequest)
        .values({
          id: input.id,
          creatorId: input.creatorId,
          payoutAccountId: input.payoutAccountId,
          ledgerIdsJson: JSON.stringify(input.ledgerIds),
          grossAmountMinor: input.grossAmountMinor,
          taxWithholdingMinor: input.taxWithholdingMinor,
          transferFeeMinor: input.transferFeeMinor,
          netAmountMinor: input.netAmountMinor,
          status: 'requested',
          requestedAt: input.now,
          updatedAt: input.now,
        })
        .returning()
      await db
        .update(creatorPayoutLedger)
        .set({ status: 'requested', updatedAt: input.now })
        .where(inArray(creatorPayoutLedger.id, input.ledgerIds))
      return request
    },

    async replaceActivePayoutAccount(db: any, input: any) {
      await db
        .update(creatorPayoutAccount)
        .set({ status: 'disabled', updatedAt: input.now })
        .where(
          and(
            eq(creatorPayoutAccount.creatorId, input.creatorId),
            eq(creatorPayoutAccount.status, 'active'),
          ),
        )
      const [account] = await db
        .insert(creatorPayoutAccount)
        .values({
          id: input.id,
          creatorId: input.creatorId,
          legalName: input.legalName,
          bankCode: input.bankCode,
          bankName: input.bankName,
          branchName: input.branchName,
          accountNumber: input.accountNumber,
          accountLast4: input.accountLast4,
          currency: 'TWD',
          status: 'active',
          createdAt: input.now,
          updatedAt: input.now,
        })
        .returning()
      return account
    },

    listPendingRequests(db: any, input: { limit: number }) {
      return db
        .select()
        .from(creatorPayoutRequest)
        .where(eq(creatorPayoutRequest.status, 'requested'))
        .limit(input.limit)
    },

    async approveRequest(db: any, input: any) {
      const [request] = await db
        .update(creatorPayoutRequest)
        .set({
          status: 'approved',
          reviewedAt: input.now,
          reviewedByUserId: input.actorUserId,
          updatedAt: input.now,
        })
        .where(eq(creatorPayoutRequest.id, input.requestId))
        .returning()
      return request
    },

    async rejectRequest(db: any, input: any) {
      const [request] = await db
        .update(creatorPayoutRequest)
        .set({
          status: 'rejected',
          rejectReason: input.reason,
          reviewedAt: input.now,
          reviewedByUserId: input.actorUserId,
          updatedAt: input.now,
        })
        .where(eq(creatorPayoutRequest.id, input.requestId))
        .returning()
      return request
    },

    async createBatchFromApprovedRequests(db: any, input: any) {
      const [batch] = await db
        .insert(creatorPayoutBatch)
        .values({
          id: input.id,
          createdByUserId: input.actorUserId,
          createdAt: input.now,
          updatedAt: input.now,
        })
        .returning()
      await db
        .update(creatorPayoutRequest)
        .set({ batchId: batch.id, status: 'exported', updatedAt: input.now })
        .where(
          and(
            inArray(creatorPayoutRequest.id, input.requestIds),
            eq(creatorPayoutRequest.status, 'approved'),
          ),
        )
      const requests = await db
        .select()
        .from(creatorPayoutRequest)
        .where(inArray(creatorPayoutRequest.id, input.requestIds))
      const ledgerIds = requests.flatMap((request: any) => parseLedgerIds(request.ledgerIdsJson))
      if (ledgerIds.length > 0) {
        await db
          .update(creatorPayoutLedger)
          .set({ status: 'locked', updatedAt: input.now })
          .where(inArray(creatorPayoutLedger.id, ledgerIds))
      }
      return batch
    },

    async exportBatchRows(db: any, input: { batchId: string }) {
      const rows = await db
        .select({
          batchId: creatorPayoutRequest.batchId,
          payoutRequestId: creatorPayoutRequest.id,
          creatorId: creatorPayoutRequest.creatorId,
          creatorDisplayName: creatorProfile.displayName,
          legalName: creatorPayoutAccount.legalName,
          bankCode: creatorPayoutAccount.bankCode,
          bankName: creatorPayoutAccount.bankName,
          branchName: creatorPayoutAccount.branchName,
          accountNumber: creatorPayoutAccount.accountNumber,
          accountLast4: creatorPayoutAccount.accountLast4,
          currency: creatorPayoutRequest.currency,
          grossAmountMinor: creatorPayoutRequest.grossAmountMinor,
          taxWithholdingMinor: creatorPayoutRequest.taxWithholdingMinor,
          transferFeeMinor: creatorPayoutRequest.transferFeeMinor,
          netAmountMinor: creatorPayoutRequest.netAmountMinor,
        })
        .from(creatorPayoutRequest)
        .innerJoin(creatorProfile, eq(creatorPayoutRequest.creatorId, creatorProfile.id))
        .innerJoin(
          creatorPayoutAccount,
          eq(creatorPayoutRequest.payoutAccountId, creatorPayoutAccount.id),
        )
        .where(eq(creatorPayoutRequest.batchId, input.batchId))

      return rows.map((row: any) => ({
        ...row,
        batchId: row.batchId ?? input.batchId,
        memo: `Vine payout ${row.payoutRequestId}`,
      }))
    },

    async markRequestPaid(db: any, input: any) {
      const [request] = await db
        .update(creatorPayoutRequest)
        .set({
          status: 'paid',
          bankTransactionId: input.bankTransactionId,
          paidAt: input.paidAt,
          updatedAt: input.now,
        })
        .where(
          and(
            eq(creatorPayoutRequest.id, input.requestId),
            eq(creatorPayoutRequest.status, 'exported'),
          ),
        )
        .returning()
      if (!request) return undefined
      const ledgerIds = parseLedgerIds(request.ledgerIdsJson)
      if (ledgerIds.length > 0) {
        await db
          .update(creatorPayoutLedger)
          .set({ status: 'paid', updatedAt: input.now })
          .where(inArray(creatorPayoutLedger.id, ledgerIds))
      }
      return request
    },

    async markRequestFailed(db: any, input: any) {
      const [request] = await db
        .update(creatorPayoutRequest)
        .set({
          status: 'failed',
          failureReason: input.reason,
          updatedAt: input.now,
        })
        .where(
          and(
            eq(creatorPayoutRequest.id, input.requestId),
            eq(creatorPayoutRequest.status, 'exported'),
          ),
        )
        .returning()
      if (!request) return undefined
      const ledgerIds = parseLedgerIds(request.ledgerIdsJson)
      if (ledgerIds.length > 0) {
        await db
          .update(creatorPayoutLedger)
          .set({ status: 'available', updatedAt: input.now })
          .where(inArray(creatorPayoutLedger.id, ledgerIds))
      }
      return request
    },
  }
}

function parseLedgerIds(value: string | null | undefined) {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string' && item.length > 0)
      : []
  } catch {
    return []
  }
}
