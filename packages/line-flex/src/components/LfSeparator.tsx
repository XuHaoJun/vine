import { YStack } from 'tamagui'
import type { LFexSeparator } from '../types'
import { marginToTamagui } from '../utils/spacing'

export type LFexSeparatorProps = LFexSeparator

export function LfSeparator({ margin, color }: LFexSeparatorProps) {
  const marginValue = margin ? marginToTamagui(margin) : undefined

  return <YStack height={1} backgroundColor={color ?? '#cccccc'} margin={marginValue} />
}
