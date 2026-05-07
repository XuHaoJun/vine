import { Slot, Stack } from 'one'
import { isWeb } from 'tamagui'

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
