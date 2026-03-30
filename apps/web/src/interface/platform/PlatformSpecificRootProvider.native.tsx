import { TransportProvider } from '@connectrpc/connect-query'
import { createConnectTransport } from '@connectrpc/connect-web'
import * as SplashScreen from 'expo-splash-screen'
import { useEffect, type ReactNode } from 'react'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { KeyboardProvider } from 'react-native-keyboard-controller'
import { useAuth } from '~/features/auth/client/authClient'
import { SERVER_URL } from '~/constants/urls'
import { QueryClientProvider, queryClient } from '~/query'

const transport = createConnectTransport({ baseUrl: SERVER_URL })

export function PlatformSpecificRootProvider({ children }: { children: ReactNode }) {
  const { state } = useAuth()

  useEffect(() => {
    if (state !== 'loading') {
      setTimeout(() => {
        SplashScreen.hide()
      }, 500)
    }
  }, [state])

  return (
    <TransportProvider transport={transport}>
      <QueryClientProvider client={queryClient}>
        <KeyboardProvider>
          <GestureHandlerRootView style={{ flex: 1 }}>{children}</GestureHandlerRootView>
        </KeyboardProvider>
      </QueryClientProvider>
    </TransportProvider>
  )
}
