import { randomUUID } from 'node:crypto'
import { and, eq, inArray } from 'drizzle-orm'
import { creatorProfile } from '@vine/db/schema-public'
import {
  creatorPayoutAccount,
  creatorPayoutAuditEvent,
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
        return {
          creator: undefined,
          account: undefined,
          availableLedgers: [],
          history: [],
        }
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
        .where(
          and(
            inArray(creatorPayoutLedger.id, input.ledgerIds),
            eq(creatorPayoutLedger.status, 'available'),
          ),
        )
      await insertAuditEvent(db, {
        id: input.auditId,
        payoutRequestId: request.id,
        actorUserId: input.actorUserId,
        action: 'request_created',
        metadataJson: JSON.stringify({ ledgerIds: input.ledgerIds }),
        createdAt: input.now,
      })
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
      await insertAuditEvent(db, {
        id: input.auditId,
        actorUserId: input.actorUserId,
        action: 'payout_account_replaced',
        metadataJson: JSON.stringify({
          creatorId: input.creatorId,
          payoutAccountId: account.id,
          accountLast4: account.accountLast4,
        }),
        createdAt: input.now,
      })
      return account
    },

    listPendingRequests(db: any, input: { limit: number }) {
      return db
        .select({
          id: creatorPayoutRequest.id,
          ledgerIdsJson: creatorPayoutRequest.ledgerIdsJson,
          creatorId: creatorPayoutRequest.creatorId,
          payoutAccountId: creatorPayoutRequest.payoutAccountId,
          batchId: creatorPayoutRequest.batchId,
          currency: creatorPayoutRequest.currency,
          grossAmountMinor: creatorPayoutRequest.grossAmountMinor,
          taxWithholdingMinor: creatorPayoutRequest.taxWithholdingMinor,
          transferFeeMinor: creatorPayoutRequest.transferFeeMinor,
          netAmountMinor: creatorPayoutRequest.netAmountMinor,
          status: creatorPayoutRequest.status,
          rejectReason: creatorPayoutRequest.rejectReason,
          failureReason: creatorPayoutRequest.failureReason,
          bankTransactionId: creatorPayoutRequest.bankTransactionId,
          paidAt: creatorPayoutRequest.paidAt,
          requestedAt: creatorPayoutRequest.requestedAt,
          reviewedAt: creatorPayoutRequest.reviewedAt,
          reviewedByUserId: creatorPayoutRequest.reviewedByUserId,
          updatedAt: creatorPayoutRequest.updatedAt,
          creatorDisplayName: creatorProfile.displayName,
          payoutHoldAt: creatorProfile.payoutHoldAt,
          payoutHoldByUserId: creatorProfile.payoutHoldByUserId,
          payoutHoldReason: creatorProfile.payoutHoldReason,
        })
        .from(creatorPayoutRequest)
        .innerJoin(creatorProfile, eq(creatorPayoutRequest.creatorId, creatorProfile.id))
        .where(
          inArray(creatorPayoutRequest.status, ['requested', 'approved', 'exported']),
        )
        .limit(input.limit)
    },

    async findRequestCreatorHold(db: any, requestId: string) {
      const [row] = await db
        .select({
          requestId: creatorPayoutRequest.id,
          creatorId: creatorPayoutRequest.creatorId,
          payoutHoldAt: creatorProfile.payoutHoldAt,
          payoutHoldReason: creatorProfile.payoutHoldReason,
        })
        .from(creatorPayoutRequest)
        .innerJoin(creatorProfile, eq(creatorPayoutRequest.creatorId, creatorProfile.id))
        .where(eq(creatorPayoutRequest.id, requestId))
        .limit(1)
      return row
    },

    async findAnyHeldCreatorInRequests(db: any, requestIds: string[]) {
      if (requestIds.length === 0) return undefined
      const [row] = await db
        .select({
          requestId: creatorPayoutRequest.id,
          creatorId: creatorPayoutRequest.creatorId,
          payoutHoldAt: creatorProfile.payoutHoldAt,
          payoutHoldReason: creatorProfile.payoutHoldReason,
        })
        .from(creatorPayoutRequest)
        .innerJoin(creatorProfile, eq(creatorPayoutRequest.creatorId, creatorProfile.id))
        .where(inArray(creatorPayoutRequest.id, requestIds))
      return row?.payoutHoldAt ? row : undefined
    },

    async findAnyHeldCreatorInBatch(db: any, batchId: string) {
      const [row] = await db
        .select({
          requestId: creatorPayoutRequest.id,
          creatorId: creatorPayoutRequest.creatorId,
          payoutHoldAt: creatorProfile.payoutHoldAt,
          payoutHoldReason: creatorProfile.payoutHoldReason,
        })
        .from(creatorPayoutRequest)
        .innerJoin(creatorProfile, eq(creatorPayoutRequest.creatorId, creatorProfile.id))
        .where(eq(creatorPayoutRequest.batchId, batchId))
      return row?.payoutHoldAt ? row : undefined
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
        .where(
          and(
            eq(creatorPayoutRequest.id, input.requestId),
            eq(creatorPayoutRequest.status, 'requested'),
          ),
        )
        .returning()
      if (!request) throw new Error('payout request not found or not in requested status')
      await insertAuditEvent(db, {
        id: input.auditId,
        payoutRequestId: request.id,
        actorUserId: input.actorUserId,
        action: 'request_approved',
        metadataJson: '{}',
        createdAt: input.now,
      })
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
        .where(
          and(
            eq(creatorPayoutRequest.id, input.requestId),
            eq(creatorPayoutRequest.status, 'requested'),
          ),
        )
        .returning()
      if (!request) throw new Error('payout request not found or not in requested status')
      const ledgerIds = parseLedgerIds(request.ledgerIdsJson)
      if (ledgerIds.length > 0) {
        await db
          .update(creatorPayoutLedger)
          .set({ status: 'available', updatedAt: input.now })
          .where(inArray(creatorPayoutLedger.id, ledgerIds))
      }
      await insertAuditEvent(db, {
        id: input.auditId,
        payoutRequestId: request.id,
        actorUserId: input.actorUserId,
        action: 'request_rejected',
        metadataJson: JSON.stringify({ reason: input.reason }),
        createdAt: input.now,
      })
      return request
    },

    async createBatchFromApprovedRequests(db: any, input: any) {
      if (!Array.isArray(input.requestIds) || input.requestIds.length === 0) {
        throw new Error('at least one approved payout request is required')
      }
      const approvedRequests = await db
        .select()
        .from(creatorPayoutRequest)
        .where(
          and(
            inArray(creatorPayoutRequest.id, input.requestIds),
            eq(creatorPayoutRequest.status, 'approved'),
          ),
        )
      if (approvedRequests.length !== new Set(input.requestIds).size) {
        throw new Error('all payout requests must be approved before batching')
      }
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
      const ledgerIds = approvedRequests.flatMap((request: any) =>
        parseLedgerIds(request.ledgerIdsJson),
      )
      if (ledgerIds.length > 0) {
        await db
          .update(creatorPayoutLedger)
          .set({ status: 'locked', updatedAt: input.now })
          .where(inArray(creatorPayoutLedger.id, ledgerIds))
      }
      await insertAuditEvent(db, {
        id: input.auditId,
        payoutBatchId: batch.id,
        actorUserId: input.actorUserId,
        action: 'batch_created',
        metadataJson: JSON.stringify({ requestIds: input.requestIds }),
        createdAt: input.now,
      })
      return batch
    },

    async exportBatchRows(
      db: any,
      input: { actorUserId: string; batchId: string; auditId?: string; now?: string },
    ) {
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

      await db
        .update(creatorPayoutBatch)
        .set({
          status: 'exported',
          exportedAt: input.now,
          exportedByUserId: input.actorUserId,
          updatedAt: input.now,
        })
        .where(eq(creatorPayoutBatch.id, input.batchId))
      await insertAuditEvent(db, {
        id: input.auditId,
        payoutBatchId: input.batchId,
        actorUserId: input.actorUserId,
        action: 'batch_exported',
        metadataJson: JSON.stringify({ rowCount: rows.length }),
        createdAt: input.now,
      })
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
      await insertAuditEvent(db, {
        id: input.auditId,
        payoutRequestId: request.id,
        payoutBatchId: request.batchId,
        actorUserId: input.actorUserId,
        action: 'request_marked_paid',
        metadataJson: JSON.stringify({ bankTransactionId: input.bankTransactionId }),
        createdAt: input.now,
      })
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
      await insertAuditEvent(db, {
        id: input.auditId,
        payoutRequestId: request.id,
        payoutBatchId: request.batchId,
        actorUserId: input.actorUserId,
        action: 'request_marked_failed',
        metadataJson: JSON.stringify({ reason: input.reason }),
        createdAt: input.now,
      })
      return request
    },
  }
}

async function insertAuditEvent(
  db: any,
  input: {
    id: string | undefined
    payoutRequestId?: string | null
    payoutBatchId?: string | null
    actorUserId: string
    action: string
    metadataJson: string
    createdAt: string | undefined
  },
) {
  await db.insert(creatorPayoutAuditEvent).values({
    id: input.id ?? randomUUID(),
    payoutRequestId: input.payoutRequestId,
    payoutBatchId: input.payoutBatchId,
    actorUserId: input.actorUserId,
    action: input.action,
    metadataJson: input.metadataJson,
    createdAt: input.createdAt,
  })
}

function parseLedgerIds(value: string | null | undefined) {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed)
      ? parsed.filter(
          (item): item is string => typeof item === 'string' && item.length > 0,
        )
      : []
  } catch {
    return []
  }
}
