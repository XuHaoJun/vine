import { useState } from 'react'
import { router } from 'one'
import { Sheet, SizableText, XStack, YStack } from 'tamagui'

import { Button } from '~/interface/buttons/Button'
import { showToast } from '~/interface/toast/Toast'
import { stickerMarketUserClient } from './client'

type StickerPackage = {
  id: string
  name: string
  priceMinor: number
  currency: string
}

type CheckoutSheetProps = {
  pkg: StickerPackage
  open: boolean
  onOpenChange: (open: boolean) => void
}

const enableSimulate = process.env.VITE_DEV_ENABLE_SIMULATE_PAID === '1'

export function CheckoutSheet({ pkg, open, onOpenChange }: CheckoutSheetProps) {
  const [loading, setLoading] = useState(false)
  const [simulatePaid, setSimulatePaid] = useState(false)

  const handleConfirm = async () => {
    setLoading(true)
    try {
      const res = await stickerMarketUserClient.createCheckout({
        packageId: pkg.id,
        simulatePaid: enableSimulate && simulatePaid,
      })
      sessionStorage.setItem('pay-redirect', JSON.stringify({
        orderId: res.orderId,
        targetUrl: res.redirect?.targetUrl ?? '',
        formFields: res.redirect?.formFields ?? {},
      }))
      onOpenChange(false)
      router.push('/pay/redirect' as any)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '結帳失敗，請稍後再試'
      showToast(message, { type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const priceDisplay = `NT$${((pkg.priceMinor ?? 0) / 100).toFixed(0)}`

  return (
    <Sheet modal open={open} onOpenChange={onOpenChange} snapPoints={[40]}>
      <Sheet.Overlay
        opacity={0.5}
        enterStyle={{ opacity: 0 }}
        exitStyle={{ opacity: 0 }}
      />
      <Sheet.Frame p="$4" bg="$background" gap="$4">
        <SizableText size="$6" fontWeight="700" color="$color12">
          確認購買
        </SizableText>

        <YStack gap="$2">
          <XStack justify="space-between">
            <SizableText size="$4" color="$color11">
              {pkg.name}
            </SizableText>
            <SizableText size="$4" fontWeight="700" color="$color12">
              {priceDisplay}
            </SizableText>
          </XStack>
        </YStack>

        {enableSimulate && (
          <XStack
            items="center"
            gap="$2"
            cursor="pointer"
            onPress={() => setSimulatePaid((v) => !v)}
          >
            <YStack
              width={20}
              height={20}
              rounded="$2"
              borderWidth={2}
              borderColor="$color8"
              bg={simulatePaid ? '$color8' : 'transparent'}
              items="center"
              justify="center"
            >
              {simulatePaid && (
                <SizableText size="$1" color="white">✓</SizableText>
              )}
            </YStack>
            <SizableText size="$3" color="$color10">
              模擬付款成功（Dev Only）
            </SizableText>
          </XStack>
        )}

        <XStack gap="$3">
          <Button
            flex={1}
            variant="outlined"
            onPress={() => onOpenChange(false)}
            disabled={loading}
          >
            取消
          </Button>
          <Button
            flex={1}
            theme="accent"
            onPress={handleConfirm}
            disabled={loading}
          >
            {loading ? '處理中...' : `確認付款 ${priceDisplay}`}
          </Button>
        </XStack>
      </Sheet.Frame>
    </Sheet>
  )
}
