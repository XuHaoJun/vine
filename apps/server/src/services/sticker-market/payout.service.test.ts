import { describe, expect, it, vi } from 'vitest'
import { createPayoutService } from './payout.service'

function makeService(overrides: Partial<any> = {}) {
  const repo = {
    getCreatorPayoutOverview: vi.fn().mockResolvedValue({
      creator: { id: 'creator_1', displayName: 'Studio' },
      account: { id: 'acct_1', bankName: 'Taiwan Bank', accountLast4: '5678' },
      availableLedgers: [
        {
          id: 'ledger_1',
          creatorId: 'creator_1',
          month: '2026-03',
          currency: 'TWD',
          grossAmountMinor: 2000,
          refundedAmountMinor: 0,
          platformFeeMinor: 600,
          creatorShareMinor: 1400,
          taxWithholdingMinor: 0,
          transferFeeMinor: 30,
          netAmountMinor: 1370,
          status: 'available',
        },
      ],
      history: [],
    }),
    createRequestForLedgers: vi
      .fn()
      .mockResolvedValue({ id: 'req_1', status: 'requested', netAmountMinor: 1370 }),
    replaceActivePayoutAccount: vi.fn().mockResolvedValue({
      id: 'acct_new',
      bankName: 'Taiwan Bank',
      accountLast4: '9012',
    }),
    listPendingRequests: vi.fn().mockResolvedValue([]),
    approveRequest: vi.fn().mockResolvedValue({ id: 'req_1', status: 'approved' }),
    rejectRequest: vi.fn().mockResolvedValue({ id: 'req_1', status: 'rejected' }),
    createBatchFromApprovedRequests: vi.fn().mockResolvedValue({ id: 'batch_1' }),
    exportBatchRows: vi.fn().mockResolvedValue([]),
    markRequestPaid: vi.fn().mockResolvedValue({ id: 'req_1', status: 'paid' }),
    markRequestFailed: vi.fn().mockResolvedValue({ id: 'req_1', status: 'failed' }),
    ...overrides.repo,
  }
  return {
    repo,
    service: createPayoutService({
      db: {},
      repo,
      createId: () => 'generated_id',
      now: () => new Date('2026-04-26T00:00:00.000Z'),
    }),
  }
}

describe('createPayoutService', () => {
  it('returns creator payout overview with masked bank account', async () => {
    const { service } = makeService()
    const overview = await service.getCreatorPayoutOverview({ userId: 'user_1' })
    expect(overview.availableNetAmountMinor).toBe(1370)
    expect(overview.bankAccount).toEqual({
      id: 'acct_1',
      bankName: 'Taiwan Bank',
      accountLast4: '5678',
    })
  })

  it('rejects payout requests below the minimum threshold', async () => {
    const { service } = makeService({
      repo: {
        getCreatorPayoutOverview: vi.fn().mockResolvedValue({
          creator: { id: 'creator_1', displayName: 'Studio' },
          account: { id: 'acct_1', bankName: 'Taiwan Bank', accountLast4: '0001' },
          availableLedgers: [{ id: 'ledger_1', netAmountMinor: 299 }],
          history: [],
        }),
      },
    })
    await expect(service.requestCreatorPayout({ userId: 'user_1' })).rejects.toThrow(
      'minimum payout amount not reached',
    )
  })

  it('replaces active payout account and returns only masked fields', async () => {
    const { service, repo } = makeService()
    const account = await service.upsertCreatorPayoutAccount({
      userId: 'user_1',
      legalName: 'Creator Legal Name',
      bankCode: '004',
      bankName: 'Taiwan Bank',
      branchName: 'Main',
      accountNumber: '123456789012',
      accountNumberConfirmation: '123456789012',
    })
    expect(repo.replaceActivePayoutAccount).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        id: 'generated_id',
        creatorId: 'creator_1',
        accountNumber: '123456789012',
        accountLast4: '9012',
      }),
    )
    expect(account).toEqual({
      id: 'acct_new',
      bankName: 'Taiwan Bank',
      accountLast4: '9012',
    })
    expect(JSON.stringify(account)).not.toContain('123456789012')
  })

  it('rejects payout account confirmation mismatch', async () => {
    const { service } = makeService()
    await expect(
      service.upsertCreatorPayoutAccount({
        userId: 'user_1',
        legalName: 'Creator Legal Name',
        bankCode: '004',
        bankName: 'Taiwan Bank',
        branchName: 'Main',
        accountNumber: '123456789012',
        accountNumberConfirmation: '999999999999',
      }),
    ).rejects.toThrow('account number confirmation mismatch')
  })

  it('exports CSV with full account number only for admin batch export', async () => {
    const { service, repo } = makeService({
      repo: {
        exportBatchRows: vi.fn().mockResolvedValue([
          {
            batchId: 'batch_1',
            payoutRequestId: 'req_1',
            creatorId: 'creator_1',
            creatorDisplayName: 'Studio',
            legalName: 'Creator Legal Name',
            bankCode: '004',
            bankName: 'Taiwan Bank',
            branchName: 'Main',
            accountNumber: '123456789012',
            accountLast4: '9012',
            currency: 'TWD',
            grossAmountMinor: 2000,
            taxWithholdingMinor: 0,
            transferFeeMinor: 30,
            netAmountMinor: 1370,
            memo: 'Vine payout req_1',
          },
        ]),
      },
    })
    const csv = await service.exportBatchCsv({
      actorUserId: 'admin_1',
      batchId: 'batch_1',
    })
    expect(repo.exportBatchRows).toHaveBeenCalledWith(
      {},
      {
        actorUserId: 'admin_1',
        batchId: 'batch_1',
        now: '2026-04-26T00:00:00.000Z',
      },
    )
    expect(csv).toContain('accountNumber')
    expect(csv).toContain('123456789012')
  })
})
