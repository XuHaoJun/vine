import { useState } from 'react'
import { router } from 'one'
import { ScrollView, SizableText, XStack, YStack } from 'tamagui'

import { Button } from '~/interface/buttons/Button'
import { Input } from '~/interface/forms/Input'
import { showToast } from '~/interface/toast/Toast'
import { useTanQuery, useTanMutation, useTanQueryClient } from '~/query'
import { stickerMarketDiscoveryClient, stickerMarketUserClient } from './client'
import { CheckoutSheet } from './CheckoutSheet'

type PackageDetailProps = {
  packageId: string
}

function StarRating({
  rating,
  interactive,
  onChange,
}: {
  rating: number
  interactive?: boolean
  onChange?: (r: number) => void
}) {
  return (
    <XStack gap="$1">
      {[1, 2, 3, 4, 5].map((star) => (
        <SizableText
          key={star}
          fontSize={16}
          color={star <= rating ? '$yellow9' : '$color5'}
          cursor={interactive ? 'pointer' : undefined}
          onPress={interactive ? () => onChange?.(star) : undefined}
          hoverStyle={interactive ? { scale: 1.2 } : undefined}
        >
          ★
        </SizableText>
      ))}
    </XStack>
  )
}

export function PackageDetail({ packageId }: PackageDetailProps) {
  const queryClient = useTanQueryClient()
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [reviewRating, setReviewRating] = useState(0)
  const [reviewBody, setReviewBody] = useState('')

  const { data, isLoading } = useTanQuery({
    queryKey: ['sticker-market', 'package-detail', packageId],
    queryFn: () => stickerMarketDiscoveryClient.getStickerPackageDetail({ packageId }),
  })

  const invalidateDetail = () => {
    queryClient.invalidateQueries({
      queryKey: ['sticker-market', 'package-detail', packageId],
    })
  }

  const pkg = data?.package

  const followMutation = useTanMutation({
    mutationFn: () =>
      stickerMarketUserClient.followCreator({ creatorId: pkg!.creator!.id }),
    onSuccess: () => {
      invalidateDetail()
      showToast('已追蹤創作者', { type: 'success' })
    },
  })

  const unfollowMutation = useTanMutation({
    mutationFn: () =>
      stickerMarketUserClient.unfollowCreator({ creatorId: pkg!.creator!.id }),
    onSuccess: () => {
      invalidateDetail()
      showToast('已取消追蹤', { type: 'success' })
    },
  })

  const reviewMutation = useTanMutation({
    mutationFn: (params: { rating: number; body: string }) =>
      stickerMarketUserClient.upsertStickerPackageReview({
        packageId,
        rating: params.rating,
        body: params.body,
      }),
    onSuccess: () => {
      setReviewBody('')
      setReviewRating(0)
      showToast('評價已送出', { type: 'success' })
    },
    onError: () => showToast('評價送出失敗', { type: 'error' }),
  })

  const deleteReviewMutation = useTanMutation({
    mutationFn: () => stickerMarketUserClient.deleteStickerPackageReview({ packageId }),
    onSuccess: () => {
      showToast('評價已刪除', { type: 'success' })
    },
  })

  if (isLoading || !pkg) {
    return (
      <YStack flex={1} items="center" justify="center">
        <SizableText size="$4" color="$color10">
          {isLoading ? '載入中...' : '找不到此貼圖套包'}
        </SizableText>
      </YStack>
    )
  }

  const priceDisplay = `${pkg.displayCurrency}${pkg.displayPriceMinor ?? pkg.priceMinor}`
  const creator = pkg.creator
  const rating = pkg.rating
  const currentUserReview = rating?.currentUserReview
  const tags = pkg.tags ?? []

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
          {pkg.name}
        </SizableText>
      </XStack>

      <ScrollView flex={1}>
        <YStack>
          <YStack height={240} bg="$color3" overflow="hidden">
            <img
              src={pkg.coverUrl}
              alt={pkg.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </YStack>

          <YStack p="$4" gap="$4">
            {/* Name + tags */}
            <YStack gap="$2">
              <XStack justify="space-between" items="flex-start">
                <YStack flex={1}>
                  <SizableText size="$6" fontWeight="700" color="$color12">
                    {pkg.name}
                  </SizableText>
                  {pkg.description ? (
                    <SizableText size="$3" color="$color10" mt="$1">
                      {pkg.description}
                    </SizableText>
                  ) : null}
                </YStack>
                <SizableText size="$5" fontWeight="700" color="$color12" ml="$4">
                  {priceDisplay}
                </SizableText>
              </XStack>

              {tags.length > 0 && (
                <XStack gap="$2" flexWrap="wrap">
                  {tags.map((tag: string) => (
                    <YStack key={tag} bg="$color3" rounded="$4" px="$3" py="$1">
                      <SizableText size="$2" color="$color11">
                        {tag}
                      </SizableText>
                    </YStack>
                  ))}
                </XStack>
              )}
            </YStack>

            {/* Creator card */}
            {creator && (
              <YStack
                bg="$color2"
                rounded="$4"
                p="$3"
                gap="$2"
                cursor="pointer"
                onPress={() => router.push(`/creators/${creator.id}` as any)}
                hoverStyle={{ bg: '$color3' }}
              >
                <XStack items="center" gap="$3">
                  <YStack
                    width={44}
                    height={44}
                    rounded={100}
                    bg="$color4"
                    overflow="hidden"
                  >
                    {creator.avatarUrl ? (
                      <img
                        src={creator.avatarUrl}
                        alt={creator.displayName}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <YStack flex={1} items="center" justify="center">
                        <SizableText size="$4" color="$color10">
                          {creator.displayName?.charAt(0) ?? '?'}
                        </SizableText>
                      </YStack>
                    )}
                  </YStack>
                  <YStack flex={1}>
                    <SizableText size="$4" fontWeight="700" color="$color12">
                      {creator.displayName}
                    </SizableText>
                    <SizableText size="$3" color="$color10">
                      {creator.followerCount} 位追蹤者
                    </SizableText>
                  </YStack>
                  <Button
                    size="$3"
                    variant={creator.followedByMe ? 'outlined' : 'default'}
                    onPress={(e: any) => {
                      e.stopPropagation()
                      if (creator.followedByMe) {
                        unfollowMutation.mutate()
                      } else {
                        followMutation.mutate()
                      }
                    }}
                  >
                    {creator.followedByMe ? '已追蹤' : '追蹤'}
                  </Button>
                </XStack>
              </YStack>
            )}

            {/* Rating summary */}
            {rating && (
              <YStack gap="$2">
                <SizableText size="$4" fontWeight="600" color="$color11">
                  評價
                </SizableText>
                <XStack items="center" gap="$2">
                  <StarRating rating={Math.round(rating.averageRating)} />
                  <SizableText size="$3" color="$color10">
                    {rating.averageRating.toFixed(1)} ({rating.totalCount})
                  </SizableText>
                </XStack>
              </YStack>
            )}

            {/* Review list preview */}
            {pkg.recentReviews && pkg.recentReviews.length > 0 && (
              <YStack gap="$2">
                <SizableText size="$4" fontWeight="600" color="$color11">
                  最新評價
                </SizableText>
                {pkg.recentReviews.slice(0, 3).map((review: any) => (
                  <YStack key={review.id} bg="$color2" rounded="$4" p="$3" gap="$1">
                    <XStack items="center" gap="$2">
                      <SizableText size="$3" fontWeight="600" color="$color12">
                        {review.userDisplayName}
                      </SizableText>
                      <StarRating rating={review.rating} />
                    </XStack>
                    {review.body && (
                      <SizableText size="$3" color="$color10">
                        {review.body}
                      </SizableText>
                    )}
                  </YStack>
                ))}
              </YStack>
            )}

            {/* Review editor for owners */}
            {pkg.owned && (
              <YStack gap="$2" bg="$color2" rounded="$4" p="$3">
                <SizableText size="$4" fontWeight="600" color="$color11">
                  {currentUserReview ? '編輯評價' : '寫評價'}
                </SizableText>
                {currentUserReview && (
                  <XStack items="center" gap="$2">
                    <StarRating rating={currentUserReview.rating} />
                    <Button
                      size="$2"
                      variant="transparent"
                      onPress={() => deleteReviewMutation.mutate()}
                    >
                      刪除
                    </Button>
                  </XStack>
                )}
                {!currentUserReview && (
                  <YStack gap="$2">
                    <StarRating
                      rating={reviewRating}
                      interactive
                      onChange={setReviewRating}
                    />
                    <Input
                      value={reviewBody}
                      onChangeText={setReviewBody}
                      placeholder="寫下你的評價..."
                      multiline
                    />
                    <Button
                      disabled={reviewRating === 0 || reviewMutation.isPending}
                      onPress={() =>
                        reviewMutation.mutate({ rating: reviewRating, body: reviewBody })
                      }
                    >
                      送出評價
                    </Button>
                  </YStack>
                )}
              </YStack>
            )}

            {/* Same-creator recommendations */}
            {pkg.sameCreatorPackages && pkg.sameCreatorPackages.length > 0 && (
              <YStack gap="$2">
                <SizableText size="$4" fontWeight="600" color="$color11">
                  同創作者更多作品
                </SizableText>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <XStack gap="$3">
                    {pkg.sameCreatorPackages.map((sp: any) => (
                      <YStack
                        key={sp.id}
                        width={120}
                        shrink={0}
                        bg="$color2"
                        rounded="$4"
                        overflow="hidden"
                        cursor="pointer"
                        onPress={() => router.push(`/store/${sp.id}` as any)}
                        hoverStyle={{ bg: '$color3' }}
                      >
                        <YStack height={90} bg="$color3" overflow="hidden">
                          <img
                            src={sp.coverUrl}
                            alt={sp.name}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        </YStack>
                        <YStack p="$2">
                          <SizableText
                            size="$2"
                            fontWeight="700"
                            color="$color12"
                            numberOfLines={1}
                          >
                            {sp.name}
                          </SizableText>
                          <SizableText size="$2" color="$color10">
                            {sp.displayCurrency}
                            {sp.displayPriceMinor ?? sp.priceMinor}
                          </SizableText>
                        </YStack>
                      </YStack>
                    ))}
                  </XStack>
                </ScrollView>
              </YStack>
            )}
          </YStack>
        </YStack>
      </ScrollView>

      <YStack
        px="$4"
        py="$3"
        borderTopWidth={1}
        borderTopColor="$color4"
        bg="$background"
      >
        {pkg.owned ? (
          <Button disabled>
            <SizableText>已擁有</SizableText>
          </Button>
        ) : (
          <Button theme="accent" onPress={() => setCheckoutOpen(true)}>
            立即購買 {priceDisplay}
          </Button>
        )}
      </YStack>

      {pkg && (
        <CheckoutSheet
          pkg={pkg as any}
          open={checkoutOpen}
          onOpenChange={setCheckoutOpen}
        />
      )}
    </YStack>
  )
}
