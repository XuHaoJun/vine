import { Slot, Stack } from 'one'

export function AuthAndOnboardingLayout() {
  return (
    <>
      {process.env.VITE_NATIVE !== '1' ? (
        <Slot />
      ) : (
        <Stack screenOptions={{ headerShown: false }} initialRouteName="login">
          <Stack.Screen name="login" />
          <Stack.Screen name="login/password" />
          <Stack.Screen name="signup/[method]" />
          <Stack.Screen name="consent" />
          <Stack.Screen name="oauth-callback" />
        </Stack>
      )}
    </>
  )
}
