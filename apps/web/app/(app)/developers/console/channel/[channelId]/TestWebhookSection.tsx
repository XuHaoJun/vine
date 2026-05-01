import { useState } from 'react'
import { SizableText, XStack, YStack } from 'tamagui'

import { useTanMutation } from '~/query'
import { oaClient } from '~/features/oa/client'
import { Button } from '~/interface/buttons/Button'
import { Input } from '~/interface/forms/Input'
import { showToast } from '~/interface/toast/Toast'

export function TestWebhookSection({ channelId }: { channelId: string }) {
  const [text, setText] = useState('Webhook test from Vine')
  const [lastResult, setLastResult] = useState<string>('No test sent')
  const send = useTanMutation({
    mutationFn: () =>
      oaClient.sendTestWebhookEvent({ officialAccountId: channelId, text }),
    onSuccess: (res) => {
      setLastResult(`${res.result?.statusCode ?? 0} ${res.result?.reason ?? ''}`)
      showToast(res.result?.success ? 'Test webhook sent' : 'Test webhook failed', {
        type: res.result?.success ? 'success' : 'error',
      })
    },
    onError: () => showToast('Failed to send test webhook', { type: 'error' }),
  })

  return (
    <YStack gap="$3" p="$4" borderWidth={1} borderColor="$borderColor" rounded="$2">
      <SizableText size="$5" fontWeight="700" color="$color12">
        Test webhook
      </SizableText>
      <Input
        value={text}
        onChangeText={setText}
        placeholder="Webhook test message"
        onSubmitEditing={() => send.mutate()}
      />
      <XStack justify="space-between" items="center">
        <SizableText size="$2" color="$color10">
          Latest result: {lastResult}
        </SizableText>
        <Button size="$2" onPress={() => send.mutate()} disabled={send.isPending}>
          Send sample event
        </Button>
      </XStack>
    </YStack>
  )
}
