import { createHash, randomUUID } from 'crypto'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { schema } from '@vine/db'

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

export type OAMessagingDeps = {
  db: NodePgDatabase<typeof schema>
  instanceId: string
  now?: () => Date
}

export function createOAMessagingService(deps: OAMessagingDeps) {
  const now = deps.now ?? (() => new Date())
  return {
    now,
  }
}
