import { Slot } from 'one'
import { YStack } from 'tamagui'

export default function FlexSimulatorLayout() {
  return (
    <YStack flex={1}>
      <Slot />
    </YStack>
  )
}