import { and, desc, eq, lt } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { schema } from '@vine/db'
import { oaWebhook } from '@vine/db/schema-oa'
import {
  oaWebhookAttempt,
  oaWebhookDelivery,
} from '@vine/db/schema-private'
import type { createOAService } from './oa'
import { randomUUID } from 'crypto'

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

type OAWebhookDeliveryDeps = {
  db: NodePgDatabase<typeof schema>
  oa: ReturnType<typeof createOAService>
  fetchFn?: typeof fetch
  now?: () => string
  logger?: { error: (obj: unknown, message?: string) => void }
}

type DeliveryListItem = {
  id: string
  webhookEventId: string
  eventType: string
  status: string
  reason?: string | undefined
  detail?: string | undefined
  responseStatus?: number | undefined
  attemptCount: number
  isRedelivery: boolean
  createdAt: string
  lastAttemptedAt?: string | undefined
  deliveredAt?: string | undefined
}

async function readResponseExcerpt(response: Response): Promise<string> {
  return excerptResponseBody(await response.text().catch(() => ''))
}

function httpFailure(status: number) {
  return { reason: 'error_status_code' as const, detail: `HTTP ${status}` }
}

export function createOAWebhookDeliveryService(deps: OAWebhookDeliveryDeps) {
  const fetchFn = deps.fetchFn ?? fetch
  const now = deps.now ?? (() => new Date().toISOString())

  async function sendSigned(input: {
    oaId: string
    url: string
    channelSecret: string
    payload: unknown
    isRedelivery: boolean
  }) {
    const requestBody = JSON.stringify(input.payload)
    const signature = deps.oa.generateWebhookSignature(requestBody, input.channelSecret)
    const startedAt = now()

    try {
      const response = await fetchFn(input.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'x-line-signature': signature,
        },
        body: requestBody,
        signal: AbortSignal.timeout(10000),
      })
      const responseBodyExcerpt = await readResponseExcerpt(response)
      const completedAt = now()
      if (!response.ok) {
        const failure = httpFailure(response.status)
        return {
          ok: false as const,
          responseStatus: response.status,
          responseBodyExcerpt,
          startedAt,
          completedAt,
          ...failure,
        }
      }
      return {
        ok: true as const,
        responseStatus: response.status,
        responseBodyExcerpt,
        startedAt,
        completedAt,
      }
    } catch (error) {
      const failure = classifyWebhookError(error)
      return {
        ok: false as const,
        responseStatus: undefined,
        responseBodyExcerpt: undefined,
        startedAt,
        completedAt: now(),
        ...failure,
      }
    }
  }

  type SendSignedResult = Awaited<ReturnType<typeof sendSigned>>

  async function persistAttemptResult(
    tx: any,
    deliveryId: string,
    oaId: string,
    attemptNumber: number,
    isRedelivery: boolean,
    webhookUrl: string,
    payload: unknown,
    sent: SendSignedResult,
  ) {
    await tx.insert(oaWebhookAttempt).values({
      deliveryId,
      oaId,
      attemptNumber,
      isRedelivery,
      requestUrl: webhookUrl,
      requestBodyJson: payload,
      responseStatus: sent.responseStatus,
      responseBodyExcerpt: sent.responseBodyExcerpt,
      reason: sent.ok ? null : sent.reason,
      detail: sent.ok ? null : sent.detail,
      startedAt: sent.startedAt,
      completedAt: sent.completedAt,
    })

    const update: Record<string, unknown> = {
      status: sent.ok ? 'delivered' : 'failed',
      reason: sent.ok ? null : sent.reason,
      detail: sent.ok ? null : sent.detail,
      responseStatus: sent.responseStatus,
      responseBodyExcerpt: sent.responseBodyExcerpt,
      attemptCount: attemptNumber,
      lastAttemptedAt: sent.completedAt,
      deliveredAt: sent.ok ? sent.completedAt : null,
      updatedAt: sent.completedAt,
    }
    if (isRedelivery) {
      update.isRedelivery = true
    }
    await tx.update(oaWebhookDelivery).set(update).where(eq(oaWebhookDelivery.id, deliveryId))
  }

  async function deliverRealEvent(input: {
    oaId: string
    buildPayload: () => unknown | Promise<unknown>
  }): Promise<WebhookDispatchResult> {
    const account = await deps.oa.getOfficialAccount(input.oaId)
    if (!account) return { kind: 'oa-not-found' }
    const webhook = await deps.oa.getWebhook(input.oaId)
    if (!webhook || webhook.status !== 'verified') return { kind: 'webhook-not-ready' }
    if (!webhook.useWebhook) return { kind: 'webhook-disabled' }

    const payload = await input.buildPayload()
    const event = extractFirstWebhookEvent(payload)
    const developerVisible = shouldCreateDeveloperVisibleDelivery({
      errorStatisticsEnabled: webhook.errorStatisticsEnabled,
    })

    const [delivery] = await deps.db
      .insert(oaWebhookDelivery)
      .values({
        oaId: input.oaId,
        webhookEventId: event.webhookEventId,
        eventType: event.eventType,
        payloadJson: payload,
        status: 'pending',
        developerVisible,
        createdAt: now(),
        updatedAt: now(),
      })
      .onConflictDoNothing()
      .returning()

    const target =
      delivery ??
      (
        await deps.db
          .select()
          .from(oaWebhookDelivery)
          .where(
            and(
              eq(oaWebhookDelivery.oaId, input.oaId),
              eq(oaWebhookDelivery.webhookEventId, event.webhookEventId),
            ),
          )
          .limit(1)
      )[0]

    const attemptNumber = target.attemptCount + 1
    const sent = await sendSigned({
      oaId: input.oaId,
      url: webhook.url,
      channelSecret: account.channelSecret,
      payload,
      isRedelivery: false,
    })

    try {
      await deps.db.transaction(async (tx) => {
        await persistAttemptResult(
          tx,
          target.id,
          input.oaId,
          attemptNumber,
          false,
          webhook.url,
          payload,
          sent,
        )
      })
    } catch (error) {
      deps.logger?.error(
        { err: error, deliveryId: target.id },
        '[oa-webhook] failed to persist webhook attempt result',
      )
      await deps.db
        .update(oaWebhookDelivery)
        .set({
          status: 'failed',
          reason: 'unclassified',
          detail: 'Webhook sent, but Vine failed to persist the attempt result',
          updatedAt: now(),
        })
        .where(eq(oaWebhookDelivery.id, target.id))
      return {
        kind: 'delivery-failed',
        deliveryId: target.id,
        reason: 'unclassified',
        detail: 'Webhook sent, but Vine failed to persist the attempt result',
        statusCode: sent.responseStatus,
      }
    }

    if (sent.ok) return { kind: 'ok', deliveryId: target.id, statusCode: sent.responseStatus }
    return {
      kind: 'delivery-failed',
      deliveryId: target.id,
      reason: sent.reason,
      detail: sent.detail,
      statusCode: sent.responseStatus,
    }
  }

  async function verifyWebhook(input: { oaId: string; endpointOverride?: string }) {
    const account = await deps.oa.getOfficialAccount(input.oaId)
    if (!account) return { success: false, statusCode: 0, reason: 'Official account not found' }
    const webhook = await deps.oa.getWebhook(input.oaId)
    const url = input.endpointOverride ?? webhook?.url
    if (!url) return { success: false, statusCode: 0, reason: 'Webhook endpoint not found' }
    try {
      deps.oa.validateWebhookUrl(url)
    } catch (error: any) {
      return { success: false, statusCode: 0, reason: error.message }
    }

    const sent = await sendSigned({
      oaId: input.oaId,
      url,
      channelSecret: account.channelSecret,
      payload: { destination: input.oaId, events: [] },
      isRedelivery: false,
    })
    const statusCode = sent.responseStatus ?? 0
    const reason = sent.ok ? 'OK' : sent.detail
    await deps.oa.recordWebhookVerifyResult(input.oaId, {
      statusCode,
      reason,
      verified: sent.ok,
    })
    return { success: sent.ok, statusCode, reason, timestamp: now() }
  }

  async function sendTestWebhookEvent(input: { oaId: string; text: string }) {
    const account = await deps.oa.getOfficialAccount(input.oaId)
    if (!account) return { success: false, statusCode: 0, reason: 'Official account not found' }
    const webhook = await deps.oa.getWebhook(input.oaId)
    if (!webhook) return { success: false, statusCode: 0, reason: 'Webhook endpoint not found' }
    const payload = {
      destination: input.oaId,
      events: [
        {
          type: 'message',
          mode: 'active',
          timestamp: Date.now(),
          source: { type: 'user', userId: 'Udiagnostic' },
          webhookEventId: `diagnostic-${randomUUID()}`,
          deliveryContext: { isRedelivery: false },
          message: { type: 'text', id: `diagnostic-${randomUUID()}`, text: input.text },
        },
      ],
    }
    const sent = await sendSigned({
      oaId: input.oaId,
      url: webhook.url,
      channelSecret: account.channelSecret,
      payload,
      isRedelivery: false,
    })
    return {
      success: sent.ok,
      statusCode: sent.responseStatus ?? 0,
      reason: sent.ok ? 'OK' : sent.detail,
      timestamp: now(),
    }
  }

  async function listDeliveries(input: {
    oaId: string
    pageSize: number
    statusFilter?: string | undefined
  }) {
    const conditions = [
      eq(oaWebhookDelivery.oaId, input.oaId),
      eq(oaWebhookDelivery.developerVisible, true),
    ]
    if (input.statusFilter) {
      conditions.push(eq(oaWebhookDelivery.status, input.statusFilter))
    }
    const rows = await deps.db
      .select()
      .from(oaWebhookDelivery)
      .where(and(...conditions))
      .orderBy(desc(oaWebhookDelivery.createdAt))
      .limit(input.pageSize)
    return { deliveries: rows as DeliveryListItem[] }
  }

  async function getDelivery(input: { oaId: string; deliveryId: string }) {
    const [delivery] = await deps.db
      .select()
      .from(oaWebhookDelivery)
      .where(
        and(
          eq(oaWebhookDelivery.oaId, input.oaId),
          eq(oaWebhookDelivery.id, input.deliveryId),
          eq(oaWebhookDelivery.developerVisible, true),
        ),
      )
      .limit(1)
    if (!delivery) return null
    const attempts = await deps.db
      .select()
      .from(oaWebhookAttempt)
      .where(eq(oaWebhookAttempt.deliveryId, input.deliveryId))
      .orderBy(desc(oaWebhookAttempt.attemptNumber))
    return { delivery, attempts }
  }

  async function redeliver(input: { oaId: string; deliveryId: string }): Promise<WebhookDispatchResult> {
    const account = await deps.oa.getOfficialAccount(input.oaId)
    if (!account) return { kind: 'oa-not-found' }
    const webhook = await deps.oa.getWebhook(input.oaId)
    if (!webhook || webhook.status !== 'verified') return { kind: 'webhook-not-ready' }
    if (!webhook.webhookRedeliveryEnabled) return { kind: 'redelivery-disabled' }
    const [delivery] = await deps.db
      .select()
      .from(oaWebhookDelivery)
      .where(and(eq(oaWebhookDelivery.oaId, input.oaId), eq(oaWebhookDelivery.id, input.deliveryId)))
      .limit(1)
    if (!delivery) return { kind: 'delivery-not-found' }
    if (delivery.status !== 'failed') return { kind: 'delivery-not-failed' }

    const payload = createRedeliveryPayload(delivery.payloadJson)
    const attemptNumber = delivery.attemptCount + 1
    const sent = await sendSigned({
      oaId: input.oaId,
      url: webhook.url,
      channelSecret: account.channelSecret,
      payload,
      isRedelivery: true,
    })

    try {
      await deps.db.transaction(async (tx) => {
        await persistAttemptResult(
          tx,
          delivery.id,
          input.oaId,
          attemptNumber,
          true,
          webhook.url,
          payload,
          sent,
        )
      })
    } catch (error) {
      deps.logger?.error(
        { err: error, deliveryId: delivery.id },
        '[oa-webhook] failed to persist redelivery attempt result',
      )
      await deps.db
        .update(oaWebhookDelivery)
        .set({
          status: 'failed',
          reason: 'unclassified',
          detail: 'Webhook redelivery sent, but Vine failed to persist the attempt result',
          updatedAt: now(),
        })
        .where(eq(oaWebhookDelivery.id, delivery.id))
      return {
        kind: 'delivery-failed',
        deliveryId: delivery.id,
        reason: 'unclassified',
        detail: 'Webhook redelivery sent, but Vine failed to persist the attempt result',
        statusCode: sent.responseStatus,
      }
    }

    if (sent.ok) return { kind: 'ok', deliveryId: delivery.id, statusCode: sent.responseStatus }
    return {
      kind: 'delivery-failed',
      deliveryId: delivery.id,
      reason: sent.reason,
      detail: sent.detail,
      statusCode: sent.responseStatus,
    }
  }

  async function cleanupExpiredDeliveries(input: { olderThanDays: number }) {
    const cutoff = new Date(Date.parse(now()) - input.olderThanDays * 24 * 60 * 60 * 1000).toISOString()
    const deleted = await deps.db
      .delete(oaWebhookDelivery)
      .where(lt(oaWebhookDelivery.createdAt, cutoff))
      .returning({ id: oaWebhookDelivery.id })
    return { deletedCount: deleted.length }
  }

  return {
    deliverRealEvent,
    verifyWebhook,
    sendTestWebhookEvent,
    listDeliveries,
    getDelivery,
    redeliver,
    cleanupExpiredDeliveries,
  }
}
