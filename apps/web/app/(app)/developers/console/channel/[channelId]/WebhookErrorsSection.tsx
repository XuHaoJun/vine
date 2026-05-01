import { useState } from 'react'
import { SizableText, Spinner, XStack, YStack } from 'tamagui'

import { useTanMutation, useTanQuery, useTanQueryClient } from '~/query'
import { oaClient } from '~/features/oa/client'
import { Button } from '~/interface/buttons/Button'
import { showToast } from '~/interface/toast/Toast'

export function WebhookErrorsSection({ channelId }: { channelId: string }) {
  const queryClient = useTanQueryClient()
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined)
  const settingsKey = ['oa', 'webhook-settings', channelId]
  const listKey = ['oa', 'webhook-deliveries', channelId, 'failed']
  const settings = useTanQuery({
    queryKey: settingsKey,
    queryFn: () => oaClient.getWebhookSettings({ officialAccountId: channelId }),
    enabled: !!channelId,
  })
  const { data, isLoading } = useTanQuery({
    queryKey: listKey,
    queryFn: () =>
      oaClient.listWebhookDeliveries({
        officialAccountId: channelId,
        pageSize: 50,
        statusFilter: 'failed',
      }),
    enabled: !!channelId,
  })
  const detail = useTanQuery({
    queryKey: ['oa', 'webhook-delivery', channelId, selectedId],
    queryFn: () =>
      oaClient.getWebhookDelivery({
        officialAccountId: channelId,
        deliveryId: selectedId!,
      }),
    enabled: !!channelId && !!selectedId,
  })
  const redeliver = useTanMutation({
    mutationFn: (deliveryId: string) =>
      oaClient.redeliverWebhook({ officialAccountId: channelId, deliveryId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: listKey })
      if (selectedId) {
        void queryClient.invalidateQueries({
          queryKey: ['oa', 'webhook-delivery', channelId, selectedId],
        })
      }
      showToast('Webhook redelivered', { type: 'success' })
    },
    onError: () => showToast('Failed to redeliver webhook', { type: 'error' }),
  })
  const redeliveryEnabled = settings.data?.settings?.webhookRedeliveryEnabled ?? false

  return (
    <YStack gap="$3" p="$4" borderWidth={1} borderColor="$borderColor" rounded="$2">
      <SizableText size="$5" fontWeight="700" color="$color12">
        Webhook errors
      </SizableText>
      {isLoading ? (
        <Spinner />
      ) : (
        <YStack>
          {(data?.deliveries ?? []).map((row) => (
            <XStack
              key={row.id}
              py="$2"
              gap="$3"
              items="center"
              borderBottomWidth={1}
              borderColor="$borderColor"
            >
              <SizableText size="$2" color="$color10" width={160}>
                {row.createdAt}
              </SizableText>
              <SizableText size="$2" color="$color12" width={90}>
                {row.eventType}
              </SizableText>
              <SizableText size="$2" color="$color10" width={120}>
                {row.reason ?? row.status}
              </SizableText>
              <SizableText size="$2" color="$color10" flex={1} numberOfLines={1}>
                {row.detail ?? ''}
              </SizableText>
              <Button size="$2" variant="outlined" onPress={() => setSelectedId(row.id)}>
                Detail
              </Button>
              <Button
                size="$2"
                variant={redeliveryEnabled ? undefined : 'outlined'}
                onPress={() => redeliver.mutate(row.id)}
                disabled={!redeliveryEnabled || redeliver.isPending}
              >
                Redeliver
              </Button>
            </XStack>
          ))}
          {(data?.deliveries ?? []).length === 0 && (
            <SizableText size="$2" color="$color10">
              No failed webhook deliveries.
            </SizableText>
          )}
        </YStack>
      )}
      {detail.data && (
        <YStack gap="$2" p="$3" bg="$color2" rounded="$2">
          <SizableText size="$3" fontWeight="700">
            Delivery detail
          </SizableText>
          <SizableText size="$2" fontFamily="$mono">
            {detail.data.payloadJson}
          </SizableText>
        </YStack>
      )}
    </YStack>
  )
}
