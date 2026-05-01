import { createHash, randomUUID } from 'crypto'
import { and, eq, gt, inArray, isNull, lt, lte, or, sql } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { schema } from '@vine/db'
import { oaMessageDelivery, oaMessageRequest, oaRetryKey } from '@vine/db/schema-private'
import { chat, chatMember, message } from '@vine/db/schema-public'
import { oaFriendship, oaQuota, oaReplyToken } from '@vine/db/schema-oa'

export const RETRY_KEY_TTL_MS = 24 * 60 * 60 * 1000

const LINE_RETRY_KEY_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isValidLineRetryKey(value: string): boolean {
  return LINE_RETRY_KEY_RE.test(value)
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>
    return `{${Object.keys(obj)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(obj[key])}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

export function createRequestHash(input: {
  endpoint: 'reply' | 'push' | 'broadcast'
  target: unknown
  messages: unknown[]
}): string {
  return createHash('sha256').update(stableJson(input)).digest('hex')
}

export function createDeterministicMessageIds(input: {
  requestId: string
  userId: string
  messageCount: number
}): string[] {
  return Array.from(
    { length: input.messageCount },
    (_, index) => `oa:req:${input.requestId}:${input.userId}:${index}`,
  )
}

export function createHttpRequestId(): string {
  return `req_${randomUUID().replace(/-/g, '')}`
}

export function createAcceptedRequestId(): string {
  return `acc_${randomUUID().replace(/-/g, '')}`
}

export type SendRequestType = 'reply' | 'push' | 'broadcast'

export type RetryKeyCheckInput = {
  db: NodePgDatabase<typeof schema>
  now: () => Date
  oaId: string
  requestType: SendRequestType
  retryKey?: string | undefined
  target: unknown
  messages: unknown[]
}

export type RetryKeyCheckResult =
  | {
      ok: true
      httpRequestId: string
      requestHash: string
    }
  | {
      ok: false
      code: 'INVALID_RETRY_KEY' | 'RETRY_KEY_ACCEPTED' | 'RETRY_KEY_CONFLICT'
      httpRequestId: string
      requestId?: string
      acceptedRequestId?: string
    }

export async function checkRetryKeyForRequest(
  input: RetryKeyCheckInput,
): Promise<RetryKeyCheckResult> {
  const httpRequestId = createHttpRequestId()
  if (input.requestType === 'reply' && input.retryKey) {
    return { ok: false, code: 'INVALID_RETRY_KEY', httpRequestId }
  }
  if (input.retryKey && !isValidLineRetryKey(input.retryKey)) {
    return { ok: false, code: 'INVALID_RETRY_KEY', httpRequestId }
  }

  const requestHash = createRequestHash({
    endpoint: input.requestType,
    target: input.target,
    messages: input.messages,
  })

  if (input.retryKey) {
    const [existing] = await input.db
      .select()
      .from(oaRetryKey)
      .where(
        and(
          eq(oaRetryKey.oaId, input.oaId),
          eq(oaRetryKey.retryKey, input.retryKey),
          gt(oaRetryKey.expiresAt, input.now().toISOString()),
        ),
      )
      .limit(1)

    if (existing) {
      if (existing.requestHash === requestHash) {
        return {
          ok: false,
          code: 'RETRY_KEY_ACCEPTED',
          httpRequestId,
          requestId: existing.requestId,
          acceptedRequestId: existing.acceptedRequestId,
        }
      }
      return {
        ok: false,
        code: 'RETRY_KEY_CONFLICT',
        httpRequestId,
        acceptedRequestId: existing.acceptedRequestId,
      }
    }
  }

  return { ok: true, httpRequestId, requestHash }
}

export type OAMessagingDeps = {
  db: NodePgDatabase<typeof schema>
  instanceId: string
  now?: () => Date
}

class RetryKeyRaceError extends Error {
  constructor(
    readonly input: RetryKeyCheckInput,
    readonly httpRequestId: string,
  ) {
    super('Retry key was accepted by another transaction')
  }
}

type NormalizedMessage = { type: string; text?: string | null; metadata?: string | null }

export function createOAMessagingService(deps: OAMessagingDeps) {
  const now = deps.now ?? (() => new Date())

  async function createDeliveryRows(input: {
    db?: typeof deps.db
    requestId: string
    oaId: string
    userIds: string[]
    messageCount: number
  }) {
    if (input.userIds.length === 0) return
    const db = input.db ?? deps.db
    await db
      .insert(oaMessageDelivery)
      .values(
        input.userIds.map((userId) => ({
          requestId: input.requestId,
          oaId: input.oaId,
          userId,
          status: 'pending' as const,
          messageIdsJson: createDeterministicMessageIds({
            requestId: input.requestId,
            userId,
            messageCount: input.messageCount,
          }),
          updatedAt: now().toISOString(),
        })),
      )
      .onConflictDoNothing()
  }

  async function findOrCreateOAChat(tx: any, oaId: string, userId: string, createdAt: string) {
    const userChatSubquery = tx
      .select({ chatId: chatMember.chatId })
      .from(chatMember)
      .where(eq(chatMember.userId, userId))

    const [existingChat] = await tx
      .select({ id: chat.id })
      .from(chat)
      .innerJoin(chatMember, eq(chatMember.chatId, chat.id))
      .where(
        and(
          eq(chat.type, 'oa'),
          inArray(chat.id, userChatSubquery),
          eq(chatMember.oaId, oaId),
        ),
      )
      .limit(1)

    if (existingChat) return existingChat.id

    const chatId = randomUUID()
    await tx.insert(chat).values({ id: chatId, type: 'oa', createdAt })
    await tx.insert(chatMember).values([
      { id: randomUUID(), chatId, userId, joinedAt: createdAt },
      { id: randomUUID(), chatId, oaId, joinedAt: createdAt },
    ])
    return chatId
  }

  async function updateRequestStatus(tx: any, requestId: string) {
    const rows = await tx
      .select({ status: oaMessageDelivery.status })
      .from(oaMessageDelivery)
      .where(eq(oaMessageDelivery.requestId, requestId))

    if (rows.length === 0) return

    const delivered = rows.filter((row: { status: string }) => row.status === 'delivered').length
    const failed = rows.filter((row: { status: string }) => row.status === 'failed').length
    const pending = rows.length - delivered - failed
    const nextStatus =
      pending > 0
        ? 'processing'
        : failed === 0
          ? 'completed'
          : delivered > 0
            ? 'partially_failed'
            : 'failed'

    await tx
      .update(oaMessageRequest)
      .set({
        status: nextStatus,
        updatedAt: now().toISOString(),
        completedAt: pending === 0 ? now().toISOString() : null,
      })
      .where(eq(oaMessageRequest.id, requestId))
  }

  async function processPendingDeliveries(input: {
    batchSize: number
    staleAfterMs: number
  }) {
    const staleBefore = new Date(now().getTime() - input.staleAfterMs).toISOString()
    return deps.db.transaction(async (tx) => {
      const deliveries = await tx
        .select()
        .from(oaMessageDelivery)
        .where(
          and(
            inArray(oaMessageDelivery.status, ['pending', 'processing']),
            or(isNull(oaMessageDelivery.lockedAt), lt(oaMessageDelivery.lockedAt, staleBefore)),
          ),
        )
        .orderBy(oaMessageDelivery.createdAt)
        .limit(input.batchSize)
        .for('update', { skipLocked: true })

      for (const delivery of deliveries) {
        const lockedAt = now().toISOString()
        await tx
          .update(oaMessageDelivery)
          .set({
            status: 'processing',
            lockedAt,
            lockedBy: deps.instanceId,
            attemptCount: delivery.attemptCount + 1,
            updatedAt: lockedAt,
          })
          .where(eq(oaMessageDelivery.id, delivery.id))

        const [request] = await tx
          .select()
          .from(oaMessageRequest)
          .where(eq(oaMessageRequest.id, delivery.requestId))
          .limit(1)
        const messages = request.messagesJson as Array<{
          type: string
          text?: string | null
          metadata?: string | null
        }>
        const messageIds = delivery.messageIdsJson as string[]
        const chatId = await findOrCreateOAChat(tx, delivery.oaId, delivery.userId, lockedAt)

        for (let index = 0; index < messages.length; index++) {
          await tx
            .insert(message)
            .values({
              id: messageIds[index],
              chatId,
              senderType: 'oa',
              oaId: delivery.oaId,
              type: messages[index].type as typeof message.$inferInsert.type,
              text: messages[index].text,
              metadata: messages[index].metadata,
              createdAt: lockedAt,
            })
            .onConflictDoNothing()
        }

        await tx
          .update(chat)
          .set({
            lastMessageId: messageIds[messageIds.length - 1],
            lastMessageAt: lockedAt,
          })
          .where(eq(chat.id, chatId))

        await tx
          .update(oaMessageDelivery)
          .set({
            chatId,
            status: 'delivered',
            deliveredAt: lockedAt,
            updatedAt: lockedAt,
          })
          .where(eq(oaMessageDelivery.id, delivery.id))
      }

      const touchedRequestIds = [...new Set(deliveries.map((delivery) => delivery.requestId))]
      for (const requestId of touchedRequestIds) {
        await updateRequestStatus(tx, requestId)
      }

      return { processed: deliveries.length }
    })
  }

  function monthStart(value: Date) {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1))
  }

  async function reserveQuota(tx: any, oaId: string, delta: number, nowIso: string) {
    const [quota] = await tx.select().from(oaQuota).where(eq(oaQuota.oaId, oaId)).limit(1)
    if (!quota || quota.monthlyLimit === 0) return true

    const resetAt = new Date(quota.resetAt)
    const start = monthStart(new Date(nowIso))
    if (resetAt < start) {
      await tx
        .update(oaQuota)
        .set({ currentUsage: 0, resetAt: start.toISOString() })
        .where(eq(oaQuota.oaId, oaId))
    }

    const [updated] = await tx
      .update(oaQuota)
      .set({ currentUsage: sql`${oaQuota.currentUsage} + ${delta}` })
      .where(
        and(
          eq(oaQuota.oaId, oaId),
          sql`${oaQuota.currentUsage} + ${delta} <= ${oaQuota.monthlyLimit}`,
        ),
      )
      .returning({ oaId: oaQuota.oaId })
    return !!updated
  }

  async function claimReplyToken(
    tx: any,
    input: {
      oaId: string
      replyToken: string
      nowIso: string
    },
  ) {
    const [record] = await tx
      .update(oaReplyToken)
      .set({ used: true })
      .where(
        and(
          eq(oaReplyToken.oaId, input.oaId),
          eq(oaReplyToken.token, input.replyToken),
          eq(oaReplyToken.used, false),
          gt(oaReplyToken.expiresAt, input.nowIso),
        ),
      )
      .returning()
    return record ?? null
  }

  async function insertAcceptedRequest(
    tx: any,
    input: {
      oaId: string
      requestType: SendRequestType
      retryKey?: string
      requestHash: string
      acceptedRequestId: string
      messages: unknown[]
      target: unknown
      nowIso: string
    },
  ) {
    const expiresAt = input.retryKey
      ? new Date(new Date(input.nowIso).getTime() + RETRY_KEY_TTL_MS).toISOString()
      : null
    if (input.retryKey) {
      await tx
        .delete(oaRetryKey)
        .where(
          and(
            eq(oaRetryKey.oaId, input.oaId),
            eq(oaRetryKey.retryKey, input.retryKey),
            lte(oaRetryKey.expiresAt, input.nowIso),
          ),
        )
    }
    const [request] = await tx
      .insert(oaMessageRequest)
      .values({
        oaId: input.oaId,
        requestType: input.requestType,
        retryKey: input.retryKey,
        requestHash: input.requestHash,
        acceptedRequestId: input.acceptedRequestId,
        status: 'processing',
        messagesJson: input.messages,
        targetJson: input.target as Record<string, unknown>,
        expiresAt,
        updatedAt: input.nowIso,
      })
      .returning()

    if (input.retryKey && expiresAt) {
      const inserted = await tx
        .insert(oaRetryKey)
        .values({
          oaId: input.oaId,
          retryKey: input.retryKey,
          requestId: request.id,
          requestHash: input.requestHash,
          acceptedRequestId: input.acceptedRequestId,
          expiresAt,
        })
        .onConflictDoNothing()
        .returning({ id: oaRetryKey.id })
      if (inserted.length === 0) {
        throw new RetryKeyRaceError(
          {
            db: tx,
            now,
            oaId: input.oaId,
            requestType: input.requestType,
            retryKey: input.retryKey,
            target: input.target,
            messages: input.messages,
          },
          createHttpRequestId(),
        )
      }
    }

    return request
  }

  async function loadSentMessagesForAcceptedRequest(requestId: string) {
    const deliveries = await deps.db
      .select({
        messageIdsJson: oaMessageDelivery.messageIdsJson,
        status: oaMessageDelivery.status,
      })
      .from(oaMessageDelivery)
      .where(eq(oaMessageDelivery.requestId, requestId))
    if (deliveries.length === 0) return []
    if (deliveries.some((delivery) => delivery.status !== 'delivered')) return []
    const ids = deliveries.flatMap((delivery) => delivery.messageIdsJson as string[])
    return ids.map((id) => ({ id }))
  }

  async function acceptMessagingExecution(input: {
    oaId: string
    requestType: SendRequestType
    retryKey?: string
    target: unknown
    messages: NormalizedMessage[]
    resolveRecipients: (tx: any, nowIso: string) => Promise<string[] | { error: string }>
  }) {
    const checked = await checkRetryKeyForRequest({
      db: deps.db,
      now,
      oaId: input.oaId,
      requestType: input.requestType,
      retryKey: input.retryKey,
      target: input.target,
      messages: input.messages,
    })
    if (!checked.ok) {
      if (checked.code === 'RETRY_KEY_ACCEPTED' && checked.requestId) {
        return {
          ...checked,
          sentMessages: await loadSentMessagesForAcceptedRequest(checked.requestId),
        }
      }
      return checked
    }

    try {
      return await deps.db.transaction(async (tx) => {
        const nowIso = now().toISOString()
        const recipients = await input.resolveRecipients(tx, nowIso)
        if (!Array.isArray(recipients)) {
          return {
            ok: false as const,
            code: recipients.error,
            httpRequestId: checked.httpRequestId,
          }
        }

        const quotaDelta = recipients.length * input.messages.length
        const allowed = await reserveQuota(tx, input.oaId, quotaDelta, nowIso)
        if (!allowed) {
          return { ok: false as const, code: 'QUOTA_EXCEEDED', httpRequestId: checked.httpRequestId }
        }

        const acceptedRequestId = createAcceptedRequestId()
        const request = await insertAcceptedRequest(tx, {
          oaId: input.oaId,
          requestType: input.requestType,
          retryKey: input.retryKey,
          requestHash: checked.requestHash,
          acceptedRequestId,
          messages: input.messages,
          target: input.target,
          nowIso,
        })
        await createDeliveryRows({
          db: tx,
          requestId: request.id,
          oaId: input.oaId,
          userIds: recipients,
          messageCount: input.messages.length,
        })

        return {
          ok: true as const,
          accepted: {
            request,
            httpRequestId: checked.httpRequestId,
            acceptedRequestId,
          },
          recipientCount: recipients.length,
        }
      })
    } catch (err) {
      if (err instanceof RetryKeyRaceError) {
        return checkRetryKeyForRequest({ ...err.input, db: deps.db, now })
      }
      throw err
    }
  }

  async function push(input: {
    oaId: string
    retryKey?: string
    to: string
    messages: NormalizedMessage[]
  }) {
    const accepted = await acceptMessagingExecution({
      oaId: input.oaId,
      requestType: 'push',
      retryKey: input.retryKey,
      target: { to: input.to },
      messages: input.messages,
      resolveRecipients: async (tx) => {
        const [friendship] = await tx
          .select()
          .from(oaFriendship)
          .where(
            and(
              eq(oaFriendship.oaId, input.oaId),
              eq(oaFriendship.userId, input.to),
              eq(oaFriendship.status, 'friend'),
            ),
          )
          .limit(1)
        return friendship ? [input.to] : { error: 'NOT_FRIEND' }
      },
    })
    if (!accepted.ok) return accepted
    const processed = await processPendingDeliveries({ batchSize: 25, staleAfterMs: 30_000 })
    return { ...accepted, processed }
  }

  async function broadcast(input: {
    oaId: string
    retryKey?: string
    messages: NormalizedMessage[]
  }) {
    const accepted = await acceptMessagingExecution({
      oaId: input.oaId,
      requestType: 'broadcast',
      retryKey: input.retryKey,
      target: { audience: 'all_friends' },
      messages: input.messages,
      resolveRecipients: async (tx) => {
        const friends = await tx
          .select({ userId: oaFriendship.userId })
          .from(oaFriendship)
          .where(and(eq(oaFriendship.oaId, input.oaId), eq(oaFriendship.status, 'friend')))
        return friends.map((friend: { userId: string }) => friend.userId)
      },
    })
    if (!accepted.ok) return accepted
    const processed = await processPendingDeliveries({ batchSize: 100, staleAfterMs: 30_000 })
    return { ...accepted, processed }
  }

  async function reply(input: {
    oaId: string
    replyToken: string
    messages: NormalizedMessage[]
  }) {
    const accepted = await acceptMessagingExecution({
      oaId: input.oaId,
      requestType: 'reply',
      target: { replyToken: input.replyToken },
      messages: input.messages,
      resolveRecipients: async (tx, nowIso) => {
        const token = await claimReplyToken(tx, {
          oaId: input.oaId,
          replyToken: input.replyToken,
          nowIso,
        })
        return token ? [token.userId] : { error: 'INVALID_REPLY_TOKEN' }
      },
    })
    if (!accepted.ok) return accepted
    const processed = await processPendingDeliveries({ batchSize: 25, staleAfterMs: 30_000 })
    return { ...accepted, processed }
  }

  return {
    now,
    checkRetryKeyForRequest: (input: Omit<RetryKeyCheckInput, 'db' | 'now'>) =>
      checkRetryKeyForRequest({ ...input, db: deps.db, now }),
    createDeliveryRows,
    processPendingDeliveries,
    acceptMessagingExecution,
    reply,
    push,
    broadcast,
  }
}
