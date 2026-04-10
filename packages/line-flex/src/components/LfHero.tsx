import type { LFexBubble, LFexAction } from '../types'
import { LfBox } from './LfBox'
import { LfImage } from './LfImage'
import { LfVideo } from './LfVideo'

export type LFexHeroProps = {
  hero?: LFexBubble['hero']
  onAction?: (action: LFexAction) => void
}

export function LfHero({ hero, onAction }: LFexHeroProps) {
  if (!hero) return null

  if (hero.type === 'video') {
    return <LfVideo {...hero} onAction={onAction} />
  }

  if (hero.type === 'image') {
    return <LfImage {...hero} onAction={onAction} />
  }

  return <LfBox {...hero} parentLayout="vertical" onAction={onAction} />
}
