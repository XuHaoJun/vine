import { useActiveParams, useRouter, createRoute } from 'one'
import { memo, useState, useEffect } from 'react'
import { SizableText, Spinner, XStack, YStack } from 'tamagui'
import { Switch } from '~/interface/forms/Switch'

import { useTanMutation, useTanQuery, useTanQueryClient } from '~/query'
import { miniAppClient } from '~/features/mini-app/client'
import { liffClient } from '~/features/liff/client'
import { Button } from '~/interface/buttons/Button'
import { CaretLeftIcon } from '~/interface/icons/phosphor/CaretLeftIcon'
import { CopyIcon } from '~/interface/icons/phosphor/CopyIcon'
import { ArrowUpRightIcon } from '~/interface/icons/phosphor/ArrowUpRightIcon'
import { Input } from '~/interface/forms/Input'
import { showToast } from '~/interface/toast/Toast'
import { dialogConfirm, showError } from '~/interface/dialogs/actions'

const route =
  createRoute<'/(app)/developers/console/provider/[providerId]/mini-app/[miniAppId]'>()

export const MiniAppSettingsPage = memo(() => {
  const params = useActiveParams<{ providerId: string; miniAppId: string }>()
  const router = useRouter()
  const qc = useTanQueryClient()
  const { providerId, miniAppId } = params

  const [name, setName] = useState('')
  const [iconUrl, setIconUrl] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')

  const { data, isLoading, isError } = useTanQuery({
    queryKey: ['mini-app', 'detail', miniAppId],
    queryFn: () => miniAppClient.getMiniApp({ id: miniAppId }),
    enabled: !!miniAppId,
  })

  const miniApp = data?.miniApp

  // Sync form fields when miniApp loads
  useEffect(() => {
    if (!miniApp) return
    setName(miniApp.name)
    setIconUrl(miniApp.iconUrl ?? '')
    setDescription(miniApp.description ?? '')
    setCategory(miniApp.category ?? '')
  }, [miniApp])

  // Fetch the underlying LIFF app
  const { data: liffData } = useTanQuery({
    queryKey: ['liff', 'app', miniApp?.liffAppId],
    queryFn: () => liffClient.getLiffApp({ liffId: miniApp!.liffAppId }),
    enabled: !!miniApp?.liffAppId,
  })

  const liffApp = liffData?.app

  const updateMiniApp = useTanMutation({
    mutationFn: () =>
      miniAppClient.updateMiniApp({
        id: miniAppId,
        name: name.trim() || undefined,
        iconUrl: iconUrl.trim() || undefined,
        description: description.trim() || undefined,
        category: category.trim() || undefined,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['mini-app', 'detail', miniAppId] })
      showToast('Saved', { type: 'success' })
    },
    onError: (e) => showError(e, 'Failed to save'),
  })

  const publishMutation = useTanMutation({
    mutationFn: () => miniAppClient.publishMiniApp({ id: miniAppId }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['mini-app', 'detail', miniAppId] })
      showToast('Published', { type: 'success' })
    },
    onError: (e) => showError(e, 'Failed to publish'),
  })

  const unpublishMutation = useTanMutation({
    mutationFn: () => miniAppClient.unpublishMiniApp({ id: miniAppId }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['mini-app', 'detail', miniAppId] })
      showToast('Unpublished', { type: 'success' })
    },
    onError: (e) => showError(e, 'Failed to unpublish'),
  })

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).then(
      () => showToast('Copied', { type: 'info' }),
      () => showToast('Copy failed', { type: 'error' }),
    )
  }

  const handleTogglePublish = async () => {
    if (!miniApp) return
    const isPublished = miniApp.isPublished

    if (!isPublished) {
      const confirmed = await dialogConfirm({
        title: 'Publish Mini App?',
        description:
          'Publishing makes this Mini App visible in the public directory and lets it send Service Messages. You can unpublish at any time.',
      })
      if (confirmed) publishMutation.mutate()
    } else {
      const confirmed = await dialogConfirm({
        title: 'Unpublish Mini App?',
        description:
          'Unpublishing removes this Mini App from the public directory and disables Service Messages. You can republish at any time.',
      })
      if (confirmed) unpublishMutation.mutate()
    }
  }

  const isPendingToggle = publishMutation.isPending || unpublishMutation.isPending

  const miniAppLink = `/m/${miniAppId}`

  return (
    <YStack gap="$6" maxW={560}>
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
          Settings
        </SizableText>
      </XStack>

      {isLoading ? (
        <YStack items="center" py="$10">
          <Spinner size="large" />
        </YStack>
      ) : isError || !miniApp ? (
        <YStack items="center" py="$10">
          <SizableText size="$3" color="$red10">
            Mini App not found.
          </SizableText>
        </YStack>
      ) : (
        <YStack gap="$6">
          {/* Page Header with publish toggle */}
          <XStack justify="space-between" items="center">
            <SizableText size="$8" fontWeight="700" color="$color12">
              {miniApp.name}
            </SizableText>
            <XStack items="center" gap="$2">
              <SizableText size="$2" color="$color10">
                {miniApp.isPublished ? 'Published' : 'Draft'}
              </SizableText>
              <Switch
                size="$2"
                checked={miniApp.isPublished}
                onCheckedChange={handleTogglePublish}
                disabled={isPendingToggle}
              />
            </XStack>
          </XStack>

          {/* Read-only info */}
          <YStack
            gap="$3"
            p="$4"
            borderWidth={1}
            borderColor="$borderColor"
            rounded="$3"
            bg="$color2"
          >
            <SizableText size="$2" fontWeight="600" color="$color11">
              App Info
            </SizableText>

            {/* Mini App ID */}
            <YStack gap="$1">
              <SizableText size="$1" color="$color10">
                Mini App ID
              </SizableText>
              <XStack items="center" gap="$1">
                <SizableText size="$2" color="$color12" fontFamily="$mono" flex={1}>
                  {miniApp.id}
                </SizableText>
                <Button
                  size="$1"
                  variant="transparent"
                  circular
                  onPress={() => handleCopy(miniApp.id)}
                  icon={<CopyIcon size={13} />}
                  aria-label="Copy Mini App ID"
                />
              </XStack>
            </YStack>

            {/* Permanent link */}
            <YStack gap="$1">
              <SizableText size="$1" color="$color10">
                Permanent link
              </SizableText>
              <XStack items="center" gap="$1">
                <SizableText size="$2" color="$color12" fontFamily="$mono" flex={1}>
                  {miniAppLink}
                </SizableText>
                <Button
                  size="$1"
                  variant="transparent"
                  circular
                  onPress={() => handleCopy(miniAppLink)}
                  icon={<CopyIcon size={13} />}
                  aria-label="Copy permanent link"
                />
              </XStack>
            </YStack>

            {/* Underlying LIFF app */}
            {liffApp ? (
              <YStack gap="$1">
                <SizableText size="$1" color="$color10">
                  Underlying LIFF App
                </SizableText>
                <XStack items="center" gap="$2">
                  <SizableText size="$2" color="$color12" flex={1} numberOfLines={1}>
                    {liffApp.endpointUrl}
                  </SizableText>
                  <Button
                    size="$1"
                    variant="outlined"
                    iconAfter={<ArrowUpRightIcon size={12} />}
                    onPress={() =>
                      router.push(
                        `/developers/console/login-channel/${liffApp.loginChannelId}/liff` as never,
                      )
                    }
                  >
                    Configure
                  </Button>
                </XStack>
              </YStack>
            ) : null}
          </YStack>

          {/* Editable fields */}
          <YStack gap="$4">
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

            {/* Icon URL */}
            <YStack gap="$2">
              <SizableText size="$2" color="$color11" fontWeight="600">
                Icon URL
              </SizableText>
              <Input
                value={iconUrl}
                onChangeText={setIconUrl}
                placeholder="https://example.com/icon.png"
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
          </YStack>

          {/* Actions */}
          <XStack gap="$2" justify="space-between" items="center" mt="$2">
            <Button
              size="$2"
              variant="outlined"
              iconAfter={<ArrowUpRightIcon size={12} />}
              onPress={() =>
                router.push(
                  `/developers/console/provider/${providerId}/mini-app/${miniAppId}/oa-links` as never,
                )
              }
            >
              Linked OAs
            </Button>
            <Button
              size="$2"
              onPress={() => updateMiniApp.mutate()}
              disabled={!name.trim() || updateMiniApp.isPending}
            >
              {updateMiniApp.isPending ? 'Saving…' : 'Save'}
            </Button>
          </XStack>
        </YStack>
      )}
    </YStack>
  )
})

export default MiniAppSettingsPage
