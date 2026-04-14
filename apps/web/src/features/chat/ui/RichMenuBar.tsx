import { memo } from 'react'
import { Pressable } from 'react-native'
import { XStack, SizableText } from 'tamagui'

type Props = {
  chatBarText: string
  isExpanded: boolean
  onToggleExpand: () => void
  onSwitchToKeyboard: () => void
}

export const RichMenuBar = memo(
  ({ chatBarText, isExpanded, onToggleExpand, onSwitchToKeyboard }: Props) => {
    return (
      <XStack bg="white" borderTopWidth={1} borderTopColor="$color4">
        <Pressable onPress={onSwitchToKeyboard}>
          <XStack
            width={44}
            height={44}
            items="center"
            justify="center"
            borderRightWidth={1}
            borderRightColor="$color4"
          >
            <SizableText fontSize={18}>⌨️</SizableText>
          </XStack>
        </Pressable>
        <Pressable onPress={onToggleExpand} style={{ flex: 1 }}>
          <XStack flex={1} items="center" justify="center" gap="$1.5" py="$2.5">
            <SizableText fontSize={13} fontWeight="500" color="$color12">
              {chatBarText}
            </SizableText>
            <SizableText fontSize={10} color="$color10">
              {isExpanded ? '▲' : '▼'}
            </SizableText>
          </XStack>
        </Pressable>
      </XStack>
    )
  },
)
