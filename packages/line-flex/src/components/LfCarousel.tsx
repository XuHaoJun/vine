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
      maxW="100%"
      className={className}
    >
      <XStack gap={9} pl={7} pr={7} shrink={0}>
        {contents.map((bubble, index) => (
          <LfBubble key={index} {...bubble} onAction={onAction} shrink={0} />
        ))}
      </XStack>
    </ScrollView>
  )
}
