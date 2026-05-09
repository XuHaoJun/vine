import { describe, expect, test } from 'vitest'
import { formatQuota } from '~/features/oa-manager/home/formatQuota'

describe('formatQuota', () => {
  test('returns placeholder when quota data is missing', () => {
    expect(formatQuota({})).toBe('No quota data')
  })

  test('returns usage-only label when monthly limit is unset', () => {
    expect(formatQuota({ quota: { totalUsage: 12 } })).toBe('12 used')
  })

  test('returns usage/limit label when monthly limit is set', () => {
    expect(formatQuota({ quota: { totalUsage: 25, monthlyLimit: 1000 } })).toBe(
      '25/1000 used',
    )
  })
})
