import { memo } from 'react'
import { SizableText, XStack } from 'tamagui'

const AVATAR_COLORS = ['#7a9cbf', '#c4aed0', '#a0c4a0', '#e0b98a']

type GroupAvatarProps = {
  size: number
  names: string[]
  image?: string | null
}

export const GroupAvatar = memo(({ size, names, image }: GroupAvatarProps) => {
  if (image) {
    return (
      <XStack
        width={size}
        height={size}
        shrink={0}
        style={{ borderRadius: 999, backgroundColor: '$color4' }}
        items="center"
        justify="center"
      >
        <SizableText fontSize={size * 0.4} fontWeight="600" color="white">
          {names[0]?.[0]?.toUpperCase() ?? '?'}
        </SizableText>
      </XStack>
    )
  }

  return (
    <XStack
      width={size}
      height={size}
      shrink={0}
      style={{ borderRadius: 999, backgroundColor: AVATAR_COLORS[0] }}
      items="center"
      justify="center"
    >
      <SizableText fontSize={size * 0.4} fontWeight="600" color="white">
        {names[0]?.[0]?.toUpperCase() ?? '?'}
      </SizableText>
    </XStack>
  )
})