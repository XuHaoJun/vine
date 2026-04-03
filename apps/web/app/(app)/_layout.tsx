import { Redirect, Slot, Stack, usePathname } from 'one'
import { Configuration } from 'tamagui'

import { useAuth } from '~/features/auth/client/authClient'
import { DialogProvider } from '~/interface/dialogs/Dialog'
import { PlatformSpecificRootProvider } from '~/interface/platform/PlatformSpecificRootProvider'
import { ToastProvider } from '~/interface/toast/Toast'
import { ProvideZero } from '~/zero/client'

function getPendingRedirect() {
  if (typeof window === 'undefined') {
    return null
  }

  return new URLSearchParams(window.location.search).get('redirect')
}

function hasOidcLoginPrompt() {
  if (typeof window === 'undefined') {
    return false
  }

  const params = new URLSearchParams(window.location.search)
  return Boolean(params.get('client_id') && params.get('code'))
}

export function AppLayout() {
  const { state } = useAuth()
  const pathname = usePathname()
  const pendingRedirect = getPendingRedirect()

  if (state === 'loading') {
    return null
  }

  // redirect logged-out users away from protected routes
  const isLoggedInRoute = pathname.startsWith('/home')
  if (state === 'logged-out' && isLoggedInRoute) {
    return <Redirect href="/auth/login" />
  }

  // redirect logged-in users away from auth routes (except consent and oauth-callback — require login)
  const hasPendingConsentRedirect =
    pathname === '/auth/login' &&
    (pendingRedirect?.startsWith('/auth/consent') || hasOidcLoginPrompt())
  const isAuthRoute =
    pathname.startsWith('/auth') &&
    !['/auth/consent', '/auth/oauth-callback', '/auth/login'].some(
      (path) => pathname === path,
    ) &&
    !hasPendingConsentRedirect
  if (state === 'logged-in' && isAuthRoute) {
    return <Redirect href="/home/feed" />
  }

  return (
    <Configuration disableSSR>
      <ProvideZero>
        <ToastProvider>
          <DialogProvider>
            <PlatformSpecificRootProvider>
              {process.env.VITE_PLATFORM === 'web' ? (
                <Slot />
              ) : (
                // We need Stack here for transition animation to work on native
                <Stack screenOptions={{ headerShown: false }}>
                  <Stack.Screen name="home" />
                  <Stack.Screen name="auth" />
                </Stack>
              )}
            </PlatformSpecificRootProvider>
          </DialogProvider>
        </ToastProvider>
      </ProvideZero>
    </Configuration>
  )
}
