import { valibotResolver } from '@hookform/resolvers/valibot'
import { useParams, useRouter, createRoute } from 'one'
import { memo, useLayoutEffect, useRef } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as v from 'valibot'
import { SizableText, Spinner, useEvent, XStack, YStack } from 'tamagui'

import { Button } from '~/interface/buttons/Button'
import { Pressable } from '~/interface/buttons/Pressable'
import { Input } from '~/interface/forms/Input'
import { CaretLeftIcon } from '~/interface/icons/phosphor/CaretLeftIcon'
import { PageLayout } from '~/interface/pages/PageLayout'

const route = createRoute<'/(app)/auth/signup/[method]'>()

const schema = v.object({
  email: v.pipe(
    v.string(),
    v.email('Please enter a valid email address'),
    v.nonEmpty('Email is required'),
  ),
})

type FormData = v.InferInput<typeof schema>

export const SignupPage = memo(() => {
  const { method } = useParams<{
    method?: 'email'
  }>()
  const { top } = useSafeAreaInsets()
  const router = useRouter()
  const inputRef = useRef<any>(null)

  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<FormData>({
    resolver: valibotResolver(schema),
    defaultValues: { email: '' },
  })

  useLayoutEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus?.()
    }, 650)

    return () => clearTimeout(timer)
  }, [])

  const handleGoBack = useEvent(() => router.back())

  const onSubmit = useEvent(async (data: FormData) => {
    if (!method) {
      return
    }

    router.push(
      `/auth/login/password?method=${method}&value=${encodeURIComponent(data.email)}`,
    )
  })

  if (method !== 'email') {
    return (
      <YStack flex={1} bg="$background" pt={top} px="$4">
        <XStack items="center" gap="$3">
          <Pressable onPress={handleGoBack}>
            <CaretLeftIcon size={24} />
          </Pressable>
        </XStack>
        <YStack flex={1} items="center" justify="center">
          <SizableText fontSize={16} opacity={0.6}>
            Invalid authentication method
          </SizableText>
        </YStack>
      </YStack>
    )
  }

  return (
    <PageLayout>
      <YStack flex={1} bg="$background" pt={top} px="$4" gap="$4">
        <XStack items="center" gap="$3">
          <Pressable onPress={handleGoBack}>
            <CaretLeftIcon size={24} />
          </Pressable>
          <SizableText size="$6" fontWeight="bold">
            Continue with Email
          </SizableText>
        </XStack>

        <SizableText size="$4" color="$color10">
          Sign in or sign up with your email.
        </SizableText>

        <YStack gap="$4" mt="$4">
          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, value }, fieldState: { error } }) => (
              <Input
                data-testid="email-input"
                ref={inputRef}
                placeholder="Enter email address"
                value={value}
                onChangeText={onChange}
                error={error?.message}
                autoCapitalize="none"
                onSubmitEditing={() => handleSubmit(onSubmit)()}
                type="email"
                autoComplete="email"
                inputMode="email"
              />
            )}
          />

          <Button
            data-testid="next-button"
            size="$5"
            pressStyle={{
              scale: 0.97,
              opacity: 0.9,
            }}
            onPress={handleSubmit(onSubmit)}
            disabled={isSubmitting}
          >
            {isSubmitting ? <Spinner size="small" /> : 'Next'}
          </Button>
        </YStack>
      </YStack>
    </PageLayout>
  )
})
