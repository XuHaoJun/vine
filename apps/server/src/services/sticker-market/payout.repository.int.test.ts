import { describe, expect, it } from 'vitest'
import { creatorProfile } from '@vine/db/schema-public'
import { withRollbackDb } from '../../test/integration-db'
import {
  creatorPayoutAccount,
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
})
