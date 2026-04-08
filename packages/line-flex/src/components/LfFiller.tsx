import { YStack } from 'tamagui'
import type { LFexFiller } from '../types'

export type LFexFillerProps = LFexFiller

export function LfFiller({ flex = 1 }: LFexFillerProps) {
  return <YStack flex={flex} />
}
