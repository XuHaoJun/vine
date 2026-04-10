import type { LFexLayout } from '../types'

/**
 * LINE Flex Message has non-standard flex defaults:
 * - horizontal box: children default to flex-1 (flex: 1 0 0)
 * - vertical box: children default to flex-none (flex: 0 0 auto)
 * - baseline box: children default to flex-1
 *
 * This differs from CSS flexbox defaults where children default to flex: 0 1 auto
 */
export function getChildDefaultFlex(
  childFlex: number | undefined,
  parentLayout: LFexLayout,
): number | 'none' {
  if (childFlex !== undefined) return childFlex
  if (parentLayout === 'horizontal' || parentLayout === 'baseline') {
    return 1
  }
  return 'none'
}

/**
 * Maps LINE flex numbers to flexGrow/Shrink/Basis. Tamagui's `flex: N` expands to
 * flex-basis 0%, which is correct for children of a *horizontal* row (width
 * distribution) but collapses children of a *vertical* column to 0 height
 * (main axis is vertical — basis 0 is height).
 */
export function expandFlexForChild(
  flex: number,
  parentLayout: LFexLayout | undefined,
): { flexGrow: number; flexShrink: number; flexBasis: number | 'auto' } {
  const parent = parentLayout ?? 'vertical'
  if (parent === 'vertical') {
    return { flexGrow: flex, flexShrink: 1, flexBasis: 'auto' }
  }
  return { flexGrow: flex, flexShrink: 0, flexBasis: 0 }
}

/** JSON / props may pass flex as string; Tamagui needs numeric flexGrow. */
export function normalizeFlexValue(flex: unknown): number | undefined {
  if (flex === undefined || flex === null) return undefined
  if (typeof flex === 'number') return Number.isNaN(flex) ? undefined : flex
  if (typeof flex === 'string') {
    const n = Number(flex)
    return Number.isNaN(n) ? undefined : n
  }
  return undefined
}
