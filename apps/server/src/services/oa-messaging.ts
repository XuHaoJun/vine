import { createHash, randomUUID } from 'crypto'
import { and, eq, gt } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { schema } from '@vine/db'
import { oaRetryKey } from '@vine/db/schema-private'

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
  return {
    now,
    checkRetryKeyForRequest: (input: Omit<RetryKeyCheckInput, 'db' | 'now'>) =>
      checkRetryKeyForRequest({ ...input, db: deps.db, now }),
  }
}
