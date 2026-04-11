import { describe, expect, it } from 'vitest'
import {
  spacingToTamagui,
  marginToTamagui,
  paddingToTamagui,
  tamaguiSpaceTokenToPx,
  mergeLineMarginWithParentSpacing,
} from './spacing'

describe('spacing utilities', () => {
  it('converts LINE spacing keywords to tamagui tokens', () => {
    expect(spacingToTamagui('none')).toBe(0)
    expect(spacingToTamagui('xs')).toBe('$0.5')
    expect(spacingToTamagui('sm')).toBe('$1')
    expect(spacingToTamagui('md')).toBe('$2')
    expect(spacingToTamagui('lg')).toBe('$3')
    expect(spacingToTamagui('xl')).toBe('$4')
    expect(spacingToTamagui('xxl')).toBe('$5')
  })

  it('passes through pixel values', () => {
    expect(spacingToTamagui('10px')).toBe(10)
    expect(spacingToTamagui('25px')).toBe(25)
  })

  it('marginToTamagui works same as spacingToTamagui', () => {
    expect(marginToTamagui('md')).toBe('$2')
  })

  it('paddingToTamagui works same as spacingToTamagui', () => {
    expect(paddingToTamagui('lg')).toBe('$3')
  })

  it('tamaguiSpaceTokenToPx maps default space tokens to px for plain DOM', () => {
    expect(tamaguiSpaceTokenToPx('$2')).toBe(8)
    expect(tamaguiSpaceTokenToPx('$3')).toBe(12)
  })

  it('mergeLineMarginWithParentSpacing: parent spacing overrides component margin (react-line-flex cn order)', () => {
    expect(mergeLineMarginWithParentSpacing('vertical', 3, 'md', 'box', 'xxl')).toEqual({
      marginTop: '$2',
    })
  })

  it('mergeLineMarginWithParentSpacing: first child uses component margin only', () => {
    expect(mergeLineMarginWithParentSpacing('vertical', 0, 'md', 'text', 'lg')).toEqual({
      marginTop: '$3',
    })
  })

  it('mergeLineMarginWithParentSpacing: skips filler/spacer for parent spacing', () => {
    expect(
      mergeLineMarginWithParentSpacing('vertical', 1, 'md', 'spacer', undefined),
    ).toEqual({})
  })
})
