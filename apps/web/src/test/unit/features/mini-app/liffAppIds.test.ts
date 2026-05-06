import { describe, expect, it } from 'vitest'
import { getAvailableLiffAppsForMiniApps } from '~/features/mini-app/liffAppIds'

describe('mini app LIFF app id helpers', () => {
  it('filters by LIFF app database id while preserving public liffId for display', () => {
    const apps = [
      { id: 'liff-app-db-1', liffId: '1234567890-abcd' },
      { id: 'liff-app-db-2', liffId: '1234567890-efgh' },
    ]

    expect(getAvailableLiffAppsForMiniApps(apps, ['liff-app-db-1'])).toEqual([
      { id: 'liff-app-db-2', liffId: '1234567890-efgh' },
    ])
  })
})
