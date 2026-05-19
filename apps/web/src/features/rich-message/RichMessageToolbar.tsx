import { XStack, SizableText } from 'tamagui'
import { Button } from '~/interface/buttons/Button'
import type { RichMessageExtension } from './core/types'

export function getRichMessageToolbarItems({
  extensions,
  canInsert,
  count,
  maxMessages,
}: {
  extensions: RichMessageExtension[]
  canInsert(type: string): boolean
  count: number
  maxMessages?: number
}) {
  return {
    buttons: extensions.map((extension) => ({
      type: extension.type,
      label: extension.label,
      Icon: extension.icon,
      ariaLabel: `Add ${extension.type} message`,
      disabled: !canInsert(extension.type),
    })),
    countLabel:
      maxMessages === undefined ? `${count} messages` : `${count} / ${maxMessages}`,
  }
}

type Props = {
  extensions: RichMessageExtension[]
  canInsert(type: string): boolean
  insert(type: string): void
  count: number
  maxMessages?: number
}

export function RichMessageToolbar({
  extensions,
  canInsert,
  insert,
  count,
  maxMessages,
}: Props) {
  const items = getRichMessageToolbarItems({ extensions, canInsert, count, maxMessages })

  return (
    <XStack p="$2" gap="$2" items="center" borderTopWidth={1} borderColor="$borderColor">
      {items.buttons.map((button) => {
        const Icon = button.Icon
        return (
          <Button
            key={button.type}
            size="$2"
            variant="transparent"
            aria-label={button.ariaLabel}
            disabled={button.disabled}
            onPress={() => insert(button.type)}
          >
            <Icon size={18} />
          </Button>
        )
      })}
      <SizableText size="$1" color="$color10" ml="auto">
        {items.countLabel}
      </SizableText>
    </XStack>
  )
}
