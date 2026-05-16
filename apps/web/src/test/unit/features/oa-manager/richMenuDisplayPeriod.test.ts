import { describe, expect, it } from 'vitest'
import {
  datetimeLocalToIso,
  formatDisplayPeriodSummary,
  isoToDatetimeLocal,
  managerStatusLabel,
  validateDisplayPeriodInput,
} from '~/features/oa-manager/richmenu/displayPeriod'

describe('rich menu display period UI helpers', () => {
  it('roundtrips ISO to datetime-local and back', () => {
    const iso = '2026-05-15T10:30:00.000Z'
    const local = isoToDatetimeLocal(iso)
    expect(local).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
    expect(datetimeLocalToIso(local)).toBe(iso)
  })

  it('converts empty datetime-local strings to undefined', () => {
    expect(datetimeLocalToIso('')).toBeUndefined()
  })

  it('formats open-ended summaries', () => {
    expect(formatDisplayPeriodSummary(undefined, undefined)).toBe('Always eligible')
    expect(
      formatDisplayPeriodSummary('2026-05-15T10:00:00.000Z', undefined),
    ).toContain('Starts')
    expect(formatDisplayPeriodSummary(undefined, '2026-05-16T10:00:00.000Z')).toContain(
      'Ends',
    )
  })

  it('labels all manager statuses', () => {
    expect(managerStatusLabel('draft')).toBe('Draft')
    expect(managerStatusLabel('inactive')).toBe('Inactive')
    expect(managerStatusLabel('scheduled')).toBe('Scheduled')
    expect(managerStatusLabel('active')).toBe('Active')
    expect(managerStatusLabel('ended')).toBe('Ended')
    expect(managerStatusLabel(undefined)).toBe('Inactive')
  })

  it('rejects display end before display start', () => {
    expect(
      validateDisplayPeriodInput('2026-05-15T10:00', '2026-05-15T09:00'),
    ).toEqual({
      success: false,
      message: 'End must be after start',
    })
  })
})
