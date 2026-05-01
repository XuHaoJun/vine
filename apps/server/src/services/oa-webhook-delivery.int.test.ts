import { describe, expect, it, vi } from 'vitest'
import { eq } from 'drizzle-orm'
import { oaWebhook } from '@vine/db/schema-oa'
import { oaWebhookAttempt, oaWebhookDelivery } from '@vine/db/schema-private'
import { createOAService } from './oa'
import { createOAWebhookDeliveryService } from './oa-webhook-delivery'
import { withRollbackDb } from '../test/integration-db'
import { randomUUID } from 'crypto'

async function seedOA(db: Parameters<typeof createOAService>[0]['db']) {
  const oa = createOAService({ db, database: {} as any })
  const provider = await oa.createProvider({
    name: 'Webhook Test Provider',
    ownerId: 'user_1',
  })
  const account = await oa.createOfficialAccount({
    providerId: provider.id,
    name: 'Webhook Test OA',
    uniqueId: `@webhook-${randomUUID()}`,
  })
  return { oa, account }
}

describe('oa webhook delivery service integration', () => {
  it('persists a failed delivery and attempt for real events', async () => {
    await withRollbackDb(async (db) => {
      const { oa, account } = await seedOA(db)
      await oa.updateWebhookSettings(account.id, {
        url: 'https://example.test/webhook',
        useWebhook: true,
        errorStatisticsEnabled: true,
      })
      await oa.recordWebhookVerifyResult(account.id, {
        statusCode: 200,
        reason: 'OK',
        verified: true,
      })
      const service = createOAWebhookDeliveryService({
        db,
        oa,
        fetchFn: vi
          .fn()
          .mockResolvedValue(
            new Response('bad', { status: 500 }),
          ) as unknown as typeof fetch,
        now: () => '2026-05-01T00:00:00.000Z',
      })

      const result = await service.deliverRealEvent({
        oaId: account.id,
        buildPayload: () => ({
          destination: account.id,
          events: [{ type: 'message', webhookEventId: 'evt_failed' }],
        }),
      })

      expect(result).toMatchObject({
        kind: 'delivery-failed',
        reason: 'error_status_code',
        statusCode: 500,
      })
      const deliveries = await db
        .select()
        .from(oaWebhookDelivery)
        .where(eq(oaWebhookDelivery.webhookEventId, 'evt_failed'))
      expect(deliveries).toHaveLength(1)
      expect(deliveries[0]).toMatchObject({
        status: 'failed',
        developerVisible: true,
        attemptCount: 1,
        responseStatus: 500,
      })
      const attempts = await db
        .select()
        .from(oaWebhookAttempt)
        .where(eq(oaWebhookAttempt.deliveryId, deliveries[0].id))
      expect(attempts).toHaveLength(1)
    })
  })

  it('persists a successful delivery and attempt for real events', async () => {
    await withRollbackDb(async (db) => {
      const { oa, account } = await seedOA(db)
      await oa.updateWebhookSettings(account.id, {
        url: 'https://example.test/webhook',
        useWebhook: true,
        errorStatisticsEnabled: true,
      })
      await oa.recordWebhookVerifyResult(account.id, {
        statusCode: 200,
        reason: 'OK',
        verified: true,
      })
      const service = createOAWebhookDeliveryService({
        db,
        oa,
        fetchFn: vi
          .fn()
          .mockResolvedValue(
            new Response(null, { status: 204 }),
          ) as unknown as typeof fetch,
        now: () => '2026-05-01T00:00:00.000Z',
      })

      const result = await service.deliverRealEvent({
        oaId: account.id,
        buildPayload: () => ({
          destination: account.id,
          events: [{ type: 'message', webhookEventId: 'evt_success' }],
        }),
      })

      expect(result).toMatchObject({
        kind: 'ok',
        statusCode: 204,
      })
      const deliveries = await db
        .select()
        .from(oaWebhookDelivery)
        .where(eq(oaWebhookDelivery.webhookEventId, 'evt_success'))
      expect(deliveries).toHaveLength(1)
      expect(deliveries[0]).toMatchObject({
        status: 'delivered',
        developerVisible: true,
        attemptCount: 1,
        responseStatus: 204,
      })
      expect(deliveries[0].deliveredAt).toBeTruthy()
      const attempts = await db
        .select()
        .from(oaWebhookAttempt)
        .where(eq(oaWebhookAttempt.deliveryId, deliveries[0].id))
      expect(attempts).toHaveLength(1)
      expect(attempts[0]).toMatchObject({
        responseStatus: 204,
        isRedelivery: false,
      })
    })
  })

  it('keeps aggregation-off rows hidden from developer listing', async () => {
    await withRollbackDb(async (db) => {
      const { oa, account } = await seedOA(db)
      await oa.updateWebhookSettings(account.id, {
        url: 'https://example.test/webhook',
        useWebhook: true,
        errorStatisticsEnabled: false,
      })
      await oa.recordWebhookVerifyResult(account.id, {
        statusCode: 200,
        reason: 'OK',
        verified: true,
      })
      const service = createOAWebhookDeliveryService({
        db,
        oa,
        fetchFn: vi
          .fn()
          .mockResolvedValue(
            new Response(null, { status: 204 }),
          ) as unknown as typeof fetch,
        now: () => '2026-05-01T00:00:00.000Z',
      })

      await service.deliverRealEvent({
        oaId: account.id,
        buildPayload: () => ({
          destination: account.id,
          events: [{ type: 'message', webhookEventId: 'evt_hidden' }],
        }),
      })

      const visible = await service.listDeliveries({ oaId: account.id, pageSize: 20 })
      expect(visible.deliveries).toHaveLength(0)
    })
  })

  it('does not build payloads before webhook preflight passes', async () => {
    await withRollbackDb(async (db) => {
      const { oa, account } = await seedOA(db)
      await oa.updateWebhookSettings(account.id, {
        url: 'https://example.test/webhook',
        useWebhook: false,
      })
      const buildPayload = vi.fn(() => ({
        destination: account.id,
        events: [{ type: 'message', webhookEventId: 'evt_not_built' }],
      }))
      const service = createOAWebhookDeliveryService({
        db,
        oa,
        fetchFn: vi.fn() as unknown as typeof fetch,
        now: () => '2026-05-01T00:00:00.000Z',
      })

      const result = await service.deliverRealEvent({
        oaId: account.id,
        buildPayload,
      })

      expect(result).toEqual({ kind: 'webhook-not-ready' })
      expect(buildPayload).not.toHaveBeenCalled()
    })
  })

  it('redelivers failed rows with isRedelivery true', async () => {
    await withRollbackDb(async (db) => {
      const { oa, account } = await seedOA(db)
      await oa.updateWebhookSettings(account.id, {
        url: 'https://example.test/webhook',
        useWebhook: true,
        webhookRedeliveryEnabled: true,
        errorStatisticsEnabled: true,
      })
      await oa.recordWebhookVerifyResult(account.id, {
        statusCode: 200,
        reason: 'OK',
        verified: true,
      })
      const fetchFn = vi
        .fn()
        .mockResolvedValueOnce(new Response('bad', { status: 500 }))
        .mockResolvedValueOnce(
          new Response(null, { status: 204 }),
        ) as unknown as typeof fetch
      const service = createOAWebhookDeliveryService({
        db,
        oa,
        fetchFn,
        now: () => '2026-05-01T00:00:00.000Z',
      })

      await service.deliverRealEvent({
        oaId: account.id,
        buildPayload: () => ({
          destination: account.id,
          events: [
            {
              type: 'message',
              webhookEventId: 'evt_redeliver',
              deliveryContext: { isRedelivery: false },
            },
          ],
        }),
      })
      const [delivery] = await db
        .select()
        .from(oaWebhookDelivery)
        .where(eq(oaWebhookDelivery.webhookEventId, 'evt_redeliver'))

      const retry = await service.redeliver({ oaId: account.id, deliveryId: delivery.id })
      expect(retry).toMatchObject({ kind: 'ok', statusCode: 204 })
      const secondBody = JSON.parse((fetchFn as any).mock.calls[1][1].body)
      expect(secondBody.events[0].deliveryContext.isRedelivery).toBe(true)
      expect(secondBody.events[0].webhookEventId).toBe('evt_redeliver')
    })
  })

  it('upserts one webhook settings row per official account', async () => {
    await withRollbackDb(async (db) => {
      const { oa, account } = await seedOA(db)
      await oa.updateWebhookSettings(account.id, {
        url: 'https://example.test/one',
        useWebhook: true,
      })
      await oa.updateWebhookSettings(account.id, {
        url: 'https://example.test/two',
        webhookRedeliveryEnabled: true,
      })

      const rows = await db.select().from(oaWebhook).where(eq(oaWebhook.oaId, account.id))
      expect(rows).toHaveLength(1)
      expect(rows[0]).toMatchObject({
        url: 'https://example.test/two',
        useWebhook: true,
        webhookRedeliveryEnabled: true,
      })
    })
  })

  it('deletes deliveries older than 30 days during retention cleanup', async () => {
    await withRollbackDb(async (db) => {
      const { oa, account } = await seedOA(db)
      await db.insert(oaWebhookDelivery).values({
        oaId: account.id,
        webhookEventId: 'evt_old',
        eventType: 'message',
        payloadJson: { events: [] },
        status: 'failed',
        developerVisible: true,
        createdAt: '2026-03-01T00:00:00.000Z',
        updatedAt: '2026-03-01T00:00:00.000Z',
      })
      const service = createOAWebhookDeliveryService({
        db,
        oa,
        fetchFn: vi.fn() as unknown as typeof fetch,
        now: () => '2026-05-01T00:00:00.000Z',
      })

      const result = await service.cleanupExpiredDeliveries({ olderThanDays: 30 })
      expect(result.deletedCount).toBe(1)
    })
  })
})
