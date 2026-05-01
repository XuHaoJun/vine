import { createHash, randomUUID } from 'crypto'
import { and, eq, gt, inArray, isNull, lt, or } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { schema } from '@vine/db'
import { oaMessageDelivery, oaMessageRequest, oaRetryKey } from '@vine/db/schema-private'
import { chat, chatMember, message } from '@vine/db/schema-public'

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

  return {
    now,
    checkRetryKeyForRequest: (input: Omit<RetryKeyCheckInput, 'db' | 'now'>) =>
      checkRetryKeyForRequest({ ...input, db: deps.db, now }),
    createDeliveryRows,
    processPendingDeliveries,
  }
}
