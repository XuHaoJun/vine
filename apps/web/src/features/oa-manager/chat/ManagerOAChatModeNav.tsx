import { useState } from 'react'
import { SizableText, YStack } from 'tamagui'
import { Pressable } from '~/interface/buttons/Pressable'
import { ChatCircleIcon } from '~/interface/icons/phosphor/ChatCircleIcon'
import { FunnelIcon } from '~/interface/icons/phosphor/FunnelIcon'
import { GearIcon } from '~/interface/icons/phosphor/GearIcon'
import { UserIcon } from '~/interface/icons/phosphor/UserIcon'

export type ManagerOAChatMode = 'chats' | 'contacts' | 'custom-filters'

type Props = {
  mode: ManagerOAChatMode
  onModeChange: (mode: ManagerOAChatMode) => void
}

const mainItems = [
  { mode: 'chats' as const, label: 'Chats', icon: ChatCircleIcon },
  { mode: 'contacts' as const, label: 'Contacts', icon: UserIcon },
]

const settingsItems = [
  { mode: 'custom-filters' as const, label: 'Custom\nfilters', icon: FunnelIcon },
]

export function ManagerOAChatModeNav({ mode, onModeChange }: Props) {
  const isSettingsActive = settingsItems.some((item) => item.mode === mode)
  const [settingsOpen, setSettingsOpen] = useState(isSettingsActive)

  return (
    <YStack width={88} shrink={0} borderRightWidth={1} borderColor="$borderColor">
      {mainItems.map((item) => {
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

      <YStack borderTopWidth={1} borderColor="$borderColor" mt="$2" pt="$2">
        <Pressable
          role="button"
          aria-label="Chat settings"
          onPress={() => setSettingsOpen((prev) => !prev)}
          p="$3"
          gap="$2"
          items="center"
          cursor="pointer"
          hoverStyle={{ bg: '$color2' }}
        >
          <GearIcon size={20} />
          <SizableText size="$1" fontWeight="500" text="center">
            Chat{'\n'}settings
          </SizableText>
        </Pressable>

        {settingsOpen &&
          settingsItems.map((item) => {
            const Icon = item.icon
            const active = mode === item.mode

            return (
              <Pressable
                key={item.mode}
                role="button"
                aria-label={`Show ${item.label.replace('\n', ' ')}`}
                onPress={() => onModeChange(item.mode)}
                p="$2"
                pl="$4"
                gap="$1"
                items="center"
                cursor="pointer"
                bg={active ? '$color3' : 'transparent'}
                hoverStyle={{ bg: active ? '$color3' : '$color2' }}
              >
                <Icon size={16} />
                <SizableText size="$1" fontWeight={active ? '700' : '500'} text="center">
                  {item.label}
                </SizableText>
              </Pressable>
            )
          })}
      </YStack>
    </YStack>
  )
}
