import { MIN_PAYOUT_MINOR, type ManualPayoutCsvRow } from './payout.types'

export function createPayoutService(deps: {
  db: any
  repo: any
  createId: () => string
  now: () => Date
}) {
  async function assertRequestCreatorNotHeld(requestId: string) {
    const hold = await deps.repo.findRequestCreatorHold?.(deps.db, requestId)
    if (hold?.payoutHoldAt) throw new Error('creator payouts are on hold')
  }

  async function assertRequestIdsNotHeld(requestIds: string[]) {
    const hold = await deps.repo.findAnyHeldCreatorInRequests?.(deps.db, requestIds)
    if (hold?.payoutHoldAt) throw new Error('creator payouts are on hold')
  }

  async function assertBatchCreatorsNotHeld(batchId: string) {
    const hold = await deps.repo.findAnyHeldCreatorInBatch?.(deps.db, batchId)
    if (hold?.payoutHoldAt) throw new Error('creator payouts are on hold')
  }

  return {
    async getCreatorPayoutOverview(input: { userId: string }) {
      const overview = await deps.repo.getCreatorPayoutOverview(deps.db, input)
      const availableNetAmountMinor = overview.availableLedgers.reduce(
        (sum: number, row: any) => sum + row.netAmountMinor,
        0,
      )
      return {
        availableNetAmountMinor,
        currency: 'TWD' as const,
        bankAccount: overview.account
          ? {
              id: overview.account.id,
              bankName: overview.account.bankName,
              accountLast4: overview.account.accountLast4,
            }
          : undefined,
        ledgers: overview.availableLedgers,
        history: overview.history,
      }
    },

    async requestCreatorPayout(input: { userId: string }) {
      const overview = await deps.repo.getCreatorPayoutOverview(deps.db, input)
      if (overview.creator?.payoutHoldAt) {
        throw new Error('creator payouts are on hold')
      }
      if (!overview.account) throw new Error('payout account required')
      const availableNetAmountMinor = overview.availableLedgers.reduce(
        (sum: number, row: any) => sum + row.netAmountMinor,
        0,
      )
      const grossAmountMinor = overview.availableLedgers.reduce(
        (sum: number, row: any) => sum + row.grossAmountMinor,
        0,
      )
      const taxWithholdingMinor = overview.availableLedgers.reduce(
        (sum: number, row: any) => sum + row.taxWithholdingMinor,
        0,
      )
      const transferFeeMinor = overview.availableLedgers.reduce(
        (sum: number, row: any) => sum + row.transferFeeMinor,
        0,
      )
      if (availableNetAmountMinor < MIN_PAYOUT_MINOR) {
        throw new Error('minimum payout amount not reached')
      }
      return deps.repo.createRequestForLedgers(deps.db, {
        id: deps.createId(),
        actorUserId: input.userId,
        creatorId: overview.creator.id,
        payoutAccountId: overview.account.id,
        ledgerIds: overview.availableLedgers.map((row: any) => row.id),
        grossAmountMinor,
        taxWithholdingMinor,
        transferFeeMinor,
        netAmountMinor: availableNetAmountMinor,
        now: deps.now().toISOString(),
      })
    },

    async upsertCreatorPayoutAccount(input: {
      userId: string
      legalName: string
      bankCode: string
      bankName: string
      branchName: string
      accountNumber: string
      accountNumberConfirmation: string
    }) {
      const overview = await deps.repo.getCreatorPayoutOverview(deps.db, {
        userId: input.userId,
      })
      if (!overview.creator) throw new Error('creator profile required')
      const accountNumber = input.accountNumber.trim()
      if (accountNumber !== input.accountNumberConfirmation.trim()) {
        throw new Error('account number confirmation mismatch')
      }
      if (!/^[0-9 -]+$/.test(accountNumber)) {
        throw new Error('invalid account number')
      }
      const account = await deps.repo.replaceActivePayoutAccount(deps.db, {
        id: deps.createId(),
        actorUserId: input.userId,
        creatorId: overview.creator.id,
        legalName: input.legalName.trim(),
        bankCode: input.bankCode.trim(),
        bankName: input.bankName.trim(),
        branchName: input.branchName.trim(),
        accountNumber,
        accountLast4: accountNumber.replaceAll(/[^0-9]/g, '').slice(-4),
        now: deps.now().toISOString(),
      })
      return {
        id: account.id,
        bankName: account.bankName,
        accountLast4: account.accountLast4,
      }
    },

    listPendingRequests(input: { limit: number }) {
      return deps.repo.listPendingRequests(deps.db, input)
    },

    async approveRequest(input: { actorUserId: string; requestId: string }) {
      await assertRequestCreatorNotHeld(input.requestId)
      return deps.repo.approveRequest(deps.db, {
        ...input,
        now: deps.now().toISOString(),
      })
    },

    rejectRequest(input: { actorUserId: string; requestId: string; reason: string }) {
      return deps.repo.rejectRequest(deps.db, { ...input, now: deps.now().toISOString() })
    },

    async createBatch(input: { actorUserId: string; requestIds: string[] }) {
      await assertRequestIdsNotHeld(input.requestIds)
      return deps.repo.createBatchFromApprovedRequests(deps.db, {
        id: deps.createId(),
        ...input,
        now: deps.now().toISOString(),
      })
    },

    async exportBatchCsv(input: { actorUserId: string; batchId: string }) {
      await assertBatchCreatorsNotHeld(input.batchId)
      const rows = await deps.repo.exportBatchRows(deps.db, {
        ...input,
        now: deps.now().toISOString(),
      })
      return encodeCsv(rows)
    },

    async markPaid(input: {
      actorUserId: string
      requestId: string
      bankTransactionId: string
      paidAt: string
    }) {
      await assertRequestCreatorNotHeld(input.requestId)
      return deps.repo.markRequestPaid(deps.db, {
        ...input,
        now: deps.now().toISOString(),
      })
    },

    markFailed(input: { actorUserId: string; requestId: string; reason: string }) {
      return deps.repo.markRequestFailed(deps.db, {
        ...input,
        now: deps.now().toISOString(),
      })
    },
  }
}

function encodeCsv(rows: ManualPayoutCsvRow[]) {
  const headers = [
    'batchId',
    'payoutRequestId',
    'creatorId',
    'creatorDisplayName',
    'legalName',
    'bankCode',
    'bankName',
    'branchName',
    'accountNumber',
    'accountLast4',
    'currency',
    'grossAmountMinor',
    'taxWithholdingMinor',
    'transferFeeMinor',
    'netAmountMinor',
    'memo',
  ] as const
  const lines = [
    headers.join(','),
    ...rows.map((row) => headers.map((key) => csvCell(String(row[key] ?? ''))).join(',')),
  ]
  return `${lines.join('\n')}\n`
}

function csvCell(value: string) {
  if (!/[",\n]/.test(value)) return value
  return `"${value.replaceAll('"', '""')}"`
}
