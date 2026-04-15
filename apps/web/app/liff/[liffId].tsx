import { useActiveParams, createRoute } from 'one'
import { memo, useEffect, useState } from 'react'
import { SizableText, Spinner, YStack } from 'tamagui'
import { useAuth } from '~/features/auth/client/authClient'

const route = createRoute<'/liff/[liffId]'>()

type LiffAppConfig = {
  liffId: string
  viewType: string
  endpointUrl: string
  moduleMode: boolean
  scopes: string[]
  botPrompt: string
  qrCode: boolean
}

export const LiffPage = memo(() => {
  const params = useActiveParams<{ liffId: string }>()
  const { liffId } = params
  const { state } = useAuth()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!liffId || state === 'loading') return

    const run = async () => {
      const res = await fetch(`/liff/v1/apps/${liffId}`)
      if (!res.ok) {
        setError(`LIFF app "${liffId}" not found`)
        return
      }
      const config = (await res.json()) as LiffAppConfig

      if (state === 'logged-out') {
        const channelId = liffId.split('-')[0] ?? liffId
        const authUrl = new URL('/oauth2/v2.1/authorize', window.location.origin)
        authUrl.searchParams.set('response_type', 'token')
        authUrl.searchParams.set('client_id', channelId)
        authUrl.searchParams.set('redirect_uri', config.endpointUrl)
        authUrl.searchParams.set('scope', config.scopes.join(' ') || 'profile openid')
        authUrl.searchParams.set('state', liffId)
        window.location.href = authUrl.toString()
      } else {
        window.location.href = config.endpointUrl
      }
    }

    void run().catch((e: unknown) => {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      setError(msg)
    })
  }, [liffId, state])

  if (error) {
    return (
      <YStack flex={1} items="center" justify="center" gap="$4" p="$6">
        <SizableText size="$5" color="$color12" fontWeight="700">LIFF Error</SizableText>
        <SizableText size="$3" color="$red10" text="center">{error}</SizableText>
      </YStack>
    )
  }

  return (
    <YStack flex={1} items="center" justify="center" gap="$4">
      <Spinner size="large" />
      <SizableText size="$3" color="$color10">Opening LIFF app…</SizableText>
    </YStack>
  )
})

export default LiffPage
