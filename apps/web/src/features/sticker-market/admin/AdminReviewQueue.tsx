import { router } from 'one'
import { ScrollView, SizableText, XStack, YStack } from 'tamagui'

import { StickerPackageStatus } from '@vine/proto/stickerMarket'
import { useTanQuery } from '~/query'
import { stickerMarketAdminClient } from '~/features/sticker-market/admin/client'

function getStatusLabel(status: StickerPackageStatus) {
  switch (status) {
    case StickerPackageStatus.DRAFT:
      return '草稿'
    case StickerPackageStatus.IN_REVIEW:
      return '審核中'
    case StickerPackageStatus.APPROVED:
      return '已通過'
    case StickerPackageStatus.REJECTED:
      return '未通過'
    case StickerPackageStatus.ON_SALE:
      return '上架中'
    case StickerPackageStatus.UNLISTED:
      return '已下架'
    case StickerPackageStatus.REMOVED:
      return '已移除'
    default:
      return '未知'
  }
}

export function AdminReviewQueue() {
  const { data, isLoading } = useTanQuery({
    queryKey: ['sticker-market', 'admin', 'review-queue'],
    queryFn: () => stickerMarketAdminClient.listStickerReviewQueue({ limit: 50 }),
  })

  const packages = data?.packages ?? []

  return (
    <YStack flex={1} bg="$background">
      <XStack
        px="$4"
        py="$3"
        items="center"
        borderBottomWidth={1}
        borderBottomColor="$color4"
      >
        <SizableText size="$6" fontWeight="700" color="$color12">
          貼圖審核佇列
        </SizableText>
      </XStack>

      <ScrollView flex={1}>
        <YStack p="$4" gap="$3">
          {isLoading && (
            <SizableText size="$4" color="$color10" text="center" mt="$8">
              載入中...
            </SizableText>
          )}
          {!isLoading && packages.length === 0 && (
            <SizableText size="$4" color="$color10" text="center" mt="$8">
              尚無待審核項目
            </SizableText>
          )}
          {packages.map((pkg) => (
            <YStack
              key={pkg.id}
              bg="$color2"
              rounded="$4"
              p="$3"
              gap="$2"
              cursor="pointer"
              onPress={() => router.push(`/admin/sticker-reviews/${pkg.id}` as any)}
              hoverStyle={{ bg: '$color3' }}
            >
              <XStack justify="space-between" items="center">
                <SizableText size="$4" fontWeight="700" color="$color12">
                  {pkg.name}
                </SizableText>
                <YStack bg="$color4" rounded="$2" px="$2" py="$1">
                  <SizableText size="$2" color="$color11">
                    {getStatusLabel(pkg.status)}
                  </SizableText>
                </YStack>
              </XStack>
              <SizableText size="$3" color="$color10">
                創作者：{pkg.creatorId}
              </SizableText>
              <SizableText size="$3" color="$color10">
                貼圖數量：{pkg.stickerCount}
              </SizableText>
            </YStack>
          ))}
        </YStack>
      </ScrollView>
    </YStack>
  )
}
