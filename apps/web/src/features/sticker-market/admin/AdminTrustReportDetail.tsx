import { useState } from 'react'
import { router } from 'one'
import { ScrollView, SizableText, XStack, YStack } from 'tamagui'

import { Button } from '~/interface/buttons/Button'
import { TextArea } from '~/interface/forms/TextArea'
import { showToast } from '~/interface/toast/Toast'
import { useTanMutation, useTanQuery, useTanQueryClient } from '~/query'
import { stickerMarketAdminClient } from './client'

type AdminTrustReportDetailProps = {
  reportId: string
}

export function AdminTrustReportDetail({ reportId }: AdminTrustReportDetailProps) {
  const queryClient = useTanQueryClient()
  const [reasonText, setReasonText] = useState('')

  const { data, isLoading } = useTanQuery({
    queryKey: ['sticker-market', 'admin', 'trust-report', reportId],
    queryFn: () => stickerMarketAdminClient.getTrustReportDetail({ reportId }),
  })

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: ['sticker-market', 'admin', 'trust-report', reportId],
    })

  const remove = useTanMutation({
    mutationFn: () =>
      stickerMarketAdminClient.forceRemoveStickerPackage({
        reportId,
        packageId: data!.report!.packageId,
        reasonText,
      }),
    onSuccess: () => {
      setReasonText('')
      invalidate()
      showToast('已下架貼圖', { type: 'success' })
    },
  })

  const restore = useTanMutation({
    mutationFn: () =>
      stickerMarketAdminClient.restoreStickerPackage({
        reportId,
        packageId: data!.report!.packageId,
        reasonText,
      }),
    onSuccess: () => {
      setReasonText('')
      invalidate()
      showToast('已恢復上架', { type: 'success' })
    },
  })

  const hold = useTanMutation({
    mutationFn: () =>
      stickerMarketAdminClient.holdCreatorPayouts({
        reportId,
        packageId: data!.report!.packageId,
        creatorId: data!.report!.creatorId,
        reasonText,
      }),
    onSuccess: () => {
      setReasonText('')
      invalidate()
      showToast('已暫停創作者提領', { type: 'success' })
    },
  })

  const clearHold = useTanMutation({
    mutationFn: () =>
      stickerMarketAdminClient.clearCreatorPayoutHold({
        reportId,
        packageId: data!.report!.packageId,
        creatorId: data!.report!.creatorId,
        reasonText,
      }),
    onSuccess: () => {
      setReasonText('')
      invalidate()
      showToast('已解除提領暫停', { type: 'success' })
    },
  })

  const markReviewing = useTanMutation({
    mutationFn: () =>
      stickerMarketAdminClient.markTrustReportReviewing({
        reportId,
        note: reasonText,
      }),
    onSuccess: () => {
      setReasonText('')
      invalidate()
      showToast('已標記處理中', { type: 'success' })
    },
  })

  const resolve = useTanMutation({
    mutationFn: () =>
      stickerMarketAdminClient.resolveTrustReport({
        reportId,
        resolutionText: reasonText,
      }),
    onSuccess: () => {
      setReasonText('')
      invalidate()
      showToast('已結案', { type: 'success' })
    },
  })

  const dismiss = useTanMutation({
    mutationFn: () =>
      stickerMarketAdminClient.dismissTrustReport({
        reportId,
        resolutionText: reasonText,
      }),
    onSuccess: () => {
      setReasonText('')
      invalidate()
      showToast('已標記不處理', { type: 'success' })
    },
  })

  const canAct = reasonText.trim().length > 0 && data?.report

  return (
    <YStack flex={1} bg="$background">
      <XStack px="$4" py="$3" items="center" gap="$3" borderBottomWidth={1} borderBottomColor="$color4">
        <YStack cursor="pointer" onPress={() => router.back()}>
          <SizableText size="$5" color="$color12">‹</SizableText>
        </YStack>
        <SizableText size="$5" fontWeight="700" color="$color12" flex={1}>
          回報詳情
        </SizableText>
      </XStack>
      <ScrollView flex={1}>
        <YStack p="$4" gap="$4">
          {isLoading && <SizableText color="$color10">載入中...</SizableText>}
          {data?.report && (
            <>
              <YStack gap="$2">
                <SizableText size="$6" fontWeight="700" color="$color12">
                  {data.report.packageName}
                </SizableText>
                <SizableText size="$3" color="$color10">
                  創作者：{data.report.creatorDisplayName || data.report.creatorId}
                </SizableText>
                <SizableText size="$3" color="$color10">
                  回報者：{data.report.reporterUserId}
                </SizableText>
                <SizableText size="$3" color="$color11">
                  {data.report.reasonText}
                </SizableText>
              </YStack>

              <XStack flexWrap="wrap" gap="$2">
                {data.assets.map((asset) => (
                  <YStack key={asset.id} width={72} height={88} rounded="$3" bg="$color2" items="center" justify="center">
                    <img src={`/uploads/${asset.driveKey}`} alt={`${asset.number}`} style={{ width: 64, height: 64, objectFit: 'contain' }} />
                  </YStack>
                ))}
              </XStack>

              <YStack gap="$2">
                <SizableText size="$4" fontWeight="600" color="$color11">
                  操作原因
                </SizableText>
                <TextArea value={reasonText} onChangeText={setReasonText} minH={96} />
              </YStack>

              <XStack gap="$2" flexWrap="wrap">
                <Button disabled={!canAct || markReviewing.isPending} onPress={() => markReviewing.mutate()}>
                  標記處理中
                </Button>
                <Button disabled={!canAct || resolve.isPending} onPress={() => resolve.mutate()}>
                  結案
                </Button>
                <Button disabled={!canAct || dismiss.isPending} variant="outlined" onPress={() => dismiss.mutate()}>
                  不處理
                </Button>
                <Button disabled={!canAct || remove.isPending} theme="red" onPress={() => remove.mutate()}>
                  強制下架
                </Button>
                <Button disabled={!canAct || restore.isPending} onPress={() => restore.mutate()}>
                  恢復上架
                </Button>
                <Button disabled={!canAct || hold.isPending || !data.report.creatorId} theme="red" onPress={() => hold.mutate()}>
                  暫停提領
                </Button>
                <Button disabled={!canAct || clearHold.isPending || !data.report.creatorId} onPress={() => clearHold.mutate()}>
                  解除提領暫停
                </Button>
              </XStack>

              <YStack gap="$2">
                <SizableText size="$4" fontWeight="600" color="$color11">
                  操作紀錄
                </SizableText>
                {data.events.map((event) => (
                  <YStack key={event.id} bg="$color2" rounded="$3" p="$2">
                    <SizableText size="$3" color="$color12">{event.action}</SizableText>
                    <SizableText size="$2" color="$color10">{event.createdAt}</SizableText>
                    {event.reasonText ? <SizableText size="$3" color="$color11">{event.reasonText}</SizableText> : null}
                  </YStack>
                ))}
              </YStack>
            </>
          )}
        </YStack>
      </ScrollView>
    </YStack>
  )
}
