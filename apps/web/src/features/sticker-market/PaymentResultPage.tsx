import { useEffect, useRef, useState } from 'react'
import { router } from 'one'
import { SizableText, YStack } from 'tamagui'

import { Button } from '~/interface/buttons/Button'
import { OrderStatus } from '@vine/proto/stickerMarket'
import { stickerMarketUserClient } from './client'

type Status = 'polling' | 'paid' | 'failed' | 'timeout'

type PaymentResultPageProps = {
  orderId: string
}

export function PaymentResultPage({ orderId }: PaymentResultPageProps) {
  const [status, setStatus] = useState<Status>('polling')
  const [failureReason, setFailureReason] = useState('')
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    if (!orderId) {
      setStatus('failed')
      return
    }

    let attempts = 0
    const maxAttempts = 10

    const poll = async () => {
      try {
        const res = await stickerMarketUserClient.getOrder({ orderId })
        if (res.status === OrderStatus.PAID) {
          setStatus('paid')
          return
        }
        if (res.status === OrderStatus.FAILED) {
          setFailureReason(res.failureReason)
          setStatus('failed')
          return
        }
      } catch {
        // network error, keep polling
      }

      attempts++
      if (attempts >= maxAttempts) {
        setStatus('timeout')
        return
      }

      timerRef.current = window.setTimeout(poll, 1000)
    }

    timerRef.current = window.setTimeout(poll, 1000)
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [orderId])

  if (status === 'polling') {
    return (
      <YStack flex={1} items="center" justify="center" bg="$background" gap="$4">
        <SizableText size="$6">⏳</SizableText>
        <SizableText size="$5" color="$color12">
          處理中...
        </SizableText>
        <SizableText size="$3" color="$color10">
          正在確認付款狀態
        </SizableText>
      </YStack>
    )
  }

  if (status === 'paid') {
    return (
      <YStack flex={1} items="center" justify="center" bg="$background" gap="$4" p="$6">
        <SizableText size="$8">🎉</SizableText>
        <SizableText size="$6" fontWeight="700" color="$color12">
          付款成功！
        </SizableText>
        <SizableText size="$3" color="$color10" text="center">
          貼圖已加入您的收藏
        </SizableText>
        <Button theme="accent" onPress={() => router.push('/store' as any)}>
          回到貼圖商店
        </Button>
      </YStack>
    )
  }

  if (status === 'failed') {
    return (
      <YStack flex={1} items="center" justify="center" bg="$background" gap="$4" p="$6">
        <SizableText size="$8">❌</SizableText>
        <SizableText size="$6" fontWeight="700" color="$color12">
          付款失敗
        </SizableText>
        {failureReason ? (
          <SizableText size="$3" color="$color10" text="center">
            {failureReason}
          </SizableText>
        ) : null}
        <Button onPress={() => router.push('/store' as any)}>
          回到貼圖商店
        </Button>
      </YStack>
    )
  }

  // timeout
  return (
    <YStack flex={1} items="center" justify="center" bg="$background" gap="$4" p="$6">
      <SizableText size="$8">⚠️</SizableText>
      <SizableText size="$6" fontWeight="700" color="$color12">
        付款確認逾時
      </SizableText>
      <SizableText size="$3" color="$color10" text="center">
        付款狀態尚未確認，請稍後至商店查看是否已完成購買
      </SizableText>
      <Button theme="accent" onPress={() => router.push('/store' as any)}>
        回到貼圖商店
      </Button>
    </YStack>
  )
}
