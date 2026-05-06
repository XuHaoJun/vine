import { useActiveParams, useRouter, createRoute } from 'one'
import { memo, useState } from 'react'
import { SizableText, Spinner, XStack, YStack } from 'tamagui'

import { useTanMutation, useTanQuery } from '~/query'
import { miniAppClient } from '~/features/mini-app/client'
import { loginChannelClient, liffClient } from '~/features/liff/client'
import { getAvailableLiffAppsForMiniApps } from '~/features/mini-app/liffAppIds'
import { Button } from '~/interface/buttons/Button'
import { CaretLeftIcon } from '~/interface/icons/phosphor/CaretLeftIcon'
import { Input } from '~/interface/forms/Input'
import { Select } from '~/interface/forms/Select'
import { showToast } from '~/interface/toast/Toast'

const route =
  createRoute<'/(app)/developers/console/provider/[providerId]/mini-app/new'>()

export const NewMiniAppPage = memo(() => {
  const params = useActiveParams<{ providerId: string }>()
  const router = useRouter()
  const providerId = params.providerId

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [selectedLiffAppId, setSelectedLiffAppId] = useState('')

  // 1. Fetch login channels for this provider
  const { data: loginChannelsData, isLoading: channelsLoading } = useTanQuery({
    queryKey: ['liff', 'login-channels', providerId],
    queryFn: () => loginChannelClient.listLoginChannels({ providerId: providerId! }),
    enabled: !!providerId,
  })

  const loginChannels = loginChannelsData?.channels ?? []

  // 2. Fetch LIFF apps for all login channels
  const { data: liffAppsData, isLoading: liffAppsLoading } = useTanQuery({
    queryKey: [
      'liff',
      'apps',
      'all',
      providerId,
      loginChannels.map((c) => c.id).join(','),
    ],
    queryFn: async () => {
      const results = await Promise.all(
        loginChannels.map((ch) => liffClient.listLiffApps({ loginChannelId: ch.id })),
      )
      return results.flatMap((r) => r.apps)
    },
    enabled: loginChannels.length > 0,
  })

  // 3. Fetch existing mini apps to filter out already-wrapped LIFF apps
  const { data: existingMiniAppsData } = useTanQuery({
    queryKey: ['mini-app', 'list', providerId],
    queryFn: () => miniAppClient.listMiniApps({ providerId }),
    enabled: !!providerId,
  })

  const availableLiffApps = getAvailableLiffAppsForMiniApps(
    liffAppsData ?? [],
    (existingMiniAppsData?.miniApps ?? []).map((m) => m.liffAppId),
  )

  const isLoading = channelsLoading || liffAppsLoading

  const createMiniApp = useTanMutation({
    mutationFn: (input: {
      providerId: string
      liffAppId: string
      name: string
      description?: string
      category?: string
    }) =>
      miniAppClient.createMiniApp({
        providerId: input.providerId,
        liffAppId: input.liffAppId,
        name: input.name,
        description: input.description || undefined,
        category: input.category || undefined,
      }),
    onSuccess: (data) => {
      showToast('Mini App created', { type: 'success' })
      const newId = data.miniApp?.id
      if (newId) {
        router.push(
          `/developers/console/provider/${providerId}/mini-app/${newId}` as never,
        )
      } else {
        router.push(`/developers/console/provider/${providerId}/mini-app` as never)
      }
    },
    onError: () => {
      showToast('Failed to create Mini App', { type: 'error' })
    },
  })

  const handleSubmit = () => {
    if (!name.trim() || !selectedLiffAppId || !providerId) return
    createMiniApp.mutate({
      providerId,
      liffAppId: selectedLiffAppId,
      name: name.trim(),
      description: description.trim(),
      category: category.trim(),
    })
  }

  return (
    <YStack gap="$6" maxW={480}>
      {/* Breadcrumb */}
      <XStack items="center" gap="$2">
        <Button
          variant="transparent"
          circular
          onPress={() => router.back()}
          icon={<CaretLeftIcon size={16} />}
          aria-label="Back"
        />
        <SizableText size="$2" color="$color10" fontWeight="500">
          Mini Apps
        </SizableText>
        <SizableText size="$2" color="$color10">
          ›
        </SizableText>
        <SizableText size="$2" color="$color12" fontWeight="700">
          New Mini App
        </SizableText>
      </XStack>

      {/* Page Header */}
      <SizableText size="$8" fontWeight="700" color="$color12">
        New Mini App
      </SizableText>

      {isLoading ? (
        <YStack items="center" py="$10">
          <Spinner size="large" />
        </YStack>
      ) : availableLiffApps.length === 0 ? (
        <YStack
          p="$4"
          borderWidth={1}
          borderColor="$borderColor"
          rounded="$3"
          items="center"
          gap="$3"
        >
          <SizableText size="$3" color="$color10" text="center">
            No LIFF apps available. Create one under a Login Channel first.
          </SizableText>
          <Button
            size="$2"
            variant="outlined"
            onPress={() =>
              router.push(`/developers/console/provider/${providerId}` as never)
            }
          >
            Go to Provider
          </Button>
        </YStack>
      ) : (
        <YStack gap="$4">
          {/* LIFF App Picker */}
          <YStack gap="$2">
            <SizableText size="$2" color="$color11" fontWeight="600">
              LIFF App *
            </SizableText>
            <Select
              value={selectedLiffAppId}
              onValueChange={setSelectedLiffAppId}
              options={availableLiffApps.map((app) => ({
                label: app.liffId,
                value: app.id,
              }))}
              placeholder="Select a LIFF app"
            />
          </YStack>

          {/* Name */}
          <YStack gap="$2">
            <SizableText size="$2" color="$color11" fontWeight="600">
              Name *
            </SizableText>
            <Input
              value={name}
              onChangeText={setName}
              placeholder="My Mini App"
              size="$2"
            />
          </YStack>

          {/* Description */}
          <YStack gap="$2">
            <SizableText size="$2" color="$color11" fontWeight="600">
              Description
            </SizableText>
            <Input
              value={description}
              onChangeText={setDescription}
              placeholder="Short description of this Mini App"
              size="$2"
            />
          </YStack>

          {/* Category */}
          <YStack gap="$2">
            <SizableText size="$2" color="$color11" fontWeight="600">
              Category
            </SizableText>
            <Input
              value={category}
              onChangeText={setCategory}
              placeholder="reservation / queue / delivery / ..."
              size="$2"
            />
          </YStack>

          {/* Actions */}
          <XStack gap="$2" justify="flex-end" mt="$2">
            <Button size="$2" variant="outlined" onPress={() => router.back()}>
              Cancel
            </Button>
            <Button
              size="$2"
              onPress={handleSubmit}
              disabled={!name.trim() || !selectedLiffAppId || createMiniApp.isPending}
            >
              {createMiniApp.isPending ? 'Creating…' : 'Create Mini App'}
            </Button>
          </XStack>
        </YStack>
      )}
    </YStack>
  )
})

export default NewMiniAppPage
