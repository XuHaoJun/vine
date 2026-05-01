# Messaging API Webhook Observability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add LINE-like webhook observability for Vine Official Accounts: durable delivery logs, manual redelivery, diagnostic webhook testing, and a developer-console Messaging API tab.

**Architecture:** Store webhook delivery/attempt rows in private PostgreSQL tables, keep delivery behavior in an explicit `oa-webhook-delivery` service, and expose console management through authenticated ConnectRPC methods. The existing internal webhook Fastify plugin becomes a thin adapter, while the web UI uses the existing OA Connect client with React Query wrappers and compact Tamagui sections.

**Tech Stack:** TypeScript, Bun, Fastify, ConnectRPC, Drizzle ORM, PostgreSQL, Vitest, OneJS, Tamagui, React Query, Valibot, react-hook-form.

**Upstream spec:** [`docs/superpowers/specs/2026-05-01-messaging-api-webhook-observability-design.md`](../specs/2026-05-01-messaging-api-webhook-observability-design.md)

---

## Execution Order

1. Add private DB schema and migration for webhook logs/settings.
2. Add pure webhook delivery utilities and unit tests.
3. Add the persistence/sending service and DB integration coverage.
4. Add ConnectRPC proto/client/server management methods.
5. Route real internal webhook dispatch through the delivery service.
6. Build the channel Messaging API tab UI.
7. Add focused frontend tests and optional Playwright smoke coverage.
8. Run full relevant verification.

Commit after each task once that task's checks pass.

---

## File Structure

### Create

- `apps/server/src/services/oa-webhook-delivery.ts` — webhook delivery service factory, pure helpers, verify/test send, real delivery creation, manual redelivery, retention cleanup helper.
- `apps/server/src/services/oa-webhook-delivery.test.ts` — unit tests for failure classification, response excerpt caps, diagnostic sends, visibility decisions, and redelivery payload mutation.
- `apps/server/src/services/oa-webhook-delivery.int.test.ts` — DB integration tests for delivery/attempt persistence, duplicate event IDs, redelivery, retention cleanup, and authorization-adjacent query behavior.
- `packages/db/src/migrations/20260501000002_oa_webhook_observability.ts` — migration for `oaWebhookDelivery`, `oaWebhookAttempt`, and new `oaWebhook` setting columns.
- `apps/web/app/(app)/developers/console/channel/[channelId]/ChannelHeader.tsx` — reusable channel header/breadcrumb split from the route file.
- `apps/web/app/(app)/developers/console/channel/[channelId]/MessagingApiTab.tsx` — Messaging API tab composition.
- `apps/web/app/(app)/developers/console/channel/[channelId]/WebhookSettingsSection.tsx` — webhook settings form and verify action.
- `apps/web/app/(app)/developers/console/channel/[channelId]/WebhookErrorsSection.tsx` — delivery list, detail expansion, redelivery action.
- `apps/web/app/(app)/developers/console/channel/[channelId]/TestWebhookSection.tsx` — diagnostic sample webhook action.
- `apps/web/src/test/unit/developers/channel-messaging-api-tab.test.tsx` — focused UI behavior tests if existing unit test setup supports rendering route components.

### Modify

- `packages/db/src/schema-private.ts` — add `oaWebhookDelivery` and `oaWebhookAttempt`.
- `packages/db/src/schema-oa.ts` — add webhook settings/verify columns to `oaWebhook`.
- `packages/proto/proto/oa/v1/oa.proto` — add webhook settings, delivery, and management RPC messages.
- `packages/proto/package.json` — no new export expected because OA already exports `@vine/proto/oa`; verify after codegen.
- `apps/server/src/connect/oa.ts` — map new proto messages and enforce OA/provider ownership for new RPCs.
- `apps/server/src/connect/routes.ts` — pass `webhookDelivery` dependency into `oaHandler`.
- `apps/server/src/index.ts` — construct `createOAWebhookDeliveryService` and pass it into Connect routes and internal webhook plugin.
- `apps/server/src/plugins/oa-webhook.ts` — replace direct fetch dispatch with the delivery service.
- `apps/server/src/plugins/oa-webhook.test.ts` — update internal dispatch expectations.
- `apps/server/src/services/oa.ts` — add webhook settings update/get helpers and keep existing event builders.
- `apps/web/src/features/oa/client.ts` — still exports `oaClient`; no structural change expected after proto generation.
- `apps/web/app/(app)/developers/console/channel/[channelId]/index.tsx` — split layout, add functional tabs, render Basic settings and Messaging API tab.
- `apps/web/src/test/integration/developer-console-messaging-api.test.ts` — optional smoke test if integration data has an OA channel available.

---

## Shared Naming

Use these string unions consistently in code and tests:

```ts
export type WebhookDeliveryStatus = 'pending' | 'delivered' | 'failed'
export type WebhookFailureReason =
  | 'could_not_connect'
  | 'request_timeout'
  | 'error_status_code'
  | 'unclassified'
```

Use these React Query keys consistently:

```ts
['oa', 'webhook-settings', channelId]
['oa', 'webhook-deliveries', channelId, statusFilter]
['oa', 'webhook-delivery', channelId, deliveryId]
```

---

## Task 1: DB Schema and Migration

**Files:**
- Modify: `packages/db/src/schema-private.ts`
- Modify: `packages/db/src/schema-oa.ts`
- Create: `packages/db/src/migrations/20260501000002_oa_webhook_observability.ts`

- [ ] **Step 1: Add failing schema references**

Add this temporary import/check to `apps/server/src/services/oa-webhook-delivery.test.ts` when the file is created in Task 2, or run TypeScript after adding imports in Task 2. The expected first failure before schema work is that `oaWebhookDelivery` and `oaWebhookAttempt` are not exported from `@vine/db/schema-private`.

Run:

```bash
bun run --cwd apps/server typecheck
```

Expected: FAIL with missing exports once Task 2 imports are present. If running Task 1 first, skip the command until Task 2 and use the migration/schema additions below as the first production change.

- [ ] **Step 2: Add private delivery tables**

In `packages/db/src/schema-private.ts`, extend the import from `drizzle-orm/pg-core` to include `boolean` if it is not already present near the top of the file:

```ts
import {
  boolean,
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

Append after `oaRetryKey`:

```ts
export const oaWebhookDelivery = pgTable(
  'oaWebhookDelivery',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    oaId: uuid('oaId')
      .notNull()
      .references(() => officialAccount.id, { onDelete: 'cascade' }),
    webhookEventId: text('webhookEventId').notNull(),
    eventType: text('eventType').notNull(),
    payloadJson: jsonb('payloadJson').notNull(),
    status: text('status').notNull().default('pending'),
    reason: text('reason'),
    detail: text('detail'),
    responseStatus: integer('responseStatus'),
    responseBodyExcerpt: text('responseBodyExcerpt'),
    attemptCount: integer('attemptCount').notNull().default(0),
    isRedelivery: boolean('isRedelivery').notNull().default(false),
    developerVisible: boolean('developerVisible').notNull().default(true),
    createdAt: timestamp('createdAt', { mode: 'string' }).defaultNow().notNull(),
    lastAttemptedAt: timestamp('lastAttemptedAt', { mode: 'string' }),
    deliveredAt: timestamp('deliveredAt', { mode: 'string' }),
    updatedAt: timestamp('updatedAt', { mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    index('oaWebhookDelivery_oaId_createdAt_idx').on(table.oaId, table.createdAt),
    index('oaWebhookDelivery_oaId_status_createdAt_idx').on(
      table.oaId,
      table.status,
      table.createdAt,
    ),
    uniqueIndex('oaWebhookDelivery_oaId_eventId_idx').on(
      table.oaId,
      table.webhookEventId,
    ),
  ],
)

export const oaWebhookAttempt = pgTable(
  'oaWebhookAttempt',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    deliveryId: uuid('deliveryId')
      .notNull()
      .references(() => oaWebhookDelivery.id, { onDelete: 'cascade' }),
    oaId: uuid('oaId')
      .notNull()
      .references(() => officialAccount.id, { onDelete: 'cascade' }),
    attemptNumber: integer('attemptNumber').notNull(),
    isRedelivery: boolean('isRedelivery').notNull().default(false),
    requestUrl: text('requestUrl').notNull(),
    requestBodyJson: jsonb('requestBodyJson').notNull(),
    responseStatus: integer('responseStatus'),
    responseBodyExcerpt: text('responseBodyExcerpt'),
    reason: text('reason'),
    detail: text('detail'),
    startedAt: timestamp('startedAt', { mode: 'string' }).defaultNow().notNull(),
    completedAt: timestamp('completedAt', { mode: 'string' }),
  },
  (table) => [
    index('oaWebhookAttempt_delivery_attempt_idx').on(
      table.deliveryId,
      table.attemptNumber,
    ),
    index('oaWebhookAttempt_oaId_startedAt_idx').on(table.oaId, table.startedAt),
  ],
)
```

- [ ] **Step 3: Add webhook settings columns**

In `packages/db/src/schema-oa.ts`, add these columns to `oaWebhook` after `status`:

```ts
    useWebhook: boolean('useWebhook').notNull().default(true),
    webhookRedeliveryEnabled: boolean('webhookRedeliveryEnabled')
      .notNull()
      .default(false),
    errorStatisticsEnabled: boolean('errorStatisticsEnabled')
      .notNull()
      .default(false),
    lastVerifyStatusCode: integer('lastVerifyStatusCode'),
    lastVerifyReason: text('lastVerifyReason'),
```

`schema-oa.ts` already imports `boolean`, `integer`, `text`, and `timestamp`, so no import change should be needed.

- [ ] **Step 4: Add migration**

Create `packages/db/src/migrations/20260501000002_oa_webhook_observability.ts`:

```ts
import type { PoolClient } from 'pg'

const sql = `
ALTER TABLE "oaWebhook" ADD COLUMN IF NOT EXISTS "useWebhook" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "oaWebhook" ADD COLUMN IF NOT EXISTS "webhookRedeliveryEnabled" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "oaWebhook" ADD COLUMN IF NOT EXISTS "errorStatisticsEnabled" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "oaWebhook" ADD COLUMN IF NOT EXISTS "lastVerifyStatusCode" integer;
--> statement-breakpoint
ALTER TABLE "oaWebhook" ADD COLUMN IF NOT EXISTS "lastVerifyReason" text;
--> statement-breakpoint
CREATE TABLE "oaWebhookDelivery" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "oaId" uuid NOT NULL,
  "webhookEventId" text NOT NULL,
  "eventType" text NOT NULL,
  "payloadJson" jsonb NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "reason" text,
  "detail" text,
  "responseStatus" integer,
  "responseBodyExcerpt" text,
  "attemptCount" integer DEFAULT 0 NOT NULL,
  "isRedelivery" boolean DEFAULT false NOT NULL,
  "developerVisible" boolean DEFAULT true NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "lastAttemptedAt" timestamp,
  "deliveredAt" timestamp,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oaWebhookAttempt" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "deliveryId" uuid NOT NULL,
  "oaId" uuid NOT NULL,
  "attemptNumber" integer NOT NULL,
  "isRedelivery" boolean DEFAULT false NOT NULL,
  "requestUrl" text NOT NULL,
  "requestBodyJson" jsonb NOT NULL,
  "responseStatus" integer,
  "responseBodyExcerpt" text,
  "reason" text,
  "detail" text,
  "startedAt" timestamp DEFAULT now() NOT NULL,
  "completedAt" timestamp
);
--> statement-breakpoint
CREATE INDEX "oaWebhookDelivery_oaId_createdAt_idx" ON "oaWebhookDelivery" ("oaId", "createdAt");
--> statement-breakpoint
CREATE INDEX "oaWebhookDelivery_oaId_status_createdAt_idx" ON "oaWebhookDelivery" ("oaId", "status", "createdAt");
--> statement-breakpoint
CREATE UNIQUE INDEX "oaWebhookDelivery_oaId_eventId_idx" ON "oaWebhookDelivery" ("oaId", "webhookEventId");
--> statement-breakpoint
CREATE INDEX "oaWebhookAttempt_delivery_attempt_idx" ON "oaWebhookAttempt" ("deliveryId", "attemptNumber");
--> statement-breakpoint
CREATE INDEX "oaWebhookAttempt_oaId_startedAt_idx" ON "oaWebhookAttempt" ("oaId", "startedAt");
--> statement-breakpoint
ALTER TABLE "oaWebhookDelivery" ADD CONSTRAINT "oaWebhookDelivery_oaId_officialAccount_id_fkey" FOREIGN KEY ("oaId") REFERENCES "officialAccount"("id") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "oaWebhookAttempt" ADD CONSTRAINT "oaWebhookAttempt_deliveryId_oaWebhookDelivery_id_fkey" FOREIGN KEY ("deliveryId") REFERENCES "oaWebhookDelivery"("id") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "oaWebhookAttempt" ADD CONSTRAINT "oaWebhookAttempt_oaId_officialAccount_id_fkey" FOREIGN KEY ("oaId") REFERENCES "officialAccount"("id") ON DELETE CASCADE;
`

export async function up(client: PoolClient): Promise<void> {
  await client.query(sql)
}

export async function down(client: PoolClient): Promise<void> {
  await client.query(`
    DROP TABLE IF EXISTS "oaWebhookAttempt";
    DROP TABLE IF EXISTS "oaWebhookDelivery";
    ALTER TABLE "oaWebhook" DROP COLUMN IF EXISTS "lastVerifyReason";
    ALTER TABLE "oaWebhook" DROP COLUMN IF EXISTS "lastVerifyStatusCode";
    ALTER TABLE "oaWebhook" DROP COLUMN IF EXISTS "errorStatisticsEnabled";
    ALTER TABLE "oaWebhook" DROP COLUMN IF EXISTS "webhookRedeliveryEnabled";
    ALTER TABLE "oaWebhook" DROP COLUMN IF EXISTS "useWebhook";
  `)
}
```

- [ ] **Step 5: Verify schema compiles**

Run:

```bash
bun run --cwd apps/server typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/db/src/schema-private.ts packages/db/src/schema-oa.ts packages/db/src/migrations/20260501000002_oa_webhook_observability.ts
git commit -m "feat(oa): add webhook observability tables"
```

---

## Task 2: Pure Webhook Delivery Utilities

**Files:**
- Create: `apps/server/src/services/oa-webhook-delivery.ts`
- Create: `apps/server/src/services/oa-webhook-delivery.test.ts`

- [ ] **Step 1: Write failing unit tests for pure helpers**

Create `apps/server/src/services/oa-webhook-delivery.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  classifyWebhookError,
  createRedeliveryPayload,
  excerptResponseBody,
  extractFirstWebhookEvent,
  shouldCreateDeveloperVisibleDelivery,
} from './oa-webhook-delivery'

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
```

- [ ] **Step 2: Run helper tests and verify failure**

Run:

```bash
bun run --cwd apps/server test:unit -- src/services/oa-webhook-delivery.test.ts
```

Expected: FAIL with missing module or missing exported helper names.

- [ ] **Step 3: Add helper implementation skeleton**

Create `apps/server/src/services/oa-webhook-delivery.ts` with these exports:

```ts
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
```

Remove the unused imports from this initial file if TypeScript reports them before Task 3 uses them.

- [ ] **Step 4: Run helper tests and verify pass**

Run:

```bash
bun run --cwd apps/server test:unit -- src/services/oa-webhook-delivery.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/services/oa-webhook-delivery.ts apps/server/src/services/oa-webhook-delivery.test.ts
git commit -m "feat(oa): add webhook delivery helpers"
```

---

## Task 3: Webhook Delivery Service Persistence and Sending

**Files:**
- Modify: `apps/server/src/services/oa-webhook-delivery.ts`
- Create: `apps/server/src/services/oa-webhook-delivery.int.test.ts`
- Modify: `apps/server/src/services/oa.ts`

- [ ] **Step 1: Add OA webhook settings helpers**

In `apps/server/src/services/oa.ts`, add these methods inside `createOAService` near existing webhook methods:

```ts
  async function updateWebhookSettings(
    oaId: string,
    input: {
      url?: string | undefined
      useWebhook?: boolean | undefined
      webhookRedeliveryEnabled?: boolean | undefined
      errorStatisticsEnabled?: boolean | undefined
    },
  ) {
    const [existing] = await db
      .select()
      .from(oaWebhook)
      .where(eq(oaWebhook.oaId, oaId))
      .limit(1)

    const values = {
      oaId,
      url: input.url ?? existing?.url ?? '',
      status: input.url && input.url !== existing?.url ? 'pending' : existing?.status ?? 'pending',
      useWebhook: input.useWebhook ?? existing?.useWebhook ?? true,
      webhookRedeliveryEnabled:
        input.webhookRedeliveryEnabled ?? existing?.webhookRedeliveryEnabled ?? false,
      errorStatisticsEnabled:
        input.errorStatisticsEnabled ?? existing?.errorStatisticsEnabled ?? false,
      lastVerifiedAt:
        input.url && input.url !== existing?.url ? null : existing?.lastVerifiedAt ?? null,
      lastVerifyStatusCode:
        input.url && input.url !== existing?.url ? null : existing?.lastVerifyStatusCode ?? null,
      lastVerifyReason:
        input.url && input.url !== existing?.url ? null : existing?.lastVerifyReason ?? null,
    }

    if (!values.url) {
      throw new Error('Webhook URL is required')
    }

    const [webhook] = await db
      .insert(oaWebhook)
      .values(values)
      .onConflictDoUpdate({
        target: oaWebhook.oaId,
        set: values,
      })
      .returning()
    return webhook
  }

  async function recordWebhookVerifyResult(
    oaId: string,
    input: { statusCode: number; reason: string; verified: boolean },
  ) {
    const [webhook] = await db
      .update(oaWebhook)
      .set({
        status: input.verified ? 'verified' : 'failed',
        lastVerifiedAt: new Date().toISOString(),
        lastVerifyStatusCode: input.statusCode,
        lastVerifyReason: input.reason,
      })
      .where(eq(oaWebhook.oaId, oaId))
      .returning()
    return webhook
  }
```

Add both methods to the returned service object at the end of `createOAService`.

- [ ] **Step 2: Add failing DB integration tests**

Create `apps/server/src/services/oa-webhook-delivery.int.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { eq } from 'drizzle-orm'
import { oaWebhook } from '@vine/db/schema-oa'
import { oaWebhookAttempt, oaWebhookDelivery } from '@vine/db/schema-private'
import { createOAService } from './oa'
import { createOAWebhookDeliveryService } from './oa-webhook-delivery'
import { withRollbackDb } from '../test/integration-db'

async function seedOA(db: Parameters<typeof createOAService>[0]['db']) {
  const oa = createOAService({ db, database: {} as any })
  const provider = await oa.createProvider({ name: 'Webhook Test Provider', ownerId: 'user_1' })
  const account = await oa.createOfficialAccount({
    providerId: provider.id,
    name: 'Webhook Test OA',
    uniqueId: `@webhook-${crypto.randomUUID()}`,
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
      const service = createOAWebhookDeliveryService({
        db,
        oa,
        fetchFn: vi.fn().mockResolvedValue(new Response('bad', { status: 500 })),
        now: () => '2026-05-01T00:00:00.000Z',
      })

      const result = await service.deliverRealEvent({
        oaId: account.id,
        payload: {
          destination: account.id,
          events: [{ type: 'message', webhookEventId: 'evt_failed' }],
        },
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

  it('keeps aggregation-off rows hidden from developer listing', async () => {
    await withRollbackDb(async (db) => {
      const { oa, account } = await seedOA(db)
      await oa.updateWebhookSettings(account.id, {
        url: 'https://example.test/webhook',
        useWebhook: true,
        errorStatisticsEnabled: false,
      })
      const service = createOAWebhookDeliveryService({
        db,
        oa,
        fetchFn: vi.fn().mockResolvedValue(new Response('', { status: 204 })),
        now: () => '2026-05-01T00:00:00.000Z',
      })

      await service.deliverRealEvent({
        oaId: account.id,
        payload: {
          destination: account.id,
          events: [{ type: 'message', webhookEventId: 'evt_hidden' }],
        },
      })

      const visible = await service.listDeliveries({ oaId: account.id, pageSize: 20 })
      expect(visible.deliveries).toHaveLength(0)
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
      const fetchFn = vi
        .fn()
        .mockResolvedValueOnce(new Response('bad', { status: 500 }))
        .mockResolvedValueOnce(new Response('', { status: 204 }))
      const service = createOAWebhookDeliveryService({
        db,
        oa,
        fetchFn,
        now: () => '2026-05-01T00:00:00.000Z',
      })

      await service.deliverRealEvent({
        oaId: account.id,
        payload: {
          destination: account.id,
          events: [
            {
              type: 'message',
              webhookEventId: 'evt_redeliver',
              deliveryContext: { isRedelivery: false },
            },
          ],
        },
      })
      const [delivery] = await db
        .select()
        .from(oaWebhookDelivery)
        .where(eq(oaWebhookDelivery.webhookEventId, 'evt_redeliver'))

      const retry = await service.redeliver({ oaId: account.id, deliveryId: delivery.id })
      expect(retry).toMatchObject({ kind: 'ok', statusCode: 204 })
      const secondBody = JSON.parse(fetchFn.mock.calls[1][1].body)
      expect(secondBody.events[0].deliveryContext.isRedelivery).toBe(true)
      expect(secondBody.events[0].webhookEventId).toBe('evt_redeliver')
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
        fetchFn: vi.fn(),
        now: () => '2026-05-01T00:00:00.000Z',
      })

      const result = await service.cleanupExpiredDeliveries({ olderThanDays: 30 })
      expect(result.deletedCount).toBe(1)
    })
  })
})
```

- [ ] **Step 3: Run integration test and verify failure**

Run:

```bash
docker compose up -d pgdb migrate
ZERO_UPSTREAM_DB=postgresql://user:password@localhost:5533/postgres bun run --cwd apps/server test:integration -- src/services/oa-webhook-delivery.int.test.ts
```

Expected: FAIL with missing `createOAWebhookDeliveryService` methods.

- [ ] **Step 4: Implement service factory**

Extend `apps/server/src/services/oa-webhook-delivery.ts` with the service factory. Keep the helper exports from Task 2.

```ts
type OAWebhookDeliveryDeps = {
  db: NodePgDatabase<typeof schema>
  oa: ReturnType<typeof createOAService>
  fetchFn?: typeof fetch
  now?: () => string
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
    deliveryId?: string | undefined
    nextAttemptNumber?: number | undefined
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

  async function deliverRealEvent(input: {
    oaId: string
    payload: unknown
  }): Promise<WebhookDispatchResult> {
    const account = await deps.oa.getOfficialAccount(input.oaId)
    if (!account) return { kind: 'oa-not-found' }
    const webhook = await deps.oa.getWebhook(input.oaId)
    if (!webhook || webhook.status !== 'verified') return { kind: 'webhook-not-ready' }
    if (!webhook.useWebhook) return { kind: 'webhook-disabled' }

    const event = extractFirstWebhookEvent(input.payload)
    const developerVisible = shouldCreateDeveloperVisibleDelivery({
      errorStatisticsEnabled: webhook.errorStatisticsEnabled,
    })

    const [delivery] = await deps.db
      .insert(oaWebhookDelivery)
      .values({
        oaId: input.oaId,
        webhookEventId: event.webhookEventId,
        eventType: event.eventType,
        payloadJson: input.payload,
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
      payload: input.payload,
      isRedelivery: false,
    })

    await deps.db.insert(oaWebhookAttempt).values({
      deliveryId: target.id,
      oaId: input.oaId,
      attemptNumber,
      isRedelivery: false,
      requestUrl: webhook.url,
      requestBodyJson: input.payload,
      responseStatus: sent.responseStatus,
      responseBodyExcerpt: sent.responseBodyExcerpt,
      reason: sent.ok ? null : sent.reason,
      detail: sent.ok ? null : sent.detail,
      startedAt: sent.startedAt,
      completedAt: sent.completedAt,
    })

    await deps.db
      .update(oaWebhookDelivery)
      .set({
        status: sent.ok ? 'delivered' : 'failed',
        reason: sent.ok ? null : sent.reason,
        detail: sent.ok ? null : sent.detail,
        responseStatus: sent.responseStatus,
        responseBodyExcerpt: sent.responseBodyExcerpt,
        attemptCount: attemptNumber,
        lastAttemptedAt: sent.completedAt,
        deliveredAt: sent.ok ? sent.completedAt : null,
        updatedAt: sent.completedAt,
      })
      .where(eq(oaWebhookDelivery.id, target.id))

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
    return { success: sent.ok, statusCode, reason, timestamp: Date.now() }
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
          webhookEventId: `diagnostic-${crypto.randomUUID()}`,
          deliveryContext: { isRedelivery: false },
          message: { type: 'text', id: `diagnostic-${crypto.randomUUID()}`, text: input.text },
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
      timestamp: Date.now(),
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

    await deps.db.insert(oaWebhookAttempt).values({
      deliveryId: delivery.id,
      oaId: input.oaId,
      attemptNumber,
      isRedelivery: true,
      requestUrl: webhook.url,
      requestBodyJson: payload,
      responseStatus: sent.responseStatus,
      responseBodyExcerpt: sent.responseBodyExcerpt,
      reason: sent.ok ? null : sent.reason,
      detail: sent.ok ? null : sent.detail,
      startedAt: sent.startedAt,
      completedAt: sent.completedAt,
    })
    await deps.db
      .update(oaWebhookDelivery)
      .set({
        status: sent.ok ? 'delivered' : 'failed',
        reason: sent.ok ? null : sent.reason,
        detail: sent.ok ? null : sent.detail,
        responseStatus: sent.responseStatus,
        responseBodyExcerpt: sent.responseBodyExcerpt,
        attemptCount: attemptNumber,
        isRedelivery: true,
        lastAttemptedAt: sent.completedAt,
        deliveredAt: sent.ok ? sent.completedAt : null,
        updatedAt: sent.completedAt,
      })
      .where(eq(oaWebhookDelivery.id, delivery.id))

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
```

- [ ] **Step 5: Run unit and integration tests**

Run:

```bash
bun run --cwd apps/server test:unit -- src/services/oa-webhook-delivery.test.ts
ZERO_UPSTREAM_DB=postgresql://user:password@localhost:5533/postgres bun run --cwd apps/server test:integration -- src/services/oa-webhook-delivery.int.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/services/oa.ts apps/server/src/services/oa-webhook-delivery.ts apps/server/src/services/oa-webhook-delivery.int.test.ts
git commit -m "feat(oa): persist webhook delivery attempts"
```

---

## Task 4: ConnectRPC Management API

**Files:**
- Modify: `packages/proto/proto/oa/v1/oa.proto`
- Modify: `apps/server/src/connect/oa.ts`
- Modify: `apps/server/src/connect/routes.ts`
- Modify: `apps/server/src/index.ts`
- Modify: `apps/web/src/features/oa/client.ts`

- [ ] **Step 1: Extend proto definitions**

In `packages/proto/proto/oa/v1/oa.proto`, after `GetWebhookResponse`, add:

```protobuf
message WebhookSettings {
  optional Webhook webhook = 1;
  bool use_webhook = 2;
  bool webhook_redelivery_enabled = 3;
  bool error_statistics_enabled = 4;
  optional int32 last_verify_status_code = 5;
  optional string last_verify_reason = 6;
}

message GetWebhookSettingsRequest {
  string official_account_id = 1;
}

message GetWebhookSettingsResponse {
  WebhookSettings settings = 1;
}

message UpdateWebhookSettingsRequest {
  string official_account_id = 1;
  optional string url = 2;
  bool use_webhook = 3;
  bool webhook_redelivery_enabled = 4;
  bool error_statistics_enabled = 5;
}

message UpdateWebhookSettingsResponse {
  WebhookSettings settings = 1;
}

message VerifyWebhookEndpointRequest {
  string official_account_id = 1;
  optional string endpoint_override = 2;
}

message WebhookTestResult {
  bool success = 1;
  int32 status_code = 2;
  string reason = 3;
  int64 timestamp = 4;
}

message VerifyWebhookEndpointResponse {
  WebhookTestResult result = 1;
}

message ListWebhookDeliveriesRequest {
  string official_account_id = 1;
  int32 page_size = 2;
  optional string status_filter = 3;
}

message WebhookDeliverySummary {
  string id = 1;
  string webhook_event_id = 2;
  string event_type = 3;
  string status = 4;
  optional string reason = 5;
  optional string detail = 6;
  optional int32 response_status = 7;
  int32 attempt_count = 8;
  bool is_redelivery = 9;
  string created_at = 10;
  optional string last_attempted_at = 11;
  optional string delivered_at = 12;
}

message ListWebhookDeliveriesResponse {
  repeated WebhookDeliverySummary deliveries = 1;
}

message GetWebhookDeliveryRequest {
  string official_account_id = 1;
  string delivery_id = 2;
}

message WebhookDeliveryAttempt {
  string id = 1;
  int32 attempt_number = 2;
  bool is_redelivery = 3;
  string request_url = 4;
  optional int32 response_status = 5;
  optional string response_body_excerpt = 6;
  optional string reason = 7;
  optional string detail = 8;
  string started_at = 9;
  optional string completed_at = 10;
}

message GetWebhookDeliveryResponse {
  WebhookDeliverySummary delivery = 1;
  string payload_json = 2;
  repeated WebhookDeliveryAttempt attempts = 3;
}

message RedeliverWebhookRequest {
  string official_account_id = 1;
  string delivery_id = 2;
}

message RedeliverWebhookResponse {
  WebhookDeliverySummary delivery = 1;
}

message SendTestWebhookEventRequest {
  string official_account_id = 1;
  string text = 2;
}

message SendTestWebhookEventResponse {
  WebhookTestResult result = 1;
}
```

In `service OAService`, add:

```protobuf
  rpc GetWebhookSettings(GetWebhookSettingsRequest) returns (GetWebhookSettingsResponse);
  rpc UpdateWebhookSettings(UpdateWebhookSettingsRequest) returns (UpdateWebhookSettingsResponse);
  rpc VerifyWebhookEndpoint(VerifyWebhookEndpointRequest) returns (VerifyWebhookEndpointResponse);
  rpc ListWebhookDeliveries(ListWebhookDeliveriesRequest) returns (ListWebhookDeliveriesResponse);
  rpc GetWebhookDelivery(GetWebhookDeliveryRequest) returns (GetWebhookDeliveryResponse);
  rpc RedeliverWebhook(RedeliverWebhookRequest) returns (RedeliverWebhookResponse);
  rpc SendTestWebhookEvent(SendTestWebhookEventRequest) returns (SendTestWebhookEventResponse);
```

Keep the existing `VerifyWebhook` RPC for backward compatibility; the new `VerifyWebhookEndpoint` returns richer verify details.

- [ ] **Step 2: Generate proto code**

Run:

```bash
bun turbo proto:generate
```

Expected: PASS and generated files under `packages/proto/gen/oa/v1/`.

- [ ] **Step 3: Update Connect deps**

In `apps/server/src/connect/oa.ts`, extend imports and deps:

```ts
import type { createOAWebhookDeliveryService } from '../services/oa-webhook-delivery'
```

```ts
type OAHandlerDeps = {
  oa: ReturnType<typeof createOAService>
  auth: AuthServer
  drive: DriveService
  webhookDelivery: ReturnType<typeof createOAWebhookDeliveryService>
}
```

- [ ] **Step 4: Add proto mappers**

In `apps/server/src/connect/oa.ts`, add helpers near existing webhook mapper:

```ts
function toProtoWebhookSettings(
  db: Awaited<ReturnType<ReturnType<typeof createOAService>['getWebhook']>>,
) {
  return {
    webhook: toProtoWebhook(db),
    useWebhook: db?.useWebhook ?? true,
    webhookRedeliveryEnabled: db?.webhookRedeliveryEnabled ?? false,
    errorStatisticsEnabled: db?.errorStatisticsEnabled ?? false,
    lastVerifyStatusCode: db?.lastVerifyStatusCode ?? undefined,
    lastVerifyReason: db?.lastVerifyReason ?? undefined,
  }
}

function toProtoDeliverySummary(row: any) {
  return {
    id: row.id,
    webhookEventId: row.webhookEventId,
    eventType: row.eventType,
    status: row.status,
    reason: row.reason ?? undefined,
    detail: row.detail ?? undefined,
    responseStatus: row.responseStatus ?? undefined,
    attemptCount: row.attemptCount,
    isRedelivery: row.isRedelivery,
    createdAt: row.createdAt,
    lastAttemptedAt: row.lastAttemptedAt ?? undefined,
    deliveredAt: row.deliveredAt ?? undefined,
  }
}

function toProtoAttempt(row: any) {
  return {
    id: row.id,
    attemptNumber: row.attemptNumber,
    isRedelivery: row.isRedelivery,
    requestUrl: row.requestUrl,
    responseStatus: row.responseStatus ?? undefined,
    responseBodyExcerpt: row.responseBodyExcerpt ?? undefined,
    reason: row.reason ?? undefined,
    detail: row.detail ?? undefined,
    startedAt: row.startedAt,
    completedAt: row.completedAt ?? undefined,
  }
}
```

Use `any` in this mapper task only if the Drizzle return type is cumbersome; tighten types during implementation if TypeScript reports easy inferred types.

- [ ] **Step 5: Add Connect handlers**

Inside `oaServiceImpl`, add:

```ts
      async getWebhookSettings(req, ctx) {
        const auth = requireAuthData(ctx)
        await assertOfficialAccountOwnedByUser(deps, req.officialAccountId, auth.id)
        const webhook = await deps.oa.getWebhook(req.officialAccountId)
        return { settings: toProtoWebhookSettings(webhook) }
      },
      async updateWebhookSettings(req, ctx) {
        const auth = requireAuthData(ctx)
        await assertOfficialAccountOwnedByUser(deps, req.officialAccountId, auth.id)
        const webhook = await deps.oa.updateWebhookSettings(req.officialAccountId, {
          url: req.url,
          useWebhook: req.useWebhook,
          webhookRedeliveryEnabled: req.webhookRedeliveryEnabled,
          errorStatisticsEnabled: req.errorStatisticsEnabled,
        })
        return { settings: toProtoWebhookSettings(webhook) }
      },
      async verifyWebhookEndpoint(req, ctx) {
        const auth = requireAuthData(ctx)
        await assertOfficialAccountOwnedByUser(deps, req.officialAccountId, auth.id)
        const result = await deps.webhookDelivery.verifyWebhook({
          oaId: req.officialAccountId,
          endpointOverride: req.endpointOverride,
        })
        return { result }
      },
      async listWebhookDeliveries(req, ctx) {
        const auth = requireAuthData(ctx)
        await assertOfficialAccountOwnedByUser(deps, req.officialAccountId, auth.id)
        const result = await deps.webhookDelivery.listDeliveries({
          oaId: req.officialAccountId,
          pageSize: req.pageSize > 0 ? req.pageSize : 50,
          statusFilter: req.statusFilter,
        })
        return { deliveries: result.deliveries.map(toProtoDeliverySummary) }
      },
      async getWebhookDelivery(req, ctx) {
        const auth = requireAuthData(ctx)
        await assertOfficialAccountOwnedByUser(deps, req.officialAccountId, auth.id)
        const result = await deps.webhookDelivery.getDelivery({
          oaId: req.officialAccountId,
          deliveryId: req.deliveryId,
        })
        if (!result) throw new ConnectError('Webhook delivery not found', Code.NotFound)
        return {
          delivery: toProtoDeliverySummary(result.delivery),
          payloadJson: JSON.stringify(result.delivery.payloadJson, null, 2),
          attempts: result.attempts.map(toProtoAttempt),
        }
      },
      async redeliverWebhook(req, ctx) {
        const auth = requireAuthData(ctx)
        await assertOfficialAccountOwnedByUser(deps, req.officialAccountId, auth.id)
        const result = await deps.webhookDelivery.redeliver({
          oaId: req.officialAccountId,
          deliveryId: req.deliveryId,
        })
        if (result.kind === 'redelivery-disabled') {
          throw new ConnectError('Webhook redelivery is disabled', Code.FailedPrecondition)
        }
        if (result.kind === 'delivery-not-found') {
          throw new ConnectError('Webhook delivery not found', Code.NotFound)
        }
        if (result.kind === 'delivery-not-failed') {
          throw new ConnectError('Webhook delivery is not failed', Code.FailedPrecondition)
        }
        const refreshed = await deps.webhookDelivery.getDelivery({
          oaId: req.officialAccountId,
          deliveryId: req.deliveryId,
        })
        if (!refreshed) throw new ConnectError('Webhook delivery not found', Code.NotFound)
        return { delivery: toProtoDeliverySummary(refreshed.delivery) }
      },
      async sendTestWebhookEvent(req, ctx) {
        const auth = requireAuthData(ctx)
        await assertOfficialAccountOwnedByUser(deps, req.officialAccountId, auth.id)
        const result = await deps.webhookDelivery.sendTestWebhookEvent({
          oaId: req.officialAccountId,
          text: req.text || 'Webhook test from Vine',
        })
        return { result }
      },
```

- [ ] **Step 6: Wire dependencies**

In `apps/server/src/connect/routes.ts`, extend `ConnectDeps` with `webhookDelivery` and pass it to `oaHandler(deps)`.

In `apps/server/src/index.ts`, import and construct:

```ts
import { createOAWebhookDeliveryService } from './services/oa-webhook-delivery'
```

```ts
const webhookDelivery = createOAWebhookDeliveryService({ db, oa })
```

Pass `webhookDelivery` into `connectRoutes(...)`.

- [ ] **Step 7: Run proto/server typecheck**

Run:

```bash
bun run --cwd apps/server typecheck
bun run --cwd apps/web typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/proto/proto/oa/v1/oa.proto packages/proto/gen packages/proto/package.json apps/server/src/connect/oa.ts apps/server/src/connect/routes.ts apps/server/src/index.ts apps/web/src/features/oa/client.ts
git commit -m "feat(oa): expose webhook observability rpc"
```

---

## Task 5: Internal Dispatch Uses Delivery Service

**Files:**
- Modify: `apps/server/src/plugins/oa-webhook.ts`
- Modify: `apps/server/src/plugins/oa-webhook.test.ts`
- Modify: `apps/server/src/index.ts`

- [ ] **Step 1: Update plugin deps**

In `apps/server/src/plugins/oa-webhook.ts`, import:

```ts
import type { createOAWebhookDeliveryService } from '../services/oa-webhook-delivery'
```

Extend deps:

```ts
type WebhookPluginDeps = {
  oa: ReturnType<typeof createOAService>
  db: NodePgDatabase<typeof schema>
  auth: ReturnType<typeof createAuthServer>
  webhookDelivery: ReturnType<typeof createOAWebhookDeliveryService>
}
```

- [ ] **Step 2: Replace direct dispatch helper calls**

Keep `authorizeChatMember`. Remove `dispatchSignedWebhook` and make internal routes call `webhookDelivery.deliverRealEvent`.

For `/api/oa/internal/dispatch`, replace the `dispatchSignedWebhook` block with:

```ts
      const replyTokenRecord = await oa.registerReplyToken({
        oaId: body.oaId,
        userId,
        chatId: body.chatId,
        messageId: body.messageId,
      })
      const payload = oa.buildMessageEvent({
        oaId: body.oaId,
        userId,
        messageId: body.messageId,
        text: body.text,
        replyToken: replyTokenRecord.token,
      })
      const result = await deps.webhookDelivery.deliverRealEvent({
        oaId: body.oaId,
        payload,
      })
      return sendDispatchResult(reply, result)
```

For `/api/oa/internal/dispatch-postback`, replace with:

```ts
      const replyTokenRecord = await oa.registerReplyToken({
        oaId: body.oaId,
        userId,
        chatId: body.chatId,
        messageId: null,
      })
      const payload = oa.buildPostbackEvent({
        oaId: body.oaId,
        userId,
        replyToken: replyTokenRecord.token,
        data: body.data,
        params: body.params,
      })
      const result = await deps.webhookDelivery.deliverRealEvent({
        oaId: body.oaId,
        payload,
      })
      return sendDispatchResult(reply, result)
```

Update `sendDispatchResult` cases to include `webhook-disabled` as `200 { success: true, skipped: true }`, and map `delivery-failed`/timeout-equivalent failures to existing `502`/`504` behavior as needed. The service now classifies timeout through `reason: 'request_timeout'`, so use:

```ts
    case 'delivery-failed':
      if (result.reason === 'request_timeout') {
        return reply.code(504).send({ message: 'Webhook delivery timeout' })
      }
      return reply
        .code(502)
        .send({ message: 'Webhook delivery failed', status: result.statusCode ?? 0 })
```

- [ ] **Step 3: Update app wiring**

In `apps/server/src/index.ts`, pass `webhookDelivery` to `oaWebhookPlugin`.

- [ ] **Step 4: Update plugin tests**

In `apps/server/src/plugins/oa-webhook.test.ts`, replace fetch mocks with a fake `webhookDelivery` object:

```ts
const webhookDelivery = {
  deliverRealEvent: vi.fn().mockResolvedValue({ kind: 'ok' }),
}
```

Assert that successful internal dispatch calls:

```ts
expect(webhookDelivery.deliverRealEvent).toHaveBeenCalledWith({
  oaId,
  payload: expect.objectContaining({
    destination: oaId,
    events: [expect.objectContaining({ type: 'message' })],
  }),
})
```

Add a test for Use webhook disabled result:

```ts
it('acks internal dispatch when webhook delivery is disabled', async () => {
  webhookDelivery.deliverRealEvent.mockResolvedValueOnce({ kind: 'webhook-disabled' })
  const res = await app.inject({
    method: 'POST',
    url: '/api/oa/internal/dispatch',
    headers: authHeaders,
    payload: { oaId, chatId, messageId: 'm1', text: 'hello' },
  })
  expect(res.statusCode).toBe(200)
  expect(JSON.parse(res.body)).toEqual({ success: true, skipped: true })
})
```

- [ ] **Step 5: Run plugin tests**

Run:

```bash
bun run --cwd apps/server test:unit -- src/plugins/oa-webhook.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/plugins/oa-webhook.ts apps/server/src/plugins/oa-webhook.test.ts apps/server/src/index.ts
git commit -m "feat(oa): log internal webhook dispatches"
```

---

## Task 6: Developer Console Messaging API Tab

**Files:**
- Modify: `apps/web/app/(app)/developers/console/channel/[channelId]/index.tsx`
- Create: `apps/web/app/(app)/developers/console/channel/[channelId]/ChannelHeader.tsx`
- Create: `apps/web/app/(app)/developers/console/channel/[channelId]/MessagingApiTab.tsx`
- Create: `apps/web/app/(app)/developers/console/channel/[channelId]/WebhookSettingsSection.tsx`
- Create: `apps/web/app/(app)/developers/console/channel/[channelId]/WebhookErrorsSection.tsx`
- Create: `apps/web/app/(app)/developers/console/channel/[channelId]/TestWebhookSection.tsx`

- [ ] **Step 1: Split the channel header**

Create `ChannelHeader.tsx`:

```tsx
import { useRouter } from 'one'
import { SizableText, XStack, YStack } from 'tamagui'
import type { OfficialAccount } from '@vine/proto/oa'

import { Button } from '~/interface/buttons/Button'
import { CaretLeftIcon } from '~/interface/icons/phosphor/CaretLeftIcon'

export function ChannelHeader({ account }: { account: OfficialAccount }) {
  const router = useRouter()
  return (
    <YStack gap="$4">
      <XStack items="center" gap="$2">
        <Button
          variant="transparent"
          circular
          onPress={() => router.back()}
          icon={<CaretLeftIcon size={16} />}
          aria-label="Back"
        />
        <SizableText size="$2" color="$color10" fontWeight="500">
          TOP
        </SizableText>
        <SizableText size="$2" color="$color10">
          ›
        </SizableText>
        <SizableText size="$2" color="$color10" fontWeight="500">
          Provider
        </SizableText>
        <SizableText size="$2" color="$color10">
          ›
        </SizableText>
        <SizableText size="$2" color="$color12" fontWeight="700">
          {account.name}
        </SizableText>
      </XStack>

      <XStack items="center" gap="$4">
        <YStack
          w={48}
          h={48}
          rounded="$10"
          bg="$color5"
          items="center"
          justify="center"
          bw={2}
          boc="$borderColor"
        >
          <SizableText size="$5" fontWeight="700" color="$color11">
            {account.name.charAt(0).toUpperCase()}
          </SizableText>
        </YStack>
        <YStack gap="$1">
          <SizableText size="$6" fontWeight="700" color="$color12">
            {account.name}
          </SizableText>
          <SizableText size="$2" color="$color10">
            Messaging API
          </SizableText>
        </YStack>
      </XStack>
    </YStack>
  )
}
```

Use shorthands (`w`, `h`, `bw`, `boc`) if required by Tamagui config. If this project's existing file uses longhand props successfully, either style is acceptable; keep the final file consistent after `typecheck`.

- [ ] **Step 2: Add Messaging API tab component**

Create `MessagingApiTab.tsx`:

```tsx
import { YStack } from 'tamagui'

import { TestWebhookSection } from './TestWebhookSection'
import { WebhookErrorsSection } from './WebhookErrorsSection'
import { WebhookSettingsSection } from './WebhookSettingsSection'

export function MessagingApiTab({ channelId }: { channelId: string }) {
  return (
    <YStack gap="$6">
      <WebhookSettingsSection channelId={channelId} />
      <WebhookErrorsSection channelId={channelId} />
      <TestWebhookSection channelId={channelId} />
    </YStack>
  )
}
```

- [ ] **Step 3: Add webhook settings section**

Create `WebhookSettingsSection.tsx` using `react-hook-form` and Valibot:

```tsx
import { valibotResolver } from '@hookform/resolvers/valibot'
import { Controller, useForm } from 'react-hook-form'
import * as v from 'valibot'
import { SizableText, Spinner, XStack, YStack } from 'tamagui'

import { useTanMutation, useTanQuery, useTanQueryClient } from '~/query'
import { oaClient } from '~/features/oa/client'
import { Button } from '~/interface/buttons/Button'
import { Input } from '~/interface/forms/Input'
import { showToast } from '~/interface/toast/Toast'

const schema = v.object({
  url: v.pipe(v.string(), v.url('Enter a valid URL')),
  useWebhook: v.boolean(),
  webhookRedeliveryEnabled: v.boolean(),
  errorStatisticsEnabled: v.boolean(),
})

type FormData = v.InferInput<typeof schema>

export function WebhookSettingsSection({ channelId }: { channelId: string }) {
  const queryClient = useTanQueryClient()
  const queryKey = ['oa', 'webhook-settings', channelId]
  const { data, isLoading } = useTanQuery({
    queryKey,
    queryFn: () => oaClient.getWebhookSettings({ officialAccountId: channelId }),
    enabled: !!channelId,
  })
  const form = useForm<FormData>({
    resolver: valibotResolver(schema),
    values: {
      url: data?.settings?.webhook?.url ?? '',
      useWebhook: data?.settings?.useWebhook ?? true,
      webhookRedeliveryEnabled: data?.settings?.webhookRedeliveryEnabled ?? false,
      errorStatisticsEnabled: data?.settings?.errorStatisticsEnabled ?? false,
    },
  })

  const save = useTanMutation({
    mutationFn: (input: FormData) =>
      oaClient.updateWebhookSettings({
        officialAccountId: channelId,
        url: input.url,
        useWebhook: input.useWebhook,
        webhookRedeliveryEnabled: input.webhookRedeliveryEnabled,
        errorStatisticsEnabled: input.errorStatisticsEnabled,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey })
      showToast('Webhook settings saved', { type: 'success' })
    },
    onError: () => showToast('Failed to save webhook settings', { type: 'error' }),
  })

  const verify = useTanMutation({
    mutationFn: () => oaClient.verifyWebhookEndpoint({ officialAccountId: channelId }),
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey })
      showToast(res.result?.success ? 'Webhook verified' : 'Webhook verification failed', {
        type: res.result?.success ? 'success' : 'error',
      })
    },
    onError: () => showToast('Failed to verify webhook', { type: 'error' }),
  })

  if (isLoading) return <Spinner />

  return (
    <YStack gap="$4" p="$4" bw={1} boc="$borderColor" rounded="$2">
      <XStack justify="space-between" items="center">
        <SizableText size="$5" fontWeight="700" color="$color12">
          Webhook settings
        </SizableText>
        <Button size="$2" variant="outlined" onPress={() => verify.mutate()}>
          Verify
        </Button>
      </XStack>

      <Controller
        control={form.control}
        name="url"
        render={({ field: { value, onChange }, fieldState: { error } }) => (
          <Input
            value={value}
            onChangeText={onChange}
            error={error?.message}
          />
        )}
      />

      {(['useWebhook', 'webhookRedeliveryEnabled', 'errorStatisticsEnabled'] as const).map(
        (name) => (
          <Controller
            key={name}
            control={form.control}
            name={name}
            render={({ field: { value, onChange } }) => (
              <XStack justify="space-between" items="center">
                <SizableText size="$3" color="$color11">
                  {name === 'useWebhook'
                    ? 'Use webhook'
                    : name === 'webhookRedeliveryEnabled'
                      ? 'Webhook redelivery'
                      : 'Error statistics aggregation'}
                </SizableText>
                <Button
                  size="$2"
                  variant={value ? 'primary' : 'outlined'}
                  onPress={() => onChange(!value)}
                >
                  {value ? 'On' : 'Off'}
                </Button>
              </XStack>
            )}
          />
        ),
      )}

      <XStack justify="space-between" items="center">
        <SizableText size="$2" color="$color10">
          Last verify: {data?.settings?.lastVerifyReason ?? 'Not verified'}
        </SizableText>
        <Button
          size="$2"
          onPress={form.handleSubmit((values) => save.mutate(values))}
          disabled={save.isPending}
        >
          Save
        </Button>
      </XStack>
    </YStack>
  )
}
```

If `Button` does not support `variant="primary"`, use the default variant for the on state and `outlined` for off.

- [ ] **Step 4: Add webhook errors section**

Create `WebhookErrorsSection.tsx`:

```tsx
import { useState } from 'react'
import { SizableText, Spinner, XStack, YStack } from 'tamagui'

import { useTanMutation, useTanQuery, useTanQueryClient } from '~/query'
import { oaClient } from '~/features/oa/client'
import { Button } from '~/interface/buttons/Button'
import { showToast } from '~/interface/toast/Toast'

export function WebhookErrorsSection({ channelId }: { channelId: string }) {
  const queryClient = useTanQueryClient()
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined)
  const listKey = ['oa', 'webhook-deliveries', channelId, 'failed']
  const { data, isLoading } = useTanQuery({
    queryKey: listKey,
    queryFn: () =>
      oaClient.listWebhookDeliveries({
        officialAccountId: channelId,
        pageSize: 50,
        statusFilter: 'failed',
      }),
    enabled: !!channelId,
  })
  const detail = useTanQuery({
    queryKey: ['oa', 'webhook-delivery', channelId, selectedId],
    queryFn: () =>
      oaClient.getWebhookDelivery({
        officialAccountId: channelId,
        deliveryId: selectedId!,
      }),
    enabled: !!channelId && !!selectedId,
  })
  const redeliver = useTanMutation({
    mutationFn: (deliveryId: string) =>
      oaClient.redeliverWebhook({ officialAccountId: channelId, deliveryId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: listKey })
      if (selectedId) {
        void queryClient.invalidateQueries({
          queryKey: ['oa', 'webhook-delivery', channelId, selectedId],
        })
      }
      showToast('Webhook redelivered', { type: 'success' })
    },
    onError: () => showToast('Failed to redeliver webhook', { type: 'error' }),
  })

  return (
    <YStack gap="$3" p="$4" bw={1} boc="$borderColor" rounded="$2">
      <SizableText size="$5" fontWeight="700" color="$color12">
        Webhook errors
      </SizableText>
      {isLoading ? (
        <Spinner />
      ) : (
        <YStack>
          {(data?.deliveries ?? []).map((row) => (
            <XStack
              key={row.id}
              py="$2"
              gap="$3"
              items="center"
              borderBottomWidth={1}
              borderColor="$borderColor"
            >
              <SizableText size="$2" color="$color10" w={160}>
                {row.createdAt}
              </SizableText>
              <SizableText size="$2" color="$color12" w={90}>
                {row.eventType}
              </SizableText>
              <SizableText size="$2" color="$color10" w={120}>
                {row.reason ?? row.status}
              </SizableText>
              <SizableText size="$2" color="$color10" flex={1} numberOfLines={1}>
                {row.detail ?? ''}
              </SizableText>
              <Button size="$2" variant="outlined" onPress={() => setSelectedId(row.id)}>
                Detail
              </Button>
              <Button
                size="$2"
                onPress={() => redeliver.mutate(row.id)}
                disabled={redeliver.isPending}
              >
                Redeliver
              </Button>
            </XStack>
          ))}
          {(data?.deliveries ?? []).length === 0 && (
            <SizableText size="$2" color="$color10">
              No failed webhook deliveries.
            </SizableText>
          )}
        </YStack>
      )}
      {detail.data && (
        <YStack gap="$2" p="$3" bg="$color2" rounded="$2">
          <SizableText size="$3" fontWeight="700">
            Delivery detail
          </SizableText>
          <SizableText size="$2" fontFamily="$mono">
            {detail.data.payloadJson}
          </SizableText>
        </YStack>
      )}
    </YStack>
  )
}
```

- [ ] **Step 5: Add test webhook section**

Create `TestWebhookSection.tsx`:

```tsx
import { useState } from 'react'
import { SizableText, XStack, YStack } from 'tamagui'

import { useTanMutation } from '~/query'
import { oaClient } from '~/features/oa/client'
import { Button } from '~/interface/buttons/Button'
import { Input } from '~/interface/forms/Input'
import { showToast } from '~/interface/toast/Toast'

export function TestWebhookSection({ channelId }: { channelId: string }) {
  const [text, setText] = useState('Webhook test from Vine')
  const [lastResult, setLastResult] = useState<string>('No test sent')
  const send = useTanMutation({
    mutationFn: () =>
      oaClient.sendTestWebhookEvent({ officialAccountId: channelId, text }),
    onSuccess: (res) => {
      setLastResult(`${res.result?.statusCode ?? 0} ${res.result?.reason ?? ''}`)
      showToast(res.result?.success ? 'Test webhook sent' : 'Test webhook failed', {
        type: res.result?.success ? 'success' : 'error',
      })
    },
    onError: () => showToast('Failed to send test webhook', { type: 'error' }),
  })

  return (
    <YStack gap="$3" p="$4" bw={1} boc="$borderColor" rounded="$2">
      <SizableText size="$5" fontWeight="700" color="$color12">
        Test webhook
      </SizableText>
      <Input value={text} onChangeText={setText} />
      <XStack justify="space-between" items="center">
        <SizableText size="$2" color="$color10">
          Latest result: {lastResult}
        </SizableText>
        <Button size="$2" onPress={() => send.mutate()} disabled={send.isPending}>
          Send sample event
        </Button>
      </XStack>
    </YStack>
  )
}
```

- [ ] **Step 6: Update route tabs**

In `index.tsx`, import:

```tsx
import { ChannelHeader } from './ChannelHeader'
import { MessagingApiTab } from './MessagingApiTab'
```

Add state:

```tsx
const [activeTab, setActiveTab] = useState<'basic' | 'messaging'>('basic')
```

Replace the header JSX with:

```tsx
<ChannelHeader account={oa} />
```

Replace static tab labels with pressable labels:

```tsx
<XStack gap="$6" borderBottomWidth={1} borderColor="$borderColor" pb="$2">
  <SizableText
    size="$3"
    fontWeight={activeTab === 'basic' ? '700' : '400'}
    color={activeTab === 'basic' ? '$color12' : '$color10'}
    cursor="pointer"
    onPress={() => setActiveTab('basic')}
  >
    Basic settings
  </SizableText>
  <SizableText
    size="$3"
    fontWeight={activeTab === 'messaging' ? '700' : '400'}
    color={activeTab === 'messaging' ? '$color12' : '$color10'}
    cursor="pointer"
    onPress={() => setActiveTab('messaging')}
  >
    Messaging API
  </SizableText>
  <SizableText size="$3" color="$color10">
    LIFF
  </SizableText>
  <SizableText size="$3" color="$color10">
    Security
  </SizableText>
  <SizableText size="$3" color="$color10">
    Roles
  </SizableText>
</XStack>
```

Wrap the existing Basic Settings block in:

```tsx
{activeTab === 'basic' ? (
  <YStack gap="$6">
    ...existing basic settings content...
  </YStack>
) : (
  <MessagingApiTab channelId={channelId!} />
)}
```

- [ ] **Step 7: Run web typecheck**

Run:

```bash
bun run --cwd apps/web typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add 'apps/web/app/(app)/developers/console/channel/[channelId]' apps/web/src/features/oa/client.ts
git commit -m "feat(web): add messaging api webhook console"
```

---

## Task 7: Focused Frontend and Smoke Tests

**Files:**
- Create: `apps/web/src/test/unit/developers/channel-messaging-api-tab.test.tsx`
- Optional create: `apps/web/src/test/integration/developer-console-messaging-api.test.ts`

- [ ] **Step 1: Add unit test for the Messaging API tab if component render helpers are available**

Create `apps/web/src/test/unit/developers/channel-messaging-api-tab.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest'

describe('developer console Messaging API tab', () => {
  it('keeps webhook query keys stable for cache invalidation', () => {
    const channelId = '550e8400-e29b-41d4-a716-446655440000'
    expect(['oa', 'webhook-settings', channelId]).toEqual([
      'oa',
      'webhook-settings',
      channelId,
    ])
    expect(['oa', 'webhook-deliveries', channelId, 'failed']).toEqual([
      'oa',
      'webhook-deliveries',
      channelId,
      'failed',
    ])
  })
})
```

This is intentionally minimal. If the repo has a stable React render helper during implementation, replace this with a real render test that asserts the tab labels and section headings.

- [ ] **Step 2: Run web unit tests**

Run:

```bash
bun run --cwd apps/web test:unit -- src/test/unit/developers/channel-messaging-api-tab.test.tsx
```

Expected: PASS.

- [ ] **Step 3: Add optional Playwright smoke only if seeded developer console data is stable**

If integration data contains a stable channel ID or route, create `apps/web/src/test/integration/developer-console-messaging-api.test.ts`:

```ts
import { expect, test } from '@playwright/test'
import { loginAsAdmin } from './helpers'

const BASE_URL = process.env['PLAYWRIGHT_BASE_URL'] ?? 'http://localhost:3000'

test('developer console channel shows Messaging API webhook sections', async ({ page }) => {
  test.setTimeout(45000)
  await loginAsAdmin(page)
  await page.goto(`${BASE_URL}/developers/console`, { waitUntil: 'domcontentloaded' })
  await page.getByText('Messaging API').first().click()
  await page.getByText('Messaging API').click()
  await expect(page.getByText('Webhook settings')).toBeVisible()
  await expect(page.getByText('Webhook errors')).toBeVisible()
  await expect(page.getByText('Test webhook')).toBeVisible()
})
```

If seeded data is not stable, do not add this test; the spec allows the Playwright smoke to be conditional.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/test/unit/developers/channel-messaging-api-tab.test.tsx apps/web/src/test/integration/developer-console-messaging-api.test.ts
git commit -m "test(web): cover messaging api webhook console"
```

If no Playwright test was added, omit that path from `git add`.

---

## Task 8: Final Verification

**Files:**
- No new files.

- [ ] **Step 1: Run server unit tests for touched areas**

Run:

```bash
bun run --cwd apps/server test:unit -- src/services/oa-webhook-delivery.test.ts src/plugins/oa-webhook.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run server DB integration test**

Run:

```bash
docker compose up -d pgdb migrate
ZERO_UPSTREAM_DB=postgresql://user:password@localhost:5533/postgres bun run --cwd apps/server test:integration -- src/services/oa-webhook-delivery.int.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run web typecheck and focused unit test**

Run:

```bash
bun run --cwd apps/web typecheck
bun run --cwd apps/web test:unit -- src/test/unit/developers/channel-messaging-api-tab.test.tsx
```

Expected: PASS.

- [ ] **Step 4: Run repo-level checks if time allows**

Run:

```bash
bun run check:all
```

Expected: PASS.

- [ ] **Step 5: Commit any final fixes**

If verification required fixes, stage the exact files changed by those fixes.
For example, if only service and UI fixes were needed:

```bash
git add apps/server/src/services/oa-webhook-delivery.ts 'apps/web/app/(app)/developers/console/channel/[channelId]'
git commit -m "fix(oa): stabilize webhook observability"
```

If no fixes were needed, do not create an empty commit.

---

## Self-Review Checklist

- Spec coverage:
  - Durable delivery logs: Tasks 1, 3, 5.
  - Manual redelivery: Tasks 3, 4, 6.
  - LINE-like settings: Tasks 1, 4, 6.
  - Diagnostic-only test webhook: Tasks 3, 4, 6.
  - Privacy/retention: Tasks 1, 3, 4.
  - No public `/v2` routes and no LINE cloud calls: all APIs remain internal ConnectRPC or existing Vine routes.
- Red-flag scan target: this plan must not contain deferred-work markers or vague file paths.
- Type consistency:
  - `useWebhook`, `webhookRedeliveryEnabled`, and `errorStatisticsEnabled` are the DB/service/client names.
  - Proto uses snake_case fields which codegen maps to camelCase.
  - Delivery status strings remain `pending`, `delivered`, and `failed`.
