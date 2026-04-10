import type { LFexBorderWidth } from '../types'

/** LINE borderWidth tokens and raw px strings → CSS border-width */
export function lineBorderWidthToCssValue(
  borderWidth: LFexBorderWidth | string | undefined,
): string | undefined {
  if (borderWidth === undefined || borderWidth === 'none') return undefined
  if (typeof borderWidth === 'string' && borderWidth.includes('px')) return borderWidth
  const map: Record<string, string> = {
    light: '0.5px',
    normal: '1px',
    medium: '2px',
    'semi-bold': '3px',
    bold: '4px',
  }
  return map[borderWidth] ?? undefined
}
