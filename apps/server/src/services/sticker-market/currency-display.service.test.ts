import { describe, expect, it, vi } from 'vitest'
import { createCurrencyDisplayService } from './currency-display.service'

describe('createCurrencyDisplayService', () => {
  it('returns same price when preferred currency matches base', async () => {
    const discoveryRepo = { getCurrencyDisplayRate: vi.fn() }
    const service = createCurrencyDisplayService({ db: {}, discoveryRepo } as any)
    const result = await service.getDisplayPrice(100, 'TWD', 'TWD')
    expect(result.priceMinor).toBe(100)
    expect(result.currency).toBe('TWD')
    expect(discoveryRepo.getCurrencyDisplayRate).not.toHaveBeenCalled()
  })

  it('converts price when rate exists', async () => {
    const discoveryRepo = {
      getCurrencyDisplayRate: vi.fn().mockResolvedValue({ rate: '0.031' }),
    }
    const service = createCurrencyDisplayService({ db: {}, discoveryRepo } as any)
    const result = await service.getDisplayPrice(100, 'TWD', 'USD')
    expect(result.priceMinor).toBe(3)
    expect(result.currency).toBe('USD')
  })

  it('falls back to original currency when rate is missing', async () => {
    const discoveryRepo = {
      getCurrencyDisplayRate: vi.fn().mockResolvedValue(null),
    }
    const service = createCurrencyDisplayService({ db: {}, discoveryRepo } as any)
    const result = await service.getDisplayPrice(100, 'TWD', 'JPY')
    expect(result.priceMinor).toBe(100)
    expect(result.currency).toBe('TWD')
  })
})
