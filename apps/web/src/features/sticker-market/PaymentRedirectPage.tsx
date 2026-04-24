import { useEffect, useRef } from 'react'
import { SizableText, YStack } from 'tamagui'

type RedirectData = {
  orderId: string
  targetUrl: string
  formFields: Record<string, string>
}

export function PaymentRedirectPage() {
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    const raw = sessionStorage.getItem('pay-redirect')
    if (!raw) return
    sessionStorage.removeItem('pay-redirect')

    let data: RedirectData
    try {
      data = JSON.parse(raw) as RedirectData
    } catch {
      return
    }

    const form = formRef.current
    if (!form || !data.targetUrl) return

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
