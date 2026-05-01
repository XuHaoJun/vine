# Messaging API v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Vine's durable Messaging API v1 for Official Accounts: `/api/oa/v2` REST routes for reply, push, broadcast, webhook settings, quota, token operations, and rich menus, backed by PostgreSQL idempotency and delivery ledgers.

**Architecture:** Keep the external API LINE-like while moving business behavior into Vine-native server services. Public OA REST routes use `/api/oa/v2` only; send requests create durable PostgreSQL request/delivery rows, process delivery rows with deterministic message IDs, and rely on Zero to sync chat/message rows to clients. Use a PostgreSQL-backed outbox with `FOR UPDATE SKIP LOCKED`; do not introduce RabbitMQ.

**Tech Stack:** TypeScript, Bun, Fastify, Drizzle ORM, PostgreSQL, Vitest, Zero-backed chat/message tables, `@vine/db`, `@vine/flex-schema`, `@vine/imagemap-schema`.

**Upstream spec:** [`docs/superpowers/specs/2026-05-01-messaging-api-v1-design.md`](../specs/2026-05-01-messaging-api-v1-design.md)

---

## Execution Order

1. Route namespace guardrails.
2. DB schema and migration for send request/delivery/retry-key tables.
3. Service extraction for auth, normalization, retry keys, and delivery rows.
4. Delivery processing with deterministic message IDs and crash recovery.
5. Update reply/push routes and add broadcast.
6. Move webhook/richmenu public routes under `/api/oa/v2`.
7. Startup/periodic recovery wiring.
8. Full verification.

Each task should be committed independently after its verification passes.

---

## File Structure

### Create

- `apps/server/src/plugins/oa-routes.ts` — shared public OA API base constants and route helper.
- `apps/server/src/services/oa-messaging.ts` — Vine-native Messaging API v1 service: request acceptance, retry-key handling, delivery creation, and delivery processing orchestration.
- `apps/server/src/services/oa-messaging.test.ts` — unit tests for retry-key semantics, route-independent request acceptance, quota behavior, and response shapes.
- `apps/server/src/services/oa-messaging.int.test.ts` — PostgreSQL integration tests for retry-key uniqueness, deterministic message id recovery, recipient snapshots, and `FOR UPDATE SKIP LOCKED`.
- `packages/db/src/migrations/20260501000001_oa_message_outbox.ts` — migration for `oaMessageRequest`, `oaMessageDelivery`, and `oaRetryKey`.

### Modify

- `packages/db/src/schema-private.ts` — add Drizzle table definitions for the three new operational tables so the Zero publication rebuild excludes them automatically.
- `apps/server/src/plugins/oa-messaging.ts` — convert to thin REST adapter, add broadcast, enforce retry-key support matrix, use `/api/oa/v2`.
- `apps/server/src/plugins/oa-messaging.test.ts` — update route paths and add route-level behavior tests.
- `apps/server/src/plugins/oa-webhook-endpoint.ts` — move routes from `/v2/...` to `/api/oa/v2/...` and add namespace comment.
- `apps/server/src/plugins/oa-webhook-endpoint.test.ts` — cover namespace behavior for webhook endpoint settings.
- `apps/server/src/plugins/oa-richmenu.ts` — move public REST routes from `/v2/...` to `/api/oa/v2/...`.
- `apps/server/src/plugins/oa-richmenu.test.ts` — update route paths and assert root `/v2/...` is not registered.
- `apps/server/src/services/oa.ts` — keep OA management methods; do not use `resolveReplyToken`/`markReplyTokenUsed` for Messaging API v1 transaction boundaries.
- `apps/server/src/index.ts` — construct and inject the new messaging service, wire recovery loop with explicit deps.
- `apps/server/src/test/integration-db.ts` — no planned changes; use it from `oa-messaging.int.test.ts`.

---

## Task 1: Public OA Route Namespace

**Files:**
- Create: `apps/server/src/plugins/oa-routes.ts`
- Modify: `apps/server/src/plugins/oa-messaging.ts`
- Modify: `apps/server/src/plugins/oa-messaging.test.ts`
- Modify: `apps/server/src/plugins/oa-webhook-endpoint.ts`
- Create: `apps/server/src/plugins/oa-webhook-endpoint.test.ts`
- Modify: `apps/server/src/plugins/oa-richmenu.ts`
- Modify: `apps/server/src/plugins/oa-richmenu.test.ts`

- [ ] **Step 1: Create the shared route constants**

Create `apps/server/src/plugins/oa-routes.ts`:

```ts
// Vine hosts the public Official Account API on the same domain as the app.
// Keep every LINE-like public OA endpoint under this base. Do not add root
// `/v2/...` routes unless Vine later gets a dedicated Messaging API domain.
export const OA_API_BASE = '/api/oa/v2' as const

export function oaApiPath(path: `/${string}`): string {
  return `${OA_API_BASE}${path}`
}
```

- [ ] **Step 2: Update message route tests to use `/api/oa/v2`**

In `apps/server/src/plugins/oa-messaging.test.ts`, import the helper:

```ts
import { oaApiPath } from './oa-routes'
```

Replace route literals such as:

```ts
url: '/api/oa/v2/bot/message/push',
```

with:

```ts
url: oaApiPath('/bot/message/push'),
```

Add this test near the push-message auth tests:

```ts
it('does not register the root /v2 push route', async () => {
  const mockDb = makeMockDb([{ oaId, token: validToken, expiresAt: null }], [])
  const { app } = createTestApp(mockDb)
  await app.ready()

  const res = await app.inject({
    method: 'POST',
    url: '/v2/bot/message/push',
    headers: { authorization: `Bearer ${validToken}` },
    payload: { to: userId, messages: [{ type: 'text', text: 'hello' }] },
  })

  await app.close()
  expect(res.statusCode).toBe(404)
})
```

- [ ] **Step 3: Update `oa-messaging.ts` routes**

In `apps/server/src/plugins/oa-messaging.ts`, import:

```ts
import { oaApiPath } from './oa-routes'
```

Change each route path:

```ts
'/api/oa/v2/bot/message/reply'
```

to:

```ts
oaApiPath('/bot/message/reply')
```

Do the same for:

```text
/bot/message/push
/bot/profile/:userId
/bot/message/quota
/bot/message/quota/consumption
/bot/message/:messageId/content
/oauth/accessToken
/oauth/revoke
```

- [ ] **Step 4: Move webhook endpoint routes under `/api/oa/v2`**

In `apps/server/src/plugins/oa-webhook-endpoint.ts`, import `oaApiPath` and replace:

```ts
'/v2/bot/channel/webhook/endpoint'
```

with:

```ts
oaApiPath('/bot/channel/webhook/endpoint')
```

Replace:

```ts
'/v2/bot/channel/webhook/test'
```

with:

```ts
oaApiPath('/bot/channel/webhook/test')
```

- [ ] **Step 5: Add webhook endpoint namespace tests**

Create `apps/server/src/plugins/oa-webhook-endpoint.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import Fastify from 'fastify'
import { oaApiPath } from './oa-routes'
import { oaWebhookEndpointPlugin } from './oa-webhook-endpoint'

const validToken = 'valid-test-token'
const oaId = '550e8400-e29b-41d4-a716-446655440000'

function makeMockDb(tokenResult: unknown[]) {
  const mockLimit = vi.fn().mockResolvedValue(tokenResult)
  const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit })
  const mockFrom = vi.fn().mockReturnValue({ where: mockWhere })
  const mockSelect = vi.fn().mockReturnValue({ from: mockFrom })
  return { select: mockSelect } as any
}

function createTestApp() {
  const db = makeMockDb([{ oaId, token: validToken, expiresAt: null }])
  const oa = {
    setWebhook: vi.fn().mockResolvedValue(undefined),
    getWebhook: vi.fn().mockResolvedValue({
      url: 'https://example.com/webhook',
      status: 'verified',
    }),
    getOfficialAccount: vi.fn().mockResolvedValue({
      id: oaId,
      channelSecret: 'channel-secret',
    }),
    generateWebhookSignature: vi.fn().mockReturnValue('signature'),
  }
  const app = Fastify()
  app.register(oaWebhookEndpointPlugin, { oa: oa as any, db })
  return { app, oa }
}

describe('oaWebhookEndpointPlugin route namespace', () => {
  it('serves webhook endpoint settings under /api/oa/v2', async () => {
    const { app } = createTestApp()
    await app.ready()

    const res = await app.inject({
      method: 'GET',
      url: oaApiPath('/bot/channel/webhook/endpoint'),
      headers: { authorization: `Bearer ${validToken}` },
    })

    await app.close()
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toEqual({
      endpoint: 'https://example.com/webhook',
      active: true,
    })
  })

  it('does not register root /v2 webhook endpoint settings', async () => {
    const { app } = createTestApp()
    await app.ready()

    const res = await app.inject({
      method: 'GET',
      url: '/v2/bot/channel/webhook/endpoint',
      headers: { authorization: `Bearer ${validToken}` },
    })

    await app.close()
    expect(res.statusCode).toBe(404)
  })
})
```

- [ ] **Step 6: Move rich menu routes under `/api/oa/v2`**

In `apps/server/src/plugins/oa-richmenu.ts`, import `oaApiPath` and wrap every root `/v2` route:

```ts
oaApiPath('/bot/richmenu')
oaApiPath('/bot/richmenu/validate')
oaApiPath('/bot/richmenu/:richMenuId/content')
oaApiPath('/bot/richmenu/list')
oaApiPath('/bot/richmenu/:richMenuId')
oaApiPath('/bot/user/all/richmenu/:richMenuId')
oaApiPath('/bot/user/all/richmenu')
oaApiPath('/bot/user/:userId/richmenu/:richMenuId')
oaApiPath('/bot/user/:userId/richmenu')
oaApiPath('/bot/richmenu/bulk/link')
oaApiPath('/bot/richmenu/bulk/unlink')
oaApiPath('/bot/richmenu/alias')
oaApiPath('/bot/richmenu/alias/:richMenuAliasId')
oaApiPath('/bot/richmenu/alias/list')
oaApiPath('/bot/richmenu/batch')
oaApiPath('/bot/richmenu/progress/batch')
oaApiPath('/bot/richmenu/validate/batch')
```

- [ ] **Step 7: Update rich menu route tests**

In `apps/server/src/plugins/oa-richmenu.test.ts`, import `oaApiPath` and replace test URLs with it. Add:

```ts
it('does not register the root /v2 richmenu route', async () => {
  const { app } = createTestApp()
  await app.ready()

  const res = await app.inject({
    method: 'GET',
    url: '/v2/bot/richmenu/list',
    headers: { authorization: `Bearer ${validToken}` },
  })

  await app.close()
expect(res.statusCode).toBe(404)
})
```

- [ ] **Step 8: Run namespace tests**

Run:

```bash
bun run --cwd apps/server test:unit -- src/plugins/oa-messaging.test.ts src/plugins/oa-webhook-endpoint.test.ts src/plugins/oa-richmenu.test.ts
```

Expected: PASS. If Vitest does not accept multiple file arguments with this script, run:

```bash
bun run --cwd apps/server test:unit
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add apps/server/src/plugins/oa-routes.ts \
  apps/server/src/plugins/oa-messaging.ts \
  apps/server/src/plugins/oa-messaging.test.ts \
  apps/server/src/plugins/oa-webhook-endpoint.ts \
  apps/server/src/plugins/oa-webhook-endpoint.test.ts \
  apps/server/src/plugins/oa-richmenu.ts \
  apps/server/src/plugins/oa-richmenu.test.ts
git commit -m "refactor(oa): standardize public api namespace"
```

---

## Task 2: DB Schema And Migration For Durable Messaging

**Files:**
- Modify: `packages/db/src/schema-private.ts`
- Create: `packages/db/src/migrations/20260501000001_oa_message_outbox.ts`

- [ ] **Step 1: Add Drizzle tables**

Operational messaging tables must not enter Zero. `packages/db/src/migrate.ts`
derives the Zero publication exclusion list from `packages/db/src/schema-private.ts`,
so add these tables there instead of `schema-oa.ts`.

In `packages/db/src/schema-private.ts`, extend the `drizzle-orm/pg-core` import so it includes:

```ts
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
```

Add this import near the other schema imports:

```ts
import { officialAccount } from './schema-oa'
```

Append to `packages/db/src/schema-private.ts` after the existing table definitions:

```ts
export const oaMessageRequest = pgTable(
  'oaMessageRequest',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    oaId: uuid('oaId')
      .notNull()
      .references(() => officialAccount.id, { onDelete: 'cascade' }),
    requestType: text('requestType').notNull(),
    retryKey: text('retryKey'),
    requestHash: text('requestHash').notNull(),
    acceptedRequestId: text('acceptedRequestId').notNull(),
    status: text('status').notNull().default('accepted'),
    messagesJson: jsonb('messagesJson').notNull(),
    targetJson: jsonb('targetJson'),
    errorCode: text('errorCode'),
    errorMessage: text('errorMessage'),
    createdAt: timestamp('createdAt', { mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp('updatedAt', { mode: 'string' }).defaultNow().notNull(),
    completedAt: timestamp('completedAt', { mode: 'string' }),
    expiresAt: timestamp('expiresAt', { mode: 'string' }),
  },
  (table) => [
    index('oaMessageRequest_oaId_type_createdAt_idx').on(
      table.oaId,
      table.requestType,
      table.createdAt,
    ),
    index('oaMessageRequest_status_idx').on(table.status),
    uniqueIndex('oaMessageRequest_acceptedRequestId_idx').on(table.acceptedRequestId),
  ],
)

export const oaMessageDelivery = pgTable(
  'oaMessageDelivery',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    requestId: uuid('requestId')
      .notNull()
      .references(() => oaMessageRequest.id, { onDelete: 'cascade' }),
    oaId: uuid('oaId')
      .notNull()
      .references(() => officialAccount.id, { onDelete: 'cascade' }),
    userId: text('userId').notNull(),
    chatId: text('chatId'),
    status: text('status').notNull().default('pending'),
    messageIdsJson: jsonb('messageIdsJson').notNull(),
    attemptCount: integer('attemptCount').notNull().default(0),
    lastErrorCode: text('lastErrorCode'),
    lastErrorMessage: text('lastErrorMessage'),
    lockedAt: timestamp('lockedAt', { mode: 'string' }),
    lockedBy: text('lockedBy'),
    createdAt: timestamp('createdAt', { mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp('updatedAt', { mode: 'string' }).defaultNow().notNull(),
    deliveredAt: timestamp('deliveredAt', { mode: 'string' }),
  },
  (table) => [
    uniqueIndex('oaMessageDelivery_request_user_idx').on(table.requestId, table.userId),
    index('oaMessageDelivery_status_lockedAt_idx').on(table.status, table.lockedAt),
    index('oaMessageDelivery_oaId_userId_idx').on(table.oaId, table.userId),
    index('oaMessageDelivery_requestId_idx').on(table.requestId),
  ],
)

export const oaRetryKey = pgTable(
  'oaRetryKey',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    oaId: uuid('oaId')
      .notNull()
      .references(() => officialAccount.id, { onDelete: 'cascade' }),
    retryKey: text('retryKey').notNull(),
    requestId: uuid('requestId')
      .notNull()
      .references(() => oaMessageRequest.id, { onDelete: 'cascade' }),
    requestHash: text('requestHash').notNull(),
    acceptedRequestId: text('acceptedRequestId').notNull(),
    expiresAt: timestamp('expiresAt', { mode: 'string' }).notNull(),
    createdAt: timestamp('createdAt', { mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('oaRetryKey_oaId_retryKey_idx').on(table.oaId, table.retryKey),
    index('oaRetryKey_expiresAt_idx').on(table.expiresAt),
  ],
)
```

- [ ] **Step 2: Add a migration**

Create `packages/db/src/migrations/20260501000001_oa_message_outbox.ts`:

```ts
import type { PoolClient } from 'pg'

const sql = `
CREATE TABLE "oaMessageRequest" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "oaId" uuid NOT NULL,
  "requestType" text NOT NULL,
  "retryKey" text,
  "requestHash" text NOT NULL,
  "acceptedRequestId" text NOT NULL,
  "status" text DEFAULT 'accepted' NOT NULL,
  "messagesJson" jsonb NOT NULL,
  "targetJson" jsonb,
  "errorCode" text,
  "errorMessage" text,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL,
  "completedAt" timestamp,
  "expiresAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "oaMessageDelivery" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "requestId" uuid NOT NULL,
  "oaId" uuid NOT NULL,
  "userId" text NOT NULL,
  "chatId" text,
  "status" text DEFAULT 'pending' NOT NULL,
  "messageIdsJson" jsonb NOT NULL,
  "attemptCount" integer DEFAULT 0 NOT NULL,
  "lastErrorCode" text,
  "lastErrorMessage" text,
  "lockedAt" timestamp,
  "lockedBy" text,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL,
  "deliveredAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "oaRetryKey" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "oaId" uuid NOT NULL,
  "retryKey" text NOT NULL,
  "requestId" uuid NOT NULL,
  "requestHash" text NOT NULL,
  "acceptedRequestId" text NOT NULL,
  "expiresAt" timestamp NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "oaMessageRequest_oaId_type_createdAt_idx" ON "oaMessageRequest" ("oaId", "requestType", "createdAt");
--> statement-breakpoint
CREATE UNIQUE INDEX "oaMessageRequest_acceptedRequestId_idx" ON "oaMessageRequest" ("acceptedRequestId");
--> statement-breakpoint
CREATE INDEX "oaMessageRequest_status_idx" ON "oaMessageRequest" ("status");
--> statement-breakpoint
CREATE UNIQUE INDEX "oaMessageDelivery_request_user_idx" ON "oaMessageDelivery" ("requestId", "userId");
--> statement-breakpoint
CREATE INDEX "oaMessageDelivery_status_lockedAt_idx" ON "oaMessageDelivery" ("status", "lockedAt");
--> statement-breakpoint
CREATE INDEX "oaMessageDelivery_oaId_userId_idx" ON "oaMessageDelivery" ("oaId", "userId");
--> statement-breakpoint
CREATE INDEX "oaMessageDelivery_requestId_idx" ON "oaMessageDelivery" ("requestId");
--> statement-breakpoint
CREATE UNIQUE INDEX "oaRetryKey_oaId_retryKey_idx" ON "oaRetryKey" ("oaId", "retryKey");
--> statement-breakpoint
CREATE INDEX "oaRetryKey_expiresAt_idx" ON "oaRetryKey" ("expiresAt");
--> statement-breakpoint
ALTER TABLE "oaMessageRequest" ADD CONSTRAINT "oaMessageRequest_oaId_officialAccount_id_fkey" FOREIGN KEY ("oaId") REFERENCES "officialAccount"("id") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "oaMessageDelivery" ADD CONSTRAINT "oaMessageDelivery_requestId_oaMessageRequest_id_fkey" FOREIGN KEY ("requestId") REFERENCES "oaMessageRequest"("id") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "oaMessageDelivery" ADD CONSTRAINT "oaMessageDelivery_oaId_officialAccount_id_fkey" FOREIGN KEY ("oaId") REFERENCES "officialAccount"("id") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "oaRetryKey" ADD CONSTRAINT "oaRetryKey_oaId_officialAccount_id_fkey" FOREIGN KEY ("oaId") REFERENCES "officialAccount"("id") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "oaRetryKey" ADD CONSTRAINT "oaRetryKey_requestId_oaMessageRequest_id_fkey" FOREIGN KEY ("requestId") REFERENCES "oaMessageRequest"("id") ON DELETE CASCADE;
`

export async function up(client: PoolClient): Promise<void> {
  await client.query(sql)
}

export async function down(client: PoolClient): Promise<void> {
  await client.query(`
    DROP TABLE IF EXISTS "oaRetryKey";
    DROP TABLE IF EXISTS "oaMessageDelivery";
    DROP TABLE IF EXISTS "oaMessageRequest";
  `)
}
```

- [ ] **Step 3: Run server typecheck**

Run:

```bash
bun run --cwd apps/server typecheck
```

Expected: PASS.

- [ ] **Step 4: Verify outbox tables are excluded from Zero publication**

Run after migration in a local database:

```bash
docker compose up -d pgdb migrate
docker compose exec pgdb psql -U user -d postgres -c "SELECT tablename FROM pg_publication_tables WHERE pubname = 'zero_takeout' AND tablename IN ('oaMessageRequest', 'oaMessageDelivery', 'oaRetryKey');"
```

Expected: zero rows.

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/schema-private.ts packages/db/src/migrations/20260501000001_oa_message_outbox.ts
git commit -m "feat(oa): add messaging outbox schema"
```

---

## Task 3: Messaging Service Skeleton And Request Utilities

**Files:**
- Create: `apps/server/src/services/oa-messaging.ts`
- Create: `apps/server/src/services/oa-messaging.test.ts`

- [ ] **Step 1: Write unit tests for request utility behavior**

Create `apps/server/src/services/oa-messaging.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  createAcceptedRequestId,
  createHttpRequestId,
  createRequestHash,
  createDeterministicMessageIds,
  isValidLineRetryKey,
} from './oa-messaging'

describe('oa messaging request utilities', () => {
  it('validates LINE retry-key UUID shape', () => {
    expect(isValidLineRetryKey('123e4567-e89b-12d3-a456-426614174000')).toBe(true)
    expect(isValidLineRetryKey('not-a-uuid')).toBe(false)
  })

  it('hashes normalized request content deterministically', () => {
    const one = createRequestHash({
      endpoint: 'push',
      target: { to: 'user-1' },
      messages: [{ type: 'text', text: 'hello' }],
    })
    const two = createRequestHash({
      messages: [{ text: 'hello', type: 'text' }],
      target: { to: 'user-1' },
      endpoint: 'push',
    })

    expect(one).toBe(two)
  })

  it('creates deterministic message ids for a request delivery', () => {
    expect(
      createDeterministicMessageIds({
        requestId: 'req-1',
        userId: 'user-1',
        messageCount: 2,
      }),
    ).toEqual(['oa:req:req-1:user-1:0', 'oa:req:req-1:user-1:1'])
  })

  it('creates request ids with stable prefixes', () => {
    expect(createHttpRequestId()).toMatch(/^req_/)
    expect(createAcceptedRequestId()).toMatch(/^acc_/)
  })
})
```

- [ ] **Step 2: Run the new test and verify failure**

Run:

```bash
bun run --cwd apps/server test:unit -- src/services/oa-messaging.test.ts
```

Expected: FAIL because `apps/server/src/services/oa-messaging.ts` does not exist.

- [ ] **Step 3: Implement request utilities and service factory shell**

Create `apps/server/src/services/oa-messaging.ts`:

```ts
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
```

- [ ] **Step 4: Run the test and verify pass**

Run:

```bash
bun run --cwd apps/server test:unit -- src/services/oa-messaging.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/services/oa-messaging.ts apps/server/src/services/oa-messaging.test.ts
git commit -m "feat(oa): add messaging request utilities"
```

---

## Task 4: Retry-Key Validation And Lookup Helpers

**Files:**
- Modify: `apps/server/src/services/oa-messaging.ts`
- Modify: `apps/server/src/services/oa-messaging.test.ts`

- [ ] **Step 1: Add unit tests for LINE retry-key support matrix**

Append to `apps/server/src/services/oa-messaging.test.ts`:

```ts
import { vi } from 'vitest'
import { checkRetryKeyForRequest, createRequestHash } from './oa-messaging'

function makeMockDbForRetryKeyLookup(existingRetryRows: unknown[] = []) {
  const retryLimit = vi.fn().mockResolvedValue(existingRetryRows)
  const db = {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ limit: retryLimit }),
      }),
    }),
  } as any
  return { db, retryLimit }
}

describe('oa messaging retry-key lookup', () => {
  it('rejects retry key on reply', async () => {
    const { db } = makeMockDbForRetryKeyLookup()

    const result = await checkRetryKeyForRequest({
      db,
      now: () => new Date('2026-05-01T00:00:00.000Z'),
      oaId: 'oa-1',
      requestType: 'reply',
      retryKey: '123e4567-e89b-12d3-a456-426614174000',
      target: { replyToken: 'reply-1' },
      messages: [{ type: 'text', text: 'hello' }],
    })

    expect(result).toMatchObject({ ok: false, code: 'INVALID_RETRY_KEY' })
  })

  it('returns duplicate accepted retry-key response', async () => {
    const { db } = makeMockDbForRetryKeyLookup([
      {
        requestId: 'request-original',
        oaId: 'oa-1',
        retryKey: '123e4567-e89b-12d3-a456-426614174000',
        requestHash: createRequestHash({
          endpoint: 'push',
          target: { to: 'user-1' },
          messages: [{ type: 'text', text: 'hello' }],
        }),
        acceptedRequestId: 'acc_original',
        expiresAt: '2026-05-02T00:00:00.000Z',
      },
    ])

    const result = await checkRetryKeyForRequest({
      db,
      now: () => new Date('2026-05-01T00:00:00.000Z'),
      oaId: 'oa-1',
      requestType: 'push',
      retryKey: '123e4567-e89b-12d3-a456-426614174000',
      target: { to: 'user-1' },
      messages: [{ type: 'text', text: 'hello' }],
    })

    expect(result).toMatchObject({
      ok: false,
      code: 'RETRY_KEY_ACCEPTED',
      requestId: 'request-original',
      acceptedRequestId: 'acc_original',
    })
  })

  it('rejects retry-key reuse with a different body', async () => {
    const { db } = makeMockDbForRetryKeyLookup([
      {
        requestHash: 'different-hash',
        acceptedRequestId: 'acc_original',
        expiresAt: '2026-05-02T00:00:00.000Z',
      },
    ])

    const result = await checkRetryKeyForRequest({
      db,
      now: () => new Date('2026-05-01T00:00:00.000Z'),
      oaId: 'oa-1',
      requestType: 'push',
      retryKey: '123e4567-e89b-12d3-a456-426614174000',
      target: { to: 'user-1' },
      messages: [{ type: 'text', text: 'hello' }],
    })

    expect(result).toMatchObject({
      ok: false,
      code: 'RETRY_KEY_CONFLICT',
    })
  })

  it('ignores expired retry-key rows so the key can be accepted again', async () => {
    const { db } = makeMockDbForRetryKeyLookup([])

    const result = await checkRetryKeyForRequest({
      db,
      now: () => new Date('2026-05-01T00:00:00.000Z'),
      oaId: 'oa-1',
      requestType: 'push',
      retryKey: '123e4567-e89b-12d3-a456-426614174000',
      target: { to: 'user-1' },
      messages: [{ type: 'text', text: 'hello' }],
    })

    expect(result).toMatchObject({ ok: true })
  })
})
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
bun run --cwd apps/server test:unit -- src/services/oa-messaging.test.ts
```

Expected: FAIL because `checkRetryKeyForRequest` is not implemented.

- [ ] **Step 3: Implement retry-key lookup without accepting a request**

In `apps/server/src/services/oa-messaging.ts`, add imports:

```ts
import { and, eq, gt } from 'drizzle-orm'
import { oaRetryKey } from '@vine/db/schema-private'
```

Add types before the factory:

```ts
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
```

Add a top-level helper. This helper only validates and looks up existing active
retry keys. It does not insert `oaMessageRequest` or `oaRetryKey`; acceptance is
done later inside one transaction with recipient snapshot, quota, and delivery
rows.

```ts
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
```

Inside `createOAMessagingService`, return the helper for unit tests and for the
high-level send methods:

```ts
return {
  now,
  checkRetryKeyForRequest: (input: Omit<RetryKeyCheckInput, 'db' | 'now'>) =>
    checkRetryKeyForRequest({ ...input, db: deps.db, now }),
}
```

- [ ] **Step 4: Run tests**

Run:

```bash
bun run --cwd apps/server test:unit -- src/services/oa-messaging.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/services/oa-messaging.ts apps/server/src/services/oa-messaging.test.ts
git commit -m "feat(oa): add messaging retry key lookup"
```

---

## Task 5: Delivery Creation And Processing

**Files:**
- Modify: `apps/server/src/services/oa-messaging.ts`
- Modify: `apps/server/src/services/oa-messaging.test.ts`
- Create: `apps/server/src/services/oa-messaging.int.test.ts`

- [ ] **Step 1: Add a unit test for delivery creation IDs**

Append to `apps/server/src/services/oa-messaging.test.ts`:

```ts
describe('oa messaging delivery creation', () => {
  it('creates one delivery per recipient with deterministic message ids', async () => {
    const deliveryRows: unknown[] = []
    const db = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn((rows: unknown[]) => {
          deliveryRows.push(...rows)
          return { onConflictDoNothing: vi.fn().mockResolvedValue(undefined) }
        }),
      }),
    } as any
    const service = createOAMessagingService({
      db,
      instanceId: 'test',
      now: () => new Date('2026-05-01T00:00:00.000Z'),
    })

    await service.createDeliveryRows({
      requestId: 'request-1',
      oaId: 'oa-1',
      userIds: ['user-1', 'user-2'],
      messageCount: 2,
    })

    expect(deliveryRows).toEqual([
      expect.objectContaining({
        requestId: 'request-1',
        oaId: 'oa-1',
        userId: 'user-1',
        messageIdsJson: ['oa:req:request-1:user-1:0', 'oa:req:request-1:user-1:1'],
      }),
      expect.objectContaining({
        requestId: 'request-1',
        oaId: 'oa-1',
        userId: 'user-2',
        messageIdsJson: ['oa:req:request-1:user-2:0', 'oa:req:request-1:user-2:1'],
      }),
    ])
  })
})
```

- [ ] **Step 2: Implement `createDeliveryRows`**

In `apps/server/src/services/oa-messaging.ts`, import:

```ts
import { oaMessageDelivery } from '@vine/db/schema-private'
```

Add inside the factory:

```ts
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
        status: 'pending',
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
```

Return it from the factory.

- [ ] **Step 3: Add DB integration test for deterministic recovery**

Create `apps/server/src/services/oa-messaging.int.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { chat, chatMember, message } from '@vine/db/schema-public'
import { oaMessageDelivery, oaMessageRequest } from '@vine/db/schema-private'
import { officialAccount, oaProvider } from '@vine/db/schema-oa'
import { withRollbackDb } from '../test/integration-db'
import { createOAMessagingService } from './oa-messaging'

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
    await withRollbackDb(async (db) => {
      const now = '2026-05-01T00:00:00.000Z'
      const [provider] = await db
        .insert(oaProvider)
        .values({ name: 'Provider 2', ownerId: 'owner-1' })
        .returning()
      const [oa] = await db
        .insert(officialAccount)
        .values({
          providerId: provider.id,
          name: 'OA 2',
          uniqueId: 'oa-skip-locked-test',
          channelSecret: 'secret',
        })
        .returning()
      const [request] = await db
        .insert(oaMessageRequest)
        .values({
          oaId: oa.id,
          requestType: 'broadcast',
          requestHash: 'hash-2',
          acceptedRequestId: 'acc_skip_locked',
          messagesJson: [{ type: 'text', text: 'hello' }],
          status: 'processing',
          updatedAt: now,
        })
        .returning()
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
        db,
        instanceId: 'worker-a',
        now: () => new Date(now),
      })
      const serviceB = createOAMessagingService({
        db,
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
    })
  })
})
```

- [ ] **Step 4: Implement `processPendingDeliveries`**

In `apps/server/src/services/oa-messaging.ts`, import:

```ts
import { inArray, isNull, lt, or, sql } from 'drizzle-orm'
import { chat, chatMember, message } from '@vine/db/schema-public'
```

Add a helper inside the factory:

```ts
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
```

Add:

```ts
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
```

Add this helper above `processPendingDeliveries`:

```ts
async function updateRequestStatus(tx: any, requestId: string) {
  const rows = await tx
    .select({ status: oaMessageDelivery.status })
    .from(oaMessageDelivery)
    .where(eq(oaMessageDelivery.requestId, requestId))

  if (rows.length === 0) return

  const delivered = rows.filter((row) => row.status === 'delivered').length
  const failed = rows.filter((row) => row.status === 'failed').length
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
```

If Drizzle's `.for('update', { skipLocked: true })` is not supported by this beta version, implement the claim query with `deps.db.execute(sql\`...\`)` and map selected ids back through Drizzle. Keep the integration test proving that rows are not double-claimed.

Return `processPendingDeliveries` from the factory.

- [ ] **Step 5: Run tests**

Run unit:

```bash
bun run --cwd apps/server test:unit -- src/services/oa-messaging.test.ts
```

Run DB integration with the local database:

```bash
docker compose up -d pgdb migrate
ZERO_UPSTREAM_DB=postgresql://user:password@localhost:5533/postgres bun run --cwd apps/server test:integration -- src/services/oa-messaging.int.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/services/oa-messaging.ts \
  apps/server/src/services/oa-messaging.test.ts \
  apps/server/src/services/oa-messaging.int.test.ts
git commit -m "feat(oa): add durable message delivery processing"
```

---

## Task 6: Reply, Push, Broadcast Service Methods

**Files:**
- Modify: `apps/server/src/services/oa-messaging.ts`
- Modify: `apps/server/src/services/oa-messaging.test.ts`
- Modify: `apps/server/src/services/oa-messaging.int.test.ts`

- [ ] **Step 1: Add integration tests for transactional acceptance**

At the top of `apps/server/src/services/oa-messaging.int.test.ts`, extend imports:

```ts
import { oaFriendship, oaQuota } from '@vine/db/schema-oa'
import { oaRetryKey } from '@vine/db/schema-private'
```

Then append these helpers and tests below the existing imports:

```ts

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
      expect(deliveries.map((row) => row.userId).sort()).toEqual(['user-1', 'user-2'])
    })
  })
})
```

- [ ] **Step 2: Extend service deps**

In `apps/server/src/services/oa-messaging.ts`, keep service deps transaction-local.
Do not pass `checkAndIncrementUsage`, `resolveReplyToken`, or `markReplyTokenUsed`
from `createOAService`; those helpers use the root DB handle and cannot participate
in the Messaging API acceptance transaction.

```ts
export type OAMessagingDeps = {
  db: NodePgDatabase<typeof schema>
  instanceId: string
  now?: () => Date
}
```

- [ ] **Step 3: Implement transactional acceptance helpers**

In `apps/server/src/services/oa-messaging.ts`, import:

```ts
import { sql } from 'drizzle-orm'
import { oaFriendship, oaQuota, oaReplyToken } from '@vine/db/schema-oa'
import { oaMessageDelivery, oaMessageRequest, oaRetryKey } from '@vine/db/schema-private'
```

Add this error class above `createOAMessagingService`:

```ts
class RetryKeyRaceError extends Error {
  constructor(
    readonly input: RetryKeyCheckInput,
    readonly httpRequestId: string,
  ) {
    super('Retry key was accepted by another transaction')
  }
}
```

Add these helpers inside the factory:

```ts
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

async function claimReplyToken(tx: any, input: {
  oaId: string
  replyToken: string
  nowIso: string
}) {
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

async function insertAcceptedRequest(tx: any, input: {
  oaId: string
  requestType: SendRequestType
  retryKey?: string
  requestHash: string
  acceptedRequestId: string
  messages: unknown[]
  target: unknown
  nowIso: string
}) {
  const expiresAt = input.retryKey
    ? new Date(new Date(input.nowIso).getTime() + RETRY_KEY_TTL_MS).toISOString()
    : null
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
```

- [ ] **Step 4: Implement high-level send methods on top of the transaction**

Add these methods inside the factory:

```ts
type NormalizedMessage = { type: string; text?: string | null; metadata?: string | null }

async function loadSentMessagesForAcceptedRequest(requestId: string) {
  const deliveries = await deps.db
    .select({ messageIdsJson: oaMessageDelivery.messageIdsJson })
    .from(oaMessageDelivery)
    .where(eq(oaMessageDelivery.requestId, requestId))
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
  return { ok: true as const, ...accepted, processed }
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
      return friends.map((friend) => friend.userId)
    },
  })
  if (!accepted.ok) return accepted
  const processed = await processPendingDeliveries({ batchSize: 100, staleAfterMs: 30_000 })
  return { ok: true as const, ...accepted, processed }
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
  return { ok: true as const, ...accepted, processed }
}
```

Return `reply`, `push`, `broadcast`, and `acceptMessagingExecution`.

- [ ] **Step 5: Run tests**

Run unit:

```bash
bun run --cwd apps/server test:unit -- src/services/oa-messaging.test.ts
```

Run DB integration:

```bash
docker compose up -d pgdb migrate
ZERO_UPSTREAM_DB=postgresql://user:password@localhost:5533/postgres bun run --cwd apps/server test:integration -- src/services/oa-messaging.int.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/services/oa-messaging.ts \
  apps/server/src/services/oa-messaging.test.ts \
  apps/server/src/services/oa-messaging.int.test.ts
git commit -m "feat(oa): add messaging send orchestration"
```

---

## Task 7: REST Adapter For Reply, Push, Broadcast

**Files:**
- Modify: `apps/server/src/plugins/oa-messaging.ts`
- Modify: `apps/server/src/plugins/oa-messaging.test.ts`
- Modify: `apps/server/src/index.ts`

- [ ] **Step 1: Update test app setup to inject messaging service**

In `apps/server/src/plugins/oa-messaging.test.ts`, update `createTestApp` so it builds:

```ts
const mockMessaging = {
  reply: vi.fn(),
  push: vi.fn(),
  broadcast: vi.fn(),
}
```

Register the plugin with:

```ts
app.register(oaMessagingPlugin, {
  oa: mockOa as any,
  messaging: mockMessaging as any,
  db,
  drive: mockDrive,
})
```

Return `mockMessaging` from `createTestApp`.

- [ ] **Step 2: Add route tests for broadcast and retry-key headers**

Add tests:

```ts
it('returns 409 with accepted request id for duplicate push retry key', async () => {
  const mockDb = makeMockDb([{ oaId, token: validToken, expiresAt: null }], [])
  const { app, mockMessaging } = createTestApp(mockDb)
  mockMessaging.push.mockResolvedValue({
    ok: false,
    code: 'RETRY_KEY_ACCEPTED',
    httpRequestId: 'req_retry',
    acceptedRequestId: 'acc_original',
    sentMessages: [{ id: 'oa:req:request-1:user-1:0' }],
  })
  await app.ready()

  const res = await app.inject({
    method: 'POST',
    url: oaApiPath('/bot/message/push'),
    headers: {
      authorization: `Bearer ${validToken}`,
      'x-line-retry-key': '123e4567-e89b-12d3-a456-426614174000',
    },
    payload: { to: userId, messages: [{ type: 'text', text: 'hello' }] },
  })

  await app.close()
  expect(res.statusCode).toBe(409)
  expect(res.headers['x-line-request-id']).toBe('req_retry')
  expect(res.headers['x-line-accepted-request-id']).toBe('acc_original')
  expect(JSON.parse(res.body)).toEqual({
    message: 'The retry key is already accepted',
    sentMessages: [{ id: 'oa:req:request-1:user-1:0' }],
  })
})

it('sends broadcast through the messaging service', async () => {
  const mockDb = makeMockDb([{ oaId, token: validToken, expiresAt: null }], [])
  const { app, mockMessaging } = createTestApp(mockDb)
  mockMessaging.broadcast.mockResolvedValue({
    ok: true,
    accepted: {
      httpRequestId: 'req_broadcast',
      acceptedRequestId: 'acc_broadcast',
    },
    processed: { processed: 2 },
    recipientCount: 2,
  })
  await app.ready()

  const res = await app.inject({
    method: 'POST',
    url: oaApiPath('/bot/message/broadcast'),
    headers: { authorization: `Bearer ${validToken}` },
    payload: { messages: [{ type: 'text', text: 'hello' }] },
  })

  await app.close()
  expect(res.statusCode).toBe(200)
  expect(res.headers['x-line-request-id']).toBe('req_broadcast')
  expect(mockMessaging.broadcast).toHaveBeenCalledWith({
    oaId,
    retryKey: undefined,
    messages: [expect.objectContaining({ type: 'text', text: 'hello' })],
  })
})
```

- [ ] **Step 3: Update plugin deps and route handlers**

In `apps/server/src/plugins/oa-messaging.ts`, update deps:

```ts
import type { createOAMessagingService } from '../services/oa-messaging'

type MessagingPluginDeps = {
  oa: ReturnType<typeof createOAService>
  messaging: ReturnType<typeof createOAMessagingService>
  db: NodePgDatabase<typeof schema>
  drive: DriveService
}
```

For `push`, after validation and friendship check, call:

```ts
const result = await messaging.push({
  oaId,
  retryKey: request.headers['x-line-retry-key'] as string | undefined,
  to: body.to,
  messages: validMessages,
})
return sendMessagingResult(reply, result)
```

For `reply`, reject retry key first:

```ts
if (request.headers['x-line-retry-key']) {
  return reply.code(400).send({
    message: 'X-Line-Retry-Key is not supported on reply messages',
    code: 'INVALID_RETRY_KEY',
  })
}
```

Add `POST oaApiPath('/bot/message/broadcast')` with validation and service call.

Define `sendMessagingResult` in the plugin:

```ts
function sendMessagingResult(reply: FastifyReply, result: any) {
  if (result.httpRequestId) reply.header('x-line-request-id', result.httpRequestId)
  if (!result.ok) {
    if (result.acceptedRequestId)
      reply.header('x-line-accepted-request-id', result.acceptedRequestId)
    if (result.code === 'RETRY_KEY_ACCEPTED') {
      return reply.code(409).send({
        message: 'The retry key is already accepted',
        ...(result.sentMessages?.length ? { sentMessages: result.sentMessages } : {}),
      })
    }
    if (result.code === 'RETRY_KEY_CONFLICT') {
      return reply.code(409).send({ message: 'The retry key conflicts with another request' })
    }
    if (result.code === 'QUOTA_EXCEEDED') {
      return reply.code(429).send({
        message: 'You have reached your monthly limit.',
        code: 'QUOTA_EXCEEDED',
      })
    }
    return reply.code(400).send({ message: result.code, code: result.code })
  }
  const accepted = result.accepted
  if (accepted?.httpRequestId) reply.header('x-line-request-id', accepted.httpRequestId)
  if (result.processed && result.processed.processed === 0) {
    return reply.code(202).send({ requestId: accepted.acceptedRequestId })
  }
  return reply.send({})
}
```

- [ ] **Step 4: Wire service in `index.ts`**

Import:

```ts
import { createOAMessagingService } from './services/oa-messaging'
```

After `const oa = createOAService(...)`, create:

```ts
const oaMessaging = createOAMessagingService({
  db,
  instanceId: process.env['HOSTNAME'] ?? `server-${process.pid}`,
})
```

Register:

```ts
await oaMessagingPlugin(app, { oa, messaging: oaMessaging, db, drive })
```

- [ ] **Step 5: Run tests**

Run:

```bash
bun run --cwd apps/server test:unit -- src/plugins/oa-messaging.test.ts src/services/oa-messaging.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/plugins/oa-messaging.ts \
  apps/server/src/plugins/oa-messaging.test.ts \
  apps/server/src/index.ts
git commit -m "feat(oa): route messaging sends through durable service"
```

---

## Task 8: Recovery Loop

**Files:**
- Modify: `apps/server/src/index.ts`
- Modify: `apps/server/src/services/oa-messaging.test.ts`

- [ ] **Step 1: Add recovery helper test**

In `apps/server/src/services/oa-messaging.test.ts`, add:

```ts
describe('oa messaging recovery', () => {
  it('exposes processPendingDeliveries for startup recovery', () => {
    const service = createOAMessagingService({
      db: {} as any,
      instanceId: 'test',
      now: () => new Date('2026-05-01T00:00:00.000Z'),
    })

    expect(typeof service.processPendingDeliveries).toBe('function')
  })
})
```

- [ ] **Step 2: Wire startup and periodic recovery**

In `apps/server/src/index.ts`, after registering plugins and before `app.listen`, add:

```ts
await oaMessaging.processPendingDeliveries({ batchSize: 100, staleAfterMs: 60_000 })

let oaMessagingRecoveryRunning = false
const oaMessagingRecoveryInterval = setInterval(() => {
  if (oaMessagingRecoveryRunning) return
  oaMessagingRecoveryRunning = true
  void oaMessaging
    .processPendingDeliveries({ batchSize: 100, staleAfterMs: 60_000 })
    .catch((err) => logger.error({ err }, '[oa-messaging] recovery failed'))
    .finally(() => {
      oaMessagingRecoveryRunning = false
    })
}, 10_000)

app.addHook('onClose', async () => {
  clearInterval(oaMessagingRecoveryInterval)
})
```

This keeps recovery in the server entrypoint, where process lifecycle belongs.

- [ ] **Step 3: Run server typecheck**

Run:

```bash
bun run --cwd apps/server typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/index.ts apps/server/src/services/oa-messaging.test.ts
git commit -m "feat(oa): recover pending message deliveries"
```

---

## Task 9: Final Verification

**Files:**
- No source files unless verification reveals failures.

- [ ] **Step 1: Run server unit tests**

Run:

```bash
bun run --cwd apps/server test:unit
```

Expected: PASS.

- [ ] **Step 2: Run server DB integration tests**

Run:

```bash
docker compose up -d pgdb migrate
ZERO_UPSTREAM_DB=postgresql://user:password@localhost:5533/postgres bun run --cwd apps/server test:integration
```

Expected: PASS.

- [ ] **Step 3: Run typecheck**

Run:

```bash
bun run --cwd apps/server typecheck
```

Expected: PASS.

- [ ] **Step 4: Run repo check if time allows**

Run:

```bash
bun run check
```

Expected: PASS.

- [ ] **Step 5: Commit any verification fixes**

If verification required fixes:

```bash
git add apps/server/src/services/oa-messaging.ts apps/server/src/plugins/oa-messaging.ts
git commit -m "fix(oa): stabilize messaging api v1"
```

Use the exact files changed by verification. The `git add` line above is the expected case when final fixes are limited to service and route adapter behavior. If no fixes were needed, do not create an empty commit.

---

## Self-Review Checklist

- `/api/oa/v2` is the only public OA API route namespace.
- Root `/v2/...` public OA routes are not registered.
- `reply` rejects `X-Line-Retry-Key`.
- `push` and `broadcast` follow LINE retry-key behavior.
- Durable request and delivery rows are created before delivery processing.
- Broadcast recipients are snapshotted once per accepted request.
- Deterministic message IDs prevent duplicate chat messages.
- Delivery processing uses PostgreSQL state and can recover stale work.
- Quota counts accepted delivery units and duplicate retry attempts do not increment quota.
- RabbitMQ is not introduced.
- Operational outbox tables are not added to Zero.
