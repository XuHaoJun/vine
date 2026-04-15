// apps/web/app/(app)/developers/console/login-channel/[loginChannelId]/liff.tsx
import { useActiveParams, useRouter, createRoute } from 'one'
import { memo, useState } from 'react'
import { SizableText, Spinner, XStack, YStack } from 'tamagui'
import { Controller, useForm } from 'react-hook-form'
import { valibotResolver } from '@hookform/resolvers/valibot'
import * as v from 'valibot'
import { useTanQuery, useTanMutation, useTanQueryClient } from '~/query'
import { liffClient, loginChannelClient } from '~/features/liff/client'
import { Button } from '~/interface/buttons/Button'
import { Input } from '~/interface/forms/Input'
import { CaretLeftIcon } from '~/interface/icons/phosphor/CaretLeftIcon'
import { showToast } from '~/interface/toast/Toast'
import { dialogConfirm } from '~/interface/dialogs/actions'
import { ViewType } from '@vine/proto/liff'

const route = createRoute<'/(app)/developers/console/login-channel/[loginChannelId]/liff'>()

const createSchema = v.object({
  endpointUrl: v.pipe(
    v.string(),
    v.nonEmpty('Required'),
    v.startsWith('https://', 'Must start with https://'),
  ),
  description: v.optional(v.string()),
})
type CreateForm = v.InferInput<typeof createSchema>

export const LiffAppsPage = memo(() => {
  const params = useActiveParams<{ loginChannelId: string }>()
  const router = useRouter()
  const queryClient = useTanQueryClient()
  const loginChannelId = params.loginChannelId
  const [showCreate, setShowCreate] = useState(false)

  const { data: channel } = useTanQuery({
    queryKey: ['liff', 'login-channel', loginChannelId],
    queryFn: () => loginChannelClient.getLoginChannel({ id: loginChannelId! }),
    enabled: !!loginChannelId,
  })

  const { data: appsData, isLoading } = useTanQuery({
    queryKey: ['liff', 'apps', loginChannelId],
    queryFn: () => liffClient.listLiffApps({ loginChannelId: loginChannelId! }),
    enabled: !!loginChannelId,
  })

  const { control, handleSubmit, reset, formState: { isSubmitting } } = useForm<CreateForm>({
    resolver: valibotResolver(createSchema),
    defaultValues: { endpointUrl: '', description: '' },
  })

  const createApp = useTanMutation({
    mutationFn: (data: CreateForm) =>
      liffClient.createLiffApp({
        loginChannelId: loginChannelId!,
        viewType: ViewType.FULL,
        endpointUrl: data.endpointUrl,
        description: data.description,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['liff', 'apps', loginChannelId] })
      showToast('LIFF app created', { type: 'success' })
      setShowCreate(false)
      reset()
    },
    onError: () => {
      showToast('Failed to create LIFF app', { type: 'error' })
    },
  })

  const deleteApp = useTanMutation({
    mutationFn: (liffId: string) => liffClient.deleteLiffApp({ liffId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['liff', 'apps', loginChannelId] })
      showToast('LIFF app deleted', { type: 'success' })
    },
    onError: () => {
      showToast('Failed to delete LIFF app', { type: 'error' })
    },
  })

  const handleDelete = async (liffId: string) => {
    const confirmed = await dialogConfirm({
      title: 'Delete LIFF app?',
      description: `This will permanently delete ${liffId}.`,
    })
    if (confirmed) {
      deleteApp.mutate(liffId)
    }
  }

  const apps = appsData?.apps ?? []
  const chan = channel?.channel

  return (
    <YStack gap="$6">
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
          {chan?.name ?? 'Login Channel'}
        </SizableText>
        <SizableText size="$2" color="$color10">›</SizableText>
        <SizableText size="$2" color="$color12" fontWeight="700">LIFF</SizableText>
      </XStack>

      {/* Tabs */}
      <XStack gap="$6" borderBottomWidth={1} borderColor="$borderColor" pb="$2">
        <SizableText
          size="$3"
          color="$color10"
          cursor="pointer"
          onPress={() => router.back()}
        >
          Settings
        </SizableText>
        <SizableText size="$3" fontWeight="700" color="$color12">
          LIFF
        </SizableText>
      </XStack>

      {/* Header row */}
      <XStack justify="space-between" items="center">
        <YStack>
          <SizableText size="$5" fontWeight="700" color="$color12">LIFF Apps</SizableText>
          <SizableText size="$2" color="$color10">{apps.length}/30 apps</SizableText>
        </YStack>
        <Button size="$2" onPress={() => setShowCreate(!showCreate)} disabled={apps.length >= 30}>
          Add LIFF App
        </Button>
      </XStack>

      {/* Create Form */}
      {showCreate && (
        <YStack
          gap="$3"
          p="$4"
          borderWidth={1}
          borderColor="$borderColor"
          rounded="$2"
          bg="$background"
        >
          <SizableText size="$3" fontWeight="600" color="$color12">New LIFF App</SizableText>
          <Controller
            control={control}
            name="endpointUrl"
            render={({ field: { onChange, value }, fieldState: { error } }) => (
              <Input
                value={value}
                onChangeText={onChange}
                placeholder="https://your-app.example.com"
                error={error?.message}
                size="$2"
              />
            )}
          />
          <Controller
            control={control}
            name="description"
            render={({ field: { onChange, value }, fieldState: { error } }) => (
              <Input
                value={value ?? ''}
                onChangeText={onChange}
                placeholder="Description (optional)"
                error={error?.message}
                size="$2"
              />
            )}
          />
          <XStack gap="$2" justify="flex-end">
            <Button size="$2" variant="outlined" onPress={() => { setShowCreate(false); reset() }}>
              Cancel
            </Button>
            <Button size="$2" onPress={handleSubmit((d) => createApp.mutate(d))} disabled={isSubmitting}>
              Create
            </Button>
          </XStack>
        </YStack>
      )}

      {/* Apps Table */}
      {isLoading ? (
        <YStack items="center" py="$10">
          <Spinner size="large" />
        </YStack>
      ) : apps.length === 0 ? (
        <YStack items="center" py="$10" gap="$3">
          <SizableText size="$4" color="$color10">No LIFF apps yet</SizableText>
          <SizableText size="$2" color="$color8">Add your first LIFF app to get started</SizableText>
        </YStack>
      ) : (
        <YStack gap="$2">
          {/* Table header */}
          <XStack
            px="$3"
            py="$2"
            borderWidth={1}
            borderColor="$borderColor"
            rounded="$2"
            bg="$color3"
            gap="$4"
          >
            <SizableText size="$2" fontWeight="600" color="$color10" flex={1}>LIFF ID</SizableText>
            <SizableText size="$2" fontWeight="600" color="$color10" width={80}>Type</SizableText>
            <SizableText size="$2" fontWeight="600" color="$color10" flex={2}>Endpoint URL</SizableText>
            <SizableText size="$2" fontWeight="600" color="$color10" width={60}></SizableText>
          </XStack>
          {apps.map((app) => (
            <XStack
              key={app.liffId}
              px="$3"
              py="$3"
              borderWidth={1}
              borderColor="$borderColor"
              rounded="$2"
              gap="$4"
              items="center"
            >
              <SizableText size="$2" color="$color12" fontFamily="$mono" flex={1} numberOfLines={1}>
                {app.liffId}
              </SizableText>
              <SizableText size="$2" color="$color10" width={80}>{app.viewType}</SizableText>
              <SizableText size="$2" color="$color12" flex={2} numberOfLines={1}>
                {app.endpointUrl}
              </SizableText>
              <Button
                size="$1"
                variant="outlined"
                width={60}
                onPress={() => handleDelete(app.liffId)}
                disabled={deleteApp.isPending}
              >
                Delete
              </Button>
            </XStack>
          ))}
        </YStack>
      )}
    </YStack>
  )
})

export default LiffAppsPage