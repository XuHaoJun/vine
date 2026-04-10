import { YStack } from 'tamagui'
import type { LFexFiller } from '../types'

export type LFexFillerProps = LFexFiller

export function LfFiller({ flex = 1 }: LFexFillerProps) {
  // min 0 matches Tailwind min-h-0 on fillers so flex rows/columns can distribute space
  return <YStack flex={flex} style={{ minWidth: 0, minHeight: 0 }} />
}
