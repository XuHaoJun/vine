type SpacingToken =
  | 0
  | '$0.25'
  | '$0.5'
  | '$1'
  | '$2'
  | '$3'
  | '$4'
  | '$5'
  | '$6'
  | '$8'
  | '$10'

const LINE_TO_TAMAGUI: Record<string, SpacingToken> = {
  none: 0,
  xs: '$0.5',
  sm: '$1',
  md: '$2',
  lg: '$3',
  xl: '$4',
  xxl: '$5',
}

export function spacingToTamagui(
  spacing: string | undefined,
): number | string | undefined {
  if (spacing === undefined) return undefined
  if (LINE_TO_TAMAGUI[spacing] !== undefined) return LINE_TO_TAMAGUI[spacing]
  if (spacing.endsWith('px')) {
    return parseInt(spacing.replace('px', ''))
  }
  return spacing
}

export function marginToTamagui(margin: string | undefined): number | string | undefined {
  return spacingToTamagui(margin)
}

/** Parent box layout — same meaning as `LfBox` `parentLayout` (the flex direction of the parent). */
export type LineFlexParentLayout = 'horizontal' | 'vertical' | 'baseline' | undefined

/**
 * LINE `spacing` on a box is applied as margin-top (vertical parent) or margin-left
 * (horizontal/baseline) on each child after the first, except filler/spacer.
 * This matches learn-projects/react-line-flex `getChildSpacingClass` — not CSS `gap`, which would
 * stack with each child's `margin` and double the gap.
 *
 * When both parent spacing and the child's own `margin` apply to the same edge, spacing wins
 * (react-line-flex applies spacing classes after margin in `cn()`).
 */
export function mergeLineMarginWithParentSpacing(
  parentLayout: LineFlexParentLayout,
  childIndex: number | undefined,
  parentSpacing: string | undefined,
  childType: string,
  componentMargin: string | undefined,
): { marginTop?: number | string; marginLeft?: number | string } {
  const spacingMargin = parentSpacingMarginForChild(
    parentLayout,
    childIndex,
    parentSpacing,
    childType,
  )
  if (spacingMargin !== undefined) {
    return spacingMargin
  }
  const marginVal = componentMargin ? marginToTamagui(componentMargin) : undefined
  if (marginVal === undefined) return {}
  const isHorizontal = parentLayout === 'horizontal' || parentLayout === 'baseline'
  return isHorizontal ? { marginLeft: marginVal } : { marginTop: marginVal }
}

function parentSpacingMarginForChild(
  parentLayout: LineFlexParentLayout,
  childIndex: number | undefined,
  parentSpacing: string | undefined,
  childType: string,
): { marginTop?: number | string; marginLeft?: number | string } | undefined {
  if (parentSpacing === undefined || childIndex === undefined || childIndex === 0) {
    return undefined
  }
  if (childType === 'filler' || childType === 'spacer') {
    return undefined
  }
  const value = marginToTamagui(parentSpacing)
  if (value === undefined) return undefined
  const isHorizontal = parentLayout === 'horizontal' || parentLayout === 'baseline'
  return isHorizontal ? { marginLeft: value } : { marginTop: value }
}

export function paddingToTamagui(
  padding: string | undefined,
): number | string | undefined {
  return spacingToTamagui(padding)
}

/**
 * Default Tamagui space token → px (for plain DOM `style` that bypasses Tamagui).
 * Matches `@tamagui/config` default space scale.
 */
export function tamaguiSpaceTokenToPx(
  value: number | string | undefined,
): number | string | undefined {
  if (value === undefined) return undefined
  if (typeof value === 'number') return value
  if (typeof value === 'string' && value.endsWith('px')) {
    return parseInt(value.replace('px', ''), 10)
  }
  const TOKENS: Record<string, number> = {
    '$0.25': 2,
    '$0.5': 4,
    $1: 4,
    $2: 8,
    $3: 12,
    $4: 16,
    $5: 20,
    $6: 24,
    $8: 32,
    $10: 40,
  }
  if (TOKENS[value] !== undefined) return TOKENS[value]
  return value
}
