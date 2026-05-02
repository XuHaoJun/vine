import { SizableText, YStack } from 'tamagui'

const basePath = '/api/oa/v2'

export function MessagingApiGuideSection() {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const curlExample = `curl -X POST ${origin}${basePath}/bot/message/push \\
  -H 'Content-Type: application/json' \\
  -H 'Authorization: Bearer {channel access token}' \\
  -H 'X-Line-Retry-Key: 123e4567-e89b-12d3-a456-426614174000' \\
  -d '{"to":"{userId}","messages":[{"type":"text","text":"Hello from Vine"}]}'`

  return (
    <YStack gap="$3" p="$4" borderWidth={1} borderColor="$borderColor" rounded="$2">
      <SizableText size="$5" fontWeight="700" color="$color12">
        Messaging API endpoint
      </SizableText>
      <SizableText size="$2" color="$color10">
        Vine uses its own LINE-like endpoint namespace. Use Vine-issued access tokens with
        this server, not LINE Developers channel tokens.
      </SizableText>
      <SizableText size="$3" color="$color12" fontFamily="$mono">
        {basePath}
      </SizableText>
      <SizableText size="$2" color="$color10">
        Supported send methods: reply, push, multicast, broadcast. Retry keys are
        supported for push, multicast, and broadcast.
      </SizableText>
      <YStack bg="$color2" p="$3" rounded="$2">
        <SizableText size="$2" color="$color12" fontFamily="$mono">
          {curlExample}
        </SizableText>
      </YStack>
    </YStack>
  )
}
