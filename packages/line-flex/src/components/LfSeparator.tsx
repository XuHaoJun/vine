import { YStack } from 'tamagui'
import type { LFexSeparator } from '../types'
import { marginToTamagui } from '../utils/spacing'

export type LFexSeparatorProps = LFexSeparator

export function LfSeparator({ margin, color }: LFexSeparatorProps) {
  const marginValue = margin ? marginToTamagui(margin) : undefined

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const props: any = { height: 1, background: color ?? '#cccccc' }
  if (marginValue) props.margin = marginValue

  return <YStack {...props} />
}
