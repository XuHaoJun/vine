import { router } from 'one'
import { isWeb, SizableText, Spinner, XStack, YStack } from 'tamagui'

import { useAuth } from '~/features/auth/client/authClient'
import { useTanMutation, useTanQuery } from '~/query'
import { Button } from '~/interface/buttons/Button'
import { LineIcon } from '~/interface/icons/LineIcon'
import { H2 } from '~/interface/text/Headings'
import { showToast } from '~/interface/toast/helpers'
import { SERVER_URL } from '~/constants/urls'

const LINE_GREEN = '#06C755'

const SCOPE_LABELS: Record<string, string> = {
  profile: 'Main profile info',
  openid: 'Your internal identifier',
  email: 'Email address',
}

function getConsentCode() {
  if (!isWeb) return ''
  const params = new URLSearchParams(window.location.search)
  return params.get('consent_code') ?? ''
}

function getClientIdFromUrl() {
  if (!isWeb) return ''
  const params = new URLSearchParams(window.location.search)
  return params.get('client_id') ?? ''
}

function getScopesFromUrl() {
  if (!isWeb) return [] as string[]
  const params = new URLSearchParams(window.location.search)
  const scopeParam = params.get('scope') ?? 'openid profile'
  return scopeParam.split(' ').filter(Boolean)
}

type ConsentDetails = {
  appName: string
  scopes: string[]
}

export const ConsentPage = () => {
  const { state } = useAuth()

  const consentCode = getConsentCode()
  const clientIdFromUrl = getClientIdFromUrl()
  const scopesFromUrl = getScopesFromUrl()

  const { data: consentDetails } = useTanQuery<ConsentDetails | null>({
    queryKey: ['consent-details', consentCode],
    queryFn: async () => {
      const res = await fetch(
        `${SERVER_URL}/api/auth/oauth2/consent-details?consent_code=${encodeURIComponent(consentCode)}`,
        { credentials: 'include' },
      )
      if (!res.ok) return null
      const data = (await res.json()) as { appName?: string; scopes?: string[] }
      if (!data?.appName) return null
      return { appName: data.appName, scopes: data.scopes ?? [] }
    },
    enabled: isWeb && state === 'logged-in' && !!consentCode,
  })

  const consentMutation = useTanMutation({
    mutationFn: async (accept: boolean) => {
      const params = new URLSearchParams({
        consent_code: consentCode,
        client_id: clientIdFromUrl,
        scope: (consentDetails?.scopes.length ? consentDetails.scopes : scopesFromUrl).join(' '),
      })
      const res = await fetch(
        `${SERVER_URL}/api/auth/oauth2/consent?${params.toString()}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ accept, consent_code: consentCode }),
        },
      )
      const data = (await res.json().catch(() => null)) as {
        redirectURI?: string
        redirectUrl?: string
        error?: string
      } | null
      const redirectTarget = data?.redirectURI ?? data?.redirectUrl
      if (res.ok && redirectTarget) {
        window.location.replace(redirectTarget)
        return
      }
      if (res.redirected && res.url) {
        window.location.replace(res.url)
        return
      }
      throw new Error(data?.error ?? 'Something went wrong')
    },
    onError: (err: Error) => {
      showToast(err.message, { type: 'error' })
    },
  })

  if (!isWeb) return null

  if (state === 'loading') {
    return (
      <YStack
        flex={1}
        justify="center"
        items="center"
        $platform-web={{ minHeight: '100vh' }}
      >
        <SizableText>Loading...</SizableText>
      </YStack>
    )
  }

  if (state === 'logged-out') {
    const returnUrl = `/auth/consent${window.location.search}`
    router.replace(`/auth/login?redirect=${encodeURIComponent(returnUrl)}`)
    return null
  }

  const displayAppName = consentDetails?.appName || clientIdFromUrl || 'Unknown App'
  const scopes = consentDetails?.scopes.length ? consentDetails.scopes : scopesFromUrl
  const isSubmitting = consentMutation.isPending

  return (
    <YStack
      flex={1}
      justify="center"
      items="center"
      bg="$background"
      $platform-web={{ minHeight: '100vh' }}
    >
      <YStack width="100%" items="center" gap="$5" p="$6" maxW={380}>
        <YStack items="center" gap="$2">
          <YStack
            width={64}
            height={64}
            rounded={32}
            bg="$color3"
            justify="center"
            items="center"
          >
            <LineIcon size={36} fill={LINE_GREEN} />
          </YStack>
          <H2 text="center">{displayAppName}</H2>
          <SizableText size="$3" color="$color10" text="center">
            Provider: Vine
          </SizableText>
        </YStack>

        <YStack width="100%" gap="$3">
          <SizableText size="$4" fontWeight="600">
            Grant the following permissions to this service.
          </SizableText>

          {scopes.map((scope) => (
            <XStack
              key={scope}
              width="100%"
              justify="space-between"
              items="center"
              py="$2"
              borderBottomWidth={1}
              borderColor="$borderColor"
            >
              <YStack gap="$1">
                <SizableText size="$3" fontWeight="500">
                  {SCOPE_LABELS[scope] ?? scope}
                </SizableText>
                <SizableText size="$2" color="$color10">
                  (Required)
                </SizableText>
              </YStack>
              <XStack
                width={44}
                height={24}
                rounded={12}
                bg={LINE_GREEN}
                justify="flex-end"
                items="center"
                pr="$1"
              >
                <YStack width={18} height={18} rounded={9} bg="white" />
              </XStack>
            </XStack>
          ))}
        </YStack>

        <YStack width="100%" gap="$3">
          <Button
            size="$5"
            width="100%"
            disabled={isSubmitting}
            onPress={() => consentMutation.mutate(true)}
            bg={LINE_GREEN}
            hoverStyle={{ bg: LINE_GREEN, opacity: 0.9 }}
            pressStyle={{ bg: LINE_GREEN, opacity: 0.7 }}
          >
            {isSubmitting ? <Spinner size="small" color="white" /> : 'Allow'}
          </Button>

          <Button
            variant="transparent"
            size="$4"
            width="100%"
            disabled={isSubmitting}
            onPress={() => consentMutation.mutate(false)}
          >
            <SizableText size="$3" color="$color10">
              Cancel
            </SizableText>
          </Button>
        </YStack>
      </YStack>
    </YStack>
  )
}
