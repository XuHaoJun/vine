import { describe, expect, it } from 'vitest'
import { expandFlexForChild, getChildDefaultFlex, normalizeFlexValue } from './flex'

describe('LINE flex behavior', () => {
  // LINE horizontal box: children default to flex-1
  it('horizontal box children default to flex-1', () => {
    expect(getChildDefaultFlex(undefined, 'horizontal')).toBe(1)
  })

  // LINE vertical box: children default to flex-none
  it('vertical box children default to flex-none', () => {
    expect(getChildDefaultFlex(undefined, 'vertical')).toBe('none')
  })

  // LINE baseline box: children default to flex-1
  it('baseline box children default to flex-1', () => {
    expect(getChildDefaultFlex(undefined, 'baseline')).toBe(1)
  })

  // Explicit flex values are preserved
  it('preserves explicit flex values', () => {
    expect(getChildDefaultFlex(2, 'horizontal')).toBe(2)
    expect(getChildDefaultFlex(0, 'vertical')).toBe(0)
  })
})

describe('expandFlexForChild', () => {
  it('uses auto basis in vertical parents so column flex does not get 0 main size', () => {
    expect(expandFlexForChild(1, 'vertical')).toEqual({
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
    })
  })

  it('uses 0 basis in horizontal parents for LINE-style width distribution', () => {
    expect(expandFlexForChild(1, 'horizontal')).toEqual({
      flexGrow: 1,
      flexShrink: 0,
      flexBasis: 0,
    })
  })

  it('treats undefined parent as vertical', () => {
    expect(expandFlexForChild(2, undefined).flexBasis).toBe('auto')
  })
})

describe('normalizeFlexValue', () => {
  it('coerces numeric strings from JSON', () => {
    expect(normalizeFlexValue('1')).toBe(1)
    expect(normalizeFlexValue('0')).toBe(0)
  })

  it('returns undefined for invalid flex', () => {
    expect(normalizeFlexValue(undefined)).toBeUndefined()
    expect(normalizeFlexValue('not-a-number')).toBeUndefined()
  })
})
