import { useState } from 'react'
import { Dialog, SizableText, XStack, YStack } from 'tamagui'

import { Button } from '~/interface/buttons/Button'
import { TextArea } from '~/interface/forms/TextArea'
import { showToast } from '~/interface/toast/Toast'
import { useTanMutation } from '~/query'
import { stickerMarketUserClient } from './client'

const categories = [
  { value: 'copyright', label: '侵權' },
  { value: 'prohibited_content', label: '違禁內容' },
  { value: 'fraud', label: '詐欺' },
  { value: 'other', label: '其他' },
] as const

type ReportStickerPackageDialogProps = {
  packageId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ReportStickerPackageDialog({
  packageId,
  open,
  onOpenChange,
}: ReportStickerPackageDialogProps) {
  const [reasonCategory, setReasonCategory] =
    useState<(typeof categories)[number]['value']>('copyright')
  const [reasonText, setReasonText] = useState('')

  const report = useTanMutation({
    mutationFn: () =>
      stickerMarketUserClient.reportStickerPackage({
        packageId,
        reasonCategory,
        reasonText,
      }),
    onSuccess: () => {
      setReasonText('')
      setReasonCategory('copyright')
      onOpenChange(false)
      showToast('已收到回報', { type: 'success' })
    },
    onError: () => showToast('回報送出失敗', { type: 'error' }),
  })

  const canSubmit = reasonText.trim().length >= 10 && !report.isPending

  return (
    <Dialog modal open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay key="overlay" bg="$shadowColor" opacity={0.4} />
        <Dialog.Content
          key="content"
          bg="$background"
          p="$4"
          rounded="$4"
          width="min(92vw, 420px)"
          gap="$3"
        >
          <Dialog.Title>
            <SizableText size="$5" fontWeight="700" color="$color12">
              回報貼圖
            </SizableText>
          </Dialog.Title>

          <XStack gap="$2" flexWrap="wrap">
            {categories.map((category) => (
              <Button
                key={category.value}
                size="$3"
                variant={reasonCategory === category.value ? 'default' : 'outlined'}
                onPress={() => setReasonCategory(category.value)}
              >
                {category.label}
              </Button>
            ))}
          </XStack>

          <YStack gap="$2">
            <TextArea
              value={reasonText}
              onChangeText={setReasonText}
              placeholder="請描述你要回報的原因"
              minH={120}
            />
            <SizableText size="$2" color="$color10">
              至少 10 字
            </SizableText>
          </YStack>

          <XStack gap="$2" justify="flex-end">
            <Button variant="outlined" onPress={() => onOpenChange(false)}>
              取消
            </Button>
            <Button disabled={!canSubmit} onPress={() => report.mutate()}>
              送出
            </Button>
          </XStack>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  )
}
