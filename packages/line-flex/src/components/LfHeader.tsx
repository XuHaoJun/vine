import { YStack } from 'tamagui'
import { LfBox } from './LfBox'
import type { LFexBubble, LFexAction } from '../types'

export type LFexHeaderProps = {
  header?: LFexBubble['header']
  onAction?: (action: LFexAction) => void
}

export function LfHeader({ header, onAction }: LFexHeaderProps) {
  if (!header) return null
  return (
    <YStack>
      <LfBox {...header} parentLayout="vertical" onAction={onAction} />
    </YStack>
  )
}
