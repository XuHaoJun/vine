import { Spacer } from 'tamagui'
import type { LFexSpacer } from '../types'

export type LFexSpacerProps = LFexSpacer

export function LfSpacer({ size = 'md' }: LFexSpacerProps) {
  const sizeValue = size === 'xxs' ? 4 :
                    size === 'xs' ? 6 :
                    size === 'sm' ? 10 :
                    size === 'md' ? 14 :
                    size === 'lg' ? 18 :
                    size === 'xl' ? 22 :
                    size === 'xxl' ? 26 : 14

  return <Spacer size={sizeValue} />
}
