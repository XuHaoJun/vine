import { ScrollView, XStack, YStack } from 'tamagui'
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
          <YStack key={index} shrink={0}>
            <LfBubble {...bubble} onAction={onAction} />
          </YStack>
        ))}
      </XStack>
    </ScrollView>
  )
}
