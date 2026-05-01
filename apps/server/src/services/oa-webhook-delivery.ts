import { and, desc, eq, lt } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { schema } from '@vine/db'
import { oaWebhook } from '@vine/db/schema-oa'
import {
  oaWebhookAttempt,
  oaWebhookDelivery,
} from '@vine/db/schema-private'
import type { createOAService } from './oa'

export type WebhookDeliveryStatus = 'pending' | 'delivered' | 'failed'
export type WebhookFailureReasonValue =
  | 'could_not_connect'
  | 'request_timeout'
  | 'error_status_code'
  | 'unclassified'

export type WebhookDispatchResult =
  | { kind: 'oa-not-found' }
  | { kind: 'webhook-not-ready' }
  | { kind: 'webhook-disabled' }
  | { kind: 'redelivery-disabled' }
  | { kind: 'delivery-not-found' }
  | { kind: 'delivery-not-failed' }
  | { kind: 'ok'; deliveryId?: string | undefined; statusCode?: number | undefined }
  | {
      kind: 'delivery-failed'
      deliveryId?: string | undefined
      reason: WebhookFailureReasonValue
      detail: string
      statusCode?: number | undefined
    }

export type WebhookPayload = {
  destination?: string
  events?: Array<Record<string, unknown>>
}

export function excerptResponseBody(body: string, limit = 4096): string {
  return body.slice(0, limit)
}

export function classifyWebhookError(error: unknown): {
  reason: WebhookFailureReasonValue
  detail: string
} {
  if (error instanceof DOMException && error.name === 'TimeoutError') {
    return { reason: 'request_timeout', detail: 'Request timeout' }
  }
  if (error instanceof TypeError) {
    return { reason: 'could_not_connect', detail: 'Connection failed' }
  }
  return { reason: 'unclassified', detail: 'Unclassified webhook dispatch error' }
}

export function extractFirstWebhookEvent(payload: unknown): {
  webhookEventId: string
  eventType: string
} {
  const events = (payload as WebhookPayload).events
  const first = events?.[0]
  const webhookEventId = String(first?.['webhookEventId'] ?? '')
  const eventType = String(first?.['type'] ?? 'unknown')
  if (!webhookEventId) {
    throw new Error('Webhook payload is missing webhookEventId')
  }
  return { webhookEventId, eventType }
}

export function createRedeliveryPayload(payload: unknown): unknown {
  const input = payload as WebhookPayload
  return {
    ...input,
    events: (input.events ?? []).map((event) => ({
      ...event,
      deliveryContext: { isRedelivery: true },
    })),
  }
}

export function shouldCreateDeveloperVisibleDelivery(input: {
  errorStatisticsEnabled: boolean
}): boolean {
  return input.errorStatisticsEnabled
}
