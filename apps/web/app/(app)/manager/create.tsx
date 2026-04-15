import { useRouter } from 'one'
import { memo } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { valibotResolver } from '@hookform/resolvers/valibot'
import * as v from 'valibot'
import { SizableText, Spinner, XStack, YStack } from 'tamagui'

import { oaClient } from '~/features/oa/client'
import { Button } from '~/interface/buttons/Button'
import { Pressable } from '~/interface/buttons/Pressable'
import { Input } from '~/interface/forms/Input'
import { showToast } from '~/interface/toast/Toast'
import { showError } from '~/interface/dialogs/actions'
import { useTanMutation, useTanQuery, useTanQueryClient } from '~/query'

const schema = v.object({
  name: v.pipe(
    v.string(),
    v.nonEmpty('Account name is required'),
    v.maxLength(20, 'Account name must be 20 characters or less'),
  ),
  uniqueId: v.pipe(
    v.string(),
    v.nonEmpty('Unique ID is required'),
    v.regex(/^[a-zA-Z0-9_-]+$/, 'Only alphanumeric, hyphens, and underscores allowed'),
  ),
  email: v.pipe(
    v.string(),
    v.nonEmpty('Email is required'),
    v.email('Invalid email address'),
    v.maxLength(240, 'Email must be 240 characters or less'),
  ),
  country: v.pipe(v.string(), v.nonEmpty('Country is required')),
  company: v.pipe(
    v.string(),
    v.maxLength(100, 'Company name must be 100 characters or less'),
  ),
  industry: v.pipe(v.string(), v.nonEmpty('Industry is required')),
})

type FormData = v.InferInput<typeof schema>

const COUNTRIES = [
  'Taiwan',
  'Japan',
  'South Korea',
  'China',
  'Hong Kong',
  'Singapore',
  'Thailand',
  'Indonesia',
  'Malaysia',
  'Philippines',
  'Vietnam',
  'United States',
  'United Kingdom',
  'Germany',
  'France',
  'Other',
]

const INDUSTRIES = [
  'Activities & Exhibitions',
  'Amusement & Entertainment',
  'Apparel & Accessories',
  'Automotive',
  'Beauty & Personal Care',
  'Construction & Real Estate',
  'Education',
  'Electronics & IT',
  'Finance & Insurance',
  'Food & Beverage',
  'Government & Public',
  'Healthcare & Medical',
  'Hotels & Accommodation',
  'Manufacturing',
  'Media & Publishing',
  'Non-profit & NPO',
  'Professional Services',
  'Restaurants & Cafes',
  'Retail & E-commerce',
  'Sports & Fitness',
  'Telecommunications',
  'Travel & Tourism',
  'Other',
]

export const CreateOAPage = memo(() => {
  const router = useRouter()
  const qc = useTanQueryClient()

  const { data: providersData, isLoading: providersLoading } = useTanQuery({
    queryKey: ['oa', 'providers'],
    queryFn: () => oaClient.listMyProviders({}),
  })

  const createMutation = useTanMutation({
    mutationFn: async (data: FormData & { providerId: string }) => {
      return oaClient.createOfficialAccount({
        providerId: data.providerId,
        name: data.name,
        uniqueId: data.uniqueId,
        email: data.email,
        country: data.country,
        company: data.company || undefined,
        industry: data.industry,
      })
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['oa', 'my-accounts'] })
      qc.invalidateQueries({ queryKey: ['oa', 'providers'] })
      showToast('Account created successfully', { type: 'success' })
      router.push('/manager' as never)
    },
    onError: (e) => showError(e, 'Failed to create account'),
  })

  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<FormData>({
    resolver: valibotResolver(schema),
    defaultValues: {
      name: '',
      uniqueId: '',
      email: '',
      country: '',
      company: '',
      industry: '',
    },
  })

  const onSubmit = async (data: FormData) => {
    let providerId = providersData?.providers?.[0]?.id

    if (!providerId) {
      try {
        const result = await oaClient.createProvider({ name: 'Default' })
        providerId = result.provider?.id
      } catch (e) {
        showError(e, 'Failed to create provider')
        return
      }
    }

    if (!providerId) {
      showError(new Error('No provider available'))
      return
    }

    createMutation.mutate({ ...data, providerId })
  }

  if (providersLoading) {
    return (
      <YStack flex={1} items="center" justify="center">
        <Spinner size="large" />
      </YStack>
    )
  }

  return (
    <YStack
      flex={1}
      bg="$background"
      $platform-web={{ height: '100vh', minHeight: '100vh' }}
    >
      {/* Header */}
      <XStack
        height="$6"
        px="$5"
        shrink={0}
        items="center"
        bg="$background"
        borderBottomWidth={1}
        borderColor="$borderColor"
      >
        <XStack items="center" gap="$3">
          <Pressable onPress={() => router.push('/manager' as never)}>
            <SizableText size="$3" color="$color10">
              ← Back
            </SizableText>
          </Pressable>
          <SizableText size="$4" fontWeight="700" color="$color12">
            LINE Official Account Manager
          </SizableText>
        </XStack>
      </XStack>

      {/* Content */}
      <YStack flex={1} $platform-web={{ overflowY: 'auto' }}>
        <YStack p="$6" maxW={720} width="100%" mx="auto" gap="$6">
          {/* Step indicator */}
          <XStack gap="$2" items="center" justify="center">
            <YStack items="center" gap="$1">
              <YStack
                width={32}
                height={32}
                rounded="$10"
                bg="$blue9"
                items="center"
                justify="center"
              >
                <SizableText size="$2" fontWeight="700" color="white">
                  1
                </SizableText>
              </YStack>
              <SizableText size="$1" color="$color10">
                Account info
              </SizableText>
            </YStack>
            <YStack width={40} height={2} bg="$color4" />
            <YStack items="center" gap="$1">
              <YStack
                width={32}
                height={32}
                rounded="$10"
                bg="$color4"
                items="center"
                justify="center"
              >
                <SizableText size="$2" fontWeight="700" color="$color10">
                  2
                </SizableText>
              </YStack>
              <SizableText size="$1" color="$color10">
                Confirm
              </SizableText>
            </YStack>
            <YStack width={40} height={2} bg="$color4" />
            <YStack items="center" gap="$1">
              <YStack
                width={32}
                height={32}
                rounded="$10"
                bg="$color4"
                items="center"
                justify="center"
              >
                <SizableText size="$2" fontWeight="700" color="$color10">
                  3
                </SizableText>
              </YStack>
              <SizableText size="$1" color="$color10">
                Complete
              </SizableText>
            </YStack>
          </XStack>

          {/* Form title */}
          <YStack gap="$1">
            <SizableText size="$7" fontWeight="700" color="$color12">
              Create LINE Official Account
            </SizableText>
            <SizableText size="$2" color="$color10">
              Fill in the account information below. Fields marked with ● are required.
            </SizableText>
          </YStack>

          {/* Form */}
          <YStack gap="$5">
            {/* Account info section */}
            <YStack gap="$1">
              <SizableText
                size="$1"
                fontWeight="700"
                color="$color9"
                textTransform="uppercase"
              >
                Account Information
              </SizableText>
              <YStack
                borderWidth={1}
                borderColor="$borderColor"
                rounded="$3"
                p="$4"
                gap="$4"
              >
                <Controller
                  control={control}
                  name="name"
                  render={({ field: { onChange, value }, fieldState: { error } }) => (
                    <YStack gap="$1">
                      <XStack gap="$1">
                        <SizableText size="$2" fontWeight="600" color="$color12">
                          Account name
                        </SizableText>
                        <SizableText size="$2" color="$red9">
                          ●
                        </SizableText>
                      </XStack>
                      <SizableText size="$1" color="$color9">
                        This name will be displayed in the friends list and chat screen.
                      </SizableText>
                      <Input
                        value={value}
                        onChangeText={onChange}
                        placeholder="e.g. Brown Coffee Shop"
                        error={error?.message}
                        data-testid="input-name"
                      />
                      <SizableText size="$1" color="$color9" text="right">
                        {value.length}/20
                      </SizableText>
                    </YStack>
                  )}
                />

                <Controller
                  control={control}
                  name="uniqueId"
                  render={({ field: { onChange, value }, fieldState: { error } }) => (
                    <YStack gap="$1">
                      <XStack gap="$1">
                        <SizableText size="$2" fontWeight="600" color="$color12">
                          Unique ID
                        </SizableText>
                        <SizableText size="$2" color="$red9">
                          ●
                        </SizableText>
                      </XStack>
                      <SizableText size="$1" color="$color9">
                        A unique identifier for your account (alphanumeric, hyphens,
                        underscores).
                      </SizableText>
                      <Input
                        value={value}
                        onChangeText={onChange}
                        placeholder="e.g. brown-coffee"
                        error={error?.message}
                        data-testid="input-uniqueId"
                      />
                    </YStack>
                  )}
                />
              </YStack>
            </YStack>

            {/* Contact info section */}
            <YStack gap="$1">
              <SizableText
                size="$1"
                fontWeight="700"
                color="$color9"
                textTransform="uppercase"
              >
                Contact Information
              </SizableText>
              <YStack
                borderWidth={1}
                borderColor="$borderColor"
                rounded="$3"
                p="$4"
                gap="$4"
              >
                <Controller
                  control={control}
                  name="email"
                  render={({ field: { onChange, value }, fieldState: { error } }) => (
                    <YStack gap="$1">
                      <XStack gap="$1">
                        <SizableText size="$2" fontWeight="600" color="$color12">
                          Email
                        </SizableText>
                        <SizableText size="$2" color="$red9">
                          ●
                        </SizableText>
                      </XStack>
                      <Input
                        value={value}
                        onChangeText={onChange}
                        placeholder="e.g. contact@example.com"
                        error={error?.message}
                        keyboardType="email-address"
                        data-testid="input-email"
                      />
                      <SizableText size="$1" color="$color9" text="right">
                        {value.length}/240
                      </SizableText>
                    </YStack>
                  )}
                />

                <Controller
                  control={control}
                  name="country"
                  render={({ field: { onChange, value }, fieldState: { error } }) => (
                    <YStack gap="$1">
                      <XStack gap="$1">
                        <SizableText size="$2" fontWeight="600" color="$color12">
                          Country / Region
                        </SizableText>
                        <SizableText size="$2" color="$red9">
                          ●
                        </SizableText>
                      </XStack>
                      <Input
                        value={value}
                        onChangeText={onChange}
                        placeholder="e.g. Taiwan"
                        error={error?.message}
                        data-testid="input-country"
                      />
                    </YStack>
                  )}
                />

                <Controller
                  control={control}
                  name="company"
                  render={({ field: { onChange, value }, fieldState: { error } }) => (
                    <YStack gap="$1">
                      <SizableText size="$2" fontWeight="600" color="$color12">
                        Company name
                      </SizableText>
                      <Input
                        value={value}
                        onChangeText={onChange}
                        placeholder="e.g. Brown Coffee Co., Ltd."
                        error={error?.message}
                        data-testid="input-company"
                      />
                      <SizableText size="$1" color="$color9" text="right">
                        {value.length}/100
                      </SizableText>
                    </YStack>
                  )}
                />
              </YStack>
            </YStack>

            {/* Industry section */}
            <YStack gap="$1">
              <SizableText
                size="$1"
                fontWeight="700"
                color="$color9"
                textTransform="uppercase"
              >
                Industry
              </SizableText>
              <YStack
                borderWidth={1}
                borderColor="$borderColor"
                rounded="$3"
                p="$4"
                gap="$4"
              >
                <Controller
                  control={control}
                  name="industry"
                  render={({ field: { onChange, value }, fieldState: { error } }) => (
                    <YStack gap="$1">
                      <XStack gap="$1">
                        <SizableText size="$2" fontWeight="600" color="$color12">
                          Industry category
                        </SizableText>
                        <SizableText size="$2" color="$red9">
                          ●
                        </SizableText>
                      </XStack>
                      <Input
                        value={value}
                        onChangeText={onChange}
                        placeholder="e.g. Food & Beverage"
                        error={error?.message}
                        data-testid="input-industry"
                      />
                    </YStack>
                  )}
                />
              </YStack>
            </YStack>

            {/* Submit */}
            <XStack gap="$3" justify="flex-end">
              <Button variant="outlined" onPress={() => router.push('/manager' as never)}>
                Cancel
              </Button>
              <Button
                onPress={handleSubmit(onSubmit)}
                disabled={isSubmitting || createMutation.isPending}
                data-testid="btn-create-account"
              >
                {createMutation.isPending ? <Spinner /> : 'Create account'}
              </Button>
            </XStack>
          </YStack>
        </YStack>
      </YStack>
    </YStack>
  )
})

export default CreateOAPage
