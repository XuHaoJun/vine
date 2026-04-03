import { router } from 'one'
import { useRef, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { valibotResolver } from '@hookform/resolvers/valibot'
import { isWeb, SizableText, Spinner, XStack, YStack } from 'tamagui'
import * as v from 'valibot'

import { useAuth } from '~/features/auth/client/authClient'
import { passwordLogin } from '~/features/auth/client/passwordLogin'
import { signInAsDemo } from '~/features/auth/client/signInAsDemo'
import { isDemoMode } from '~/helpers/isDemoMode'
import { Link } from '~/interface/app/Link'
import { Button } from '~/interface/buttons/Button'
import { Pressable } from '~/interface/buttons/Pressable'
import { Input } from '~/interface/forms/Input'
import { LineIcon } from '~/interface/icons/LineIcon'
import { H2 } from '~/interface/text/Headings'
import { showToast } from '~/interface/toast/helpers'

const LINE_GREEN = '#06C755'
const LOGIN_REDIRECT_KEY = 'auth.login.target'

const schema = v.object({
  email: v.pipe(v.string(), v.nonEmpty('Required'), v.email('Invalid email')),
  password: v.pipe(v.string(), v.nonEmpty('Required')),
})

type FormData = v.InferInput<typeof schema>

function getLoginTargetFromSearch(search: string) {
  const params = new URLSearchParams(search)
  const redirect = params.get('redirect')
  if (redirect?.startsWith('/')) {
    return redirect
  }

  const clientId = params.get('client_id')
  const redirectUri = params.get('redirect_uri')
  const responseType = params.get('response_type')
  if (clientId && redirectUri && responseType === 'code') {
    return `/oauth2/v2.1/authorize?${params.toString()}`
  }

  return null
}

function getLoginTargetFromNavigationEntry() {
  if (!isWeb || typeof window === 'undefined') {
    return null
  }

  const navigationEntry = window.performance
    .getEntriesByType('navigation')
    .find((entry) => 'name' in entry)

  if (!navigationEntry || typeof navigationEntry.name !== 'string') {
    return null
  }

  try {
    const url = new URL(navigationEntry.name)
    return getLoginTargetFromSearch(url.search)
  } catch {
    return null
  }
}

function persistPostLoginRedirect() {
  if (!isWeb) {
    return
  }

  const target =
    getLoginTargetFromSearch(window.location.search) ??
    getLoginTargetFromNavigationEntry()
  if (target) {
    window.sessionStorage.setItem(LOGIN_REDIRECT_KEY, target)
  }
}

if (typeof window !== 'undefined') {
  persistPostLoginRedirect()
}

function getPostLoginRedirect() {
  if (!isWeb) {
    return '/home/talks'
  }

  const currentTarget = getLoginTargetFromSearch(window.location.search)
  if (currentTarget) {
    return currentTarget
  }

  const navigationTarget = getLoginTargetFromNavigationEntry()
  if (navigationTarget) {
    return navigationTarget
  }

  const persistedTarget = window.sessionStorage.getItem(LOGIN_REDIRECT_KEY)
  return persistedTarget?.startsWith('/') ? persistedTarget : '/home/talks'
}

function redirectAfterLogin(target: string) {
  if (isWeb) {
    window.sessionStorage.removeItem(LOGIN_REDIRECT_KEY)
    window.location.replace(target)
    return
  }

  router.replace('/home/talks')
}

export const LoginPage = () => {
  const { state } = useAuth()
  const [showPassword, setShowPassword] = useState(false)
  const [demoLoading, setDemoLoading] = useState(false)
  const postLoginRedirect = useRef(getPostLoginRedirect()).current

  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<FormData>({
    resolver: valibotResolver(schema),
    defaultValues: { email: '', password: '' },
  })

  if (state === 'loading') {
    return null
  }

  if (state === 'logged-in') {
    redirectAfterLogin(postLoginRedirect)
    return null
  }

  const onSubmit = async (data: FormData) => {
    const result = await passwordLogin(data.email, data.password)
    if (!result.success) {
      showToast(result.error.message, { type: 'error' })
      return
    }
    redirectAfterLogin(postLoginRedirect)
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
        p={isWeb ? '$6' : '$4'}
        maxW={isWeb ? 380 : '90%'}
      >
        {/* Logo */}
        <YStack items="center" gap="$3">
          <LineIcon size={56} fill={LINE_GREEN} />
          <H2 text="center">Log in to LINE</H2>
        </YStack>

        {/* Form */}
        <YStack width="100%" gap="$3">
          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, value }, fieldState: { error } }) => (
              <Input
                value={value}
                onChangeText={onChange}
                placeholder="Email"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                error={error?.message}
                returnKeyType="next"
                onSubmitEditing={() => handleSubmit(onSubmit)()}
              />
            )}
          />
        </YStack>

        <XStack width="100%" items="flex-start">
          <YStack flex={1}>
            <Controller
              control={control}
              name="password"
              render={({ field: { onChange, value }, fieldState: { error } }) => (
                <Input
                  value={value}
                  onChangeText={onChange}
                  placeholder="Password"
                  secureTextEntry={!showPassword}
                  error={error?.message}
                  onSubmitEditing={() => handleSubmit(onSubmit)()}
                />
              )}
            />
          </YStack>
          <Pressable mt={14} ml="$2" onPress={() => setShowPassword((prev) => !prev)}>
            <SizableText size="$3" color="$color9">
              {showPassword ? 'Hide' : 'Show'}
            </SizableText>
          </Pressable>
        </XStack>

        <Button
          size="$5"
          width="100%"
          disabled={isSubmitting}
          onPress={handleSubmit(onSubmit)}
          bg={LINE_GREEN}
          hoverStyle={{ bg: LINE_GREEN, opacity: 0.9 }}
          pressStyle={{ bg: LINE_GREEN, opacity: 0.7 }}
        >
          {isSubmitting ? (
            <Spinner size="small" color="white" />
          ) : (
            <SizableText color="white">Log in</SizableText>
          )}
        </Button>

        {/* @ts-expect-error OneJS routing type mismatch */}
        <Link href="/auth/forgot-password" size="$3" color="$color9" textAlign="center">
          Forgot password?
        </Link>

        {/* Demo mode — dev only */}
        {isDemoMode && (
          <Button
            variant="outlined"
            size="$5"
            width="100%"
            disabled={demoLoading}
            onPress={async () => {
              setDemoLoading(true)
              const { error } = await signInAsDemo()
              setDemoLoading(false)
              if (error) {
                showToast('Demo login failed', { type: 'error' })
                return
              }
              redirectAfterLogin(postLoginRedirect)
            }}
            data-testid="login-as-demo"
          >
            {demoLoading ? <Spinner size="small" /> : 'Login as Demo User'}
          </Button>
        )}

        {/* Create account */}
        <XStack gap="$1" justify="center" flexWrap="wrap">
          <SizableText size="$3" color="$color10">
            Don't have an account?
          </SizableText>
          <Link href="/auth/signup/email" size="$3" color={LINE_GREEN} fontWeight="600">
            Create one
          </Link>
        </XStack>
      </YStack>
    </YStack>
  )
}
