import { describe, expect, it } from 'vitest'
import {
  buildRichMenuDisplayJobKeys,
  deriveRichMenuManagerStatus,
  parseDisplayPeriodInput,
} from './oa-richmenu-display'

describe('rich menu display period helpers', () => {
  it('rejects an end before a start', () => {
    expect(() =>
      parseDisplayPeriodInput({
        displayStartsAt: '2026-05-15T10:00:00.000Z',
        displayEndsAt: '2026-05-15T09:00:00.000Z',
      }),
    ).toThrow('displayEndsAt must be after displayStartsAt')
  })

  it('derives draft when image is missing', () => {
    expect(
      deriveRichMenuManagerStatus({
        isDefault: true,
        hasImage: false,
        displayStartsAt: null,
        displayEndsAt: null,
        now: '2026-05-15T10:00:00.000Z',
      }),
    ).toBe('draft')
  })

  it('derives scheduled, active, ended, and inactive states', () => {
    expect(
      deriveRichMenuManagerStatus({
        isDefault: true,
        hasImage: true,
        displayStartsAt: '2026-05-15T11:00:00.000Z',
        displayEndsAt: null,
        now: '2026-05-15T10:00:00.000Z',
      }),
    ).toBe('scheduled')
    expect(
      deriveRichMenuManagerStatus({
        isDefault: true,
        hasImage: true,
        displayStartsAt: '2026-05-15T09:00:00.000Z',
        displayEndsAt: '2026-05-15T11:00:00.000Z',
        now: '2026-05-15T10:00:00.000Z',
      }),
    ).toBe('active')
    expect(
      deriveRichMenuManagerStatus({
        isDefault: true,
        hasImage: true,
        displayStartsAt: null,
        displayEndsAt: '2026-05-15T09:00:00.000Z',
        now: '2026-05-15T10:00:00.000Z',
      }),
    ).toBe('ended')
    expect(
      deriveRichMenuManagerStatus({
        isDefault: false,
        hasImage: true,
        displayStartsAt: null,
        displayEndsAt: null,
        now: '2026-05-15T10:00:00.000Z',
      }),
    ).toBe('inactive')
  })

  it('builds stable display job keys', () => {
    expect(buildRichMenuDisplayJobKeys('oa-1', 'richmenu-1')).toEqual({
      start: 'oa-rich-menu:oa-1:richmenu-1:display-start',
      end: 'oa-rich-menu:oa-1:richmenu-1:display-end',
    })
  })
})
