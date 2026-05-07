import { SizableText, YStack } from 'tamagui'
import { Avatar } from '~/interface/avatars/Avatar'

type Props = {
  name: string
  image: string | null
}

export function ManagerOAProfilePanel({ name, image }: Props) {
  return (
    <YStack
      width={260}
      shrink={0}
      items="center"
      p="$5"
      gap="$3"
      borderLeftWidth={1}
      borderColor="$borderColor"
    >
      <Avatar size={88} image={image} name={name} />
      <SizableText size="$5" fontWeight="700" text="center" numberOfLines={2}>
        {name}
      </SizableText>
    </YStack>
  )
}
