import { describe, expect, it } from 'vitest'
import {
  classifyWebhookError,
  createRedeliveryPayload,
  excerptResponseBody,
  extractFirstWebhookEvent,
  shouldCreateDeveloperVisibleDelivery,
} from './oa-webhook-delivery'

describe('webhook delivery helpers', () => {
  it('caps response body excerpts at 4096 characters', () => {
    expect(excerptResponseBody('x'.repeat(4100))).toHaveLength(4096)
  })

  it('classifies timeout separately from connection failure', () => {
    expect(classifyWebhookError(new DOMException('Timeout', 'TimeoutError'))).toEqual({
      reason: 'request_timeout',
      detail: 'Request timeout',
    })
    expect(classifyWebhookError(new TypeError('fetch failed'))).toEqual({
      reason: 'could_not_connect',
      detail: 'Connection failed',
    })
  })

  it('classifies unknown delivery errors as unclassified', () => {
    expect(classifyWebhookError(new Error('boom'))).toEqual({
      reason: 'unclassified',
      detail: 'Unclassified webhook dispatch error',
    })
  })

  it('extracts the first event id and type from a webhook payload', () => {
    const event = extractFirstWebhookEvent({
      destination: 'oa_1',
      events: [{ type: 'message', webhookEventId: 'evt_1' }],
    })

    expect(event).toEqual({ webhookEventId: 'evt_1', eventType: 'message' })
  })

  it('throws when payload is missing webhookEventId', () => {
    expect(() => extractFirstWebhookEvent({ destination: 'oa_1', events: [{}] }))
      .toThrow('Webhook payload is missing webhookEventId')
  })

  it('marks every event in a redelivery payload as redelivery', () => {
    const payload = createRedeliveryPayload({
      destination: 'oa_1',
      events: [
        {
          type: 'message',
          webhookEventId: 'evt_1',
          deliveryContext: { isRedelivery: false },
        },
      ],
    })

    expect(payload).toEqual({
      destination: 'oa_1',
      events: [
        {
          type: 'message',
          webhookEventId: 'evt_1',
          deliveryContext: { isRedelivery: true },
        },
      ],
    })
  })

  it('uses error statistics setting for developer-visible delivery state', () => {
    expect(shouldCreateDeveloperVisibleDelivery({ errorStatisticsEnabled: true })).toBe(
      true,
    )
    expect(shouldCreateDeveloperVisibleDelivery({ errorStatisticsEnabled: false })).toBe(
      false,
    )
  })
})
