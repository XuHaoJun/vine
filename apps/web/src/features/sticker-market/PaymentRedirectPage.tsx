import { useEffect, useRef, useState } from 'react'
import { SizableText, YStack } from 'tamagui'

type RedirectData = {
  orderId: string
  targetUrl: string
  formFields: Record<string, string>
}

export function PaymentRedirectPage() {
  const formRef = useRef<HTMLFormElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const raw = localStorage.getItem('pay-redirect')
    if (!raw) {
      setError('找不到付款資料，請重新操作')
      return
    }
    localStorage.removeItem('pay-redirect')

    let data: RedirectData
    try {
      data = JSON.parse(raw) as RedirectData
    } catch {
      setError('付款資料格式錯誤')
      return
    }

    const form = formRef.current
    if (!form || !data.targetUrl) {
      setError('付款連結無效')
      return
    }

    form.action = data.targetUrl
    form.method = 'POST'

    // Clear existing hidden inputs and add fresh ones
    form.innerHTML = ''
    for (const [key, value] of Object.entries(data.formFields)) {
      const input = document.createElement('input')
      input.type = 'hidden'
      input.name = key
      input.value = value
      form.appendChild(input)
    }

    form.submit()
  }, [])

  if (error) {
    return (
      <YStack flex={1} items="center" justify="center" bg="$background" gap="$4" p="$6">
        <SizableText size="$6" fontWeight="700" color="$color12">
          無法完成付款
        </SizableText>
        <SizableText size="$3" color="$color10" text="center">
          {error}
        </SizableText>
      </YStack>
    )
  }

  return (
    <YStack flex={1} items="center" justify="center" bg="$background" gap="$4">
      <SizableText size="$5" color="$color12">
        正在跳轉至付款頁面...
      </SizableText>
      <SizableText size="$3" color="$color10">
        請稍候
      </SizableText>
      {/* Hidden form, populated and submitted by the effect above */}
      <form ref={formRef} style={{ display: 'none' }} />
    </YStack>
  )
}
