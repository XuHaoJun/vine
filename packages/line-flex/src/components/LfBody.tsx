import { YStack } from 'tamagui'
import type { LFexBubble, LFexAction } from '../types'
import { LfBox } from './LfBox'

export type LFexBodyProps = {
  body?: LFexBubble['body']
  onAction?: (action: LFexAction) => void
}

export function LfBody({ body, onAction }: LFexBodyProps) {
  if (!body) return null
  return (
    <YStack flex={1} flexBasis="auto">
      <LfBox {...body} onAction={onAction} />
    </YStack>
  )
}
