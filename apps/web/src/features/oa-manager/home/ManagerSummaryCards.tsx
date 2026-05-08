import { SizableText, XStack, YStack } from 'tamagui'
import { Button } from '~/interface/buttons/Button'

type OperationCardProps = {
  title: string
  description: string
  value: string
  actionLabel?: string | undefined
  onPress?: (() => void) | undefined
}

export function OperationCard({
  title,
  description,
  value,
  actionLabel,
  onPress,
}: OperationCardProps) {
  return (
    <YStack
      minH={140}
      borderWidth={1}
      borderColor="$borderColor"
      rounded="$3"
      p="$4"
      gap="$3"
      justify="space-between"
      bg="$background"
    >
      <YStack gap="$1">
        <SizableText size="$4" fontWeight="700" color="$color12">
          {title}
        </SizableText>
        <SizableText size="$2" color="$color10">
          {description}
        </SizableText>
      </YStack>
      <XStack items="center" justify="space-between" gap="$3">
        <SizableText size="$2" fontWeight="600" color="$color11">
          {value}
        </SizableText>
        {actionLabel && onPress ? (
          <Button size="$2" onPress={onPress}>
            {actionLabel}
          </Button>
        ) : null}
      </XStack>
    </YStack>
  )
}

type SetupChecklistProps = {
  items: Array<{ label: string; complete: boolean }>
}

export function SetupChecklist({ items }: SetupChecklistProps) {
  const completeCount = items.filter((item) => item.complete).length

  return (
    <YStack borderWidth={1} borderColor="$borderColor" rounded="$3" p="$4" gap="$3">
      <XStack items="center" justify="space-between">
        <SizableText size="$4" fontWeight="700" color="$color12">
          To-do list
        </SizableText>
        <SizableText size="$2" color="$color10">
          {completeCount}/{items.length}
        </SizableText>
      </XStack>
      <YStack gap="$2">
        {items.map((item) => (
          <XStack key={item.label} items="center" gap="$2">
            <YStack
              width={18}
              height={18}
              rounded="$10"
              bg={item.complete ? '$green9' : '$color4'}
              items="center"
              justify="center"
            >
              <SizableText size="$1" color={item.complete ? 'white' : '$color10'}>
                {item.complete ? 'v' : ''}
              </SizableText>
            </YStack>
            <SizableText size="$2" color={item.complete ? '$color10' : '$color12'}>
              {item.label}
            </SizableText>
          </XStack>
        ))}
      </YStack>
    </YStack>
  )
}
