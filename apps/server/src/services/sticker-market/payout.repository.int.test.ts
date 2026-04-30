import { describe, expect, it } from 'vitest'
import { creatorProfile } from '@vine/db/schema-public'
import { withRollbackDb } from '../../test/integration-db'
import {
  creatorPayoutAccount,
  creatorPayoutAuditEvent,
  creatorPayoutBatch,
  creatorPayoutLedger,
  creatorPayoutRequest,
} from '@vine/db/schema-private'
import { createPayoutRepository } from './payout.repository'

describe('createPayoutRepository', () => {
  const repo = createPayoutRepository()

  it('returns only available ledgers for the authenticated creator', async () => {
    await withRollbackDb(async (db) => {
      await db.insert(creatorProfile).values({
        id: 'creator_1',
        userId: 'user_1',
        displayName: 'Studio',
        country: 'TW',
      })
      await db.insert(creatorPayoutAccount).values({
        id: 'acct_1',
        creatorId: 'creator_1',
        legalName: 'Creator Legal Name',
        bankCode: '004',
        bankName: 'Taiwan Bank',
        accountNumber: '123456789012',
        accountLast4: '9012',
      })
      await db.insert(creatorPayoutLedger).values({
        id: 'ledger_1',
        creatorId: 'creator_1',
        month: '2026-03',
        grossAmountMinor: 2000,
        platformFeeMinor: 600,
        creatorShareMinor: 1400,
        transferFeeMinor: 30,
        netAmountMinor: 1370,
      })

      const overview = await repo.getCreatorPayoutOverview(db, { userId: 'user_1' })

      expect(overview.creator.id).toBe('creator_1')
      expect(overview.account.accountLast4).toBe('9012')
      expect(overview.availableLedgers).toHaveLength(1)
    })
  })

  it('keeps approved and exported requests in the admin payout queue', async () => {
    await withRollbackDb(async (db) => {
      await db.insert(creatorProfile).values({
        id: 'creator_1',
        userId: 'user_1',
        displayName: 'Studio',
        country: 'TW',
      })
      await db.insert(creatorPayoutRequest).values([
        {
          id: 'req_requested',
          creatorId: 'creator_1',
          payoutAccountId: 'acct_1',
          grossAmountMinor: 1000,
          netAmountMinor: 700,
          status: 'requested',
        },
        {
          id: 'req_approved',
          creatorId: 'creator_1',
          payoutAccountId: 'acct_1',
          grossAmountMinor: 1000,
          netAmountMinor: 700,
          status: 'approved',
        },
        {
          id: 'req_exported',
          creatorId: 'creator_1',
          payoutAccountId: 'acct_1',
          grossAmountMinor: 1000,
          netAmountMinor: 700,
          status: 'exported',
        },
        {
          id: 'req_paid',
          creatorId: 'creator_1',
          payoutAccountId: 'acct_1',
          grossAmountMinor: 1000,
          netAmountMinor: 700,
          status: 'paid',
        },
      ])

      const requests = await repo.listPendingRequests(db, { limit: 100 })

      expect(requests.map((request: any) => request.id).sort()).toEqual([
        'req_approved',
        'req_exported',
        'req_requested',
      ])
    })
  })

  it('finds a held creator across multiple payout request ids', async () => {
    await withRollbackDb(async (db) => {
      await db.insert(creatorProfile).values([
        {
          id: 'creator_unheld',
          userId: 'user_unheld',
          displayName: 'Unheld Studio',
          country: 'TW',
        },
        {
          id: 'creator_held',
          userId: 'user_held',
          displayName: 'Held Studio',
          country: 'TW',
          payoutHoldAt: '2026-04-27T00:00:00.000Z',
          payoutHoldReason: 'Investigation.',
        },
      ])
      await db.insert(creatorPayoutRequest).values([
        {
          id: 'req_unheld',
          creatorId: 'creator_unheld',
          payoutAccountId: 'acct_unheld',
          grossAmountMinor: 1000,
          netAmountMinor: 700,
          status: 'approved',
        },
        {
          id: 'req_held',
          creatorId: 'creator_held',
          payoutAccountId: 'acct_held',
          grossAmountMinor: 1000,
          netAmountMinor: 700,
          status: 'approved',
        },
      ])

      const held = await repo.findAnyHeldCreatorInRequests(db, ['req_unheld', 'req_held'])

      expect(held).toMatchObject({
        requestId: 'req_held',
        creatorId: 'creator_held',
      })
      expect(held?.payoutHoldAt).toBeTruthy()
    })
  })

  it('finds a held creator across multiple payout requests in a batch', async () => {
    await withRollbackDb(async (db) => {
      await db.insert(creatorProfile).values([
        {
          id: 'creator_unheld',
          userId: 'user_unheld',
          displayName: 'Unheld Studio',
          country: 'TW',
        },
        {
          id: 'creator_held',
          userId: 'user_held',
          displayName: 'Held Studio',
          country: 'TW',
          payoutHoldAt: '2026-04-27T00:00:00.000Z',
          payoutHoldReason: 'Investigation.',
        },
      ])
      await db.insert(creatorPayoutBatch).values({
        id: 'batch_mixed',
        createdByUserId: 'admin_1',
      })
      await db.insert(creatorPayoutRequest).values([
        {
          id: 'req_unheld',
          creatorId: 'creator_unheld',
          payoutAccountId: 'acct_unheld',
          batchId: 'batch_mixed',
          grossAmountMinor: 1000,
          netAmountMinor: 700,
          status: 'exported',
        },
        {
          id: 'req_held',
          creatorId: 'creator_held',
          payoutAccountId: 'acct_held',
          batchId: 'batch_mixed',
          grossAmountMinor: 1000,
          netAmountMinor: 700,
          status: 'exported',
        },
      ])

      const held = await repo.findAnyHeldCreatorInBatch(db, 'batch_mixed')

      expect(held).toMatchObject({
        requestId: 'req_held',
        creatorId: 'creator_held',
      })
      expect(held?.payoutHoldAt).toBeTruthy()
    })
  })

  it('releases ledger rows and writes an audit event when rejecting a request', async () => {
    await withRollbackDb(async (db) => {
      await db.insert(creatorPayoutLedger).values({
        id: 'ledger_1',
        creatorId: 'creator_1',
        month: '2026-03',
        grossAmountMinor: 2000,
        platformFeeMinor: 600,
        creatorShareMinor: 1400,
        transferFeeMinor: 30,
        netAmountMinor: 1370,
        status: 'requested',
      })
      await db.insert(creatorPayoutRequest).values({
        id: 'req_1',
        creatorId: 'creator_1',
        payoutAccountId: 'acct_1',
        ledgerIdsJson: JSON.stringify(['ledger_1']),
        grossAmountMinor: 2000,
        transferFeeMinor: 30,
        netAmountMinor: 1370,
        status: 'requested',
      })

      await repo.rejectRequest(db, {
        actorUserId: 'admin_1',
        requestId: 'req_1',
        reason: 'missing bank proof',
        now: '2026-04-26T00:00:00.000Z',
      })

      const [ledger] = await db.select().from(creatorPayoutLedger)
      const [audit] = await db.select().from(creatorPayoutAuditEvent)

      expect(ledger.status).toBe('available')
      expect(audit).toMatchObject({
        actorUserId: 'admin_1',
        action: 'request_rejected',
        payoutRequestId: 'req_1',
      })
    })
  })

  it('does not create a partial batch when any selected request is not approved', async () => {
    await withRollbackDb(async (db) => {
      await db.insert(creatorPayoutLedger).values([
        {
          id: 'ledger_approved',
          creatorId: 'creator_1',
          month: '2026-03',
          grossAmountMinor: 2000,
          platformFeeMinor: 600,
          creatorShareMinor: 1400,
          transferFeeMinor: 30,
          netAmountMinor: 1370,
          status: 'requested',
        },
        {
          id: 'ledger_requested',
          creatorId: 'creator_1',
          month: '2026-04',
          grossAmountMinor: 2000,
          platformFeeMinor: 600,
          creatorShareMinor: 1400,
          transferFeeMinor: 30,
          netAmountMinor: 1370,
          status: 'requested',
        },
      ])
      await db.insert(creatorPayoutRequest).values([
        {
          id: 'req_approved',
          creatorId: 'creator_1',
          payoutAccountId: 'acct_1',
          ledgerIdsJson: JSON.stringify(['ledger_approved']),
          grossAmountMinor: 2000,
          transferFeeMinor: 30,
          netAmountMinor: 1370,
          status: 'approved',
        },
        {
          id: 'req_requested',
          creatorId: 'creator_1',
          payoutAccountId: 'acct_1',
          ledgerIdsJson: JSON.stringify(['ledger_requested']),
          grossAmountMinor: 2000,
          transferFeeMinor: 30,
          netAmountMinor: 1370,
          status: 'requested',
        },
      ])

      await expect(
        repo.createBatchFromApprovedRequests(db, {
          id: 'batch_1',
          actorUserId: 'admin_1',
          requestIds: ['req_approved', 'req_requested'],
          now: '2026-04-26T00:00:00.000Z',
        }),
      ).rejects.toThrow('all payout requests must be approved before batching')

      const batches = await db.select().from(creatorPayoutBatch)
      const requests = await db.select().from(creatorPayoutRequest)
      const ledgers = await db.select().from(creatorPayoutLedger)

      expect(batches).toHaveLength(0)
      expect(
        Object.fromEntries(requests.map((request: any) => [request.id, request.status])),
      ).toEqual({
        req_approved: 'approved',
        req_requested: 'requested',
      })
      expect(
        Object.fromEntries(ledgers.map((ledger: any) => [ledger.id, ledger.status])),
      ).toEqual({
        ledger_approved: 'requested',
        ledger_requested: 'requested',
      })
    })
  })
})
