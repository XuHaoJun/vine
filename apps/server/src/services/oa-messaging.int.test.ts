import { randomUUID } from 'crypto'
import { describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { chat, chatMember, message } from '@vine/db/schema-public'
import { oaMessageDelivery, oaMessageRequest, oaRetryKey } from '@vine/db/schema-private'
import { officialAccount, oaFriendship, oaProvider, oaQuota } from '@vine/db/schema-oa'
import { getIntegrationDb, withRollbackDb } from '../test/integration-db'
import { createOAMessagingService, createRequestHash } from './oa-messaging'

describe('oa messaging delivery recovery', () => {
  it('does not duplicate messages when recovery reruns a delivered insert', async () => {
    await withRollbackDb(async (db) => {
      const now = '2026-05-01T00:00:00.000Z'
      const [provider] = await db
        .insert(oaProvider)
        .values({ name: 'Provider', ownerId: 'owner-1' })
        .returning()
      const [oa] = await db
        .insert(officialAccount)
        .values({
          providerId: provider.id,
          name: 'OA',
          uniqueId: 'oa-recovery-test',
          channelSecret: 'secret',
        })
        .returning()
      const [request] = await db
        .insert(oaMessageRequest)
        .values({
          oaId: oa.id,
          requestType: 'push',
          requestHash: 'hash',
          acceptedRequestId: 'acc_recovery',
          messagesJson: [{ type: 'text', text: 'hello' }],
          status: 'processing',
          updatedAt: now,
        })
        .returning()
      await db.insert(oaMessageDelivery).values({
        requestId: request.id,
        oaId: oa.id,
        userId: 'user-1',
        status: 'pending',
        messageIdsJson: [`oa:req:${request.id}:user-1:0`],
        updatedAt: now,
      })

      const service = createOAMessagingService({
        db,
        instanceId: 'test',
        now: () => new Date(now),
      })

      await service.processPendingDeliveries({ batchSize: 10, staleAfterMs: 0 })
      await db
        .update(oaMessageDelivery)
        .set({ status: 'pending', deliveredAt: null, lockedAt: null })
        .where(eq(oaMessageDelivery.requestId, request.id))
      await service.processPendingDeliveries({ batchSize: 10, staleAfterMs: 0 })

      const rows = await db
        .select()
        .from(message)
        .where(eq(message.id, `oa:req:${request.id}:user-1:0`))
      expect(rows).toHaveLength(1)

      const [updatedRequest] = await db
        .select()
        .from(oaMessageRequest)
        .where(eq(oaMessageRequest.id, request.id))
        .limit(1)
      expect(updatedRequest.status).toBe('completed')
      expect(updatedRequest.completedAt).not.toBeNull()

      const chats = await db.select().from(chat)
      const members = await db.select().from(chatMember)
      expect(chats).toHaveLength(1)
      expect(members).toHaveLength(2)
    })
  })

  it('does not double-claim deliveries across concurrent processors', async () => {
    const db = getIntegrationDb()
    const now = '2026-05-01T00:00:00.000Z'
    const suffix = randomUUID()
    let providerId: string | undefined
    let oaId: string | undefined
    let requestId: string | undefined

    try {
      const [provider] = await db
        .insert(oaProvider)
        .values({ name: 'Provider 2', ownerId: 'owner-1' })
        .returning()
      providerId = provider.id
      const [oa] = await db
        .insert(officialAccount)
        .values({
          providerId: provider.id,
          name: 'OA 2',
          uniqueId: `oa-skip-locked-test-${suffix}`,
          channelSecret: 'secret',
        })
        .returning()
      oaId = oa.id
      const [request] = await db
        .insert(oaMessageRequest)
        .values({
          oaId: oa.id,
          requestType: 'broadcast',
          requestHash: `hash-2-${suffix}`,
          acceptedRequestId: `acc_skip_locked_${suffix}`,
          messagesJson: [{ type: 'text', text: 'hello' }],
          status: 'processing',
          updatedAt: now,
        })
        .returning()
      requestId = request.id
      await db.insert(oaMessageDelivery).values([
        {
          requestId: request.id,
          oaId: oa.id,
          userId: 'user-1',
          status: 'pending',
          messageIdsJson: [`oa:req:${request.id}:user-1:0`],
          updatedAt: now,
        },
        {
          requestId: request.id,
          oaId: oa.id,
          userId: 'user-2',
          status: 'pending',
          messageIdsJson: [`oa:req:${request.id}:user-2:0`],
          updatedAt: now,
        },
      ])

      const serviceA = createOAMessagingService({
        db: getIntegrationDb(),
        instanceId: 'worker-a',
        now: () => new Date(now),
      })
      const serviceB = createOAMessagingService({
        db: getIntegrationDb(),
        instanceId: 'worker-b',
        now: () => new Date(now),
      })

      await Promise.all([
        serviceA.processPendingDeliveries({ batchSize: 1, staleAfterMs: 0 }),
        serviceB.processPendingDeliveries({ batchSize: 1, staleAfterMs: 0 }),
      ])

      const deliveries = await db
        .select()
        .from(oaMessageDelivery)
        .where(eq(oaMessageDelivery.requestId, request.id))
      expect(deliveries.every((delivery) => delivery.attemptCount === 1)).toBe(true)
      expect(deliveries.every((delivery) => delivery.status === 'delivered')).toBe(true)
    } finally {
      if (oaId) {
        await db.delete(message).where(eq(message.oaId, oaId))
        const members = await db
          .select({ chatId: chatMember.chatId })
          .from(chatMember)
          .where(eq(chatMember.oaId, oaId))
        const chatIds = [...new Set(members.map((m) => m.chatId))]
        for (const chatId of chatIds) {
          await db.delete(chatMember).where(eq(chatMember.chatId, chatId))
          await db.delete(chat).where(eq(chat.id, chatId))
        }
      }
      if (requestId) {
        await db
          .delete(oaMessageDelivery)
          .where(eq(oaMessageDelivery.requestId, requestId))
        await db.delete(oaMessageRequest).where(eq(oaMessageRequest.id, requestId))
      }
      if (oaId) {
        await db.delete(officialAccount).where(eq(officialAccount.id, oaId))
      }
      if (providerId) {
        await db.delete(oaProvider).where(eq(oaProvider.id, providerId))
      }
    }
  })
})

async function seedOA(db: any, uniqueId: string) {
  const [provider] = await db
    .insert(oaProvider)
    .values({ name: 'Provider', ownerId: 'owner-1' })
    .returning()
  const [oa] = await db
    .insert(officialAccount)
    .values({
      providerId: provider.id,
      name: 'OA',
      uniqueId,
      channelSecret: 'secret',
    })
    .returning()
  return oa
}

describe('oa messaging transactional acceptance', () => {
  it('accepts multicast with zero eligible recipients and completes immediately', async () => {
    await withRollbackDb(async (db) => {
      const now = '2026-05-01T00:00:00.000Z'
      const oa = await seedOA(db, 'oa-multicast-zero-test')
      await db.insert(oaQuota).values({
        oaId: oa.id,
        monthlyLimit: 1000,
        currentUsage: 0,
        resetAt: now,
      })

      const service = createOAMessagingService({
        db,
        instanceId: 'test',
        now: () => new Date(now),
      })

      const result = await service.multicast({
        oaId: oa.id,
        retryKey: '123e4567-e89b-12d3-a456-426614174000',
        to: ['non-friend-1', 'non-friend-2'],
        messages: [{ type: 'text', text: 'hello' }],
      })

      expect(result.ok).toBe(true)
      expect(result).toHaveProperty('recipientCount', 0)

      const requests = await db
        .select()
        .from(oaMessageRequest)
        .where(eq(oaMessageRequest.oaId, oa.id))
      expect(requests).toHaveLength(1)
      expect(requests[0].requestType).toBe('multicast')
      expect(requests[0].status).toBe('completed')
      expect(requests[0].completedAt).not.toBeNull()

      const retryRows = await db
        .select()
        .from(oaRetryKey)
        .where(eq(oaRetryKey.oaId, oa.id))
      expect(retryRows).toHaveLength(1)

      const deliveries = await db
        .select()
        .from(oaMessageDelivery)
        .where(eq(oaMessageDelivery.requestId, requests[0].id))
      expect(deliveries).toHaveLength(0)
    })
  })

  it('does not accept retry key or delivery rows when quota fails', async () => {
    await withRollbackDb(async (db) => {
      const now = '2026-05-01T00:00:00.000Z'
      const oa = await seedOA(db, 'oa-quota-fail-test')
      await db.insert(oaFriendship).values({
        oaId: oa.id,
        userId: 'user-1',
        status: 'friend',
      })
      await db.insert(oaQuota).values({
        oaId: oa.id,
        monthlyLimit: 1,
        currentUsage: 1,
        resetAt: now,
      })

      const service = createOAMessagingService({
        db,
        instanceId: 'test',
        now: () => new Date(now),
      })

      const result = await service.push({
        oaId: oa.id,
        retryKey: '123e4567-e89b-12d3-a456-426614174000',
        to: 'user-1',
        messages: [{ type: 'text', text: 'hello' }],
      })

      expect(result).toMatchObject({ ok: false, code: 'QUOTA_EXCEEDED' })
      expect(await db.select().from(oaRetryKey)).toHaveLength(0)
      expect(await db.select().from(oaMessageRequest)).toHaveLength(0)
      expect(await db.select().from(oaMessageDelivery)).toHaveLength(0)
    })
  })

  it('keeps broadcast recipient snapshot stable across retry', async () => {
    await withRollbackDb(async (db) => {
      const now = '2026-05-01T00:00:00.000Z'
      const oa = await seedOA(db, 'oa-broadcast-snapshot-test')
      await db.insert(oaFriendship).values([
        { oaId: oa.id, userId: 'user-1', status: 'friend' },
        { oaId: oa.id, userId: 'user-2', status: 'friend' },
      ])
      const service = createOAMessagingService({
        db,
        instanceId: 'test',
        now: () => new Date(now),
      })

      await service.broadcast({
        oaId: oa.id,
        retryKey: '123e4567-e89b-12d3-a456-426614174000',
        messages: [{ type: 'text', text: 'hello' }],
      })
      await db.insert(oaFriendship).values({
        oaId: oa.id,
        userId: 'user-3',
        status: 'friend',
      })
      const retry = await service.broadcast({
        oaId: oa.id,
        retryKey: '123e4567-e89b-12d3-a456-426614174000',
        messages: [{ type: 'text', text: 'hello' }],
      })

      expect(retry).toMatchObject({ ok: false, code: 'RETRY_KEY_ACCEPTED' })
      const deliveries = await db.select().from(oaMessageDelivery)
      expect(deliveries.map((row: { userId: string }) => row.userId).sort()).toEqual([
        'user-1',
        'user-2',
      ])
    })
  })

  it('reuses an expired retry key for a new push request', async () => {
    await withRollbackDb(async (db) => {
      const now = '2026-05-01T00:00:00.000Z'
      const retryKey = '123e4567-e89b-12d3-a456-426614174000'
      const messages = [{ type: 'text', text: 'hello' }]
      const oa = await seedOA(db, 'oa-expired-retry-test')
      await db.insert(oaFriendship).values({
        oaId: oa.id,
        userId: 'user-1',
        status: 'friend',
      })
      const [oldRequest] = await db
        .insert(oaMessageRequest)
        .values({
          oaId: oa.id,
          requestType: 'push',
          retryKey,
          requestHash: 'old-hash',
          acceptedRequestId: 'acc_old_expired',
          messagesJson: messages,
          targetJson: { to: 'user-1' },
          status: 'completed',
          updatedAt: '2026-04-30T00:00:00.000Z',
          expiresAt: '2026-04-30T00:00:00.000Z',
        })
        .returning()
      await db.insert(oaRetryKey).values({
        oaId: oa.id,
        retryKey,
        requestId: oldRequest.id,
        requestHash: 'old-hash',
        acceptedRequestId: 'acc_old_expired',
        expiresAt: '2026-04-30T00:00:00.000Z',
      })

      const service = createOAMessagingService({
        db,
        instanceId: 'test',
        now: () => new Date(now),
      })

      const result = await service.push({
        oaId: oa.id,
        retryKey,
        to: 'user-1',
        messages,
      })

      expect(result.ok).toBe(true)
      expect(result).toHaveProperty('accepted')
      const retryRows = await db
        .select()
        .from(oaRetryKey)
        .where(eq(oaRetryKey.retryKey, retryKey))
      expect(retryRows).toHaveLength(1)
      expect(retryRows[0].acceptedRequestId).not.toBe('acc_old_expired')
      const requests = await db
        .select()
        .from(oaMessageRequest)
        .where(eq(oaMessageRequest.oaId, oa.id))
      expect(requests).toHaveLength(2)
      const deliveries = await db.select().from(oaMessageDelivery)
      expect(deliveries).toHaveLength(1)
    })
  })

  it('omits sentMessages for duplicate retry while original delivery is pending', async () => {
    await withRollbackDb(async (db) => {
      const now = '2026-05-01T00:00:00.000Z'
      const retryKey = '123e4567-e89b-12d3-a456-426614174000'
      const target = { to: 'user-1' }
      const messages = [{ type: 'text', text: 'hello' }]
      const oa = await seedOA(db, 'oa-pending-retry-test')
      const requestHash = createRequestHash({ endpoint: 'push', target, messages })
      const [request] = await db
        .insert(oaMessageRequest)
        .values({
          oaId: oa.id,
          requestType: 'push',
          retryKey,
          requestHash,
          acceptedRequestId: 'acc_pending',
          messagesJson: messages,
          targetJson: target,
          status: 'processing',
          updatedAt: now,
          expiresAt: '2026-05-02T00:00:00.000Z',
        })
        .returning()
      await db.insert(oaRetryKey).values({
        oaId: oa.id,
        retryKey,
        requestId: request.id,
        requestHash,
        acceptedRequestId: 'acc_pending',
        expiresAt: '2026-05-02T00:00:00.000Z',
      })
      await db.insert(oaMessageDelivery).values({
        requestId: request.id,
        oaId: oa.id,
        userId: 'user-1',
        status: 'pending',
        messageIdsJson: [`oa:req:${request.id}:user-1:0`],
        updatedAt: now,
      })

      const service = createOAMessagingService({
        db,
        instanceId: 'test',
        now: () => new Date(now),
      })

      const retry = await service.push({
        oaId: oa.id,
        retryKey,
        to: 'user-1',
        messages,
      })

      expect(retry).toMatchObject({
        ok: false,
        code: 'RETRY_KEY_ACCEPTED',
        acceptedRequestId: 'acc_pending',
      })
      expect(
        'sentMessages' in retry &&
          Array.isArray(retry.sentMessages) &&
          retry.sentMessages.length > 0,
      ).toBe(false)
    })
  })
})
