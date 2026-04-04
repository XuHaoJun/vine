import { isWeb } from 'tamagui'
import { Slot, Stack } from 'one'

export default function MainLayout() {
  if (isWeb) {
    return <Slot />
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="settings/index" />
    </Stack>
  )
}
