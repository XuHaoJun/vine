import { Slot } from 'one'

import { BottomTabBar } from '~/features/app/BottomTabBar'

export function TabsLayout() {
  return (
    <>
      <Slot />
      <BottomTabBar />
    </>
  )
}
