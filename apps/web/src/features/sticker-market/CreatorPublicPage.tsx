import { useState } from 'react'
import { router } from 'one'
import { ScrollView, SizableText, XStack, YStack } from 'tamagui'

import { useAuth } from '~/features/auth/client/authClient'
import { Button } from '~/interface/buttons/Button'
import { showToast } from '~/interface/toast/Toast'
import { useTanQuery, useTanMutation } from '~/query'
import { stickerMarketDiscoveryClient, stickerMarketUserClient } from './client'

const TYPE_CHIPS = [
  { key: '', label: '全部' },
  { key: 'static', label: '靜態' },
]

type CreatorPublicPageProps = {
  creatorId: string
}

export function CreatorPublicPage({ creatorId }: CreatorPublicPageProps) {
  const [typeFilter, setTypeFilter] = useState('')

  const { data, isLoading } = useTanQuery({
    queryKey: ['sticker-market', 'creator-profile', creatorId],
    queryFn: () => stickerMarketDiscoveryClient.getCreatorPublicProfile({ creatorId }),
  })

  const followMutation = useTanMutation({
    mutationFn: () => stickerMarketUserClient.followCreator({ creatorId }),
    onSuccess: () => {
      showToast('已追蹤創作者', { type: 'success' })
    },
  })

  const unfollowMutation = useTanMutation({
    mutationFn: () => stickerMarketUserClient.unfollowCreator({ creatorId }),
    onSuccess: () => {
      showToast('已取消追蹤', { type: 'success' })
    },
  })

  if (isLoading || !data) {
    return (
      <YStack flex={1} items="center" justify="center">
        <SizableText size="$4" color="$color10">
          {isLoading ? '載入中...' : '找不到此創作者'}
        </SizableText>
      </YStack>
    )
  }

  const profile = data.profile
  const packages = (data.packages ?? []).filter(
    (p: any) => !typeFilter || p.stickerType === typeFilter,
  )

  return (
    <YStack flex={1} bg="$background">
      <XStack
        px="$4"
        py="$3"
        items="center"
        gap="$3"
        borderBottomWidth={1}
        borderBottomColor="$color4"
      >
        <YStack cursor="pointer" onPress={() => router.back()}>
          <SizableText size="$5" color="$color12">
            ‹
          </SizableText>
        </YStack>
        <SizableText
          size="$5"
          fontWeight="700"
          color="$color12"
          flex={1}
          numberOfLines={1}
        >
          {profile?.displayName ?? '創作者'}
        </SizableText>
      </XStack>

      <ScrollView flex={1}>
        <YStack p="$4" gap="$4">
          {/* Profile header */}
          {profile && (
            <YStack items="center" gap="$3" py="$4">
              <YStack width={80} height={80} rounded={100} bg="$color4" overflow="hidden">
                {profile.avatarUrl ? (
                  <img
                    src={profile.avatarUrl}
                    alt={profile.displayName}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <YStack flex={1} items="center" justify="center">
                    <SizableText size="$6" color="$color10">
                      {profile.displayName?.charAt(0) ?? '?'}
                    </SizableText>
                  </YStack>
                )}
              </YStack>
              <SizableText size="$6" fontWeight="700" color="$color12">
                {profile.displayName}
              </SizableText>
              {profile.bio && (
                <SizableText size="$3" color="$color10" text="center" maxW={300}>
                  {profile.bio}
                </SizableText>
              )}
              <SizableText size="$3" color="$color10">
                {profile.followerCount} 位追蹤者
              </SizableText>
              <Button
                variant={profile.followedByMe ? 'outlined' : 'default'}
                onPress={() => {
                  if (profile.followedByMe) {
                    unfollowMutation.mutate()
                  } else {
                    followMutation.mutate()
                  }
                }}
              >
                {profile.followedByMe ? '已追蹤' : '追蹤'}
              </Button>
            </YStack>
          )}

          {/* Type filter */}
          <XStack gap="$2">
            {TYPE_CHIPS.map((chip) => (
              <YStack
                key={chip.key}
                bg={typeFilter === chip.key ? '$color5' : '$color3'}
                rounded="$4"
                px="$3"
                py="$1"
                cursor="pointer"
                onPress={() => setTypeFilter(chip.key)}
              >
                <SizableText size="$3" color="$color12">
                  {chip.label}
                </SizableText>
              </YStack>
            ))}
          </XStack>

          {/* Package grid */}
          {packages.length === 0 && (
            <SizableText size="$4" color="$color10" text="center" mt="$4">
              尚無貼圖作品
            </SizableText>
          )}

          <XStack flexWrap="wrap" gap="$3">
            {packages.map((pkg: any) => (
              <YStack
                key={pkg.id}
                width="47%"
                bg="$color2"
                rounded="$4"
                overflow="hidden"
                cursor="pointer"
                onPress={() => router.push(`/store/${pkg.id}` as any)}
                hoverStyle={{ bg: '$color3' }}
              >
                <YStack height={140} bg="$color3" overflow="hidden">
                  <img
                    src={pkg.coverUrl}
                    alt={pkg.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </YStack>
                <YStack p="$3" gap="$1">
                  <SizableText
                    size="$3"
                    fontWeight="700"
                    color="$color12"
                    numberOfLines={1}
                  >
                    {pkg.name}
                  </SizableText>
                  <SizableText size="$2" color="$color10">
                    {pkg.displayCurrency}
                    {pkg.displayPriceMinor ?? pkg.priceMinor}
                  </SizableText>
                  {pkg.averageRating > 0 && (
                    <SizableText size="$2" color="$color10">
                      ★ {pkg.averageRating.toFixed(1)}
                    </SizableText>
                  )}
                </YStack>
              </YStack>
            ))}
          </XStack>
        </YStack>
      </ScrollView>
    </YStack>
  )
}
