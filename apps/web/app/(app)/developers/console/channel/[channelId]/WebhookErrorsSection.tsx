import { useState } from 'react'
import { SizableText, Spinner, XStack, YStack } from 'tamagui'

import { useTanMutation, useTanQuery, useTanQueryClient } from '~/query'
import { oaClient } from '~/features/oa/client'
import { Button } from '~/interface/buttons/Button'
import { showToast } from '~/interface/toast/Toast'

import {
  getWebhookDeliveryDetailRows,
  getWebhookDeliverySummaryCells,
} from './WebhookErrorsSection.helpers'

export function WebhookErrorsSection({ channelId }: { channelId: string }) {
  const queryClient = useTanQueryClient()
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined)
  const [cursor, setCursor] = useState<string | undefined>(undefined)
  const settingsKey = ['oa', 'webhook-settings', channelId]
  const listRootKey = ['oa', 'webhook-deliveries', channelId]
  const listKey = [...listRootKey, 'failed', cursor]
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
        cursor,
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
      void queryClient.invalidateQueries({ queryKey: listRootKey })
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
        <YStack gap="$2">
          <XStack gap="$3" py="$1" items="center">
            <SizableText size="$1" color="$color10" width={150}>
              Time
            </SizableText>
            <SizableText size="$1" color="$color10" width={80}>
              Event
            </SizableText>
            <SizableText size="$1" color="$color10" width={76}>
              Status
            </SizableText>
            <SizableText size="$1" color="$color10" width={64}>
              HTTP
            </SizableText>
            <SizableText size="$1" color="$color10" width={130}>
              Reason
            </SizableText>
            <SizableText size="$1" color="$color10" width={64}>
              Tries
            </SizableText>
            <SizableText size="$1" color="$color10" width={78}>
              Redeliv.
            </SizableText>
            <SizableText size="$1" color="$color10" flex={1}>
              Detail
            </SizableText>
            <YStack width={176} />
          </XStack>
          {(data?.deliveries ?? []).map((row) => {
            const cells = getWebhookDeliverySummaryCells(row)
            return (
              <XStack
                key={row.id}
                py="$2"
                gap="$3"
                items="center"
                borderBottomWidth={1}
                borderColor="$borderColor"
              >
                <SizableText size="$2" color="$color10" width={150} numberOfLines={1}>
                  {cells.createdAt}
                </SizableText>
                <SizableText size="$2" color="$color12" width={80}>
                  {cells.eventType}
                </SizableText>
                <SizableText size="$2" color="$color10" width={76}>
                  {cells.status}
                </SizableText>
                <SizableText size="$2" color="$color10" width={64}>
                  {cells.responseStatus}
                </SizableText>
                <SizableText size="$2" color="$color10" width={130} numberOfLines={1}>
                  {cells.reason}
                </SizableText>
                <SizableText size="$2" color="$color10" width={64}>
                  {cells.attemptCount}
                </SizableText>
                <SizableText size="$2" color="$color10" width={78}>
                  {cells.redelivery}
                </SizableText>
                <SizableText size="$2" color="$color10" flex={1} numberOfLines={1}>
                  {cells.detail}
                </SizableText>
                <XStack gap="$2" width={176} justify="flex-end">
                  <Button
                    size="$2"
                    variant="outlined"
                    onPress={() => setSelectedId(row.id)}
                  >
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
              </XStack>
            )
          })}
          {(data?.deliveries ?? []).length === 0 && (
            <SizableText size="$2" color="$color10">
              No failed webhook deliveries.
            </SizableText>
          )}
          {data?.nextCursor && (
            <XStack justify="flex-end" pt="$2">
              <Button
                size="$2"
                variant="outlined"
                onPress={() => setCursor(data.nextCursor)}
              >
                Older
              </Button>
            </XStack>
          )}
        </YStack>
      )}
      {detail.data && (
        <YStack gap="$2" p="$3" bg="$color2" rounded="$2">
          <SizableText size="$3" fontWeight="700">
            Delivery detail
          </SizableText>
          {getWebhookDeliveryDetailRows(detail.data).map((row) => (
            <XStack key={row.label} gap="$3">
              <SizableText size="$2" color="$color10" width={150}>
                {row.label}
              </SizableText>
              <SizableText size="$2" color="$color12" flex={1}>
                {row.value}
              </SizableText>
            </XStack>
          ))}
          <SizableText size="$2" color="$color10">
            Request payload JSON
          </SizableText>
          <SizableText size="$2" fontFamily="$mono" color="$color12">
            {detail.data.payloadJson}
          </SizableText>
        </YStack>
      )}
    </YStack>
  )
}
