import { router, usePathname } from 'one'
import { memo } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { SizableText, XStack, YStack } from 'tamagui'

type TabRoute = {
  name: string
  label: string
  path: string
}

const routes: TabRoute[] = [
  { name: 'talks', label: '聊天', path: '/home/talks' },
  { name: 'settings', label: '設定', path: '/home/settings' },
]

export const BottomTabBar = memo(() => {
  const pathname = usePathname()
  const insets = useSafeAreaInsets()

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
      <XStack
        bg="$background"
        borderTopWidth={1}
        borderTopColor="$color5"
      >
        {routes.map((route) => {
          const isActive = currentTab === route.name
          return (
            <XStack
              key={route.name}
              flex={1}
              py="$3"
              justify="center"
              items="center"
              cursor="pointer"
              onPress={() => router.push(route.path as any)}
            >
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
