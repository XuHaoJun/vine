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
  parentLayout: LFexLayout
): number | 'none' {
  if (childFlex !== undefined) return childFlex
  if (parentLayout === 'horizontal' || parentLayout === 'baseline') {
    return 1
  }
  return 'none'
}
