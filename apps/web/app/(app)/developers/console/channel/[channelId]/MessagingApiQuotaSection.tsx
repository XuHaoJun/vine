import { SizableText, XStack, YStack } from 'tamagui'

import { oaClient } from '~/features/oa/client'
import { useTanQuery } from '~/query'

export function MessagingApiQuotaSection({ channelId }: { channelId: string }) {
  const { data, isLoading } = useTanQuery({
    queryKey: ['oa', 'messaging-api-quota', channelId],
    queryFn: () => oaClient.getMessagingApiQuotaSummary({ officialAccountId: channelId }),
    enabled: !!channelId,
  })

  const limit =
    data?.type === 'limited' && data.monthlyLimit !== undefined
      ? data.monthlyLimit.toLocaleString()
      : 'Unlimited'

  return (
    <YStack gap="$3" p="$4" borderWidth={1} borderColor="$borderColor" rounded="$2">
      <SizableText size="$5" fontWeight="700" color="$color12">
        Message quota
      </SizableText>
      <XStack gap="$4" flexWrap="wrap">
        <YStack minW={160}>
          <SizableText size="$2" color="$color10">
            Monthly limit
          </SizableText>
          <SizableText size="$4" color="$color12" fontWeight="700">
            {isLoading ? 'Loading' : limit}
          </SizableText>
        </YStack>
        <YStack minW={160}>
          <SizableText size="$2" color="$color10">
            Used this month
          </SizableText>
          <SizableText size="$4" color="$color12" fontWeight="700">
            {isLoading ? 'Loading' : (data?.totalUsage ?? 0).toLocaleString()}
          </SizableText>
        </YStack>
      </XStack>
    </YStack>
  )
}
