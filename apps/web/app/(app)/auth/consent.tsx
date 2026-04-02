import { router } from 'one'
import { useRef, useState } from 'react'
import { isWeb, SizableText, Spinner, XStack, YStack } from 'tamagui'

import { useAuth } from '~/features/auth/client/authClient'
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

function getConsentParams() {
  if (!isWeb) return { consentCode: '', clientId: '', scopes: [] as string[] }
  const params = new URLSearchParams(window.location.search)
  return {
    consentCode: params.get('consent_code') ?? '',
    clientId: params.get('client_id') ?? '',
    scopes: (params.get('scope') ?? 'openid profile').split(' ').filter(Boolean),
  }
}

export const ConsentPage = () => {
  const { state } = useAuth()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const isSubmittingRef = useRef(false)

  const { consentCode, clientId, scopes } = getConsentParams()

  if (!isWeb) return null

  if (state === 'loading') return null

  if (state === 'logged-out') {
    const returnUrl = `/auth/consent${window.location.search}`
    router.replace(`/auth/login?redirect=${encodeURIComponent(returnUrl)}`)
    return null
  }

  const postConsent = (accept: boolean) => {
    if (isSubmittingRef.current) return
    isSubmittingRef.current = true
    setIsSubmitting(true)
    const form = document.createElement('form')
    form.method = 'POST'
    form.action = `${SERVER_URL}/api/auth/oauth2/consent`
    const acceptInput = document.createElement('input')
    acceptInput.name = 'accept'
    acceptInput.value = String(accept)
    form.appendChild(acceptInput)
    const codeInput = document.createElement('input')
    codeInput.name = 'consent_code'
    codeInput.value = consentCode
    form.appendChild(codeInput)
    document.body.appendChild(form)
    form.submit()
  }

  return (
    <YStack
      flex={1}
      justify="center"
      items="center"
      bg="$background"
      $platform-web={{ minHeight: '100vh' }}
    >
      <YStack
        width="100%"
        items="center"
        gap="$5"
        p="$6"
        maxW={380}
      >
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
          <H2 text="center">{clientId}</H2>
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
            onPress={() => postConsent(true)}
            bg={LINE_GREEN}
            color="white"
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
            onPress={() => postConsent(false)}
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
