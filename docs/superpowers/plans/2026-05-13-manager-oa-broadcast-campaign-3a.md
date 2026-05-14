# Manager OA Broadcast Campaign Phase 3A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Vine-native manager audience filters and text campaign sending for one OA.

**Architecture:** Store saved audience filters and campaign summaries as Zero-synced OA manager data. Keep send execution server-owned by compiling the saved Mongo-like audience query into an OA-scoped recipient list, then reusing the existing `oaMessageRequest` / `oaMessageDelivery` outbox as the durable recipient snapshot and delivery pipeline. Phase 3B LINE-compatible external Messaging API endpoints are outside this plan and get their own adapter plan after Phase 3A lands.

**Tech Stack:** Bun, Drizzle, Zero/on-zero, ConnectRPC, Fastify, Vitest, One, Tamagui, Playwright.

**Execution decision:** Do not use a native `git worktree` for the first Phase 3A pass. This repository already has root `node_modules` and an existing `.code-review-graph/` in the current checkout, while a new worktree would need its own dependency install and graph setup. Use a normal feature branch plus subagent forked workspaces for task isolation.

---

## File Structure

- Create `packages/zero-schema/src/audience/query.ts`
  - Defines `AudienceQueryJson`, allowed field/operator registry, validation, and pure in-memory evaluation for canonical audience contact records.
- Create `packages/zero-schema/src/audience/query.test.ts`
  - Unit tests for query validation and evaluation semantics.
- Modify `packages/zero-schema/src/index.ts`
  - Exports audience query helpers.
- Modify `packages/db/src/schema-oa.ts`
  - Adds `oaAudienceFilter` and `oaCampaign`.
- Create `packages/db/src/migrations/20260513000000_oa_campaigns.ts`
  - Creates the two Phase 3A tables and indexes.
- Create `packages/zero-schema/src/models/oaAudienceFilter.ts`
  - Zero model, permission, and CRUD mutations for saved audience filters.
- Create `packages/zero-schema/src/models/oaCampaign.ts`
  - Zero model and read-only manager permission for campaign summaries.
- Create `packages/zero-schema/src/queries/oaAudienceFilter.ts`
  - Lists audience filters for one OA.
- Create `packages/zero-schema/src/queries/oaCampaign.ts`
  - Lists campaign summaries for one OA.
- Modify `packages/zero-schema/src/relationships.ts`
  - Adds OA relationships for audience filters and campaigns.
- Modify generated Zero files via `rtk bun --filter @vine/zero-schema zero:generate`
  - Regenerates `packages/zero-schema/src/generated/*`.
- Create `apps/server/src/services/oa-audience.ts`
  - Loads canonical OA contact records and applies `AudienceQueryJson` inside the OA boundary.
- Create `apps/server/src/services/oa-audience.test.ts`
  - Unit tests for audience preview and OA boundary behavior with mocked DB rows.
- Create `apps/server/src/services/oa-campaign.ts`
  - Creates/sends campaigns, links to the existing messaging outbox request, and syncs campaign counts.
- Create `apps/server/src/services/oa-campaign.test.ts`
  - Unit tests for ownership, preview, send idempotency, quota/message pipeline delegation, and count updates.
- Modify `apps/server/src/services/oa-messaging.ts`
  - Adds `campaign` as an internal request type and returns accepted request metadata needed by campaign service.
- Modify `packages/proto/proto/oa/v1/oa.proto`
  - Adds manager-only RPCs for previewing audience filters and sending text campaigns.
- Run `rtk bun turbo proto:generate`
  - Regenerates `packages/proto/gen/oa/v1/oa_pb.ts`.
- Modify `apps/server/src/connect/routes.ts`
  - Passes `oaCampaign` service into the OA Connect handler.
- Modify `apps/server/src/connect/oa.ts`
  - Wires new authenticated RPC methods.
- Modify `apps/server/src/index.ts`
  - Constructs `createOAAudienceService` and `createOACampaignService`.
- Create `apps/web/src/features/oa-manager/campaign/useManagerOAAudienceFilters.ts`
  - Reads saved audience filters from Zero and wraps Zero mutations.
- Create `apps/web/src/features/oa-manager/campaign/useManagerOACampaigns.ts`
  - Reads campaign summaries from Zero and calls ConnectRPC preview/send.
- Create `apps/web/src/features/oa-manager/campaign/ManagerOAAudienceFiltersPage.tsx`
  - Manager page for saved audience filters.
- Create `apps/web/src/features/oa-manager/campaign/ManagerOACampaignsPage.tsx`
  - Manager page for campaign list and text campaign creation.
- Create `apps/web/app/(app)/manager/[oaId]/campaigns/index.tsx`
  - One route for campaign management.
- Create `apps/web/src/test/unit/features/oa-manager/audienceQueryBuilder.test.ts`
  - Unit tests for the UI query builder helpers.
- Modify `apps/web/src/features/oa-manager/home/ManagerOAHome.tsx`
  - Adds a Campaigns operation card.
- Modify `apps/web/src/test/integration/manager-oa-home.test.ts`
  - Asserts the Campaigns entry point exists.
- Create `apps/web/src/test/integration/manager-oa-campaigns.test.ts`
  - Covers filter creation, preview count, text campaign send, and campaign status visibility.

Do not implement the external LINE-compatible `/v2/bot/...` facade in this plan.

## Task 1: Audience Query Language

**Files:**
- Create: `packages/zero-schema/src/audience/query.ts`
- Create: `packages/zero-schema/src/audience/query.test.ts`
- Modify: `packages/zero-schema/src/index.ts`

- [ ] **Step 1: Write failing query validation and evaluation tests**

Create `packages/zero-schema/src/audience/query.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  evaluateAudienceQuery,
  validateAudienceQuery,
  type AudienceContact,
  type AudienceQueryJson,
} from './query'

const vipContact: AudienceContact = {
  friendship: { status: 'friend' },
  providerUserId: 'user-1',
  displayName: 'Alice',
  tags: { ids: ['tag-vip', 'tag-spring'], names: ['VIP', 'Spring'] },
  lastInteractionAt: '2026-05-01T00:00:00.000Z',
  chat: { status: 'active', unread: true },
  note: { exists: true },
}

describe('AudienceQueryJson', () => {
  it('accepts a controlled Mongo-like predicate', () => {
    const query: AudienceQueryJson = {
      $and: [
        { 'friendship.status': 'friend' },
        { 'tags.ids': { $all: ['tag-vip'] } },
        { lastInteractionAt: { $gte: '2026-04-01T00:00:00.000Z' } },
      ],
    }

    expect(validateAudienceQuery(query)).toEqual({ ok: true })
    expect(evaluateAudienceQuery(query, vipContact)).toBe(true)
  })

  it('rejects unknown fields', () => {
    expect(validateAudienceQuery({ 'secret.email': 'a@example.test' })).toEqual({
      ok: false,
      error: 'Unsupported audience field: secret.email',
    })
  })

  it('rejects unknown operators', () => {
    expect(validateAudienceQuery({ displayName: { $regex: 'Alice' } })).toEqual({
      ok: false,
      error: 'Unsupported operator for displayName: $regex',
    })
  })

  it('supports OR, NOT, IN, NIN, ALL, and EXISTS', () => {
    const query: AudienceQueryJson = {
      $and: [
        { $or: [{ providerUserId: 'user-1' }, { providerUserId: 'user-2' }] },
        { $not: { 'tags.ids': { $in: ['blocked'] } } },
        { 'tags.ids': { $all: ['tag-vip', 'tag-spring'] } },
        { 'note.exists': true },
        { 'chat.status': { $nin: ['no_chat'] } },
      ],
    }

    expect(validateAudienceQuery(query)).toEqual({ ok: true })
    expect(evaluateAudienceQuery(query, vipContact)).toBe(true)
  })

  it('rejects excessive depth', () => {
    const query: AudienceQueryJson = {
      $and: [
        {
          $or: [
            {
              $and: [
                {
                  $or: [{ displayName: 'Alice' }],
                },
              ],
            },
          ],
        },
      ],
    }

    expect(validateAudienceQuery(query)).toEqual({
      ok: false,
      error: 'Audience query is too deep',
    })
  })
})
```

- [ ] **Step 2: Run the failing package test**

Run:

```bash
rtk bun run --cwd packages/zero-schema test -- src/audience/query.test.ts
```

Expected: FAIL because `packages/zero-schema/src/audience/query.ts` does not exist.

- [ ] **Step 3: Add the minimal query implementation**

Create `packages/zero-schema/src/audience/query.ts`:

```ts
export type AudienceQueryJson = Record<string, unknown>

export type AudienceContact = {
  friendship: { status: string }
  providerUserId: string
  displayName: string
  tags: { ids: string[]; names: string[] }
  lastInteractionAt: string | null
  chat: { status: 'active' | 'no_chat'; unread: boolean }
  note: { exists: boolean }
}

export type AudienceValidationResult =
  | { ok: true }
  | { ok: false; error: string }

const MAX_DEPTH = 4
const MAX_BRANCHES = 20

const FIELD_OPERATORS: Record<string, Set<string>> = {
  'friendship.status': new Set(['$eq', '$ne', '$in', '$nin']),
  providerUserId: new Set(['$eq', '$ne', '$in', '$nin']),
  displayName: new Set(['$eq', '$ne', '$in', '$nin']),
  'tags.ids': new Set(['$eq', '$ne', '$in', '$nin', '$all', '$exists']),
  'tags.names': new Set(['$eq', '$ne', '$in', '$nin', '$all', '$exists']),
  lastInteractionAt: new Set(['$eq', '$ne', '$gt', '$gte', '$lt', '$lte', '$exists']),
  'chat.status': new Set(['$eq', '$ne', '$in', '$nin']),
  'chat.unread': new Set(['$eq', '$ne']),
  'note.exists': new Set(['$eq', '$ne']),
}

const LOGICAL_OPERATORS = new Set(['$and', '$or', '$not'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function getPathValue(contact: AudienceContact, field: string): unknown {
  const parts = field.split('.')
  let value: unknown = contact
  for (const part of parts) {
    if (!isRecord(value)) return undefined
    value = value[part]
  }
  return value
}

function normalizeFieldPredicate(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) return { $eq: value }
  const keys = Object.keys(value)
  if (keys.some((key) => key.startsWith('$'))) return value
  return { $eq: value }
}

function compareScalar(actual: unknown, op: string, expected: unknown): boolean {
  if (op === '$eq') return actual === expected
  if (op === '$ne') return actual !== expected
  if (op === '$gt') return String(actual ?? '') > String(expected ?? '')
  if (op === '$gte') return String(actual ?? '') >= String(expected ?? '')
  if (op === '$lt') return String(actual ?? '') < String(expected ?? '')
  if (op === '$lte') return String(actual ?? '') <= String(expected ?? '')
  return false
}

function matchesField(actual: unknown, predicate: Record<string, unknown>): boolean {
  for (const [op, expected] of Object.entries(predicate)) {
    if (op === '$exists') {
      const exists = actual !== undefined && actual !== null
      if (exists !== Boolean(expected)) return false
      continue
    }
    if (op === '$in' || op === '$nin') {
      const list = Array.isArray(expected) ? expected : []
      const hit = Array.isArray(actual)
        ? actual.some((value) => list.includes(value))
        : list.includes(actual)
      if (op === '$in' && !hit) return false
      if (op === '$nin' && hit) return false
      continue
    }
    if (op === '$all') {
      const list = Array.isArray(expected) ? expected : []
      if (!Array.isArray(actual)) return false
      if (!list.every((value) => actual.includes(value))) return false
      continue
    }
    if (Array.isArray(actual)) {
      const hit = actual.some((value) => compareScalar(value, op, expected))
      if (!hit) return false
      continue
    }
    if (!compareScalar(actual, op, expected)) return false
  }
  return true
}

function validateNode(node: unknown, depth: number): AudienceValidationResult {
  if (!isRecord(node)) return { ok: false, error: 'Audience query must be an object' }
  if (depth > MAX_DEPTH) return { ok: false, error: 'Audience query is too deep' }
  if (Object.keys(node).length > MAX_BRANCHES) {
    return { ok: false, error: 'Audience query has too many branches' }
  }

  for (const [key, value] of Object.entries(node)) {
    if (key === '$and' || key === '$or') {
      if (!Array.isArray(value) || value.length === 0) {
        return { ok: false, error: `${key} must be a non-empty array` }
      }
      if (value.length > MAX_BRANCHES) {
        return { ok: false, error: 'Audience query has too many branches' }
      }
      for (const child of value) {
        const result = validateNode(child, depth + 1)
        if (!result.ok) return result
      }
      continue
    }
    if (key === '$not') {
      return validateNode(value, depth + 1)
    }
    if (key.startsWith('$') && !LOGICAL_OPERATORS.has(key)) {
      return { ok: false, error: `Unsupported audience operator: ${key}` }
    }

    const allowed = FIELD_OPERATORS[key]
    if (!allowed) return { ok: false, error: `Unsupported audience field: ${key}` }
    const predicate = normalizeFieldPredicate(value)
    for (const op of Object.keys(predicate)) {
      if (!allowed.has(op)) {
        return { ok: false, error: `Unsupported operator for ${key}: ${op}` }
      }
    }
  }

  return { ok: true }
}

function evaluateNode(node: AudienceQueryJson, contact: AudienceContact): boolean {
  for (const [key, value] of Object.entries(node)) {
    if (key === '$and') {
      const children = value as AudienceQueryJson[]
      if (!children.every((child) => evaluateNode(child, contact))) return false
      continue
    }
    if (key === '$or') {
      const children = value as AudienceQueryJson[]
      if (!children.some((child) => evaluateNode(child, contact))) return false
      continue
    }
    if (key === '$not') {
      if (evaluateNode(value as AudienceQueryJson, contact)) return false
      continue
    }
    if (!matchesField(getPathValue(contact, key), normalizeFieldPredicate(value))) {
      return false
    }
  }
  return true
}

export function validateAudienceQuery(query: unknown): AudienceValidationResult {
  return validateNode(query, 0)
}

export function evaluateAudienceQuery(
  query: AudienceQueryJson,
  contact: AudienceContact,
): boolean {
  const validation = validateAudienceQuery(query)
  if (!validation.ok) throw new Error(validation.error)
  return evaluateNode(query, contact)
}
```

- [ ] **Step 4: Export the query helpers**

Modify `packages/zero-schema/src/index.ts`:

```ts
export * from './audience/query'
```

Place this near the existing type exports so server and web can import from `@vine/zero-schema`.

- [ ] **Step 5: Run the query tests**

Run:

```bash
rtk bun run --cwd packages/zero-schema test -- src/audience/query.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
rtk git add packages/zero-schema/src/audience/query.ts packages/zero-schema/src/audience/query.test.ts packages/zero-schema/src/index.ts
rtk git commit -m "feat: add oa audience query language"
```

## Task 2: Database and Zero Schema

**Files:**
- Modify: `packages/db/src/schema-oa.ts`
- Create: `packages/db/src/migrations/20260513000000_oa_campaigns.ts`
- Create: `packages/zero-schema/src/models/oaAudienceFilter.ts`
- Create: `packages/zero-schema/src/models/oaCampaign.ts`
- Create: `packages/zero-schema/src/queries/oaAudienceFilter.ts`
- Create: `packages/zero-schema/src/queries/oaCampaign.ts`
- Modify: `packages/zero-schema/src/relationships.ts`
- Modify: `packages/zero-schema/src/index.ts`
- Generated: `packages/zero-schema/src/generated/*`

- [ ] **Step 1: Write failing Zero model permission tests**

Create `packages/zero-schema/src/__tests__/manager-oa-campaigns.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { managerOwnedOaAudienceFilterPermission } from '../models/oaAudienceFilter'
import { managerOwnedOaCampaignPermission } from '../models/oaCampaign'

function chain(rows: unknown[]) {
  return {
    where: vi.fn(() => chain(rows)),
    whereExists: vi.fn((_name: string, cb: (q: unknown) => unknown) => {
      cb(chain(rows))
      return chain(rows)
    }),
    run: vi.fn(async () => rows),
  }
}

describe('manager OA campaigns Zero schema', () => {
  it('exposes manager-owned permissions for audience filters and campaigns', () => {
    expect(typeof managerOwnedOaAudienceFilterPermission).toBe('function')
    expect(typeof managerOwnedOaCampaignPermission).toBe('function')
  })
})
```

- [ ] **Step 2: Run the failing Zero tests**

Run:

```bash
rtk bun run --cwd packages/zero-schema test -- src/__tests__/manager-oa-campaigns.test.ts
```

Expected: FAIL because `oaAudienceFilter` and `oaCampaign` models do not exist.

- [ ] **Step 3: Add Drizzle tables**

Modify `packages/db/src/schema-oa.ts`. Add these table exports after `oaChatFilter`:

```ts
export const oaAudienceFilter = pgTable(
  'oaAudienceFilter',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    oaId: uuid('oaId')
      .notNull()
      .references(() => officialAccount.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    queryVersion: integer('queryVersion').notNull().default(1),
    queryJson: jsonb('queryJson').notNull(),
    createdByManagerId: text('createdByManagerId').notNull(),
    createdAt: timestamp('createdAt', { mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp('updatedAt', { mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    index('oaAudienceFilter_oaId_idx').on(table.oaId),
    uniqueIndex('oaAudienceFilter_oaId_name_unique').on(table.oaId, table.name),
  ],
)

export const oaCampaign = pgTable(
  'oaCampaign',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    oaId: uuid('oaId')
      .notNull()
      .references(() => officialAccount.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    messageType: text('messageType').notNull().default('text'),
    messageText: text('messageText').notNull(),
    audienceFilterId: uuid('audienceFilterId').references(() => oaAudienceFilter.id, {
      onDelete: 'set null',
    }),
    inlineAudienceQueryJson: jsonb('inlineAudienceQueryJson'),
    messageRequestId: uuid('messageRequestId'),
    status: text('status').notNull().default('draft'),
    recipientSnapshotCount: integer('recipientSnapshotCount').notNull().default(0),
    successCount: integer('successCount').notNull().default(0),
    failedCount: integer('failedCount').notNull().default(0),
    quotaUsed: integer('quotaUsed').notNull().default(0),
    createdByManagerId: text('createdByManagerId').notNull(),
    createdAt: timestamp('createdAt', { mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp('updatedAt', { mode: 'string' }).defaultNow().notNull(),
    queuedAt: timestamp('queuedAt', { mode: 'string' }),
    sentAt: timestamp('sentAt', { mode: 'string' }),
  },
  (table) => [
    index('oaCampaign_oaId_createdAt_idx').on(table.oaId, table.createdAt),
    index('oaCampaign_oaId_status_idx').on(table.oaId, table.status),
    index('oaCampaign_messageRequestId_idx').on(table.messageRequestId),
  ],
)
```

`messageRequestId` intentionally has no Drizzle foreign key because `oaMessageRequest` is defined in `schema-private.ts`, which already imports `officialAccount` from `schema-oa.ts`.

- [ ] **Step 4: Add the migration**

Create `packages/db/src/migrations/20260513000000_oa_campaigns.ts`:

```ts
import { sql } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

export async function up(db: NodePgDatabase) {
  await db.execute(sql`
    CREATE TABLE "oaAudienceFilter" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "oaId" uuid NOT NULL,
      "name" text NOT NULL,
      "queryVersion" integer DEFAULT 1 NOT NULL,
      "queryJson" jsonb NOT NULL,
      "createdByManagerId" text NOT NULL,
      "createdAt" timestamp DEFAULT now() NOT NULL,
      "updatedAt" timestamp DEFAULT now() NOT NULL
    );

    CREATE TABLE "oaCampaign" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "oaId" uuid NOT NULL,
      "name" text NOT NULL,
      "messageType" text DEFAULT 'text' NOT NULL,
      "messageText" text NOT NULL,
      "audienceFilterId" uuid,
      "inlineAudienceQueryJson" jsonb,
      "messageRequestId" uuid,
      "status" text DEFAULT 'draft' NOT NULL,
      "recipientSnapshotCount" integer DEFAULT 0 NOT NULL,
      "successCount" integer DEFAULT 0 NOT NULL,
      "failedCount" integer DEFAULT 0 NOT NULL,
      "quotaUsed" integer DEFAULT 0 NOT NULL,
      "createdByManagerId" text NOT NULL,
      "createdAt" timestamp DEFAULT now() NOT NULL,
      "updatedAt" timestamp DEFAULT now() NOT NULL,
      "queuedAt" timestamp,
      "sentAt" timestamp
    );

    CREATE INDEX "oaAudienceFilter_oaId_idx" ON "oaAudienceFilter" ("oaId");
    CREATE UNIQUE INDEX "oaAudienceFilter_oaId_name_unique" ON "oaAudienceFilter" ("oaId", "name");
    CREATE INDEX "oaCampaign_oaId_createdAt_idx" ON "oaCampaign" ("oaId", "createdAt");
    CREATE INDEX "oaCampaign_oaId_status_idx" ON "oaCampaign" ("oaId", "status");
    CREATE INDEX "oaCampaign_messageRequestId_idx" ON "oaCampaign" ("messageRequestId");

    ALTER TABLE "oaAudienceFilter"
      ADD CONSTRAINT "oaAudienceFilter_oaId_officialAccount_id_fkey"
      FOREIGN KEY ("oaId") REFERENCES "officialAccount"("id") ON DELETE CASCADE;

    ALTER TABLE "oaCampaign"
      ADD CONSTRAINT "oaCampaign_oaId_officialAccount_id_fkey"
      FOREIGN KEY ("oaId") REFERENCES "officialAccount"("id") ON DELETE CASCADE;

    ALTER TABLE "oaCampaign"
      ADD CONSTRAINT "oaCampaign_audienceFilterId_oaAudienceFilter_id_fkey"
      FOREIGN KEY ("audienceFilterId") REFERENCES "oaAudienceFilter"("id") ON DELETE SET NULL;
  `)
}

export async function down(db: NodePgDatabase) {
  await db.execute(sql`
    DROP TABLE IF EXISTS "oaCampaign";
    DROP TABLE IF EXISTS "oaAudienceFilter";
  `)
}
```

- [ ] **Step 5: Add Zero audience filter model**

Create `packages/zero-schema/src/models/oaAudienceFilter.ts`:

```ts
import { json, number, string, table } from '@rocicorp/zero'
/* eslint-disable @typescript-eslint/no-deprecated -- tx.query is the current Zero mutations API */
import { mutations, run, serverWhere, zql } from 'on-zero'
import { validateAudienceQuery, type AudienceQueryJson } from '../audience/query'
import type { TableInsertRow } from 'on-zero'

export type OaAudienceFilter = TableInsertRow<typeof schema>

const MAX_AUDIENCE_FILTERS_PER_OA = 50

async function readRows(
  tx: { query?: Record<string, any> },
  tableName: string,
  build: (query: any) => any,
) {
  const query = tx.query as Record<string, any> | undefined
  const txQuery = query?.[tableName]
  if (txQuery) return build(txQuery).run()
  return run(build((zql as Record<string, any>)[tableName]))
}

async function assertManagerOwnsOa(
  tx: { query?: Record<string, any> },
  authData: { id: string },
  oaId: string,
) {
  const accounts = await readRows(tx, 'officialAccount', (q) => q.where('id', oaId))
  const account = accounts[0]
  if (!account) throw new Error('Unauthorized')

  const providers = await readRows(tx, 'oaProvider', (q) =>
    q.where('id', account.providerId),
  )
  const provider = providers[0]
  if (!provider || provider.ownerId !== authData.id) throw new Error('Unauthorized')
}

function cleanName(name: string): string {
  const trimmed = name.trim()
  if (trimmed.length === 0) throw new Error('Audience name is required')
  if (trimmed.length > 64) throw new Error('Audience name too long (max 64)')
  return trimmed
}

function validateStoredQuery(queryJson: AudienceQueryJson) {
  const result = validateAudienceQuery(queryJson)
  if (!result.ok) throw new Error(result.error)
}

export const schema = table('oaAudienceFilter')
  .columns({
    id: string(),
    oaId: string(),
    name: string(),
    queryVersion: number(),
    queryJson: json<AudienceQueryJson>(),
    createdByManagerId: string(),
    createdAt: number(),
    updatedAt: number(),
  })
  .primaryKey('id')

export const managerOwnedOaAudienceFilterPermission = serverWhere(
  'oaAudienceFilter',
  (eb, auth) => {
    const userId = auth?.id || ''
    return eb.exists('oa', (oaQ) =>
      oaQ.whereExists('provider', (providerQ) => providerQ.where('ownerId', userId)),
    )
  },
)

export const mutate = mutations(schema, managerOwnedOaAudienceFilterPermission, {
  create: async (
    { authData, tx },
    args: {
      id: string
      oaId: string
      name: string
      queryJson: AudienceQueryJson
      createdAt: number
      updatedAt: number
    },
  ) => {
    if (!authData) throw new Error('Unauthorized')
    await assertManagerOwnsOa(tx as { query?: Record<string, any> }, authData, args.oaId)

    const name = cleanName(args.name)
    validateStoredQuery(args.queryJson)

    const existing = await readRows(tx, 'oaAudienceFilter', (q) =>
      q.where('oaId', args.oaId),
    )
    if (existing.length >= MAX_AUDIENCE_FILTERS_PER_OA) {
      throw new Error(`Cannot create more than ${MAX_AUDIENCE_FILTERS_PER_OA} audiences`)
    }
    if (existing.some((filter: { name: string }) => filter.name === name)) {
      throw new Error('Audience name already exists')
    }

    await tx.mutate.oaAudienceFilter.insert({
      id: args.id,
      oaId: args.oaId,
      name,
      queryVersion: 1,
      queryJson: args.queryJson,
      createdByManagerId: authData.id,
      createdAt: args.createdAt,
      updatedAt: args.updatedAt,
    })
  },
  update: async (
    { authData, tx },
    args: {
      id: string
      oaId: string
      name: string
      queryJson: AudienceQueryJson
      updatedAt: number
    },
  ) => {
    if (!authData) throw new Error('Unauthorized')
    await assertManagerOwnsOa(tx as { query?: Record<string, any> }, authData, args.oaId)

    const name = cleanName(args.name)
    validateStoredQuery(args.queryJson)

    await tx.mutate.oaAudienceFilter.update({
      id: args.id,
      name,
      queryJson: args.queryJson,
      updatedAt: args.updatedAt,
    })
  },
  deleteFilter: async ({ authData, tx }, args: { id: string; oaId: string }) => {
    if (!authData) throw new Error('Unauthorized')
    await assertManagerOwnsOa(tx as { query?: Record<string, any> }, authData, args.oaId)
    await tx.mutate.oaAudienceFilter.delete({ id: args.id })
  },
})
```

- [ ] **Step 6: Add Zero campaign model**

Create `packages/zero-schema/src/models/oaCampaign.ts`:

```ts
import { json, number, string, table } from '@rocicorp/zero'
import { mutations, serverWhere } from 'on-zero'
import type { AudienceQueryJson } from '../audience/query'
import type { TableInsertRow } from 'on-zero'

export type OaCampaign = TableInsertRow<typeof schema>

export const schema = table('oaCampaign')
  .columns({
    id: string(),
    oaId: string(),
    name: string(),
    messageType: string(),
    messageText: string(),
    audienceFilterId: string().optional(),
    inlineAudienceQueryJson: json<AudienceQueryJson>().optional(),
    messageRequestId: string().optional(),
    status: string(),
    recipientSnapshotCount: number(),
    successCount: number(),
    failedCount: number(),
    quotaUsed: number(),
    createdByManagerId: string(),
    createdAt: number(),
    updatedAt: number(),
    queuedAt: number().optional(),
    sentAt: number().optional(),
  })
  .primaryKey('id')

export const managerOwnedOaCampaignPermission = serverWhere('oaCampaign', (eb, auth) => {
  const userId = auth?.id || ''
  return eb.exists('oa', (oaQ) =>
    oaQ.whereExists('provider', (providerQ) => providerQ.where('ownerId', userId)),
  )
})

const rejectClientCampaignMutation = async () => {
  throw new Error('Use campaign service actions')
}

export const mutate = mutations(schema, managerOwnedOaCampaignPermission, {
  insert: rejectClientCampaignMutation,
  update: rejectClientCampaignMutation,
  upsert: rejectClientCampaignMutation,
  delete: rejectClientCampaignMutation,
})
```

- [ ] **Step 7: Add Zero queries and relationships**

Create `packages/zero-schema/src/queries/oaAudienceFilter.ts`:

```ts
import { zql } from 'on-zero'
import { managerOwnedOaAudienceFilterPermission } from '../models/oaAudienceFilter'

export const oaAudienceFiltersByOfficialAccountId = (props: {
  oaId: string
  limit?: number
}) => {
  return zql.oaAudienceFilter
    .where(managerOwnedOaAudienceFilterPermission)
    .where('oaId', props.oaId)
    .orderBy('createdAt', 'desc')
    .limit(props.limit ?? 50)
}
```

Create `packages/zero-schema/src/queries/oaCampaign.ts`:

```ts
import { zql } from 'on-zero'
import { managerOwnedOaCampaignPermission } from '../models/oaCampaign'

export const oaCampaignsByOfficialAccountId = (props: {
  oaId: string
  limit?: number
}) => {
  return zql.oaCampaign
    .where(managerOwnedOaCampaignPermission)
    .where('oaId', props.oaId)
    .orderBy('createdAt', 'desc')
    .limit(props.limit ?? 100)
}
```

Modify `packages/zero-schema/src/relationships.ts`:

```ts
export const oaAudienceFilterRelationships = relationships(
  tables.oaAudienceFilter,
  ({ one, many }) => ({
    oa: one({
      sourceField: ['oaId'],
      destSchema: tables.officialAccount,
      destField: ['id'],
    }),
    campaigns: many({
      sourceField: ['id'],
      destSchema: tables.oaCampaign,
      destField: ['audienceFilterId'],
    }),
  }),
)

export const oaCampaignRelationships = relationships(tables.oaCampaign, ({ one }) => ({
  oa: one({
    sourceField: ['oaId'],
    destSchema: tables.officialAccount,
    destField: ['id'],
  }),
  audienceFilter: one({
    sourceField: ['audienceFilterId'],
    destSchema: tables.oaAudienceFilter,
    destField: ['id'],
  }),
}))
```

Also add `audienceFilters` and `campaigns` to `officialAccountRelationships`, and add both relationship exports to `allRelationships`.

- [ ] **Step 8: Export models and queries**

Modify `packages/zero-schema/src/index.ts`:

```ts
export * as oaAudienceFilterModel from './models/oaAudienceFilter'
export * as oaCampaignModel from './models/oaCampaign'
export * as oaAudienceFilterQueries from './queries/oaAudienceFilter'
export * as oaCampaignQueries from './queries/oaCampaign'
```

- [ ] **Step 9: Regenerate Zero schema**

Run:

```bash
rtk bun --filter @vine/zero-schema zero:generate
```

Expected: generated table/model/query/mutation files include `oaAudienceFilter` and `oaCampaign`.

- [ ] **Step 10: Run Zero tests**

Run:

```bash
rtk bun run --cwd packages/zero-schema test -- src/__tests__/manager-oa-campaigns.test.ts
```

Expected: PASS.

- [ ] **Step 11: Commit**

```bash
rtk git add packages/db/src/schema-oa.ts packages/db/src/migrations/20260513000000_oa_campaigns.ts packages/zero-schema/src
rtk git commit -m "feat: add oa audience and campaign schema"
```

## Task 3: Server Audience Resolver

**Files:**
- Create: `apps/server/src/services/oa-audience.ts`
- Create: `apps/server/src/services/oa-audience.test.ts`

- [ ] **Step 1: Write failing audience service tests**

Create `apps/server/src/services/oa-audience.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { createOAAudienceService } from './oa-audience'

describe('OA audience service', () => {
  it('rejects invalid queries before reading recipients', async () => {
    const db = { select: vi.fn() } as any
    const service = createOAAudienceService({ db })

    const result = await service.preview({
      oaId: 'oa-1',
      query: { displayName: { $regex: 'bad' } },
    })

    expect(result).toEqual({
      ok: false,
      code: 'INVALID_AUDIENCE_QUERY',
      message: 'Unsupported operator for displayName: $regex',
    })
    expect(db.select).not.toHaveBeenCalled()
  })

  it('loads contacts inside one OA and filters by tag', async () => {
    const service = createOAAudienceService({
      db: {
        select: vi.fn(),
      } as any,
      loadContactsForTest: async () => [
        {
          friendship: { status: 'friend' },
          providerUserId: 'user-1',
          displayName: 'Alice',
          tags: { ids: ['vip'], names: ['VIP'] },
          lastInteractionAt: '2026-05-01T00:00:00.000Z',
          chat: { status: 'active', unread: true },
          note: { exists: true },
        },
        {
          friendship: { status: 'friend' },
          providerUserId: 'user-2',
          displayName: 'Bob',
          tags: { ids: [], names: [] },
          lastInteractionAt: null,
          chat: { status: 'no_chat', unread: false },
          note: { exists: false },
        },
      ],
    })

    const result = await service.resolveRecipients({
      oaId: 'oa-1',
      query: { 'tags.ids': { $all: ['vip'] } },
    })

    expect(result).toEqual({ ok: true, userIds: ['user-1'] })
  })
})
```

- [ ] **Step 2: Run the failing server unit test**

Run:

```bash
rtk bun run --cwd apps/server test:unit -- oa-audience.test.ts
```

Expected: FAIL because `oa-audience.ts` does not exist.

- [ ] **Step 3: Implement the audience service**

Create `apps/server/src/services/oa-audience.ts`:

```ts
import { evaluateAudienceQuery, validateAudienceQuery } from '@vine/zero-schema'
import type { AudienceContact, AudienceQueryJson } from '@vine/zero-schema'
import type { schema } from '@vine/db'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

export type OAAudienceServiceDeps = {
  db: NodePgDatabase<typeof schema>
  loadContactsForTest?: (oaId: string) => Promise<AudienceContact[]>
}

export type OAAudienceResolveResult =
  | { ok: true; userIds: string[] }
  | { ok: false; code: 'INVALID_AUDIENCE_QUERY'; message: string }

async function loadContactsForOa(
  deps: OAAudienceServiceDeps,
  oaId: string,
): Promise<AudienceContact[]> {
  if (deps.loadContactsForTest) return deps.loadContactsForTest(oaId)

  const { oaFriendship, oaContactProfile, oaContactTag, oaContactTagAssignment } =
    await import('@vine/db/schema-oa')
  const { chat, chatMember, userPublic } = await import('@vine/db/schema-public')
  const { and, eq, isNotNull } = await import('drizzle-orm')
  const { alias } = await import('drizzle-orm/pg-core')

  const friendships = await deps.db
    .select({
      userId: oaFriendship.userId,
      status: oaFriendship.status,
      displayName: userPublic.name,
      noteText: oaContactProfile.noteText,
    })
    .from(oaFriendship)
    .leftJoin(userPublic, eq(userPublic.id, oaFriendship.userId))
    .leftJoin(
      oaContactProfile,
      and(
        eq(oaContactProfile.oaId, oaFriendship.oaId),
        eq(oaContactProfile.userId, oaFriendship.userId),
      ),
    )
    .where(eq(oaFriendship.oaId, oaId))

  const assignments = await deps.db
    .select({
      userId: oaContactTagAssignment.userId,
      tagId: oaContactTagAssignment.tagId,
      tagName: oaContactTag.name,
    })
    .from(oaContactTagAssignment)
    .innerJoin(oaContactTag, eq(oaContactTag.id, oaContactTagAssignment.tagId))
    .where(eq(oaContactTagAssignment.oaId, oaId))

  const oaChatMember = alias(chatMember, 'oaChatMember')
  const userChatMember = alias(chatMember, 'userChatMember')
  const oaChatMembers = await deps.db
    .select({
      userId: userChatMember.userId,
      chatId: chat.id,
      lastMessageAt: chat.lastMessageAt,
      lastReadAt: userChatMember.lastReadAt,
    })
    .from(chat)
    .innerJoin(
      oaChatMember,
      and(eq(oaChatMember.chatId, chat.id), eq(oaChatMember.oaId, oaId)),
    )
    .innerJoin(
      userChatMember,
      and(eq(userChatMember.chatId, chat.id), isNotNull(userChatMember.userId)),
    )
    .where(eq(chat.type, 'oa'))

  return friendships.map((friend) => {
    const tags = assignments.filter((tag) => tag.userId === friend.userId)
    const chatRow = oaChatMembers.find((row) => row.userId === friend.userId)
    const hasUnread = Boolean(
      chatRow?.lastMessageAt &&
        (!chatRow.lastReadAt || chatRow.lastReadAt < chatRow.lastMessageAt),
    )

    return {
      friendship: { status: friend.status },
      providerUserId: friend.userId,
      displayName: friend.displayName ?? '',
      tags: {
        ids: tags.map((tag) => tag.tagId),
        names: tags.map((tag) => tag.tagName),
      },
      lastInteractionAt: chatRow?.lastMessageAt ?? null,
      chat: { status: chatRow ? 'active' : 'no_chat', unread: hasUnread },
      note: { exists: Boolean(friend.noteText && friend.noteText.length > 0) },
    }
  })
}

export function createOAAudienceService(deps: OAAudienceServiceDeps) {
  async function resolveRecipients(input: {
    oaId: string
    query: AudienceQueryJson
  }): Promise<OAAudienceResolveResult> {
    const validation = validateAudienceQuery(input.query)
    if (!validation.ok) {
      return {
        ok: false,
        code: 'INVALID_AUDIENCE_QUERY',
        message: validation.error,
      }
    }

    const contacts = await loadContactsForOa(deps, input.oaId)
    return {
      ok: true,
      userIds: contacts
        .filter((contact) => evaluateAudienceQuery(input.query, contact))
        .map((contact) => contact.providerUserId),
    }
  }

  async function preview(input: { oaId: string; query: AudienceQueryJson }) {
    const result = await resolveRecipients(input)
    if (!result.ok) return result
    return { ok: true as const, count: result.userIds.length }
  }

  return { resolveRecipients, preview }
}
```

- [ ] **Step 4: Run the audience service tests**

Run:

```bash
rtk bun run --cwd apps/server test:unit -- oa-audience.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
rtk git add apps/server/src/services/oa-audience.ts apps/server/src/services/oa-audience.test.ts
rtk git commit -m "feat: add oa audience resolver"
```

## Task 4: Campaign Send Service

**Files:**
- Create: `apps/server/src/services/oa-campaign.ts`
- Create: `apps/server/src/services/oa-campaign.test.ts`
- Modify: `apps/server/src/services/oa-messaging.ts`

- [ ] **Step 1: Write failing campaign service tests**

Create `apps/server/src/services/oa-campaign.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { createOACampaignService } from './oa-campaign'

describe('OA campaign service', () => {
  it('previews a saved audience filter', async () => {
    const audience = { preview: vi.fn(async () => ({ ok: true, count: 2 })) }
    const service = createOACampaignService({
      db: {} as any,
      audience: audience as any,
      messaging: {} as any,
      now: () => new Date('2026-05-13T00:00:00.000Z'),
    })

    const result = await service.previewAudience({
      oaId: 'oa-1',
      query: { 'tags.ids': { $all: ['vip'] } },
    })

    expect(result).toEqual({ ok: true, count: 2 })
  })

  it('rejects empty text campaigns', async () => {
    const service = createOACampaignService({
      db: {} as any,
      audience: {} as any,
      messaging: {} as any,
    })

    await expect(
      service.sendTextCampaign({
        campaignId: 'campaign-1',
        oaId: 'oa-1',
        managerId: 'manager-1',
        name: 'Blank',
        messageText: '   ',
        audienceFilterId: undefined,
        inlineAudienceQuery: { 'friendship.status': 'friend' },
      }),
    ).rejects.toThrow('Campaign text is required')
  })
})
```

- [ ] **Step 2: Run the failing service test**

Run:

```bash
rtk bun run --cwd apps/server test:unit -- oa-campaign.test.ts
```

Expected: FAIL because `oa-campaign.ts` does not exist.

- [ ] **Step 3: Add internal campaign request type support**

Modify `apps/server/src/services/oa-messaging.ts`:

```ts
export type SendRequestType =
  | 'reply'
  | 'push'
  | 'multicast'
  | 'broadcast'
  | 'campaign'
```

No external plugin should expose `campaign` as a LINE request type in Phase 3A. It is for the manager campaign service only.

Also extend `acceptMessagingExecution()` with an optional transaction callback that runs after the message request and delivery snapshot rows are written, but before the transaction commits:

```ts
onAccepted?: (ctx: {
  tx: unknown // use the existing Drizzle transaction type from oa-messaging.ts
  request: { id: string }
  recipientCount: number
}) => Promise<void>
```

The campaign service must insert `oaCampaign` through this callback. Do not insert the campaign row in a separate transaction after the outbox request is accepted; that can leave a durable `oaMessageRequest` without a corresponding campaign summary if the later insert fails.

- [ ] **Step 4: Implement campaign service**

Create `apps/server/src/services/oa-campaign.ts`:

```ts
import { oaAudienceFilter, oaCampaign } from '@vine/db/schema-oa'
import { and, eq } from 'drizzle-orm'
import type { AudienceQueryJson } from '@vine/zero-schema'
import type { schema } from '@vine/db'
import type { createOAAudienceService } from './oa-audience'
import type { createOAMessagingService } from './oa-messaging'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

type OACampaignDeps = {
  db: NodePgDatabase<typeof schema>
  audience: ReturnType<typeof createOAAudienceService>
  messaging: ReturnType<typeof createOAMessagingService>
  now?: () => Date
}

type SendTextCampaignInput = {
  campaignId: string
  oaId: string
  managerId: string
  name: string
  messageText: string
  audienceFilterId: string | undefined
  inlineAudienceQuery: AudienceQueryJson | undefined
}

function cleanCampaignName(name: string): string {
  const trimmed = name.trim()
  if (trimmed.length === 0) throw new Error('Campaign name is required')
  if (trimmed.length > 80) throw new Error('Campaign name too long (max 80)')
  return trimmed
}

function cleanMessageText(text: string): string {
  const trimmed = text.trim()
  if (trimmed.length === 0) throw new Error('Campaign text is required')
  if (trimmed.length > 5000) throw new Error('Campaign text must not exceed 5000 characters')
  return trimmed
}

export function createOACampaignService(deps: OACampaignDeps) {
  const now = deps.now ?? (() => new Date())

  async function loadAudienceQuery(input: {
    oaId: string
    audienceFilterId: string | undefined
    inlineAudienceQuery: AudienceQueryJson | undefined
  }): Promise<AudienceQueryJson> {
    if (input.inlineAudienceQuery) return input.inlineAudienceQuery
    if (!input.audienceFilterId) return { 'friendship.status': 'friend' }

    const [filter] = await deps.db
      .select()
      .from(oaAudienceFilter)
      .where(
        and(
          eq(oaAudienceFilter.id, input.audienceFilterId),
          eq(oaAudienceFilter.oaId, input.oaId),
        ),
      )
      .limit(1)
    if (!filter) throw new Error('Audience filter not found')
    return filter.queryJson as AudienceQueryJson
  }

  async function previewAudience(input: { oaId: string; query: AudienceQueryJson }) {
    return deps.audience.preview(input)
  }

  async function sendTextCampaign(input: SendTextCampaignInput) {
    const name = cleanCampaignName(input.name)
    const messageText = cleanMessageText(input.messageText)
    const query = await loadAudienceQuery(input)
    const recipients = await deps.audience.resolveRecipients({ oaId: input.oaId, query })
    if (!recipients.ok) throw new Error(recipients.message)

    const nowIso = now().toISOString()
    let acceptedRequestId = ''
    let acceptedRecipientCount = 0
    const accepted = await deps.messaging.acceptMessagingExecution({
      oaId: input.oaId,
      requestType: 'campaign',
      target: { campaignId: input.campaignId, audience: query },
      messages: [{ type: 'text', text: messageText, metadata: null }],
      resolveRecipients: async () => recipients.userIds,
      onAccepted: async ({ tx, request, recipientCount }) => {
        acceptedRequestId = request.id
        acceptedRecipientCount = recipientCount
        await tx.insert(oaCampaign).values({
          id: input.campaignId,
          oaId: input.oaId,
          name,
          messageType: 'text',
          messageText,
          audienceFilterId: input.audienceFilterId,
          inlineAudienceQueryJson: input.inlineAudienceQuery ?? null,
          messageRequestId: request.id,
          status: recipientCount === 0 ? 'sent' : 'queued',
          recipientSnapshotCount: recipientCount,
          successCount: 0,
          failedCount: 0,
          quotaUsed: recipientCount,
          createdByManagerId: input.managerId,
          createdAt: nowIso,
          updatedAt: nowIso,
          queuedAt: nowIso,
          sentAt: recipientCount === 0 ? nowIso : null,
        })
      },
    })
    if (!accepted.ok) {
      throw new Error(accepted.code)
    }

    return {
      ok: true as const,
      campaignId: input.campaignId,
      messageRequestId: acceptedRequestId,
      recipientCount: acceptedRecipientCount,
    }
  }

  return { previewAudience, sendTextCampaign }
}
```

- [ ] **Step 5: Run campaign service tests**

Run:

```bash
rtk bun run --cwd apps/server test:unit -- oa-campaign.test.ts
```

Expected: PASS.

- [ ] **Step 6: Add a focused DB integration test for snapshot rows**

Create `apps/server/src/services/oa-campaign.int.test.ts` using `withRollbackDb()` from `apps/server/src/test/integration-db.ts`. Seed one OA, two friendships, a tag, and one audience filter. Call `sendTextCampaign()`. Assert:

```ts
expect(campaign.recipientSnapshotCount).toBe(1)
expect(deliveries).toHaveLength(1)
expect(deliveries[0].userId).toBe('user-vip')
expect(request.requestType).toBe('campaign')
```

- [ ] **Step 7: Run DB-only integration for the campaign test**

Run:

```bash
rtk bun scripts/integration.ts --db-only oa-campaign.int.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
rtk git add apps/server/src/services/oa-messaging.ts apps/server/src/services/oa-campaign.ts apps/server/src/services/oa-campaign.test.ts apps/server/src/services/oa-campaign.int.test.ts
rtk git commit -m "feat: add oa campaign send service"
```

## Task 5: ConnectRPC Manager Campaign Actions

**Files:**
- Modify: `packages/proto/proto/oa/v1/oa.proto`
- Generated: `packages/proto/gen/oa/v1/oa_pb.ts`
- Modify: `apps/server/src/connect/routes.ts`
- Modify: `apps/server/src/connect/oa.ts`
- Modify: `apps/server/src/index.ts`
- Modify: `apps/web/src/features/oa/client.ts`

- [ ] **Step 1: Add proto messages and RPCs**

Modify `packages/proto/proto/oa/v1/oa.proto` before `service OAService`:

```protobuf
// ── OA Campaigns ──

message PreviewAudienceFilterRequest {
  string official_account_id = 1;
  string query_json = 2;
}

message PreviewAudienceFilterResponse {
  int32 count = 1;
}

message SendTextCampaignRequest {
  string official_account_id = 1;
  string campaign_id = 2;
  string name = 3;
  string message_text = 4;
  optional string audience_filter_id = 5;
  optional string inline_audience_query_json = 6;
}

message SendTextCampaignResponse {
  string campaign_id = 1;
}
```

Add RPCs to `service OAService`:

```protobuf
  rpc PreviewAudienceFilter(PreviewAudienceFilterRequest) returns (PreviewAudienceFilterResponse);
  rpc SendTextCampaign(SendTextCampaignRequest) returns (SendTextCampaignResponse);
```

- [ ] **Step 2: Generate proto code**

Run:

```bash
rtk bun turbo proto:generate
```

Expected: `packages/proto/gen/oa/v1/oa_pb.ts` includes the new message classes and methods.

- [ ] **Step 3: Wire services into server startup**

Modify `apps/server/src/index.ts`:

```ts
import { createOAAudienceService } from './services/oa-audience'
import { createOACampaignService } from './services/oa-campaign'
```

After `oaMessaging` construction:

```ts
const oaAudience = createOAAudienceService({ db })
const oaCampaign = createOACampaignService({
  db,
  audience: oaAudience,
  messaging: oaMessaging,
})
```

Pass both into `connectRoutes`.

- [ ] **Step 4: Extend ConnectDeps**

Modify `apps/server/src/connect/routes.ts`:

```ts
import type { createOAAudienceService } from '../services/oa-audience'
import type { createOACampaignService } from '../services/oa-campaign'
```

Add fields:

```ts
  oaAudience: ReturnType<typeof createOAAudienceService>
  oaCampaign: ReturnType<typeof createOACampaignService>
```

- [ ] **Step 5: Add authenticated OA handler methods**

Modify `apps/server/src/connect/oa.ts`. In the existing `impl` for `OAService`, add:

```ts
previewAudienceFilter: async (req, ctx) => {
  const auth = requireAuthData(ctx)
  await assertOfficialAccountOwnedByUser(deps, req.officialAccountId, auth.id)

  const query = JSON.parse(req.queryJson)
  const result = await deps.oaAudience.preview({
    oaId: req.officialAccountId,
    query,
  })
  if (!result.ok) {
    throw new ConnectError(result.message, Code.InvalidArgument)
  }
  return { count: result.count }
},
sendTextCampaign: async (req, ctx) => {
  const auth = requireAuthData(ctx)
  await assertOfficialAccountOwnedByUser(deps, req.officialAccountId, auth.id)

  const inlineAudienceQuery = req.inlineAudienceQueryJson
    ? JSON.parse(req.inlineAudienceQueryJson)
    : undefined

  const result = await deps.oaCampaign.sendTextCampaign({
    campaignId: req.campaignId,
    oaId: req.officialAccountId,
    managerId: auth.id,
    name: req.name,
    messageText: req.messageText,
    audienceFilterId: req.audienceFilterId,
    inlineAudienceQuery,
  })

  return { campaignId: result.campaignId }
},
```

Use existing imports in `apps/server/src/connect/oa.ts` for `ConnectError`, `Code`, `requireAuthData`, and `assertOfficialAccountOwnedByUser`. If `Code` is not imported, import it from `@connectrpc/connect`.

- [ ] **Step 6: Add Connect handler tests**

Create or extend `apps/server/src/connect/oa-campaign.test.ts`. Capture `impl` the same way existing `oa-richmenu-m3.test.ts` captures OA handlers. Assert:

```ts
await capturedImpl.previewAudienceFilter(
  {
    officialAccountId: 'oa-1',
    queryJson: JSON.stringify({ 'tags.ids': { $all: ['vip'] } }),
  },
  ctx,
)
expect(deps.oaAudience.preview).toHaveBeenCalledWith({
  oaId: 'oa-1',
  query: { 'tags.ids': { $all: ['vip'] } },
})
```

Also assert `sendTextCampaign` passes `auth.id` as `managerId`.

- [ ] **Step 7: Run Connect tests**

Run:

```bash
rtk bun run --cwd apps/server test:unit -- oa-campaign.test.ts oa-campaign
```

Expected: PASS for service and Connect tests.

- [ ] **Step 8: Commit**

```bash
rtk git add packages/proto/proto/oa/v1/oa.proto packages/proto/gen/oa/v1/oa_pb.ts apps/server/src/index.ts apps/server/src/connect/routes.ts apps/server/src/connect/oa.ts apps/server/src/connect/oa-campaign.test.ts
rtk git commit -m "feat: add oa campaign connect actions"
```

## Task 6: Manager Campaign UI

**Files:**
- Create: `apps/web/src/features/oa-manager/campaign/useManagerOAAudienceFilters.ts`
- Create: `apps/web/src/features/oa-manager/campaign/useManagerOACampaigns.ts`
- Create: `apps/web/src/features/oa-manager/campaign/ManagerOAAudienceFiltersPage.tsx`
- Create: `apps/web/src/features/oa-manager/campaign/ManagerOACampaignsPage.tsx`
- Create: `apps/web/app/(app)/manager/[oaId]/campaigns/index.tsx`
- Modify: `apps/web/src/features/oa-manager/home/ManagerOAHome.tsx`

- [ ] **Step 1: Add frontend hooks**

Create `apps/web/src/features/oa-manager/campaign/useManagerOAAudienceFilters.ts`:

```ts
import { oaAudienceFiltersByOfficialAccountId } from '@vine/zero-schema/queries/oaAudienceFilter'
import { useMemo } from 'react'
import { zero, useZeroQuery } from '~/zero/client'
import type { AudienceQueryJson } from '@vine/zero-schema'

export type AudienceFilterItem = {
  id: string
  name: string
  queryJson: AudienceQueryJson
  createdAt: number
}

export function useManagerOAAudienceFilters(oaId: string | undefined) {
  const [rows] = useZeroQuery(
    oaAudienceFiltersByOfficialAccountId,
    { oaId: oaId ?? '' },
    { enabled: Boolean(oaId) },
  )

  const filters = useMemo<AudienceFilterItem[]>(
    () =>
      (rows ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        queryJson: row.queryJson,
        createdAt: row.createdAt,
      })),
    [rows],
  )

  const createFilter = async (name: string, queryJson: AudienceQueryJson) => {
    if (!oaId) return
    const now = Date.now()
    await zero.mutate.oaAudienceFilter.create({
      id: crypto.randomUUID(),
      oaId,
      name,
      queryJson,
      createdAt: now,
      updatedAt: now,
    })
  }

  const updateFilter = async (
    id: string,
    name: string,
    queryJson: AudienceQueryJson,
  ) => {
    if (!oaId) return
    await zero.mutate.oaAudienceFilter.update({
      id,
      oaId,
      name,
      queryJson,
      updatedAt: Date.now(),
    })
  }

  const deleteFilter = async (id: string) => {
    if (!oaId) return
    await zero.mutate.oaAudienceFilter.deleteFilter({ id, oaId })
  }

  return { filters, createFilter, updateFilter, deleteFilter }
}
```

Create `apps/web/src/features/oa-manager/campaign/useManagerOACampaigns.ts`:

```ts
import { oaCampaignsByOfficialAccountId } from '@vine/zero-schema/queries/oaCampaign'
import { useMemo } from 'react'
import { oaClient } from '~/features/oa/client'
import { useTanMutation } from '~/query'
import { useZeroQuery } from '~/zero/client'
import type { AudienceQueryJson } from '@vine/zero-schema'

export function useManagerOACampaigns(oaId: string | undefined) {
  const [rows] = useZeroQuery(
    oaCampaignsByOfficialAccountId,
    { oaId: oaId ?? '' },
    { enabled: Boolean(oaId) },
  )

  const campaigns = useMemo(() => rows ?? [], [rows])

  const previewAudience = useTanMutation({
    mutationFn: async (query: AudienceQueryJson) => {
      if (!oaId) return { count: 0 }
      return oaClient.previewAudienceFilter({
        officialAccountId: oaId,
        queryJson: JSON.stringify(query),
      })
    },
  })

  const sendTextCampaign = useTanMutation({
    mutationFn: async (input: {
      name: string
      messageText: string
      audienceFilterId?: string
      inlineAudienceQuery?: AudienceQueryJson
    }) => {
      if (!oaId) throw new Error('Missing official account')
      return oaClient.sendTextCampaign({
        officialAccountId: oaId,
        campaignId: crypto.randomUUID(),
        name: input.name,
        messageText: input.messageText,
        audienceFilterId: input.audienceFilterId,
        inlineAudienceQueryJson: input.inlineAudienceQuery
          ? JSON.stringify(input.inlineAudienceQuery)
          : undefined,
      })
    },
  })

  return { campaigns, previewAudience, sendTextCampaign }
}
```

- [ ] **Step 2: Add a compact audience filters page**

Create `apps/web/src/features/oa-manager/campaign/ManagerOAAudienceFiltersPage.tsx`:

```tsx
import { useState } from 'react'
import { SizableText, XStack, YStack } from 'tamagui'
import { Button } from '~/interface/buttons/Button'
import { Input } from '~/interface/forms/Input'
import { showToast } from '~/interface/toast/Toast'
import { useManagerOAAudienceFilters } from './useManagerOAAudienceFilters'
import type { AudienceQueryJson } from '@vine/zero-schema'

const defaultQuery: AudienceQueryJson = { 'friendship.status': 'friend' }

export function ManagerOAAudienceFiltersPage({ oaId }: { oaId: string }) {
  const { filters, createFilter } = useManagerOAAudienceFilters(oaId)
  const [name, setName] = useState('')

  const handleCreateAllFriends = async () => {
    try {
      await createFilter(name || 'All current friends', defaultQuery)
      setName('')
      showToast('Audience saved', { type: 'success' })
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save audience', {
        type: 'error',
      })
    }
  }

  return (
    <YStack gap="$4">
      <XStack items="center" justify="space-between">
        <YStack gap="$1">
          <SizableText size="$6" fontWeight="700">
            Audiences
          </SizableText>
          <SizableText size="$2" color="$color10">
            Saved filters for campaign recipients.
          </SizableText>
        </YStack>
      </XStack>

      <XStack gap="$2" items="center">
        <Input
          flex={1}
          value={name}
          onChangeText={setName}
          placeholder="Audience name"
        />
        <Button onPress={handleCreateAllFriends}>Save all friends</Button>
      </XStack>

      <YStack gap="$2">
        {filters.map((filter) => (
          <YStack
            key={filter.id}
            p="$3"
            rounded="$3"
            borderWidth={1}
            borderColor="$borderColor"
            gap="$1"
          >
            <SizableText size="$3" fontWeight="600">
              {filter.name}
            </SizableText>
            <SizableText size="$1" color="$color10">
              {JSON.stringify(filter.queryJson)}
            </SizableText>
          </YStack>
        ))}
      </YStack>
    </YStack>
  )
}
```

- [ ] **Step 3: Add campaign page**

Create `apps/web/src/features/oa-manager/campaign/ManagerOACampaignsPage.tsx`:

```tsx
import { useState } from 'react'
import { ScrollView, SizableText, XStack, YStack } from 'tamagui'
import { Button } from '~/interface/buttons/Button'
import { Input } from '~/interface/forms/Input'
import { showToast } from '~/interface/toast/Toast'
import { ManagerOAAudienceFiltersPage } from './ManagerOAAudienceFiltersPage'
import { useManagerOAAudienceFilters } from './useManagerOAAudienceFilters'
import { useManagerOACampaigns } from './useManagerOACampaigns'

export function ManagerOACampaignsPage({ oaId }: { oaId: string }) {
  const { filters } = useManagerOAAudienceFilters(oaId)
  const { campaigns, previewAudience, sendTextCampaign } = useManagerOACampaigns(oaId)
  const [name, setName] = useState('')
  const [text, setText] = useState('')
  const [audienceFilterId, setAudienceFilterId] = useState<string | undefined>()

  const selectedFilter = filters.find((filter) => filter.id === audienceFilterId)

  const handlePreview = async () => {
    const query = selectedFilter?.queryJson ?? { 'friendship.status': 'friend' }
    const result = await previewAudience.mutateAsync(query)
    showToast(`${result.count} recipients`, { type: 'success' })
  }

  const handleSend = async () => {
    try {
      await sendTextCampaign.mutateAsync({
        name,
        messageText: text,
        audienceFilterId,
        inlineAudienceQuery: audienceFilterId
          ? undefined
          : { 'friendship.status': 'friend' },
      })
      setName('')
      setText('')
      showToast('Campaign queued', { type: 'success' })
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to send campaign', {
        type: 'error',
      })
    }
  }

  return (
    <ScrollView>
      <YStack p="$5" gap="$6">
        <XStack gap="$6" items="flex-start" $platform-web={{ flexWrap: 'wrap' }}>
          <YStack flex={2} minW={360} gap="$4">
            <SizableText size="$7" fontWeight="700">
              Campaigns
            </SizableText>
            <YStack gap="$3" borderWidth={1} borderColor="$borderColor" rounded="$3" p="$4">
              <SizableText size="$4" fontWeight="700">
                New text campaign
              </SizableText>
              <Input value={name} onChangeText={setName} placeholder="Campaign name" />
              <Input
                value={text}
                onChangeText={setText}
                placeholder="Message text"
                multiline
              />
              <YStack gap="$2">
                <Button
                  variant={audienceFilterId ? 'outlined' : undefined}
                  onPress={() => setAudienceFilterId(undefined)}
                >
                  All current friends
                </Button>
                {filters.map((filter) => (
                  <Button
                    key={filter.id}
                    variant={audienceFilterId === filter.id ? undefined : 'outlined'}
                    onPress={() => setAudienceFilterId(filter.id)}
                  >
                    {filter.name}
                  </Button>
                ))}
              </YStack>
              <XStack gap="$2">
                <Button variant="outlined" onPress={handlePreview}>
                  Preview count
                </Button>
                <Button onPress={handleSend} disabled={sendTextCampaign.isPending}>
                  Send
                </Button>
              </XStack>
            </YStack>

            <YStack gap="$2">
              {campaigns.map((campaign) => (
                <XStack
                  key={campaign.id}
                  p="$3"
                  rounded="$3"
                  borderWidth={1}
                  borderColor="$borderColor"
                  justify="space-between"
                  items="center"
                >
                  <YStack gap="$1" flex={1}>
                    <SizableText size="$3" fontWeight="600">
                      {campaign.name}
                    </SizableText>
                    <SizableText size="$1" color="$color10">
                      {campaign.status} · {campaign.recipientSnapshotCount} recipients
                    </SizableText>
                  </YStack>
                  <SizableText size="$2" color="$color10">
                    {campaign.successCount} sent
                  </SizableText>
                </XStack>
              ))}
            </YStack>
          </YStack>

          <YStack flex={1} minW={320}>
            <ManagerOAAudienceFiltersPage oaId={oaId} />
          </YStack>
        </XStack>
      </YStack>
    </ScrollView>
  )
}
```

- [ ] **Step 4: Add One route**

Create `apps/web/app/(app)/manager/[oaId]/campaigns/index.tsx`:

```tsx
import { useActiveParams } from 'one'
import { ManagerOACampaignsPage } from '~/features/oa-manager/campaign/ManagerOACampaignsPage'

export default function ManagerOACampaignsRoute() {
  const params = useActiveParams<{ oaId: string }>()
  return <ManagerOACampaignsPage oaId={params.oaId!} />
}
```

- [ ] **Step 5: Add home entry point**

Modify `apps/web/src/features/oa-manager/home/ManagerOAHome.tsx`. Add one `OperationCard` near Chats:

```tsx
<OperationCard
  title="Campaigns"
  description="Send text broadcasts to saved audiences."
  value="Audience filters ready"
  actionLabel="Manage campaigns"
  onPress={() => router.navigate(`/manager/${oaId}/campaigns` as any)}
/>
```

- [ ] **Step 6: Run web unit type checks**

Run:

```bash
rtk bun run --cwd apps/web typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
rtk git add apps/web/app/(app)/manager/[oaId]/campaigns/index.tsx apps/web/src/features/oa-manager/campaign apps/web/src/features/oa-manager/home/ManagerOAHome.tsx
rtk git commit -m "feat: add manager oa campaign UI"
```

## Task 7: Integration Coverage and Final Verification

**Files:**
- Modify: `apps/web/src/test/integration/manager-oa-home.test.ts`
- Create: `apps/web/src/test/integration/manager-oa-campaigns.test.ts`

- [ ] **Step 1: Add home entry integration assertion**

Modify `apps/web/src/test/integration/manager-oa-home.test.ts` to assert the Campaigns card appears after opening a manager OA home page:

```ts
await expect(page.getByText('Campaigns')).toBeVisible()
await expect(page.getByRole('button', { name: 'Manage campaigns' })).toBeVisible()
```

- [ ] **Step 2: Add campaign flow integration test**

Create `apps/web/src/test/integration/manager-oa-campaigns.test.ts`:

```ts
import { expect, test } from '@playwright/test'
import { BASE_URL, loginAsDemo } from './helpers'

test('manager can create an audience and queue a text campaign', async ({ page }) => {
  await loginAsDemo(page)
  await page.goto(`${BASE_URL}/manager`, { waitUntil: 'domcontentloaded' })
  await page.waitForURL(/\/manager$/, { timeout: 10000 })

  const testBotRow = page.getByText('@testbot').locator('xpath=../..')
  await testBotRow.getByRole('button', { name: 'Manage' }).click()
  await page.waitForURL(/\/manager\/[^/]+$/, { timeout: 15000 })
  await page.getByRole('button', { name: 'Manage campaigns' }).click()
  await page.waitForURL(/\/manager\/[^/]+\/campaigns$/, { timeout: 15000 })
  await expect(page.getByText('New text campaign')).toBeVisible()

  await page.getByPlaceholder('Audience name').fill('All current friends')
  await page.getByRole('button', { name: 'Save all friends' }).click()
  await expect(page.getByText('Audience saved')).toBeVisible()

  await page.getByPlaceholder('Campaign name').fill('Spring notice')
  await page.getByPlaceholder('Message text').fill('Spring campaign message')
  await page.getByRole('button', { name: 'Preview count' }).click()
  await expect(page.getByText(/recipients/)).toBeVisible()

  await page.getByRole('button', { name: 'Send' }).click()
  await expect(page.getByText('Campaign queued')).toBeVisible()
  await expect(page.getByText('Spring notice')).toBeVisible()
})
```

- [ ] **Step 3: Run focused package and server tests**

Run:

```bash
rtk bun run --cwd packages/zero-schema test -- src/audience/query.test.ts src/__tests__/manager-oa-campaigns.test.ts
rtk bun run --cwd apps/server test:unit -- oa-audience.test.ts oa-campaign.test.ts oa-campaign
```

Expected: PASS.

- [ ] **Step 4: Run DB integration**

Run:

```bash
rtk docker compose version
rtk docker compose config --quiet
rtk docker compose ps
rtk bun scripts/integration.ts --db-only oa-campaign.int.test.ts
```

Expected: PASS. If Docker Compose preflight fails, capture the failing command and the reason.

- [ ] **Step 5: Run web integration**

Run:

```bash
rtk bun scripts/integration.ts --web-only manager-oa-campaigns.test.ts
```

Expected: PASS.

- [ ] **Step 6: Run full verification**

Run:

```bash
rtk bun run check:all
rtk bun run test
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
rtk git add apps/web/src/test/integration/manager-oa-home.test.ts apps/web/src/test/integration/manager-oa-campaigns.test.ts
rtk git commit -m "test: cover manager oa campaign flow"
```

## Phase 3B Handoff

After this plan is complete, Phase 3B can add the external Messaging API facade by mapping LINE-shaped broadcast, multicast, narrowcast, and audience upload requests into the `oaAudienceFilter` and `oaCampaign` model. The Phase 3B plan should not change the manager UI abstraction introduced here.

## Self-Review

- Spec coverage: Phase 3A audience filters, campaign records, recipient snapshots via existing delivery rows, preview counts, quota counting through the messaging service, idempotent one-send campaign behavior, tag-capable audience queries, and manager UI are covered.
- Scope: external `/v2/bot/...` compatibility is intentionally excluded and reserved for Phase 3B.
- Type consistency: the plan uses `AudienceQueryJson`, `oaAudienceFilter`, `oaCampaign`, `previewAudienceFilter`, and `sendTextCampaign` consistently across Zero, server, ConnectRPC, and web code.
- Verification: package unit, server unit, DB integration, web integration, `check:all`, and `test` commands are specified with expected PASS outcomes.
