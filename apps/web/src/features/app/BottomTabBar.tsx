import { router, usePathname } from 'one'
import { memo } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { SizableText, XStack, YStack } from 'tamagui'

import { ChatCircleIcon } from '~/interface/icons/phosphor/ChatCircleIcon'
import { HouseIcon } from '~/interface/icons/phosphor/HouseIcon'

import type { IconProps } from '~/interface/icons/types'

type TabRoute = {
  name: string
  label: string
  path: string
  icon: React.FC<IconProps>
}

const routes: TabRoute[] = [
  { name: 'main', label: '主頁', path: '/home/main', icon: HouseIcon },
  { name: 'talks', label: '聊天', path: '/home/talks', icon: ChatCircleIcon },
]

/** `/home/talks/:chatId` — full-screen chat; tab bar would stack under MessageInput */
function isTalksChatRoomPath(pathname: string): boolean {
  const path = pathname.split('?')[0]?.replace(/\/$/, '') ?? ''
  const m = /^\/home\/talks\/([^/]+)$/.exec(path)
  return m !== null && m[1] !== 'requests'
}

export const BottomTabBar = memo(() => {
  const pathname = usePathname()
  const insets = useSafeAreaInsets()

  if (isTalksChatRoomPath(pathname)) {
    return null
  }

  const currentTab = routes.find((r) => pathname.startsWith(r.path))?.name ?? 'talks'

  return (
    <YStack
      t={undefined}
      b={0}
      l={0}
      r={0}
      z={50}
      $platform-web={{
        position: 'fixed',
      }}
      pb={insets.bottom}
    >
      <XStack bg="$background" borderTopWidth={1} borderTopColor="$color5">
        {routes.map((route) => {
          const isActive = currentTab === route.name
          return (
            <XStack
              key={route.name}
              flex={1}
              py="$3"
              justify="center"
              items="center"
              gap="$1.5"
              cursor="pointer"
              onPress={() => router.push(route.path as any)}
            >
              <route.icon size={20} color={isActive ? '$color12' : '$color10'} />
              <SizableText
                size="$4"
                fontWeight={isActive ? '700' : '400'}
                color={isActive ? '$color12' : '$color10'}
              >
                {route.label}
              </SizableText>
            </XStack>
          )
        })}
      </XStack>
    </YStack>
  )
})
