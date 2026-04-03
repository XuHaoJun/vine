import { useEffect } from 'react'
import { isWeb, SizableText, YStack } from 'tamagui'

const isDev = process.env.NODE_ENV !== 'production'

export const OAuthCallbackPage = () => {
  useEffect(() => {
    if (!isWeb) return

    if (!isDev) {
      window.location.replace('/home/talks')
      return
    }

    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const error = params.get('error')
    const state = params.get('state')
    if (code) {
      console.info('[oauth-callback] received code:', code, 'state:', state)
    } else if (error) {
      console.info('[oauth-callback] received error:', error, 'state:', state)
    }
  }, [])

  if (!isDev) return null

  return (
    <YStack
      flex={1}
      justify="center"
      items="center"
      bg="$background"
      $platform-web={{ minHeight: '100vh' }}
    >
      <SizableText>OAuth Callback (dev only)</SizableText>
      <SizableText size="$3" color="$color10" mt="$2">
        Check console for code/error
      </SizableText>
    </YStack>
  )
}
