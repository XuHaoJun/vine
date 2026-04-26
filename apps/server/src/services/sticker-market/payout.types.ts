export const MIN_PAYOUT_MINOR = 300
export const DEFAULT_TRANSFER_FEE_MINOR = 30
export const CREATOR_REVENUE_SHARE_BPS = 7000

export type PayoutRequestStatus =
  | 'requested'
  | 'approved'
  | 'exported'
  | 'paid'
  | 'rejected'
  | 'failed'

export type PayoutLedgerStatus = 'available' | 'requested' | 'locked' | 'paid' | 'void'

export type PayoutAccountInput = {
  legalName: string
  bankCode: string
  bankName: string
  branchName: string
  accountNumber: string
  accountNumberConfirmation: string
}

export type ManualPayoutCsvRow = {
  batchId: string
  payoutRequestId: string
  creatorId: string
  creatorDisplayName: string
  legalName: string
  bankCode: string
  bankName: string
  branchName: string
  accountNumber: string
  accountLast4: string
  currency: 'TWD'
  grossAmountMinor: number
  taxWithholdingMinor: number
  transferFeeMinor: number
  netAmountMinor: number
  memo: string
}
