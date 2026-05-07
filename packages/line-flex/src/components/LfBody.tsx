import { YStack } from 'tamagui'
import { LfBox } from './LfBox'
import type { LFexBubble, LFexAction } from '../types'

export type LFexBodyProps = {
  body?: LFexBubble['body']
  onAction?: (action: LFexAction) => void
}

export function LfBody({ body, onAction }: LFexBodyProps) {
  if (!body) return null
  return (
    <YStack flex={1} flexBasis="auto" width="100%" style={{ minWidth: 0 }}>
      <LfBox {...body} parentLayout="vertical" onAction={onAction} />
    </YStack>
  )
}
