import { createClient } from '@connectrpc/connect'
import { StickerMarketCreatorService } from '@vine/proto/stickerMarket'
import { connectTransport } from '~/features/auth/client/connectTransport'

export const stickerMarketCreatorClient = createClient(
  StickerMarketCreatorService,
  connectTransport,
)

export function creatorSalesReportQueryKey(month: string) {
  return ['sticker-market', 'creator-sales-report', month] as const
}

export function getCurrentReportMonth(date = new Date()) {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

export function shiftReportMonth(month: string, delta: number) {
  const [yearText, monthText] = month.split('-')
  const date = new Date(Date.UTC(Number(yearText), Number(monthText) - 1 + delta, 1))
  return getCurrentReportMonth(date)
}

export function creatorPayoutOverviewQueryKey() {
  return ['sticker-market', 'creator-payout-overview'] as const
}

export function creatorPayoutAccountMutationKey() {
  return ['sticker-market', 'creator-payout-account'] as const
}

export function formatTwdMinor(amountMinor: number) {
  return `NT$${amountMinor.toLocaleString('zh-TW')}`
}
