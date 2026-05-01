import { describe, expect, it } from 'vitest'

import {
  getWebhookDeliveryDetailRows,
  getWebhookDeliverySummaryCells,
} from '../../../../app/(app)/developers/console/channel/[channelId]/WebhookErrorsSection.helpers'

describe('webhook delivery view helpers', () => {
  it('maps list rows to all operational table cells', () => {
    const cells = getWebhookDeliverySummaryCells({
      id: 'delivery-1',
      webhookEventId: 'evt-1',
      eventType: 'message',
      status: 'failed',
      reason: 'error_status_code',
      detail: 'HTTP 500',
      responseStatus: 500,
      attemptCount: 2,
      isRedelivery: true,
      createdAt: '2026-05-01T00:00:00.000Z',
      lastAttemptedAt: '2026-05-01T00:00:01.000Z',
      deliveredAt: undefined,
    })

    expect(cells).toEqual({
      createdAt: '2026-05-01T00:00:00.000Z',
      eventType: 'message',
      status: 'failed',
      responseStatus: '500',
      reason: 'error_status_code',
      detail: 'HTTP 500',
      attemptCount: '2',
      redelivery: 'Yes',
    })
  })

  it('maps detail data to inspectable diagnostic rows', () => {
    const rows = getWebhookDeliveryDetailRows({
      delivery: {
        id: 'delivery-1',
        webhookEventId: 'evt-1',
        eventType: 'message',
        status: 'failed',
        reason: 'error_status_code',
        detail: 'HTTP 500',
        responseStatus: 500,
        attemptCount: 2,
        isRedelivery: true,
        createdAt: '2026-05-01T00:00:00.000Z',
        lastAttemptedAt: '2026-05-01T00:00:01.000Z',
        deliveredAt: undefined,
      },
      payloadJson: '{"events":[]}',
      attempts: [
        {
          id: 'attempt-1',
          attemptNumber: 2,
          isRedelivery: true,
          requestUrl: 'https://example.test/webhook',
          responseStatus: 500,
          responseBodyExcerpt: 'server error',
          reason: 'error_status_code',
          detail: 'HTTP 500',
          startedAt: '2026-05-01T00:00:01.000Z',
          completedAt: '2026-05-01T00:00:02.000Z',
        },
      ],
    })

    expect(rows).toEqual([
      { label: 'Delivery ID', value: 'delivery-1' },
      { label: 'Webhook event ID', value: 'evt-1' },
      { label: 'Response status', value: '500' },
      { label: 'Response body excerpt', value: 'server error' },
      { label: 'Last error', value: 'HTTP 500' },
      { label: 'Created', value: '2026-05-01T00:00:00.000Z' },
      { label: 'Last attempted', value: '2026-05-01T00:00:01.000Z' },
      { label: 'Delivered', value: '-' },
    ])
  })
})
