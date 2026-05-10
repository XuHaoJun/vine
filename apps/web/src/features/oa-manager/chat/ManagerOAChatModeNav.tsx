import { SizableText, YStack } from 'tamagui'
import { Pressable } from '~/interface/buttons/Pressable'
import { ChatCircleIcon } from '~/interface/icons/phosphor/ChatCircleIcon'
import { UserIcon } from '~/interface/icons/phosphor/UserIcon'

export type ManagerOAChatMode = 'chats' | 'contacts'

type Props = {
  mode: ManagerOAChatMode
  onModeChange: (mode: ManagerOAChatMode) => void
}

const items = [
  { mode: 'chats' as const, label: 'Chats', icon: ChatCircleIcon },
  { mode: 'contacts' as const, label: 'Contacts', icon: UserIcon },
]

export function ManagerOAChatModeNav({ mode, onModeChange }: Props) {
  return (
    <YStack width={88} shrink={0} borderRightWidth={1} borderColor="$borderColor">
      {items.map((item) => {
        const Icon = item.icon
        const active = mode === item.mode

        return (
          <Pressable
            key={item.mode}
            role="button"
            aria-label={`Show ${item.label}`}
            onPress={() => onModeChange(item.mode)}
            p="$3"
            gap="$2"
            items="center"
            cursor="pointer"
            bg={active ? '$color3' : 'transparent'}
            hoverStyle={{ bg: active ? '$color3' : '$color2' }}
          >
            <Icon size={20} />
            <SizableText size="$1" fontWeight={active ? '700' : '500'} text="center">
              {item.label}
            </SizableText>
          </Pressable>
        )
      })}
    </YStack>
  )
}
