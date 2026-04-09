import { ScrollView, XStack } from 'tamagui'
import type { LFexCarousel, LFexAction } from '../types'
import { LfBubble } from './LfBubble'

export type LFexCarouselProps = LFexCarousel & {
  className?: string
  onAction?: (action: LFexAction) => void
}

export function LfCarousel({ contents = [], onAction, className }: LFexCarouselProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ flexDirection: 'row' }}
      flexDirection="row"
      className={className}
    >
      {contents.map((bubble, index) => (
        <XStack key={index} marginRight="$2">
          <LfBubble {...bubble} onAction={onAction} />
        </XStack>
      ))}
    </ScrollView>
  )
}
