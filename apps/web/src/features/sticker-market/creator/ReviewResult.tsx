import { Link } from 'one'
import { SizableText, XStack, YStack } from 'tamagui'

import { creatorProfileByUserId } from '@vine/zero-schema/queries/creatorProfile'
import { stickerPackageForCreator } from '@vine/zero-schema/queries/stickerPackage'
import { Button } from '~/interface/buttons/Button'
import { showToast } from '~/interface/toast/Toast'
import { useAuth } from '~/features/auth/client/authClient'
import { stickerMarketCreatorClient } from '~/features/sticker-market/creator/client'
import { useZeroQuery } from '~/zero/client'
import { useTanMutation } from '~/query'

export function ReviewResult({ packageId }: { packageId: string }) {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const [profile] = useZeroQuery(
    creatorProfileByUserId,
    { userId },
    { enabled: Boolean(userId) },
  )

  const [pkg] = useZeroQuery(
    stickerPackageForCreator,
    { packageId, creatorId: profile?.id ?? '' },
    { enabled: Boolean(packageId) && Boolean(profile?.id) },
  )

  const publish = useTanMutation({
    mutationFn: (id: string) =>
      stickerMarketCreatorClient.publishApprovedStickerPackage({ packageId: id }),
    onSuccess: () => {
      showToast('已上架', { type: 'success' })
    },
    onError: () => {
      showToast('上架失敗', { type: 'error' })
    },
  })

  if (!pkg) {
    return (
      <YStack flex={1} p="$4">
        <SizableText color="$color10">載入中…</SizableText>
      </YStack>
    )
  }

  const problemAssetNumbers = parseProblemAssetNumbers(pkg.reviewProblemAssetNumbers)

  return (
    <YStack flex={1} p="$4" gap="$4">
      <SizableText size="$6" fontWeight="700">
        {pkg.name}
      </SizableText>

      {pkg.status === 'in_review' && (
        <YStack gap="$2" p="$3" bg="$color2" rounded="$4">
          <SizableText size="$4" fontWeight="600">
            審核中
          </SizableText>
          <SizableText>
            提交日期：
            {pkg.submittedAt
              ? new Date(pkg.submittedAt).toLocaleDateString('zh-TW')
              : '—'}
          </SizableText>
          <SizableText color="$color10">預計 3 個工作天內完成審核</SizableText>
        </YStack>
      )}

      {pkg.status === 'rejected' && (
        <YStack gap="$2" p="$3" bg="$color2" rounded="$4">
          <SizableText size="$4" fontWeight="600" color="$red9">
            未通過審核
          </SizableText>
          {pkg.reviewReasonCategory && (
            <SizableText>類別：{pkg.reviewReasonCategory}</SizableText>
          )}
          {pkg.reviewReasonText && (
            <SizableText>原因：{pkg.reviewReasonText}</SizableText>
          )}
          {pkg.reviewSuggestion && (
            <SizableText>建議：{pkg.reviewSuggestion}</SizableText>
          )}
          {problemAssetNumbers.length > 0 && (
            <XStack gap="$1" flexWrap="wrap">
              <SizableText>問題素材編號：</SizableText>
              {problemAssetNumbers.map((n) => (
                <SizableText key={n} size="$2" color="$color10">
                  #{n}
                </SizableText>
              ))}
            </XStack>
          )}
        </YStack>
      )}

      {pkg.status === 'approved' && (
        <YStack gap="$2" p="$3" bg="$color2" rounded="$4">
          <SizableText size="$4" fontWeight="600" color="$green9">
            已核准
          </SizableText>
          <Button disabled={publish.isPending} onPress={() => publish.mutate(packageId)}>
            立即上架
          </Button>
        </YStack>
      )}

      {pkg.status === 'on_sale' && (
        <YStack gap="$2" p="$3" bg="$color2" rounded="$4">
          <SizableText size="$4" fontWeight="600" color="$green9">
            販售中
          </SizableText>
          <Link href={`/store/${packageId}`}>
            <SizableText color="$blue10">前往商店頁面</SizableText>
          </Link>
        </YStack>
      )}

      {pkg.status === 'draft' && (
        <YStack gap="$2" p="$3" bg="$color2" rounded="$4">
          <SizableText size="$4" fontWeight="600">
            草稿
          </SizableText>
          <SizableText color="$color10">尚未提交審核</SizableText>
        </YStack>
      )}
    </YStack>
  )
}

function parseProblemAssetNumbers(value: string) {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is number => Number.isInteger(item))
  } catch {
    return value
      .split(',')
      .map((item) => Number(item.trim()))
      .filter((item) => Number.isInteger(item))
  }
}
