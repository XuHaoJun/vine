import { useEffect } from 'react'
import { isWeb, SizableText, YStack } from 'tamagui'

export const OAuthCallbackPage = () => {
  useEffect(() => {
    if (!isWeb) return
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

  return (
    <YStack
      flex={1}
      justify="center"
      items="center"
      bg="$background"
      $platform-web={{ minHeight: '100vh' }}
    >
      <SizableText>OAuth Callback</SizableText>
      <SizableText size="$3" color="$color10" mt="$2">
        Check console for code/error
      </SizableText>
    </YStack>
  )
}
