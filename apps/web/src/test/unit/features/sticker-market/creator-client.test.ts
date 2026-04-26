import { describe, expect, it } from 'vitest'
import { vi } from 'vitest'

vi.mock('@connectrpc/connect', () => ({
  createClient: () => ({}),
}))

vi.mock('@vine/proto/stickerMarket', () => ({
  StickerMarketCreatorService: {},
}))

vi.mock('~/features/auth/client/connectTransport', () => ({
  connectTransport: {},
}))

import {
  getCurrentReportMonth,
  shiftReportMonth,
} from '~/features/sticker-market/creator/client'

describe('creator sales report client helpers', () => {
  it('formats the report month from UTC date parts', () => {
    expect(getCurrentReportMonth(new Date('2026-05-01T00:30:00Z'))).toBe('2026-05')
  })

  it('shifts report months using UTC calendar boundaries', () => {
    expect(shiftReportMonth('2026-01', -1)).toBe('2025-12')
    expect(shiftReportMonth('2026-12', 1)).toBe('2027-01')
  })
})
