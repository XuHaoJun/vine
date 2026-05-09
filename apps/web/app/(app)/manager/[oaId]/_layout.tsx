import { Slot } from 'one'
import { YStack } from 'tamagui'

export default function ManagerOARouteBoundary() {
  return (
    <YStack
      flex={1}
      bg="$background"
      $platform-web={{ height: '100vh', minHeight: '100vh' }}
    >
      <Slot />
    </YStack>
  )
}
