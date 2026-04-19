import { memo, useCallback } from 'react'
import { ScrollView } from 'react-native'
import { Image, SizableText, XStack, YStack } from 'tamagui'
import type { QuickReplyAction, QuickReplyItem } from '@vine/flex-schema'

type QuickReplyBarProps = {
  items: QuickReplyItem[]
  onAction: (action: QuickReplyAction) => void
}

const PillButton = memo(
  ({ item, onPress }: { item: QuickReplyItem; onPress: () => void }) => {
    const label = labelFor(item.action)
    return (
      <XStack
        items="center"
        gap="$2"
        px="$3"
        py="$2"
        bg="white"
        borderColor="$gray5"
        borderWidth={1}
        cursor="pointer"
        hoverStyle={{ bg: '$gray2' }}
        pressStyle={{ bg: '$gray3' }}
        onPress={onPress}
        style={{ borderRadius: 999 }}
      >
        {item.imageUrl ? (
          <Image
            source={{ uri: item.imageUrl }}
            width={20}
            height={20}
            style={{ borderRadius: 4 }}
          />
        ) : null}
        <SizableText fontSize={14} color="$gray12" numberOfLines={1}>
          {label}
        </SizableText>
      </XStack>
    )
  },
)

export const QuickReplyBar = memo(({ items, onAction }: QuickReplyBarProps) => {
  const handlePress = useCallback(
    (action: QuickReplyAction) => () => onAction(action),
    [onAction],
  )

  if (items.length === 0) return null

  return (
    <YStack py="$2" bg="$background">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}
      >
        {items.map((item, idx) => (
          <PillButton
            key={`${item.action.type}-${idx}`}
            item={item}
            onPress={handlePress(item.action)}
          />
        ))}
      </ScrollView>
    </YStack>
  )
})

function labelFor(action: QuickReplyAction): string {
  if ('label' in action && action.label) return action.label
  // Fallback per LINE convention.
  switch (action.type) {
    case 'message':
      return action.text
    case 'uri':
      return action.uri
    case 'postback':
      return action.displayText ?? '...'
    default:
      return action.type
  }
}
