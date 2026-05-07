import { LfBubble } from './LfBubble'
import { LfCarousel } from './LfCarousel'
import type { LFexMessage, LFexAction } from '../types'

export type LFexMessageProps = LFexMessage & {
  className?: string
  onAction?: (action: LFexAction) => void
}

export function LfMessage({ contents, onAction, className }: LFexMessageProps) {
  if (contents.type === 'carousel') {
    return <LfCarousel {...contents} onAction={onAction} className={className} />
  }

  return <LfBubble {...contents} onAction={onAction} className={className} />
}
