import type {
  GetWebhookDeliveryResponse,
  WebhookDeliveryAttempt,
  WebhookDeliverySummary,
} from '@vine/proto/oa'
import { createRoute } from 'one'

const route = createRoute<'/(app)/developers/console/channel/[channelId]/WebhookErrorsSection.helpers'>()

type WebhookDeliverySummaryLike = Pick<
  WebhookDeliverySummary,
  | 'id'
  | 'webhookEventId'
  | 'eventType'
  | 'status'
  | 'reason'
  | 'detail'
  | 'responseStatus'
  | 'attemptCount'
  | 'isRedelivery'
  | 'createdAt'
  | 'lastAttemptedAt'
  | 'deliveredAt'
>

type WebhookDeliveryAttemptLike = Partial<WebhookDeliveryAttempt> &
  Pick<WebhookDeliveryAttempt, 'responseStatus' | 'responseBodyExcerpt' | 'detail'>

type WebhookDeliveryDetailLike = Pick<GetWebhookDeliveryResponse, 'payloadJson'> & {
  delivery?: WebhookDeliverySummaryLike | undefined
  attempts: WebhookDeliveryAttemptLike[]
}

export function getWebhookDeliverySummaryCells(row: WebhookDeliverySummaryLike) {
  return {
    createdAt: row.createdAt,
    eventType: row.eventType,
    status: row.status,
    responseStatus: row.responseStatus == null ? '-' : String(row.responseStatus),
    reason: row.reason ?? row.status,
    detail: row.detail ?? '',
    attemptCount: String(row.attemptCount),
    redelivery: row.isRedelivery ? 'Yes' : 'No',
  }
}

export function getWebhookDeliveryDetailRows(detail: WebhookDeliveryDetailLike) {
  const latestAttempt = detail.attempts[0]
  return [
    { label: 'Delivery ID', value: detail.delivery?.id ?? '-' },
    { label: 'Webhook event ID', value: detail.delivery?.webhookEventId ?? '-' },
    {
      label: 'Response status',
      value:
        latestAttempt?.responseStatus == null
          ? '-'
          : String(latestAttempt.responseStatus),
    },
    {
      label: 'Response body excerpt',
      value: latestAttempt?.responseBodyExcerpt ?? '-',
    },
    {
      label: 'Last error',
      value: latestAttempt?.detail ?? detail.delivery?.detail ?? '-',
    },
    { label: 'Created', value: detail.delivery?.createdAt ?? '-' },
    { label: 'Last attempted', value: detail.delivery?.lastAttemptedAt ?? '-' },
    { label: 'Delivered', value: detail.delivery?.deliveredAt ?? '-' },
  ]
}
