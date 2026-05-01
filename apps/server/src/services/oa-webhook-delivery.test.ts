import { describe, expect, it, vi } from 'vitest'
import {
  classifyWebhookError,
  createOAWebhookDeliveryService,
  createRedeliveryPayload,
  excerptResponseBody,
  extractFirstWebhookEvent,
  shouldCreateDeveloperVisibleDelivery,
} from './oa-webhook-delivery'
import { oaWebhookAttempt, oaWebhookDelivery } from '@vine/db/schema-private'

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
    expect(() => extractFirstWebhookEvent({ destination: 'oa_1', events: [{}] })).toThrow(
      'Webhook payload is missing webhookEventId',
    )
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

describe('createOAWebhookDeliveryService persistence failure', () => {
  it('returns delivery-failed with unclassified when attempt insert fails after fetch succeeds', async () => {
    const logger = { error: vi.fn() }

    const mockDb = {
      insert: vi.fn((table) => {
        const chain: any = {
          values: vi.fn(() => chain),
          onConflictDoNothing: vi.fn(() => chain),
          returning: vi.fn(() => Promise.resolve([])),
          set: vi.fn(() => chain),
          where: vi.fn(() => Promise.resolve([])),
        }
        if (table === oaWebhookDelivery) {
          chain.returning = vi.fn(() =>
            Promise.resolve([{ id: 'del_1', attemptCount: 0 }]),
          )
        }
        if (table === oaWebhookAttempt) {
          chain.values = vi.fn(() => Promise.reject(new Error('DB error')))
        }
        return chain
      }),
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([])),
          })),
        })),
      })),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => Promise.resolve([])),
        })),
      })),
      transaction: vi.fn(async (callback) => {
        return callback(mockDb)
      }),
    }

    const service = createOAWebhookDeliveryService({
      db: mockDb as any,
      oa: {
        getOfficialAccount: vi.fn(() =>
          Promise.resolve({ id: 'oa_1', channelSecret: 'secret' }),
        ),
        getWebhook: vi.fn(() =>
          Promise.resolve({
            url: 'https://example.test/webhook',
            status: 'verified',
            useWebhook: true,
            errorStatisticsEnabled: true,
          }),
        ),
        generateWebhookSignature: vi.fn(() => 'sig'),
        validateWebhookUrl: vi.fn(),
        recordWebhookVerifyResult: vi.fn(),
      } as any,
      fetchFn: vi.fn(() =>
        Promise.resolve(new Response(null, { status: 200 })),
      ) as unknown as typeof fetch,
      now: () => '2026-05-01T00:00:00.000Z',
      logger,
    })

    const result = await service.deliverRealEvent({
      oaId: 'oa_1',
      buildPayload: () => ({
        destination: 'oa_1',
        events: [{ type: 'message', webhookEventId: 'evt_1' }],
      }),
    })

    expect(logger.error).toHaveBeenCalled()
    expect(result).toEqual({
      kind: 'delivery-failed',
      deliveryId: 'del_1',
      reason: 'unclassified',
      detail: 'Webhook sent, but Vine failed to persist the attempt result',
      statusCode: 200,
    })
  })
})
