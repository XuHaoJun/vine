import { useState } from 'react'
import { ScrollView, SizableText, XStack, YStack } from 'tamagui'

import { Button } from '~/interface/buttons/Button'
import { Input } from '~/interface/forms/Input'
import { showToast } from '~/interface/toast/Toast'
import { useTanMutation, useTanQuery, useTanQueryClient } from '~/query'
import { stickerMarketAdminClient } from '~/features/sticker-market/admin/client'

const statusText: Record<string, string> = {
  requested: '審核中',
  approved: '已核准',
  exported: '已排入匯款批次',
  paid: '已匯款',
  rejected: '退件',
  failed: '匯款失敗',
}

function downloadCsv(fileName: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

export function AdminPayoutsPage() {
  const queryClient = useTanQueryClient()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [batchId, setBatchId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectingId, setRejectingId] = useState<string | null>(null)

  const { data, isLoading } = useTanQuery({
    queryKey: ['sticker-market', 'admin', 'payouts'],
    queryFn: () => stickerMarketAdminClient.listPayoutRequests({ limit: 100 }),
  })

  const requests = data?.requests ?? []

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['sticker-market', 'admin', 'payouts'] })
  }

  const approveMutation = useTanMutation({
    mutationFn: (payoutRequestId: string) =>
      stickerMarketAdminClient.approvePayoutRequest({ payoutRequestId }),
    onSuccess: () => {
      invalidate()
      showToast('已核准', { type: 'success' })
    },
    onError: () => showToast('核准失敗', { type: 'error' }),
  })

  const rejectMutation = useTanMutation({
    mutationFn: (params: { payoutRequestId: string; reason: string }) =>
      stickerMarketAdminClient.rejectPayoutRequest(params),
    onSuccess: () => {
      invalidate()
      setRejectingId(null)
      setRejectReason('')
      showToast('已退件', { type: 'success' })
    },
    onError: () => showToast('退件失敗', { type: 'error' }),
  })

  const createBatchMutation = useTanMutation({
    mutationFn: (payoutRequestIds: string[]) =>
      stickerMarketAdminClient.createPayoutBatch({ payoutRequestIds }),
    onSuccess: (res) => {
      setBatchId(res.batchId)
      setSelectedIds(new Set())
      invalidate()
      showToast('已建立匯款批次', { type: 'success' })
    },
    onError: () => showToast('建立批次失敗', { type: 'error' }),
  })

  const exportMutation = useTanMutation({
    mutationFn: (bid: string) =>
      stickerMarketAdminClient.exportPayoutBatch({ batchId: bid }),
    onSuccess: (res, bid) => {
      downloadCsv(`vine-payout-${bid}.csv`, res.csv)
      setBatchId(null)
      showToast('已下載 CSV', { type: 'success' })
    },
    onError: () => showToast('匯出失敗', { type: 'error' }),
  })

  const markPaidMutation = useTanMutation({
    mutationFn: (params: {
      payoutRequestId: string
      bankTransactionId: string
      paidAt: string
    }) => stickerMarketAdminClient.markPayoutPaid(params),
    onSuccess: () => {
      invalidate()
      showToast('已標記匯款', { type: 'success' })
    },
    onError: () => showToast('標記失敗', { type: 'error' }),
  })

  const markFailedMutation = useTanMutation({
    mutationFn: (params: { payoutRequestId: string; reason: string }) =>
      stickerMarketAdminClient.markPayoutFailed(params),
    onSuccess: () => {
      invalidate()
      showToast('已標記匯款失敗', { type: 'success' })
    },
    onError: () => showToast('標記失敗', { type: 'error' }),
  })

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedIds(next)
  }

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
          創作者收益匯款
        </SizableText>
      </XStack>

      <ScrollView flex={1}>
        <YStack p="$4" gap="$3">
          {isLoading && (
            <SizableText size="$4" color="$color10" mt="$8">
              載入中...
            </SizableText>
          )}
          {!isLoading && requests.length === 0 && (
            <SizableText size="$4" color="$color10" mt="$8">
              尚無待處理申請
            </SizableText>
          )}

          {!isLoading && requests.length === 0 && (
            <SizableText size="$4" color="$color10" mt="$8">
              尚無匯款申請
            </SizableText>
          )}

          {requests.map((req) => (
            <YStack key={req.id} bg="$color2" rounded="$4" p="$3" gap="$2">
              <XStack justify="space-between" items="center">
                <SizableText size="$4" fontWeight="700" color="$color12">
                  {req.id}
                </SizableText>
                <YStack bg="$color4" rounded="$2" px="$2" py="$1">
                  <SizableText size="$2" color="$color11">
                    {statusText[req.status] ?? req.status}
                  </SizableText>
                </YStack>
              </XStack>

              {req.payoutHold?.held && (
                <YStack bg="$red3" rounded="$3" p="$2">
                  <SizableText size="$3" color="$red11">
                    提領暫停：{req.payoutHold?.reason}
                  </SizableText>
                </YStack>
              )}

              <XStack gap="$2" items="center">
                <SizableText size="$3" color="$color10">
                  {req.currency} {(req.netAmountMinor / 100).toFixed(2)}
                </SizableText>
                <SizableText size="$3" color="$color10">
                  申請時間：{req.requestedAt}
                </SizableText>
              </XStack>

              {req.status === 'requested' && (
                <XStack gap="$2">
                  <Button
                    size="$3"
                    theme="green"
                    disabled={Boolean(req.payoutHold?.held) || approveMutation.isPending}
                    onPress={() => approveMutation.mutate(req.id)}
                  >
                    核准
                  </Button>
                  <Button size="$3" theme="red" onPress={() => setRejectingId(req.id)}>
                    退件
                  </Button>
                </XStack>
              )}

              {rejectingId === req.id && (
                <YStack gap="$2" p="$2" bg="$color3" rounded="$3">
                  <Input
                    value={rejectReason}
                    onChangeText={setRejectReason}
                    placeholder="退件原因"
                  />
                  <XStack gap="$2">
                    <Button
                      size="$3"
                      variant="outlined"
                      onPress={() => {
                        setRejectingId(null)
                        setRejectReason('')
                      }}
                    >
                      取消
                    </Button>
                    <Button
                      size="$3"
                      theme="red"
                      disabled={!rejectReason.trim() || rejectMutation.isPending}
                      onPress={() =>
                        rejectMutation.mutate({
                          payoutRequestId: req.id,
                          reason: rejectReason.trim(),
                        })
                      }
                    >
                      確認退件
                    </Button>
                  </XStack>
                </YStack>
              )}

              {req.status === 'approved' && (
                <Button
                  size="$3"
                  variant={selectedIds.has(req.id) ? 'default' : 'outlined'}
                  disabled={Boolean(req.payoutHold?.held)}
                  onPress={() => toggleSelect(req.id)}
                >
                  {selectedIds.has(req.id) ? '已選取' : '選取'}
                </Button>
              )}

              {req.status === 'exported' && (
                <XStack gap="$2">
                  <Button
                    size="$3"
                    theme="green"
                    disabled={Boolean(req.payoutHold?.held) || markPaidMutation.isPending}
                    onPress={() => {
                      const bankTransactionId = prompt('輸入銀行交易序號')
                      if (!bankTransactionId) return
                      const paidAt =
                        prompt('輸入匯款日期 (YYYY-MM-DD)') ??
                        new Date().toISOString().slice(0, 10)
                      markPaidMutation.mutate({
                        payoutRequestId: req.id,
                        bankTransactionId,
                        paidAt,
                      })
                    }}
                  >
                    標記已匯款
                  </Button>
                  <Button
                    size="$3"
                    theme="red"
                    disabled={markFailedMutation.isPending}
                    onPress={() => {
                      const reason = prompt('輸入失敗原因')
                      if (!reason) return
                      markFailedMutation.mutate({
                        payoutRequestId: req.id,
                        reason,
                      })
                    }}
                  >
                    標記匯款失敗
                  </Button>
                </XStack>
              )}
            </YStack>
          ))}

          {requests.length > 0 && (
            <XStack gap="$3" pt="$2" flexWrap="wrap">
              <Button
                disabled={selectedIds.size === 0 || createBatchMutation.isPending}
                onPress={() => createBatchMutation.mutate(Array.from(selectedIds))}
              >
                建立匯款批次 ({selectedIds.size})
              </Button>
              {batchId && (
                <Button
                  disabled={exportMutation.isPending}
                  onPress={() => exportMutation.mutate(batchId)}
                >
                  下載 CSV
                </Button>
              )}
            </XStack>
          )}
        </YStack>
      </ScrollView>
    </YStack>
  )
}
