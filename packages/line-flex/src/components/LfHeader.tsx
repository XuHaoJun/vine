import { YStack } from 'tamagui'
import type { LFexBubble, LFexAction } from '../types'
import { LfBox } from './LfBox'

export type LFexHeaderProps = {
  header?: LFexBubble['header']
  onAction?: (action: LFexAction) => void
}

export function LfHeader({ header, onAction }: LFexHeaderProps) {
  if (!header) return null
  return (
    <YStack>
      <LfBox {...header} onAction={onAction} />
    </YStack>
  )
}
