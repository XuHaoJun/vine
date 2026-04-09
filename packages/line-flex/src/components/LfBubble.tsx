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
  nano: 120,
  micro: 160,
  deca: 200,
  hecto: 240,
  kilo: 260,
  mega: 300,
  giga: 500,
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
  const width = BUBBLE_SIZES[size] ?? 300

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const props: any = {
    width,
    maxWidth: width,
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
