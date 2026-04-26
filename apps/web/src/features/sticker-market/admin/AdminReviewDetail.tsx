import { useState } from 'react'
import { router } from 'one'
import { Controller, useForm } from 'react-hook-form'
import { valibotResolver } from '@hookform/resolvers/valibot'
import { ScrollView, SizableText, XStack, YStack } from 'tamagui'
import * as v from 'valibot'

import { StickerPackageStatus } from '@vine/proto/stickerMarket'
import { Button } from '~/interface/buttons/Button'
import { Input } from '~/interface/forms/Input'
import { TextArea } from '~/interface/forms/TextArea'
import { showToast } from '~/interface/toast/Toast'
import { useTanMutation, useTanQuery, useTanQueryClient } from '~/query'
import { stickerMarketAdminClient } from '~/features/sticker-market/admin/client'

const rejectSchema = v.object({
  reasonCategory: v.pipe(v.string(), v.minLength(1, 'Category is required')),
  reasonText: v.pipe(v.string(), v.minLength(1, 'Reason is required')),
  suggestion: v.pipe(v.string(), v.minLength(1, 'Suggestion is required')),
  problemAssetNumbersText: v.string(),
})

type RejectFormData = v.InferOutput<typeof rejectSchema>

function parseProblemAssetNumbers(value: string) {
  return value
    .split(',')
    .map((item) => Number(item.trim()))
    .filter((num) => Number.isInteger(num) && num > 0)
}

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

type AdminReviewDetailProps = {
  packageId: string
}

export function AdminReviewDetail({ packageId }: AdminReviewDetailProps) {
  const queryClient = useTanQueryClient()
  const [showRejectForm, setShowRejectForm] = useState(false)

  const { data, isLoading } = useTanQuery({
    queryKey: ['sticker-market', 'admin', 'review-detail', packageId],
    queryFn: () => stickerMarketAdminClient.getStickerReviewDetail({ packageId }),
  })

  const approve = useTanMutation({
    mutationFn: () => stickerMarketAdminClient.approveStickerPackage({ packageId }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['sticker-market', 'admin', 'review-queue'],
      })
      queryClient.invalidateQueries({
        queryKey: ['sticker-market', 'admin', 'review-detail', packageId],
      })
      showToast('已通過審核', { type: 'success' })
      setShowRejectForm(false)
    },
    onError: () => {
      showToast('審核通過失敗', { type: 'error' })
    },
  })

  const reject = useTanMutation({
    mutationFn: (
      payload: Omit<RejectFormData, 'problemAssetNumbersText'> & {
        problemAssetNumbers: number[]
      },
    ) =>
      stickerMarketAdminClient.rejectStickerPackage({
        packageId,
        reasonCategory: payload.reasonCategory,
        reasonText: payload.reasonText,
        suggestion: payload.suggestion,
        problemAssetNumbers: payload.problemAssetNumbers,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['sticker-market', 'admin', 'review-queue'],
      })
      queryClient.invalidateQueries({
        queryKey: ['sticker-market', 'admin', 'review-detail', packageId],
      })
      showToast('已退回審核', { type: 'success' })
      setShowRejectForm(false)
    },
    onError: () => {
      showToast('審核退回失敗', { type: 'error' })
    },
  })

  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<RejectFormData>({
    resolver: valibotResolver(rejectSchema),
    defaultValues: {
      reasonCategory: '',
      reasonText: '',
      suggestion: '',
      problemAssetNumbersText: '',
    },
  })

  const onSubmitReject = (formData: RejectFormData) => {
    const problemAssetNumbers = parseProblemAssetNumbers(formData.problemAssetNumbersText)
    reject.mutate({
      reasonCategory: formData.reasonCategory,
      reasonText: formData.reasonText,
      suggestion: formData.suggestion,
      problemAssetNumbers,
    })
  }

  const pkg = data?.package

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
        <SizableText size="$5" fontWeight="700" color="$color12" flex={1}>
          審核詳情
        </SizableText>
      </XStack>

      <ScrollView flex={1}>
        <YStack p="$4" gap="$4">
          {isLoading && (
            <SizableText size="$4" color="$color10" text="center" mt="$8">
              載入中...
            </SizableText>
          )}

          {!isLoading && !pkg && (
            <SizableText size="$4" color="$color10" text="center" mt="$8">
              找不到套包
            </SizableText>
          )}

          {pkg && (
            <>
              <YStack gap="$2">
                <SizableText size="$6" fontWeight="700" color="$color12">
                  {pkg.name}
                </SizableText>
                <SizableText size="$3" color="$color10">
                  創作者：{pkg.creatorId}
                </SizableText>
                <SizableText size="$3" color="$color10">
                  貼圖數量：{pkg.stickerCount}
                </SizableText>
                <SizableText size="$3" color="$color10">
                  狀態：{getStatusLabel(pkg.status)}
                </SizableText>
                {pkg.description ? (
                  <SizableText size="$3" color="$color11" mt="$1">
                    {pkg.description}
                  </SizableText>
                ) : null}
              </YStack>

              <XStack gap="$3" flexWrap="wrap">
                {pkg.coverDriveKey ? (
                  <YStack gap="$2">
                    <SizableText size="$3" fontWeight="600" color="$color11">
                      封面
                    </SizableText>
                    <YStack
                      width={120}
                      height={120}
                      rounded="$3"
                      bg="$color3"
                      overflow="hidden"
                    >
                      <img
                        src={`/uploads/${pkg.coverDriveKey}`}
                        alt={`${pkg.name} cover`}
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                      />
                    </YStack>
                  </YStack>
                ) : null}
                {pkg.tabIconDriveKey ? (
                  <YStack gap="$2">
                    <SizableText size="$3" fontWeight="600" color="$color11">
                      分頁圖示
                    </SizableText>
                    <YStack
                      width={72}
                      height={72}
                      rounded="$3"
                      bg="$color3"
                      overflow="hidden"
                    >
                      <img
                        src={`/uploads/${pkg.tabIconDriveKey}`}
                        alt={`${pkg.name} tab icon`}
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                      />
                    </YStack>
                  </YStack>
                ) : null}
              </XStack>

              {data?.assets && data.assets.length > 0 && (
                <YStack gap="$2">
                  <SizableText size="$4" fontWeight="600" color="$color11">
                    貼圖素材
                  </SizableText>
                  <XStack flexWrap="wrap" gap="$2">
                    {data.assets.map((asset) => (
                      <YStack
                        key={asset.id}
                        width={72}
                        height={88}
                        rounded="$3"
                        bg="$color2"
                        items="center"
                        justify="center"
                        gap="$1"
                        overflow="hidden"
                      >
                        <img
                          src={`/uploads/${asset.driveKey}`}
                          alt={`${pkg.name} ${asset.number}`}
                          style={{ width: 64, height: 64, objectFit: 'contain' }}
                        />
                        <SizableText size="$1" color="$color10">
                          #{asset.number}
                        </SizableText>
                      </YStack>
                    ))}
                  </XStack>
                </YStack>
              )}

              {data?.latestValidation && data.latestValidation.length > 0 && (
                <YStack gap="$2">
                  <SizableText size="$4" fontWeight="600" color="$color11">
                    資產驗證結果
                  </SizableText>
                  {data.latestValidation.map((item) => (
                    <YStack
                      key={`${item.fileName}-${item.number}`}
                      bg="$color2"
                      rounded="$4"
                      p="$3"
                      gap="$1"
                    >
                      <SizableText size="$3" fontWeight="600" color="$color12">
                        {item.fileName} (#{item.number})
                      </SizableText>
                      <SizableText size="$2" color="$color10">
                        {item.level}: {item.code}
                      </SizableText>
                      <SizableText size="$2" color="$color10">
                        {item.message}
                      </SizableText>
                      <SizableText size="$2" color="$color10">
                        尺寸：{item.width}x{item.height}，大小：{item.sizeBytes} bytes
                      </SizableText>
                    </YStack>
                  ))}
                </YStack>
              )}

              <XStack gap="$3">
                <Button
                  flex={1}
                  theme="green"
                  disabled={approve.isPending}
                  onPress={() => approve.mutate()}
                >
                  通過
                </Button>
                <Button
                  flex={1}
                  theme="red"
                  disabled={reject.isPending}
                  onPress={() => setShowRejectForm(true)}
                >
                  退回
                </Button>
              </XStack>

              {showRejectForm && (
                <YStack gap="$3" p="$3" bg="$color2" rounded="$4">
                  <SizableText size="$4" fontWeight="600" color="$color12">
                    退回原因
                  </SizableText>

                  <Controller
                    control={control}
                    name="reasonCategory"
                    render={({ field: { onChange, value }, fieldState: { error } }) => (
                      <Input
                        value={value}
                        onChangeText={onChange}
                        placeholder="原因分類"
                        error={error?.message}
                      />
                    )}
                  />

                  <Controller
                    control={control}
                    name="reasonText"
                    render={({ field: { onChange, value }, fieldState: { error } }) => (
                      <TextArea
                        value={value}
                        onChangeText={onChange}
                        placeholder="退回原因"
                        error={error?.message}
                        numberOfLines={3}
                      />
                    )}
                  />

                  <Controller
                    control={control}
                    name="suggestion"
                    render={({ field: { onChange, value }, fieldState: { error } }) => (
                      <TextArea
                        value={value}
                        onChangeText={onChange}
                        placeholder="修改建議"
                        error={error?.message}
                        numberOfLines={3}
                      />
                    )}
                  />

                  <Controller
                    control={control}
                    name="problemAssetNumbersText"
                    render={({ field: { onChange, value }, fieldState: { error } }) => (
                      <Input
                        value={value}
                        onChangeText={onChange}
                        placeholder="問題貼圖編號（以逗號分隔，例如：1, 3, 5）"
                        error={error?.message}
                      />
                    )}
                  />

                  <XStack gap="$3">
                    <Button
                      flex={1}
                      variant="outlined"
                      onPress={() => setShowRejectForm(false)}
                    >
                      取消
                    </Button>
                    <Button
                      flex={1}
                      theme="red"
                      disabled={isSubmitting || reject.isPending}
                      onPress={handleSubmit(onSubmitReject)}
                    >
                      確認退回
                    </Button>
                  </XStack>
                </YStack>
              )}
            </>
          )}
        </YStack>
      </ScrollView>
    </YStack>
  )
}
