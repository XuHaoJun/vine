import { useActiveParams, useRouter, createRoute } from 'one'
import { memo } from 'react'
import { SizableText, Spinner, XStack, YStack } from 'tamagui'

import { useTanQuery } from '~/query'
import { miniAppClient } from '~/features/mini-app/client'
import { Button } from '~/interface/buttons/Button'
import { CaretLeftIcon } from '~/interface/icons/phosphor/CaretLeftIcon'

const route = createRoute<'/(app)/developers/console/provider/[providerId]/mini-app'>()

export const MiniAppListPage = memo(() => {
  const params = useActiveParams<{ providerId: string }>()
  const router = useRouter()
  const providerId = params.providerId

  const { data, isLoading, isError } = useTanQuery({
    queryKey: ['mini-app', 'list', providerId],
    queryFn: () => miniAppClient.listMiniApps({ providerId }),
    enabled: !!providerId,
  })

  const miniApps = data?.miniApps ?? []

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
          Provider
        </SizableText>
        <SizableText size="$2" color="$color10">
          ›
        </SizableText>
        <SizableText size="$2" color="$color12" fontWeight="700">
          Mini Apps
        </SizableText>
      </XStack>

      {/* Page Header */}
      <XStack justify="space-between" items="center">
        <SizableText size="$8" fontWeight="700" color="$color12">
          Mini Apps
        </SizableText>
        <Button
          size="$2"
          onPress={() =>
            router.push(
              `/developers/console/provider/${providerId}/mini-app/new` as never,
            )
          }
        >
          New Mini App
        </Button>
      </XStack>

      {/* Content */}
      {isLoading ? (
        <YStack items="center" py="$10">
          <Spinner size="large" />
        </YStack>
      ) : isError ? (
        <YStack items="center" py="$10">
          <SizableText size="$3" color="$red10">
            Failed to load Mini Apps.
          </SizableText>
        </YStack>
      ) : miniApps.length === 0 ? (
        <YStack items="center" py="$10" gap="$3">
          <SizableText size="$3" color="$color10" text="center">
            No Mini Apps yet. Create one to wrap an existing LIFF app with a gallery-ready
            presence.
          </SizableText>
        </YStack>
      ) : (
        <XStack flexWrap="wrap" gap="$4">
          {miniApps.map((m) => (
            <YStack
              key={m.id}
              width={220}
              height={240}
              borderWidth={1}
              borderColor="$borderColor"
              rounded="$3"
              position="relative"
              cursor="pointer"
              hoverStyle={{ shadowColor: '$shadowColor', shadowRadius: 8 }}
              onPress={() =>
                router.push(
                  `/developers/console/provider/${providerId}/mini-app/${m.id}` as never,
                )
              }
            >
              {/* Published badge */}
              <XStack
                position="absolute"
                t="$2"
                r="$2"
                px="$2"
                py="$0.5"
                bg={m.isPublished ? '$green9' : '$color7'}
                rounded="$1"
              >
                <SizableText size="$1" color="white" fontWeight="700">
                  {m.isPublished ? 'Published' : 'Draft'}
                </SizableText>
              </XStack>

              <YStack flex={1} items="center" justify="center" gap="$4" pt="$6">
                {/* Icon Placeholder */}
                <YStack
                  width={64}
                  height={64}
                  rounded="$10"
                  bg="$color5"
                  items="center"
                  justify="center"
                  borderWidth={2}
                  borderColor="$borderColor"
                >
                  <SizableText size="$6" fontWeight="700" color="$color11">
                    {m.name.charAt(0).toUpperCase()}
                  </SizableText>
                </YStack>

                <SizableText size="$3" fontWeight="700" color="$color12" text="center">
                  {m.name}
                </SizableText>

                {m.category ? (
                  <XStack gap="$1.5" items="center">
                    <SizableText size="$2" color="$color10" fontWeight="500">
                      {m.category}
                    </SizableText>
                  </XStack>
                ) : null}
              </YStack>
            </YStack>
          ))}
        </XStack>
      )}
    </YStack>
  )
})

export default MiniAppListPage
