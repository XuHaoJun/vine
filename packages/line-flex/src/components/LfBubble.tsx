import { YStack } from 'tamagui'
import type { LFexBubble, LFexAction } from '../types'
import { LfHero } from './LfHero'
import { LfHeader } from './LfHeader'
import { LfBody } from './LfBody'
import { LfFooter } from './LfFooter'

export type LFexBubbleProps = LFexBubble & {
  className?: string
  onAction?: (action: LFexAction) => void
}

const BUBBLE_SIZES = {
  nano: { width: 120, height: 120 },
  micro: { width: 160, height: 160 },
  deca: { width: 200, height: 200 },
  hecto: { width: 240, height: 240 },
  kilo: { width: 260, height: 260 },
  mega: { width: 300, height: 300 },
  giga: { width: 500, height: 500 },
} as const

export function LfBubble({
  size = 'mega',
  direction,
  header,
  hero,
  body,
  footer,
  styles,
  action,
  onAction,
  className,
}: LFexBubbleProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const props: any = {
    background: styles?.body?.backgroundColor ?? '#ffffff',
    overflow: 'hidden',
    borderRadius: '$4',
    className,
  }

  return (
    <YStack {...props}>
      <LfHeader header={header} onAction={onAction} />
      <LfHero hero={hero} onAction={onAction} />
      <LfBody body={body} onAction={onAction} />
      <LfFooter footer={footer} onAction={onAction} />
    </YStack>
  )
}
