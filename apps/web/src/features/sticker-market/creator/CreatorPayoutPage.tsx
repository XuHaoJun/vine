import { useState } from 'react'
import { SizableText, XStack, YStack } from 'tamagui'
import { Button } from '~/interface/buttons/Button'
import { Input } from '~/interface/forms/Input'
import { useTanMutation, useTanQuery, useTanQueryClient } from '~/query'
import {
  creatorPayoutAccountMutationKey,
  creatorPayoutOverviewQueryKey,
  formatTwdMinor,
  stickerMarketCreatorClient,
} from '~/features/sticker-market/creator/client'

const MIN_PAYOUT_MINOR = 300

const statusText: Record<string, string> = {
  requested: '審核中',
  approved: '已核准',
  exported: '已排入匯款批次',
  paid: '已匯款',
  rejected: '退件',
  failed: '匯款失敗',
}

type PayoutAccountForm = {
  legalName: string
  bankCode: string
  bankName: string
  branchName: string
  accountNumber: string
  accountNumberConfirmation: string
}

const emptyForm: PayoutAccountForm = {
  legalName: '',
  bankCode: '',
  bankName: '',
  branchName: '',
  accountNumber: '',
  accountNumberConfirmation: '',
}

export function CreatorPayoutPage() {
  const queryClient = useTanQueryClient()

  const overview = useTanQuery({
    queryKey: creatorPayoutOverviewQueryKey(),
    queryFn: () => stickerMarketCreatorClient.getCreatorPayoutOverview({}),
  })

  const [form, setForm] = useState<PayoutAccountForm>(emptyForm)
  const [showAccountForm, setShowAccountForm] = useState(false)

  const upsertMutation = useTanMutation({
    mutationKey: creatorPayoutAccountMutationKey(),
    mutationFn: (form: PayoutAccountForm) => {
      if (form.accountNumber !== form.accountNumberConfirmation) {
        throw new Error('兩次輸入的帳號不一致')
      }
      return stickerMarketCreatorClient.upsertCreatorPayoutAccount(form)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: creatorPayoutOverviewQueryKey() })
      setForm((prev) => ({ ...prev, accountNumber: '', accountNumberConfirmation: '' }))
      setShowAccountForm(false)
    },
  })

  const requestMutation = useTanMutation({
    mutationFn: () => stickerMarketCreatorClient.requestCreatorPayout({}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: creatorPayoutOverviewQueryKey() })
    },
  })

  const data = overview.data
  const bankAccount = data?.bankAccount
  const hasPending = (data?.history ?? []).some(
    (row) =>
      row.status === 'requested' ||
      row.status === 'approved' ||
      row.status === 'exported',
  )
  const availableMinor = data?.availableNetAmountMinor ?? 0
  const meetsMinimum = availableMinor >= MIN_PAYOUT_MINOR
  const canRequestPayout = !!bankAccount && meetsMinimum && !hasPending
  const shouldShowAccountForm = !bankAccount || showAccountForm

  const setField = (field: keyof PayoutAccountForm) => (value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }))

  return (
    <YStack flex={1} minW={0} p="$4" gap="$4">
      <SizableText size="$6" fontWeight="700">
        收款申請
      </SizableText>

      {overview.isLoading && <SizableText color="$color10">載入中...</SizableText>}
      {overview.isError && <SizableText color="$red10">收款資料載入失敗</SizableText>}

      {data && (
        <>
          <XStack flexWrap="wrap" gap="$3">
            <YStack flex={1} minW={200} p="$3" bg="$color2" rounded="$4" gap="$1">
              <SizableText size="$2" color="$color10">
                可申請金額
              </SizableText>
              <SizableText size="$6" fontWeight="700">
                {formatTwdMinor(availableMinor)}
              </SizableText>
            </YStack>
            <YStack flex={1} minW={200} p="$3" bg="$color2" rounded="$4" gap="$1">
              <SizableText size="$2" color="$color10">
                最低匯款門檻
              </SizableText>
              <SizableText size="$6" fontWeight="700">
                {formatTwdMinor(MIN_PAYOUT_MINOR)}
              </SizableText>
            </YStack>
          </XStack>

          <SizableText size="$2" color="$color10">
            目前為人工審核匯款，收款金額需達最低門檻方可提出申請。每週一統一處理上週申請。
          </SizableText>

          <YStack gap="$3">
            <SizableText size="$4" fontWeight="700">
              收款帳戶
            </SizableText>
            {bankAccount && !shouldShowAccountForm ? (
              <XStack
                p="$3"
                bg="$color2"
                rounded="$4"
                items="center"
                justify="space-between"
              >
                <SizableText>
                  {bankAccount.bankName} ···· {bankAccount.accountLast4}
                </SizableText>
                <Button
                  size="$3"
                  variant="outlined"
                  onPress={() => setShowAccountForm(true)}
                >
                  修改收款資訊
                </Button>
              </XStack>
            ) : (
              <YStack gap="$3" p="$3" bg="$color2" rounded="$4">
                <Input
                  value={form.legalName}
                  onChangeText={setField('legalName')}
                  placeholder="帳戶戶名"
                />
                <Input
                  value={form.bankCode}
                  onChangeText={setField('bankCode')}
                  placeholder="銀行代碼 (如 004)"
                />
                <Input
                  value={form.bankName}
                  onChangeText={setField('bankName')}
                  placeholder="銀行名稱"
                />
                <Input
                  value={form.branchName}
                  onChangeText={setField('branchName')}
                  placeholder="分行名稱"
                />
                <Input
                  value={form.accountNumber}
                  onChangeText={setField('accountNumber')}
                  placeholder="帳號"
                />
                <Input
                  value={form.accountNumberConfirmation}
                  onChangeText={setField('accountNumberConfirmation')}
                  placeholder="再次輸入帳號"
                />
                <XStack gap="$2" flexWrap="wrap">
                  {bankAccount && (
                    <Button
                      variant="outlined"
                      disabled={upsertMutation.isPending}
                      onPress={() => setShowAccountForm(false)}
                    >
                      取消
                    </Button>
                  )}
                  <Button
                    variant="default"
                    disabled={upsertMutation.isPending}
                    onPress={() => upsertMutation.mutate(form)}
                  >
                    {upsertMutation.isPending ? '儲存中...' : '儲存帳戶'}
                  </Button>
                </XStack>
                {upsertMutation.isError && (
                  <SizableText size="$2" color="$red9">
                    {(upsertMutation.error as Error)?.message ?? '儲存失敗'}
                  </SizableText>
                )}
              </YStack>
            )}
          </YStack>

          <Button
            variant="default"
            disabled={!canRequestPayout || requestMutation.isPending}
            onPress={() => requestMutation.mutate()}
          >
            {requestMutation.isPending
              ? '申請中...'
              : `申請人工匯款 ${formatTwdMinor(availableMinor)}`}
          </Button>
          {!bankAccount && (
            <SizableText size="$2" color="$color10">
              請先設定收款帳戶
            </SizableText>
          )}
          {bankAccount && !meetsMinimum && (
            <SizableText size="$2" color="$color10">
              尚未達到最低匯款門檻 {formatTwdMinor(MIN_PAYOUT_MINOR)}
            </SizableText>
          )}
          {bankAccount && hasPending && (
            <SizableText size="$2" color="$color10">
              已有待處理的匯款申請
            </SizableText>
          )}
          {requestMutation.isError && (
            <SizableText size="$2" color="$red9">
              {(requestMutation.error as Error)?.message ?? '申請失敗'}
            </SizableText>
          )}
          {requestMutation.isSuccess && (
            <SizableText size="$2" color="$green9">
              匯款申請已送出
            </SizableText>
          )}

          <YStack gap="$3">
            <SizableText size="$4" fontWeight="700">
              匯款紀錄
            </SizableText>
            {data.history.length === 0 && (
              <SizableText p="$3" color="$color10" bg="$color2" rounded="$4">
                尚無匯款紀錄
              </SizableText>
            )}
            {data.history.length > 0 && (
              <YStack bg="$color2" rounded="$4" overflow="hidden">
                <XStack px="$3" py="$2" gap="$3" bg="$color3">
                  <SizableText flex={1} fontWeight="600">
                    金額
                  </SizableText>
                  <SizableText width={80} fontWeight="600">
                    狀態
                  </SizableText>
                  <SizableText width={140} fontWeight="600">
                    申請時間
                  </SizableText>
                </XStack>
                {data.history.map((row) => (
                  <XStack
                    key={row.id}
                    px="$3"
                    py="$2"
                    gap="$3"
                    items="center"
                    borderBottomWidth={1}
                    borderBottomColor="$color4"
                  >
                    <SizableText flex={1}>
                      {formatTwdMinor(row.netAmountMinor)}
                    </SizableText>
                    <SizableText width={80}>
                      {statusText[row.status] ?? row.status}
                    </SizableText>
                    <SizableText width={140} size="$2" color="$color10">
                      {row.requestedAt}
                    </SizableText>
                  </XStack>
                ))}
              </YStack>
            )}
          </YStack>
        </>
      )}
    </YStack>
  )
}
