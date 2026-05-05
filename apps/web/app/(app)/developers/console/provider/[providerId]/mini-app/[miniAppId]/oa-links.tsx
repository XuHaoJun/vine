import { useActiveParams, useRouter, createRoute } from 'one'
import { memo } from 'react'
import { SizableText, Spinner, XStack, YStack } from 'tamagui'

import { useTanMutation, useTanQuery, useTanQueryClient } from '~/query'
import { miniAppClient } from '~/features/mini-app/client'
import { oaClient } from '~/features/oa/client'
import { Button } from '~/interface/buttons/Button'
import { CaretLeftIcon } from '~/interface/icons/phosphor/CaretLeftIcon'
import { showToast } from '~/interface/toast/Toast'
import { showError } from '~/interface/dialogs/actions'

const route =
  createRoute<'/(app)/developers/console/provider/[providerId]/mini-app/[miniAppId]/oa-links'>()

export const MiniAppOaLinksPage = memo(() => {
  const params = useActiveParams<{ providerId: string; miniAppId: string }>()
  const router = useRouter()
  const qc = useTanQueryClient()
  const { miniAppId } = params

  const { data: miniAppData, isLoading: isLoadingMiniApp, isError: isMiniAppError } = useTanQuery({
    queryKey: ['mini-app', 'detail', miniAppId],
    queryFn: () => miniAppClient.getMiniApp({ id: miniAppId }),
    enabled: !!miniAppId,
  })

  const { data: oasData, isLoading: isLoadingOas } = useTanQuery({
    queryKey: ['oa', 'my-accounts'],
    queryFn: () => oaClient.listMyOfficialAccounts({}),
  })

  const miniApp = miniAppData?.miniApp
  const accounts = oasData?.accounts ?? []

  const linkMutation = useTanMutation({
    mutationFn: (oaId: string) => miniAppClient.linkOa({ miniAppId, oaId }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['mini-app', 'detail', miniAppId] })
      showToast('OA linked', { type: 'success' })
    },
    onError: (e) => showError(e, 'Failed to link OA'),
  })

  const unlinkMutation = useTanMutation({
    mutationFn: (oaId: string) => miniAppClient.unlinkOa({ miniAppId, oaId }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['mini-app', 'detail', miniAppId] })
      showToast('OA unlinked', { type: 'success' })
    },
    onError: (e) => showError(e, 'Failed to unlink OA'),
  })

  const isPending = linkMutation.isPending || unlinkMutation.isPending
  const isLoading = isLoadingMiniApp || isLoadingOas

  return (
    <YStack gap="$6" maxWidth={560}>
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
          Linked OAs
        </SizableText>
      </XStack>

      {isLoading ? (
        <YStack items="center" py="$10">
          <Spinner size="large" />
        </YStack>
      ) : isMiniAppError || !miniApp ? (
        <YStack items="center" py="$10">
          <SizableText size="$3" color="$red10">
            Mini App not found.
          </SizableText>
        </YStack>
      ) : (
        <YStack gap="$6">
          {/* Header */}
          <YStack gap="$2">
            <SizableText size="$8" fontWeight="700" color="$color12">
              {miniApp.name}
            </SizableText>
            <SizableText size="$3" color="$color10">
              Linked OAs surface this Mini App on their profile and in users' 'From your OAs'
              gallery.
            </SizableText>
          </YStack>

          {/* OA list */}
          {accounts.length === 0 ? (
            <YStack
              p="$4"
              borderWidth={1}
              borderColor="$borderColor"
              rounded="$3"
              items="center"
              gap="$2"
            >
              <SizableText size="$3" color="$color10">
                No Official Accounts found.
              </SizableText>
              <SizableText size="$2" color="$color9">
                Create an OA in the Manager section first.
              </SizableText>
            </YStack>
          ) : (
            <YStack
              borderWidth={1}
              borderColor="$borderColor"
              rounded="$3"
              overflow="hidden"
            >
              {accounts.map((oa, i) => {
                const isLinked = miniApp.linkedOaIds.includes(oa.id)
                return (
                  <XStack
                    key={oa.id}
                    px="$4"
                    py="$3"
                    items="center"
                    justify="space-between"
                    borderBottomWidth={i < accounts.length - 1 ? 1 : 0}
                    borderBottomColor="$borderColor"
                  >
                    <YStack gap="$1" flex={1} mr="$3">
                      <SizableText size="$3" color="$color12" fontWeight="600">
                        {oa.name}
                      </SizableText>
                      <SizableText size="$2" color="$color10">
                        @{oa.uniqueId}
                      </SizableText>
                    </YStack>
                    <Button
                      size="$2"
                      variant={isLinked ? 'outlined' : undefined}
                      disabled={isPending}
                      onPress={() =>
                        isLinked ? unlinkMutation.mutate(oa.id) : linkMutation.mutate(oa.id)
                      }
                    >
                      {isLinked ? 'Unlink' : 'Link'}
                    </Button>
                  </XStack>
                )
              })}
            </YStack>
          )}
        </YStack>
      )}
    </YStack>
  )
})

export default MiniAppOaLinksPage
