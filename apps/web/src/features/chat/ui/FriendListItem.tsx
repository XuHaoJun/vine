import { memo } from 'react'
import { SizableText, XStack, YStack } from 'tamagui'

import { Avatar } from '~/interface/avatars/Avatar'
import { Pressable } from '~/interface/buttons/Pressable'

type Props = {
  name: string
  image?: string | null
  statusMessage?: string | null
  onPress: () => void
}

export const FriendListItem = memo(({ name, image, statusMessage, onPress }: Props) => {
  return (
    <Pressable onPress={onPress}>
      <XStack px="$4" py="$3" gap="$3" items="center" hoverStyle={{ bg: '$color2' }}>
        <Avatar size={44} image={image ?? null} name={name} />
        <YStack flex={1} gap="$0.5">
          <SizableText fontSize={14} fontWeight="700" numberOfLines={1}>
            {name}
          </SizableText>
          {statusMessage && (
            <SizableText fontSize={11} color="$color10" numberOfLines={1}>
              {statusMessage}
            </SizableText>
          )}
        </YStack>
      </XStack>
    </Pressable>
  )
})
