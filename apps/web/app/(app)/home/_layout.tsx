import { Slot, Stack } from 'one'
import { YStack } from 'tamagui'

export function AppLayout() {
  return (
    <>
      {!process.env.VITE_NATIVE ? (
        <YStack flex={1}>
          <Slot />
        </YStack>
      ) : (
        // We need Stack here for transition animation to work on native
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
        </Stack>
      )}
    </>
  )
}
