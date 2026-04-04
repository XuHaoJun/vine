import { Slot } from 'one'
import { YStack } from 'tamagui'

import { BottomTabBar } from '~/features/app/BottomTabBar'

export function TabsLayout() {
  return (
    <YStack flex={1}>
      <YStack flex={1}>
        <Slot />
      </YStack>
      <BottomTabBar />
    </YStack>
  )
}
