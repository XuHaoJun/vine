import { describe, expect, it } from 'vitest'
import { getChildDefaultFlex } from './flex'

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
