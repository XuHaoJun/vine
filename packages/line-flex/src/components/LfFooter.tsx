import { YStack } from 'tamagui'
import type { LFexBubble, LFexAction } from '../types'
import { LfBox } from './LfBox'

export type LFexFooterProps = {
  footer?: LFexBubble['footer']
  onAction?: (action: LFexAction) => void
}

export function LfFooter({ footer, onAction }: LFexFooterProps) {
  if (!footer) return null
  return (
    <YStack flex={0}>
      <LfBox {...footer} onAction={onAction} />
    </YStack>
  )
}
