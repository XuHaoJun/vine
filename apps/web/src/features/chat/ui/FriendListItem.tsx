import { memo } from 'react'
import { ListItem } from 'tamagui'

import { Avatar } from '~/interface/avatars/Avatar'

type Props = {
  name: string
  image?: string | null
  statusMessage?: string | null
  onPress: () => void
}

export const FriendListItem = memo(({ name, image, statusMessage, onPress }: Props) => {
  return (
    <ListItem
      gap="$3"
      title={name}
      subTitle={statusMessage ?? undefined}
      icon={
        <Avatar size={44} image={image ?? null} name={name} />
      }
      onPress={onPress}
      cursor="pointer"
    />
  )
})
