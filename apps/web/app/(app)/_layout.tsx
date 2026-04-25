import { Redirect, Slot, Stack, usePathname } from 'one'
import { Configuration } from 'tamagui'

import { useAuth } from '~/features/auth/client/authClient'
import { DialogProvider } from '~/interface/dialogs/Dialog'
import { PlatformSpecificRootProvider } from '~/interface/platform/PlatformSpecificRootProvider'
import { ToastProvider } from '~/interface/toast/Toast'
import { ProvideZero } from '~/zero/client'

const LOGIN_REDIRECT_KEY = 'auth.login.target'

function getPendingRedirect() {
  if (typeof window === 'undefined') {
    return null
  }

  const params = new URLSearchParams(window.location.search)
  const redirect = params.get('redirect')
  if (redirect?.startsWith('/')) {
    return redirect
  }

  if (
    params.get('client_id') &&
    params.get('redirect_uri') &&
    params.get('response_type') === 'code'
  ) {
    return `/oauth2/v2.1/authorize?${params.toString()}`
  }

  const persistedTarget = window.sessionStorage.getItem(LOGIN_REDIRECT_KEY)
  return persistedTarget?.startsWith('/') ? persistedTarget : null
}

export function AppLayout() {
  const { state } = useAuth()
  const pathname = usePathname()
  const pendingRedirect = getPendingRedirect()

  // redirect logged-out users away from protected routes
  const isLoggedInRoute =
    pathname.startsWith('/home') ||
    pathname.startsWith('/developers') ||
    pathname.startsWith('/manager') ||
    pathname.startsWith('/store') ||
    pathname.startsWith('/pay')
  if (state === 'logged-out' && isLoggedInRoute) {
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(LOGIN_REDIRECT_KEY, pathname)
    }
    return <Redirect href="/auth/login" />
  }

  // redirect logged-in users away from auth routes (except consent and oauth-callback — require login)
  const hasPendingAuthContinuation =
    pathname === '/auth/login' &&
    (pendingRedirect?.startsWith('/auth/consent') ||
      pendingRedirect?.startsWith('/oauth2/v2.1/authorize'))
  const isGuestOnlyAuthRoute =
    ['/auth/login', '/auth/forgot-password'].includes(pathname) ||
    pathname === '/auth/login/password' ||
    pathname.startsWith('/auth/signup')
  if (state === 'logged-in' && isGuestOnlyAuthRoute && !hasPendingAuthContinuation) {
    const saved = (pendingRedirect ?? '/home/talks') as any
    return <Redirect href={saved} />
  }

  return (
    <Configuration disableSSR>
      <ProvideZero>
        <ToastProvider>
          <DialogProvider>
            <PlatformSpecificRootProvider>
              {process.env.VITE_NATIVE !== '1' ? (
                <Slot />
              ) : (
                // We need Stack here for transition animation to work on native
                <Stack screenOptions={{ headerShown: false }}>
                  <Stack.Screen name="home" />
                  <Stack.Screen name="auth" />
                  <Stack.Screen name="developers" />
                </Stack>
              )}
            </PlatformSpecificRootProvider>
          </DialogProvider>
        </ToastProvider>
      </ProvideZero>
    </Configuration>
  )
}
