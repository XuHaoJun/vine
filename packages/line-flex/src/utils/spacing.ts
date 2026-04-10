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
