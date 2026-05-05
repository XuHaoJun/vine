# M5 Mini App Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a LINE-MINI-App-shaped product surface on top of M4's LIFF runtime — Mini App entity, gallery, public directory, `/m/{id}` permanent route, header chrome, OA promotion, and Service Messages.

**Architecture:** A `miniApp` row wraps one `oaLiffApp`. The runtime continues to be M4's LIFF stack — Mini App is additive metadata + chrome + discovery + a Service-Messages subsystem that delivers Flex-rendered notifications into a per-Vine-instance platform-system OA chat ("Mini App 通知") with a `(miniAppId, userId)` rolling 24-hour rate limit. ConnectRPC drives developer-console CRUD; a single new public Fastify endpoint accepts server-to-server Service-Message sends.

**Tech Stack:** Drizzle (Postgres), Zero (sync), ConnectRPC + Better-Auth, Fastify, OneJS / vxrn, Tamagui, Vitest, the existing M4 LIFF runtime + SDK.

**Spec:** `docs/superpowers/specs/2026-05-05-m5-mini-app-platform-design.md`

---

## File Structure

### Stage 1 — Foundation (entity, DB, RPC, basic console)

- Create: `packages/db/src/migrations/20260505000001_mini_app_tables.ts`
- Modify: `packages/db/src/schema-login.ts` (add `miniApp`, `miniAppOaLink` tables)
- Create: `apps/server/src/services/mini-app.ts`
- Create: `apps/server/src/services/mini-app.test.ts`
- Create: `packages/proto/proto/mini-app/v1/mini-app.proto`
- Create: `apps/server/src/connect/mini-app.ts`
- Create: `apps/server/src/connect/mini-app.test.ts`
- Modify: `apps/server/src/connect/routes.ts`
- Modify: `apps/server/src/index.ts` (wire mini-app service into deps)
- Create: `apps/web/app/(app)/developers/console/provider/[providerId]/mini-app/index.tsx`
- Create: `apps/web/app/(app)/developers/console/provider/[providerId]/mini-app/[miniAppId]/index.tsx`
- Create: `apps/web/app/(app)/developers/console/provider/[providerId]/mini-app/[miniAppId]/oa-links.tsx`

### Stage 2 — Public surfaces (route, SDK, chrome, action button)

- Create: `apps/server/src/plugins/mini-app-public.ts`
- Create: `apps/server/src/plugins/mini-app-public.test.ts`
- Modify: `apps/server/src/index.ts` (register mini-app-public plugin)
- Modify: `packages/liff/src/liff.ts` (bootstrap fields, `liff.miniApp.getInfo()`, extended `permanentLink.createUrlBy`)
- Create: `packages/liff/src/liff.miniapp.test.ts`
- Create: `apps/web/app/(public)/m/[miniAppId]/index.tsx`
- Create: `apps/web/app/(public)/m/[miniAppId]/[...rest].tsx`
- Create: `apps/web/app/(public)/liff/MiniAppShell.tsx`
- Create: `apps/web/app/(public)/liff/MiniAppShell.test.tsx`
- Create: `apps/web/app/(public)/liff/MiniAppActionMenu.tsx`

### Stage 3 — Discovery

- Modify: `packages/db/src/schema-login.ts` (add `miniAppRecent` table)
- Modify: migration `20260505000001_mini_app_tables.ts` extended in Task 3.1
- Modify: `apps/server/src/services/mini-app.ts` (add `recordRecent`, `listRecent`, `listForUserOas`)
- Modify: `apps/server/src/connect/mini-app.ts` (add gallery RPCs)
- Modify: `packages/proto/proto/mini-app/v1/mini-app.proto`
- Create: `apps/web/app/(app)/home/(tabs)/main/mini-apps/index.tsx`
- Create: `apps/web/app/(public)/mini-apps/index.tsx`
- Modify: `apps/web/app/(app)/oa/[oaId]/index.tsx` (or equivalent OA profile screen — exact path located at implementation per `one` skill)
- Modify: `apps/web/app/(app)/manager/...` (add read-only "Linked Mini Apps" panel — path located at implementation)

### Stage 4 — Service Messages

- Create: `packages/db/src/migrations/20260505000002_mini_app_service_messages.ts`
- Modify: `packages/db/src/schema-oa.ts` (add `officialAccount.kind` column)
- Modify: `packages/db/src/schema-public.ts` (add `message.miniAppId` column)
- Modify: `packages/db/src/schema-login.ts` (add `miniAppServiceMessageTemplate` table)
- Modify: `packages/zero-schema/src/models/message.ts` (add `miniAppId` field)
- Create: `apps/server/src/services/mini-app-service-message.ts`
- Create: `apps/server/src/services/mini-app-service-message.test.ts`
- Create: `apps/server/src/services/mini-app-service-message-templates.ts`
- Create: `apps/server/src/services/mini-app-service-message-templates.test.ts`
- Create: `apps/server/src/plugins/mini-app-notifier.ts`
- Create: `apps/server/src/plugins/mini-app-notifier.test.ts`
- Modify: `apps/server/src/connect/mini-app.ts` (add template RPCs + `SendTestServiceMessage`)
- Modify: `packages/proto/proto/mini-app/v1/mini-app.proto`
- Create: `apps/web/app/(app)/developers/console/provider/[providerId]/mini-app/[miniAppId]/service-templates.tsx`
- Modify: chat-message renderer (path located at implementation, likely `apps/web/src/chat/MessageBubbleFactory*.tsx`) — add Service-Message footer

---

# Stage 1 — Foundation

Outcome of stage: a developer can navigate to their provider in the console, create a Mini App that wraps an existing LIFF app, link OAs, and toggle `isPublished`. RPC + service + DB exist and are tested. No public route, no chrome, no service messages yet.

## Task 1.1: DB migration + Drizzle schema for `miniApp` and `miniAppOaLink`

**Files:**
- Create: `packages/db/src/migrations/20260505000001_mini_app_tables.ts`
- Modify: `packages/db/src/schema-login.ts`

- [ ] **Step 1: Write the migration**

Create `packages/db/src/migrations/20260505000001_mini_app_tables.ts`:

```ts
import type { PoolClient } from 'pg'

const sql = `
CREATE TABLE "miniApp" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "providerId" uuid NOT NULL REFERENCES "oaProvider"("id") ON DELETE CASCADE,
  "liffAppId" uuid NOT NULL UNIQUE REFERENCES "oaLiffApp"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "iconUrl" text,
  "description" text,
  "category" text,
  "isPublished" boolean NOT NULL DEFAULT false,
  "publishedAt" timestamptz,
  "createdAt" timestamptz DEFAULT now() NOT NULL,
  "updatedAt" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX "miniApp_providerId_idx" ON "miniApp"("providerId");
CREATE INDEX "miniApp_liffAppId_idx" ON "miniApp"("liffAppId");
CREATE INDEX "miniApp_isPublished_idx" ON "miniApp"("isPublished") WHERE "isPublished" = true;

CREATE TABLE "miniAppOaLink" (
  "miniAppId" uuid NOT NULL REFERENCES "miniApp"("id") ON DELETE CASCADE,
  "oaId" uuid NOT NULL REFERENCES "officialAccount"("id") ON DELETE CASCADE,
  "createdAt" timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY ("miniAppId", "oaId")
);
CREATE INDEX "miniAppOaLink_oaId_idx" ON "miniAppOaLink"("oaId");
`

export async function up(client: PoolClient): Promise<void> {
  await client.query(sql)
}

export async function down(client: PoolClient): Promise<void> {
  await client.query(`
    DROP TABLE IF EXISTS "miniAppOaLink";
    DROP TABLE IF EXISTS "miniApp";
  `)
}
```

- [ ] **Step 2: Add Drizzle schema entries**

Append to `packages/db/src/schema-login.ts`:

```ts
import { officialAccount } from './schema-oa'

export const miniApp = pgTable(
  'miniApp',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    providerId: uuid('providerId')
      .notNull()
      .references(() => oaProvider.id, { onDelete: 'cascade' }),
    liffAppId: uuid('liffAppId')
      .notNull()
      .unique()
      .references(() => oaLiffApp.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    iconUrl: text('iconUrl'),
    description: text('description'),
    category: text('category'),
    isPublished: boolean('isPublished').notNull().default(false),
    publishedAt: timestamp('publishedAt', { mode: 'string' }),
    createdAt: timestamp('createdAt', { mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp('updatedAt', { mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    index('miniApp_providerId_idx').on(table.providerId),
    index('miniApp_liffAppId_idx').on(table.liffAppId),
  ],
)

export const miniAppOaLink = pgTable(
  'miniAppOaLink',
  {
    miniAppId: uuid('miniAppId')
      .notNull()
      .references(() => miniApp.id, { onDelete: 'cascade' }),
    oaId: uuid('oaId')
      .notNull()
      .references(() => officialAccount.id, { onDelete: 'cascade' }),
    createdAt: timestamp('createdAt', { mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.miniAppId, table.oaId] }),
    index('miniAppOaLink_oaId_idx').on(table.oaId),
  ],
)
```

Add to imports at top of `schema-login.ts`:

```ts
import {
  boolean,
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import { oaProvider, officialAccount } from './schema-oa'
```

(The existing import line for `oaProvider` may already be present; merge accordingly. Add `boolean` and `primaryKey` to the existing drizzle-orm import.)

- [ ] **Step 3: Run migration locally and verify**

```bash
docker compose up -d
bun run --cwd packages/db migrate:up
psql "postgres://vine:vine@localhost:5432/vine" -c '\d "miniApp"'
psql "postgres://vine:vine@localhost:5432/vine" -c '\d "miniAppOaLink"'
```

Expected: both tables print with the columns listed in the migration. `\d "miniApp"` shows `liffAppId` as `unique`.

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/migrations/20260505000001_mini_app_tables.ts \
        packages/db/src/schema-login.ts
git commit -m "feat(db): add miniApp and miniAppOaLink tables"
```

---

## Task 1.2: `createMiniAppService` factory

**Files:**
- Create: `apps/server/src/services/mini-app.ts`
- Test: `apps/server/src/services/mini-app.test.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/server/src/services/mini-app.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { createMiniAppService } from './mini-app'

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ma-1',
    providerId: 'prov-1',
    liffAppId: 'liff-app-1',
    name: 'Pizza Order',
    iconUrl: null,
    description: null,
    category: null,
    isPublished: false,
    publishedAt: null,
    createdAt: '2026-05-05T00:00:00Z',
    updatedAt: '2026-05-05T00:00:00Z',
    ...overrides,
  }
}

function chain(value: unknown) {
  const fn: any = vi.fn().mockResolvedValue(value)
  fn.mockReturnValue = vi.fn().mockReturnThis()
  return fn
}

function createMockDb(initial: Record<string, unknown[]> = {}) {
  const mock = {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([makeRow()]),
      }),
    }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(initial.select ?? []),
          orderBy: vi.fn().mockResolvedValue(initial.select ?? []),
        }),
        orderBy: vi.fn().mockResolvedValue(initial.select ?? []),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([makeRow({ name: 'updated' })]),
        }),
      }),
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([]),
    }),
  }
  return mock
}

describe('createMiniAppService', () => {
  it('creates a mini app with required fields', async () => {
    const db = createMockDb()
    const svc = createMiniAppService({ db: db as any })
    const result = await svc.createMiniApp({
      providerId: 'prov-1',
      liffAppId: 'liff-app-1',
      name: 'Pizza Order',
    })
    expect(db.insert).toHaveBeenCalled()
    expect(result.name).toBe('Pizza Order')
    expect(result.isPublished).toBe(false)
  })

  it('publish() rejects when iconUrl is null', async () => {
    const db = createMockDb()
    db.select = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([makeRow({ iconUrl: null })]),
        }),
      }),
    })
    const svc = createMiniAppService({ db: db as any })
    await expect(svc.publishMiniApp('ma-1')).rejects.toThrow(/iconUrl/)
  })

  it('publish() sets publishedAt on first publish and preserves it on re-publish', async () => {
    const db = createMockDb()
    let storedPublishedAt: string | null = null
    db.select = vi
      .fn()
      .mockReturnValueOnce({
        // first publish — current row has iconUrl, isPublished false, publishedAt null
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi
              .fn()
              .mockResolvedValue([makeRow({ iconUrl: 'https://x', isPublished: false })]),
          }),
        }),
      })
      .mockReturnValueOnce({
        // re-publish — current row has publishedAt set
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              makeRow({
                iconUrl: 'https://x',
                isPublished: false,
                publishedAt: '2026-05-05T00:00:00Z',
              }),
            ]),
          }),
        }),
      })
    db.update = vi.fn().mockImplementation(() => ({
      set: vi.fn().mockImplementation((values: { publishedAt?: string }) => {
        if (values.publishedAt) storedPublishedAt = values.publishedAt
        return {
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([
              makeRow({ isPublished: true, publishedAt: storedPublishedAt }),
            ]),
          }),
        }
      }),
    }))

    const svc = createMiniAppService({ db: db as any })
    const first = await svc.publishMiniApp('ma-1')
    expect(first?.publishedAt).toBeTruthy()
    const re = await svc.publishMiniApp('ma-1')
    expect(re?.publishedAt).toBe('2026-05-05T00:00:00Z')
  })
})
```

- [ ] **Step 2: Run tests, expect failure**

```bash
bun run --cwd apps/server test mini-app
```

Expected: FAIL — `Cannot find module './mini-app'`.

- [ ] **Step 3: Implement the service**

Create `apps/server/src/services/mini-app.ts`:

```ts
import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { schema } from '@vine/db'
import { miniApp, miniAppOaLink, oaLiffApp } from '@vine/db/schema-login'

type MiniAppDeps = {
  db: NodePgDatabase<typeof schema>
}

export function createMiniAppService(deps: MiniAppDeps) {
  const { db } = deps

  async function createMiniApp(input: {
    providerId: string
    liffAppId: string
    name: string
    iconUrl?: string | null
    description?: string | null
    category?: string | null
  }) {
    const [row] = await db
      .insert(miniApp)
      .values({
        providerId: input.providerId,
        liffAppId: input.liffAppId,
        name: input.name,
        iconUrl: input.iconUrl ?? null,
        description: input.description ?? null,
        category: input.category ?? null,
      })
      .returning()
    return row
  }

  async function getMiniApp(id: string) {
    const [row] = await db.select().from(miniApp).where(eq(miniApp.id, id)).limit(1)
    return row ?? null
  }

  async function getMiniAppByLiffAppId(liffAppId: string) {
    const [row] = await db
      .select()
      .from(miniApp)
      .where(eq(miniApp.liffAppId, liffAppId))
      .limit(1)
    return row ?? null
  }

  async function listMiniApps(providerId: string) {
    return db
      .select()
      .from(miniApp)
      .where(eq(miniApp.providerId, providerId))
      .orderBy(desc(miniApp.createdAt))
  }

  async function updateMiniApp(
    id: string,
    input: {
      name?: string
      iconUrl?: string | null
      description?: string | null
      category?: string | null
    },
  ) {
    const [row] = await db
      .update(miniApp)
      .set({
        ...(input.name !== undefined && { name: input.name }),
        ...(input.iconUrl !== undefined && { iconUrl: input.iconUrl }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.category !== undefined && { category: input.category }),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(miniApp.id, id))
      .returning()
    return row ?? null
  }

  async function publishMiniApp(id: string) {
    const current = await getMiniApp(id)
    if (!current) return null
    if (!current.iconUrl) {
      throw new Error('iconUrl is required to publish a Mini App')
    }
    const publishedAt = current.publishedAt ?? new Date().toISOString()
    const [row] = await db
      .update(miniApp)
      .set({
        isPublished: true,
        publishedAt,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(miniApp.id, id))
      .returning()
    return row ?? null
  }

  async function unpublishMiniApp(id: string) {
    const [row] = await db
      .update(miniApp)
      .set({ isPublished: false, updatedAt: new Date().toISOString() })
      .where(eq(miniApp.id, id))
      .returning()
    return row ?? null
  }

  async function deleteMiniApp(id: string) {
    await db.delete(miniApp).where(eq(miniApp.id, id))
  }

  async function linkOa(input: { miniAppId: string; oaId: string }) {
    await db
      .insert(miniAppOaLink)
      .values({ miniAppId: input.miniAppId, oaId: input.oaId })
      .onConflictDoNothing()
  }

  async function unlinkOa(input: { miniAppId: string; oaId: string }) {
    await db
      .delete(miniAppOaLink)
      .where(
        and(
          eq(miniAppOaLink.miniAppId, input.miniAppId),
          eq(miniAppOaLink.oaId, input.oaId),
        ),
      )
  }

  async function listLinkedOaIds(miniAppId: string): Promise<string[]> {
    const rows = await db
      .select({ oaId: miniAppOaLink.oaId })
      .from(miniAppOaLink)
      .where(eq(miniAppOaLink.miniAppId, miniAppId))
    return rows.map((r) => r.oaId)
  }

  async function listMiniAppsLinkedToOa(oaId: string) {
    return db
      .select({ miniApp })
      .from(miniAppOaLink)
      .innerJoin(miniApp, eq(miniApp.id, miniAppOaLink.miniAppId))
      .where(eq(miniAppOaLink.oaId, oaId))
      .then((rows) => rows.map((r) => r.miniApp))
  }

  // Used by Service Messages send pipeline (Stage 4)
  async function getMiniAppByLoginChannelId(loginChannelId: string) {
    const [row] = await db
      .select({ miniApp })
      .from(oaLiffApp)
      .innerJoin(miniApp, eq(miniApp.liffAppId, oaLiffApp.id))
      .where(eq(oaLiffApp.loginChannelId, loginChannelId))
      .limit(1)
    return row?.miniApp ?? null
  }

  return {
    createMiniApp,
    getMiniApp,
    getMiniAppByLiffAppId,
    getMiniAppByLoginChannelId,
    listMiniApps,
    updateMiniApp,
    publishMiniApp,
    unpublishMiniApp,
    deleteMiniApp,
    linkOa,
    unlinkOa,
    listLinkedOaIds,
    listMiniAppsLinkedToOa,
  }
}

export type { MiniAppDeps }
```

- [ ] **Step 4: Run tests, expect pass**

```bash
bun run --cwd apps/server test mini-app
```

Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/services/mini-app.ts apps/server/src/services/mini-app.test.ts
git commit -m "feat(server): add miniApp service factory with CRUD + publish + linkOa"
```

---

## Task 1.3: Proto + ConnectRPC handler — Mini App basic CRUD

**Files:**
- Create: `packages/proto/proto/mini-app/v1/mini-app.proto`
- Create: `apps/server/src/connect/mini-app.ts`
- Test: `apps/server/src/connect/mini-app.test.ts`

- [ ] **Step 1: Write the proto**

Create `packages/proto/proto/mini-app/v1/mini-app.proto`:

```proto
syntax = "proto3";

package miniapp.v1;

message MiniApp {
  string id = 1;
  string provider_id = 2;
  string liff_app_id = 3;
  string name = 4;
  optional string icon_url = 5;
  optional string description = 6;
  optional string category = 7;
  bool is_published = 8;
  optional string published_at = 9;
  string created_at = 10;
  string updated_at = 11;
  repeated string linked_oa_ids = 12;
}

message ListMiniAppsRequest { string provider_id = 1; }
message ListMiniAppsResponse { repeated MiniApp mini_apps = 1; }

message GetMiniAppRequest { string id = 1; }
message GetMiniAppResponse { MiniApp mini_app = 1; }

message CreateMiniAppRequest {
  string provider_id = 1;
  string liff_app_id = 2;
  string name = 3;
  optional string icon_url = 4;
  optional string description = 5;
  optional string category = 6;
}
message CreateMiniAppResponse { MiniApp mini_app = 1; }

message UpdateMiniAppRequest {
  string id = 1;
  optional string name = 2;
  optional string icon_url = 3;
  optional string description = 4;
  optional string category = 5;
}
message UpdateMiniAppResponse { MiniApp mini_app = 1; }

message PublishMiniAppRequest { string id = 1; }
message PublishMiniAppResponse { MiniApp mini_app = 1; }

message UnpublishMiniAppRequest { string id = 1; }
message UnpublishMiniAppResponse { MiniApp mini_app = 1; }

message DeleteMiniAppRequest { string id = 1; }
message DeleteMiniAppResponse {}

message LinkOaRequest { string mini_app_id = 1; string oa_id = 2; }
message LinkOaResponse {}

message UnlinkOaRequest { string mini_app_id = 1; string oa_id = 2; }
message UnlinkOaResponse {}

service MiniAppService {
  rpc ListMiniApps(ListMiniAppsRequest) returns (ListMiniAppsResponse);
  rpc GetMiniApp(GetMiniAppRequest) returns (GetMiniAppResponse);
  rpc CreateMiniApp(CreateMiniAppRequest) returns (CreateMiniAppResponse);
  rpc UpdateMiniApp(UpdateMiniAppRequest) returns (UpdateMiniAppResponse);
  rpc PublishMiniApp(PublishMiniAppRequest) returns (PublishMiniAppResponse);
  rpc UnpublishMiniApp(UnpublishMiniAppRequest) returns (UnpublishMiniAppResponse);
  rpc DeleteMiniApp(DeleteMiniAppRequest) returns (DeleteMiniAppResponse);
  rpc LinkOa(LinkOaRequest) returns (LinkOaResponse);
  rpc UnlinkOa(UnlinkOaRequest) returns (UnlinkOaResponse);
}
```

- [ ] **Step 2: Generate proto code**

```bash
bun run proto:generate
ls packages/proto/gen/mini-app/v1/
```

Expected: `mini-app_pb.ts` exists.

- [ ] **Step 3: Add proto package export**

Modify `packages/proto/package.json` to add the exports key for `@vine/proto/mini-app`:

```json
{
  "exports": {
    "./liff": "./gen/liff/v1/liff_pb.ts",
    "./oa": "./gen/oa/v1/oa_pb.ts",
    "./mini-app": "./gen/mini-app/v1/mini-app_pb.ts"
  }
}
```

(Merge with existing `exports` keys; do not overwrite.)

- [ ] **Step 4: Write failing handler tests**

Create `apps/server/src/connect/mini-app.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { ConnectError, Code } from '@connectrpc/connect'
import { miniAppHandler } from './mini-app'

function fakeService() {
  return {
    createMiniApp: vi.fn().mockResolvedValue({
      id: 'ma-1',
      providerId: 'prov-1',
      liffAppId: 'liff-app-1',
      name: 'Pizza',
      iconUrl: null,
      description: null,
      category: null,
      isPublished: false,
      publishedAt: null,
      createdAt: '2026-05-05T00:00:00Z',
      updatedAt: '2026-05-05T00:00:00Z',
    }),
    getMiniApp: vi.fn().mockResolvedValue(null),
    listMiniApps: vi.fn().mockResolvedValue([]),
    updateMiniApp: vi.fn(),
    publishMiniApp: vi.fn(),
    unpublishMiniApp: vi.fn(),
    deleteMiniApp: vi.fn(),
    linkOa: vi.fn(),
    unlinkOa: vi.fn(),
    listLinkedOaIds: vi.fn().mockResolvedValue([]),
    listMiniAppsLinkedToOa: vi.fn(),
    getMiniAppByLiffAppId: vi.fn(),
    getMiniAppByLoginChannelId: vi.fn(),
  }
}

function fakeAuth() {
  return { /* unused — we mount handler directly */ } as any
}

function fakeCtx(authData: { id: string } | null) {
  return { values: { get: () => authData } } as any
}

describe('miniAppHandler', () => {
  it('createMiniApp requires providerId, liffAppId, name', async () => {
    const svc = fakeService()
    const handler = makeImpl(svc)
    await expect(
      handler.createMiniApp({ providerId: '', liffAppId: 'l', name: 'n' }, fakeCtx({ id: 'u' })),
    ).rejects.toThrow(/providerId/)
    await expect(
      handler.createMiniApp({ providerId: 'p', liffAppId: '', name: 'n' }, fakeCtx({ id: 'u' })),
    ).rejects.toThrow(/liffAppId/)
    await expect(
      handler.createMiniApp({ providerId: 'p', liffAppId: 'l', name: '' }, fakeCtx({ id: 'u' })),
    ).rejects.toThrow(/name/)
  })

  it('createMiniApp returns proto-shaped MiniApp', async () => {
    const svc = fakeService()
    const handler = makeImpl(svc)
    const res = await handler.createMiniApp(
      { providerId: 'prov-1', liffAppId: 'liff-app-1', name: 'Pizza' },
      fakeCtx({ id: 'u-1' }),
    )
    expect(res.miniApp?.name).toBe('Pizza')
    expect(res.miniApp?.isPublished).toBe(false)
    expect(res.miniApp?.linkedOaIds).toEqual([])
  })
})

// Bootstrapping helper — extracts the implementation map from the router setup
function makeImpl(svc: ReturnType<typeof fakeService>) {
  // The handler factory exports a `miniAppImpl(deps)` we can call directly
  const { miniAppImpl } = require('./mini-app')
  return miniAppImpl({ miniApp: svc, auth: fakeAuth() })
}
```

- [ ] **Step 5: Run tests, expect failure**

```bash
bun run --cwd apps/server test connect/mini-app
```

Expected: FAIL — module not found.

- [ ] **Step 6: Implement the handler**

Create `apps/server/src/connect/mini-app.ts`:

```ts
import type { ServiceImpl } from '@connectrpc/connect'
import { Code, ConnectError, ConnectRouter } from '@connectrpc/connect'
import type { AuthServer } from '@take-out/better-auth-utils/server'
import { MiniAppService } from '@vine/proto/mini-app'
import type { createMiniAppService } from '../services/mini-app'
import { requireAuthData, withAuthService } from './auth-context'

type MiniAppHandlerDeps = {
  miniApp: ReturnType<typeof createMiniAppService>
  auth: AuthServer
}

async function toProtoMiniApp(
  deps: MiniAppHandlerDeps,
  row: NonNullable<Awaited<ReturnType<typeof deps.miniApp.getMiniApp>>>,
) {
  const linkedOaIds = await deps.miniApp.listLinkedOaIds(row.id)
  return {
    id: row.id,
    providerId: row.providerId,
    liffAppId: row.liffAppId,
    name: row.name,
    iconUrl: row.iconUrl ?? undefined,
    description: row.description ?? undefined,
    category: row.category ?? undefined,
    isPublished: row.isPublished,
    publishedAt: row.publishedAt ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    linkedOaIds,
  }
}

export function miniAppImpl(deps: MiniAppHandlerDeps): ServiceImpl<typeof MiniAppService> {
  return {
    async listMiniApps(req, ctx) {
      requireAuthData(ctx)
      if (!req.providerId)
        throw new ConnectError('providerId required', Code.InvalidArgument)
      const rows = await deps.miniApp.listMiniApps(req.providerId)
      const miniApps = await Promise.all(rows.map((r) => toProtoMiniApp(deps, r)))
      return { miniApps }
    },

    async getMiniApp(req, ctx) {
      requireAuthData(ctx)
      if (!req.id) throw new ConnectError('id required', Code.InvalidArgument)
      const row = await deps.miniApp.getMiniApp(req.id)
      if (!row) throw new ConnectError('Mini App not found', Code.NotFound)
      return { miniApp: await toProtoMiniApp(deps, row) }
    },

    async createMiniApp(req, ctx) {
      requireAuthData(ctx)
      if (!req.providerId)
        throw new ConnectError('providerId required', Code.InvalidArgument)
      if (!req.liffAppId)
        throw new ConnectError('liffAppId required', Code.InvalidArgument)
      if (!req.name) throw new ConnectError('name required', Code.InvalidArgument)
      try {
        const existing = await deps.miniApp.getMiniAppByLiffAppId(req.liffAppId)
        if (existing) {
          throw new ConnectError(
            'This LIFF app is already wrapped by another Mini App',
            Code.AlreadyExists,
          )
        }
        const row = await deps.miniApp.createMiniApp({
          providerId: req.providerId,
          liffAppId: req.liffAppId,
          name: req.name,
          iconUrl: req.iconUrl,
          description: req.description,
          category: req.category,
        })
        return { miniApp: await toProtoMiniApp(deps, row) }
      } catch (e) {
        if (e instanceof ConnectError) throw e
        const msg = e instanceof Error ? e.message : 'create failed'
        throw new ConnectError(msg, Code.InvalidArgument)
      }
    },

    async updateMiniApp(req, ctx) {
      requireAuthData(ctx)
      if (!req.id) throw new ConnectError('id required', Code.InvalidArgument)
      const row = await deps.miniApp.updateMiniApp(req.id, {
        name: req.name,
        iconUrl: req.iconUrl,
        description: req.description,
        category: req.category,
      })
      if (!row) throw new ConnectError('Mini App not found', Code.NotFound)
      return { miniApp: await toProtoMiniApp(deps, row) }
    },

    async publishMiniApp(req, ctx) {
      requireAuthData(ctx)
      if (!req.id) throw new ConnectError('id required', Code.InvalidArgument)
      try {
        const row = await deps.miniApp.publishMiniApp(req.id)
        if (!row) throw new ConnectError('Mini App not found', Code.NotFound)
        return { miniApp: await toProtoMiniApp(deps, row) }
      } catch (e) {
        if (e instanceof ConnectError) throw e
        const msg = e instanceof Error ? e.message : 'publish failed'
        throw new ConnectError(msg, Code.FailedPrecondition)
      }
    },

    async unpublishMiniApp(req, ctx) {
      requireAuthData(ctx)
      if (!req.id) throw new ConnectError('id required', Code.InvalidArgument)
      const row = await deps.miniApp.unpublishMiniApp(req.id)
      if (!row) throw new ConnectError('Mini App not found', Code.NotFound)
      return { miniApp: await toProtoMiniApp(deps, row) }
    },

    async deleteMiniApp(req, ctx) {
      requireAuthData(ctx)
      if (!req.id) throw new ConnectError('id required', Code.InvalidArgument)
      await deps.miniApp.deleteMiniApp(req.id)
      return {}
    },

    async linkOa(req, ctx) {
      requireAuthData(ctx)
      if (!req.miniAppId)
        throw new ConnectError('miniAppId required', Code.InvalidArgument)
      if (!req.oaId) throw new ConnectError('oaId required', Code.InvalidArgument)
      await deps.miniApp.linkOa({ miniAppId: req.miniAppId, oaId: req.oaId })
      return {}
    },

    async unlinkOa(req, ctx) {
      requireAuthData(ctx)
      if (!req.miniAppId)
        throw new ConnectError('miniAppId required', Code.InvalidArgument)
      if (!req.oaId) throw new ConnectError('oaId required', Code.InvalidArgument)
      await deps.miniApp.unlinkOa({ miniAppId: req.miniAppId, oaId: req.oaId })
      return {}
    },
  }
}

export function miniAppHandler(deps: MiniAppHandlerDeps) {
  return (router: ConnectRouter) => {
    router.service(MiniAppService, withAuthService(MiniAppService, deps.auth, miniAppImpl(deps)))
  }
}
```

- [ ] **Step 7: Run tests, expect pass**

```bash
bun run --cwd apps/server test connect/mini-app
```

Expected: 2 tests PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/proto/proto/mini-app/v1/mini-app.proto \
        packages/proto/gen/mini-app \
        packages/proto/package.json \
        apps/server/src/connect/mini-app.ts \
        apps/server/src/connect/mini-app.test.ts
git commit -m "feat(server): MiniApp ConnectRPC service with CRUD + publish + OA linkage"
```

---

## Task 1.4: Wire `miniAppHandler` into the server

**Files:**
- Modify: `apps/server/src/connect/routes.ts`
- Modify: `apps/server/src/index.ts`

- [ ] **Step 1: Inspect existing wiring**

```bash
rtk grep -n "liffHandler\|liff:" apps/server/src/index.ts apps/server/src/connect/routes.ts
```

Expected: shows where `liffHandler` is constructed and registered.

- [ ] **Step 2: Wire the new handler**

Modify `apps/server/src/connect/routes.ts` to accept and register `miniAppHandler`:

```ts
// Add to imports:
import { miniAppHandler } from './mini-app'

// Extend the deps type (where the routes function takes deps):
type Deps = {
  // …existing fields…
  miniApp: ReturnType<typeof import('../services/mini-app').createMiniAppService>
}

// Inside the registration function (where liffHandler is currently registered),
// add:
miniAppHandler({ miniApp: deps.miniApp, auth: deps.auth })(router)
```

(Exact merge details follow the existing pattern at the file. If `routes.ts` constructs the handlers individually, add the line right after the LIFF handler registration.)

Modify `apps/server/src/index.ts` to construct the service and add it to the deps passed into routes:

```ts
import { createMiniAppService } from './services/mini-app'

// …inside the bootstrap, after the existing service constructions:
const miniApp = createMiniAppService({ db })

// Pass into the routes registration deps object:
// connectRoutes({ ..., miniApp, ... })(router)
```

- [ ] **Step 3: Type-check**

```bash
bun run check:all
```

Expected: type-check passes; no errors related to `miniApp` deps.

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/connect/routes.ts apps/server/src/index.ts
git commit -m "chore(server): wire miniAppHandler into ConnectRPC routes"
```

---

## Task 1.5: Console — Mini Apps list page under provider

**Files:**
- Create: `apps/web/app/(app)/developers/console/provider/[providerId]/mini-app/index.tsx`

- [ ] **Step 1: Inspect existing console layout**

```bash
ls "apps/web/app/(app)/developers/console/provider/[providerId]/"
cat "apps/web/app/(app)/developers/console/provider/[providerId]/index.tsx"
```

Note the existing layout structure — Tamagui `YStack`/`XStack`, `Heading` patterns, and how it consumes the provider via OneJS loader and the existing `LIFFService` / `LoginChannelService` ConnectRPC clients via `useTanQuery`.

- [ ] **Step 2: Create the list page**

Create `apps/web/app/(app)/developers/console/provider/[providerId]/mini-app/index.tsx`:

```tsx
import { useParams, Link } from 'one'
import { useTanQuery } from '~/data/useTanQuery'
import { miniAppClient } from '~/connect/clients'
import { Button, Heading, Stack, Text, XStack, YStack } from '~/interface/ui'

export default function MiniAppsListPage() {
  const { providerId } = useParams<{ providerId: string }>()
  const query = useTanQuery({
    queryKey: ['miniApp.list', providerId],
    queryFn: () => miniAppClient.listMiniApps({ providerId }),
  })

  return (
    <YStack p="$4" gap="$4">
      <XStack ai="center" jc="space-between">
        <Heading size="$8">Mini Apps</Heading>
        <Link href={`/developers/console/provider/${providerId}/mini-app/new`}>
          <Button>New Mini App</Button>
        </Link>
      </XStack>

      {query.isLoading && <Text>Loading...</Text>}
      {query.error && <Text color="$red10">{query.error.message}</Text>}
      {query.data?.miniApps.length === 0 && (
        <Text color="$gray10">
          No Mini Apps yet. Create one to wrap an existing LIFF app with a
          gallery-ready presence.
        </Text>
      )}

      <YStack gap="$2">
        {query.data?.miniApps.map((m) => (
          <Link
            key={m.id}
            href={`/developers/console/provider/${providerId}/mini-app/${m.id}`}
          >
            <Stack
              p="$3"
              br="$3"
              bw={1}
              boc="$borderColor"
              hoverStyle={{ bg: '$backgroundHover' }}
            >
              <XStack jc="space-between" ai="center">
                <YStack>
                  <Text fontWeight="600">{m.name}</Text>
                  <Text fontSize="$2" color="$gray10">
                    {m.category ?? 'uncategorized'}
                  </Text>
                </YStack>
                <Text fontSize="$2" color={m.isPublished ? '$green10' : '$gray10'}>
                  {m.isPublished ? 'Published' : 'Draft'}
                </Text>
              </XStack>
            </Stack>
          </Link>
        ))}
      </YStack>
    </YStack>
  )
}
```

(`miniAppClient` is the ConnectRPC client created next.)

- [ ] **Step 3: Add the ConnectRPC client**

Modify `apps/web/src/connect/clients.ts` (or equivalent — locate via `rtk grep -n "createClient(LIFFService" apps/web/src`):

```ts
import { MiniAppService } from '@vine/proto/mini-app'

export const miniAppClient = createClient(MiniAppService, transport)
```

- [ ] **Step 4: Smoke-test the page in the dev server**

```bash
bun run dev
```

Open `http://localhost:3000/developers/console/provider/<providerId>/mini-app`.

Expected: page renders with empty-state copy when no Mini Apps exist; "New Mini App" link visible.

- [ ] **Step 5: Commit**

```bash
git add "apps/web/app/(app)/developers/console/provider/[providerId]/mini-app" \
        apps/web/src/connect/clients.ts
git commit -m "feat(web): mini app list page under provider console"
```

---

## Task 1.6: Console — "New Mini App" creation page

**Files:**
- Create: `apps/web/app/(app)/developers/console/provider/[providerId]/mini-app/new.tsx`

- [ ] **Step 1: Create the page**

Create `apps/web/app/(app)/developers/console/provider/[providerId]/mini-app/new.tsx`:

```tsx
import { useParams, useRouter } from 'one'
import { useState } from 'react'
import { useTanQuery, useTanMutation } from '~/data/useTanQuery'
import { miniAppClient, liffClient, loginChannelClient } from '~/connect/clients'
import { Button, Heading, Input, Select, Stack, Text, YStack } from '~/interface/ui'
import { showToast } from '~/interface/toast'

export default function NewMiniAppPage() {
  const { providerId } = useParams<{ providerId: string }>()
  const router = useRouter()

  const channels = useTanQuery({
    queryKey: ['loginChannels', providerId],
    queryFn: () => loginChannelClient.listLoginChannels({ providerId }),
  })

  const liffApps = useTanQuery({
    queryKey: ['liffAppsAcrossChannels', providerId, channels.data?.channels],
    queryFn: async () => {
      if (!channels.data?.channels.length) return { apps: [] }
      const all = await Promise.all(
        channels.data.channels.map((c) =>
          liffClient.listLiffApps({ loginChannelId: c.id }).then((r) => r.apps),
        ),
      )
      return { apps: all.flat() }
    },
    enabled: !!channels.data,
  })

  const [liffAppId, setLiffAppId] = useState<string>('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')

  const create = useTanMutation({
    mutationFn: () =>
      miniAppClient.createMiniApp({
        providerId,
        liffAppId,
        name,
        description: description || undefined,
        category: category || undefined,
      }),
    onSuccess: (res) => {
      showToast('Mini App created')
      router.push(
        `/developers/console/provider/${providerId}/mini-app/${res.miniApp!.id}`,
      )
    },
    onError: (e) => showToast(`Create failed: ${(e as Error).message}`),
  })

  return (
    <YStack p="$4" gap="$4" maxWidth={600}>
      <Heading size="$8">New Mini App</Heading>

      <YStack gap="$2">
        <Text>Underlying LIFF app</Text>
        <Select value={liffAppId} onValueChange={setLiffAppId}>
          <Select.Trigger>
            <Select.Value placeholder="Select a LIFF app..." />
          </Select.Trigger>
          <Select.Content>
            {liffApps.data?.apps.map((a) => (
              <Select.Item key={a.id} value={a.id}>
                <Select.ItemText>
                  {a.endpointUrl} ({a.liffId})
                </Select.ItemText>
              </Select.Item>
            ))}
          </Select.Content>
        </Select>
        {liffApps.data?.apps.length === 0 && (
          <Text fontSize="$2" color="$gray10">
            No LIFF apps yet. Create one under a Login Channel first.
          </Text>
        )}
      </YStack>

      <YStack gap="$2">
        <Text>Name</Text>
        <Input value={name} onChangeText={setName} placeholder="My Mini App" />
      </YStack>

      <YStack gap="$2">
        <Text>Description</Text>
        <Input value={description} onChangeText={setDescription} />
      </YStack>

      <YStack gap="$2">
        <Text>Category</Text>
        <Input
          value={category}
          onChangeText={setCategory}
          placeholder="reservation / queue / delivery / ..."
        />
      </YStack>

      <Button
        theme="active"
        disabled={!liffAppId || !name || create.isPending}
        onPress={() => create.mutate()}
      >
        {create.isPending ? 'Creating...' : 'Create'}
      </Button>
    </YStack>
  )
}
```

- [ ] **Step 2: Smoke-test**

```bash
bun run dev
```

Navigate to `/developers/console/provider/<providerId>/mini-app/new`, pick a LIFF app, fill in name + description, click Create.

Expected: redirect to the Mini App detail page (which is built in Task 1.7).

- [ ] **Step 3: Commit**

```bash
git add "apps/web/app/(app)/developers/console/provider/[providerId]/mini-app/new.tsx"
git commit -m "feat(web): mini app creation page"
```

---

## Task 1.7: Console — Mini App settings page with publish toggle

**Files:**
- Create: `apps/web/app/(app)/developers/console/provider/[providerId]/mini-app/[miniAppId]/index.tsx`

- [ ] **Step 1: Create the page**

```tsx
import { useParams, useRouter } from 'one'
import { useState, useEffect } from 'react'
import { useTanQuery, useTanMutation, queryClient } from '~/data/useTanQuery'
import { miniAppClient, liffClient } from '~/connect/clients'
import {
  Button,
  Dialog,
  Heading,
  Input,
  Stack,
  Switch,
  Text,
  XStack,
  YStack,
} from '~/interface/ui'
import { showToast } from '~/interface/toast'
import { dialogConfirm } from '~/interface/dialogs'
import { uploadIcon } from '~/interface/upload'

export default function MiniAppSettingsPage() {
  const { providerId, miniAppId } = useParams<{ providerId: string; miniAppId: string }>()
  const router = useRouter()

  const ma = useTanQuery({
    queryKey: ['miniApp.get', miniAppId],
    queryFn: () => miniAppClient.getMiniApp({ id: miniAppId }),
  })

  const liffApp = useTanQuery({
    queryKey: ['liffApp', ma.data?.miniApp?.liffAppId],
    queryFn: () => liffClient.getLiffApp({ liffId: ma.data!.miniApp!.liffAppId }),
    enabled: !!ma.data?.miniApp?.liffAppId,
  })

  const [name, setName] = useState('')
  const [iconUrl, setIconUrl] = useState<string | null>(null)
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')

  useEffect(() => {
    const m = ma.data?.miniApp
    if (m) {
      setName(m.name)
      setIconUrl(m.iconUrl ?? null)
      setDescription(m.description ?? '')
      setCategory(m.category ?? '')
    }
  }, [ma.data?.miniApp?.id])

  const save = useTanMutation({
    mutationFn: () =>
      miniAppClient.updateMiniApp({
        id: miniAppId,
        name,
        iconUrl: iconUrl ?? undefined,
        description: description || undefined,
        category: category || undefined,
      }),
    onSuccess: () => {
      showToast('Saved')
      queryClient.invalidateQueries({ queryKey: ['miniApp.get', miniAppId] })
    },
  })

  const publish = useTanMutation({
    mutationFn: () => miniAppClient.publishMiniApp({ id: miniAppId }),
    onSuccess: () => {
      showToast('Published')
      queryClient.invalidateQueries({ queryKey: ['miniApp.get', miniAppId] })
    },
    onError: (e) => showToast(`Publish failed: ${(e as Error).message}`),
  })

  const unpublish = useTanMutation({
    mutationFn: () => miniAppClient.unpublishMiniApp({ id: miniAppId }),
    onSuccess: () => {
      showToast('Unpublished')
      queryClient.invalidateQueries({ queryKey: ['miniApp.get', miniAppId] })
    },
  })

  const handlePublishToggle = async (next: boolean) => {
    const ok = await dialogConfirm({
      title: next ? 'Publish this Mini App?' : 'Unpublish this Mini App?',
      message: next
        ? 'Publishing makes this Mini App visible in the public directory and lets it send Service Messages. You can unpublish at any time.'
        : 'Unpublishing removes this Mini App from the public directory and disables Service Messages.',
      confirmText: next ? 'Publish' : 'Unpublish',
    })
    if (!ok) return
    if (next) publish.mutate()
    else unpublish.mutate()
  }

  if (ma.isLoading) return <Text p="$4">Loading...</Text>
  if (!ma.data?.miniApp) return <Text p="$4">Not found</Text>

  const m = ma.data.miniApp

  return (
    <YStack p="$4" gap="$4" maxWidth={720}>
      <XStack jc="space-between" ai="center">
        <Heading size="$8">{m.name}</Heading>
        <XStack ai="center" gap="$2">
          <Text>Published</Text>
          <Switch
            checked={m.isPublished}
            onCheckedChange={handlePublishToggle}
            disabled={publish.isPending || unpublish.isPending}
          />
        </XStack>
      </XStack>

      <YStack gap="$1">
        <Text fontSize="$2" color="$gray10">Mini App ID</Text>
        <Text>{m.id}</Text>
      </YStack>

      <YStack gap="$1">
        <Text fontSize="$2" color="$gray10">Permanent link</Text>
        <Text>{`${typeof window !== 'undefined' ? window.location.origin : ''}/m/${m.id}`}</Text>
      </YStack>

      <YStack gap="$1">
        <Text fontSize="$2" color="$gray10">Underlying LIFF app</Text>
        <XStack gap="$2" ai="center">
          <Text>{liffApp.data?.app?.endpointUrl ?? '...'}</Text>
          {liffApp.data?.app && (
            <Button
              size="$2"
              onPress={() =>
                router.push(
                  `/developers/console/provider/${providerId}/login-channel/${liffApp.data!.app!.loginChannelId}/liff/${liffApp.data!.app!.liffId}`,
                )
              }
            >
              Configure →
            </Button>
          )}
        </XStack>
      </YStack>

      <YStack gap="$2">
        <Text>Name</Text>
        <Input value={name} onChangeText={setName} />
      </YStack>

      <YStack gap="$2">
        <Text>Icon</Text>
        <XStack gap="$2" ai="center">
          {iconUrl && (
            <Stack w={48} h={48} br="$3" overflow="hidden">
              <img src={iconUrl} width={48} height={48} alt="icon" />
            </Stack>
          )}
          <Button
            onPress={async () => {
              const url = await uploadIcon({ accept: 'image/png,image/jpeg' })
              if (url) setIconUrl(url)
            }}
          >
            {iconUrl ? 'Replace' : 'Upload'}
          </Button>
        </XStack>
        {!iconUrl && (
          <Text fontSize="$2" color="$gray10">
            An icon is required to publish this Mini App.
          </Text>
        )}
      </YStack>

      <YStack gap="$2">
        <Text>Description</Text>
        <Input value={description} onChangeText={setDescription} />
      </YStack>

      <YStack gap="$2">
        <Text>Category</Text>
        <Input value={category} onChangeText={setCategory} />
      </YStack>

      <XStack gap="$2">
        <Button
          theme="active"
          disabled={save.isPending || !name}
          onPress={() => save.mutate()}
        >
          {save.isPending ? 'Saving...' : 'Save'}
        </Button>
        <Button
          theme="alt2"
          onPress={() =>
            router.push(
              `/developers/console/provider/${providerId}/mini-app/${miniAppId}/oa-links`,
            )
          }
        >
          Linked OAs →
        </Button>
      </XStack>
    </YStack>
  )
}
```

- [ ] **Step 2: Smoke-test publish + unpublish**

```bash
bun run dev
```

Open the Mini App page. Toggle "Published":
- Without an icon: confirm modal appears; clicking Publish triggers a 412/`FailedPrecondition` toast saying iconUrl is required.
- With an icon set + saved: toggle succeeds; "Published" green pill appears in the list page.

- [ ] **Step 3: Commit**

```bash
git add "apps/web/app/(app)/developers/console/provider/[providerId]/mini-app/[miniAppId]/index.tsx"
git commit -m "feat(web): mini app settings page with publish toggle and icon upload"
```

---

## Task 1.8: Console — OA-link management page

**Files:**
- Create: `apps/web/app/(app)/developers/console/provider/[providerId]/mini-app/[miniAppId]/oa-links.tsx`

- [ ] **Step 1: Create the page**

```tsx
import { useParams } from 'one'
import { useTanQuery, useTanMutation, queryClient } from '~/data/useTanQuery'
import { miniAppClient, oaClient } from '~/connect/clients'
import { Button, Heading, Stack, Text, XStack, YStack } from '~/interface/ui'

export default function MiniAppOaLinksPage() {
  const { miniAppId } = useParams<{ miniAppId: string }>()

  const ma = useTanQuery({
    queryKey: ['miniApp.get', miniAppId],
    queryFn: () => miniAppClient.getMiniApp({ id: miniAppId }),
  })

  const myOas = useTanQuery({
    queryKey: ['oa.listManaged'],
    queryFn: () => oaClient.listManagedOas({}),
  })

  const link = useTanMutation({
    mutationFn: (oaId: string) => miniAppClient.linkOa({ miniAppId, oaId }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['miniApp.get', miniAppId] }),
  })

  const unlink = useTanMutation({
    mutationFn: (oaId: string) => miniAppClient.unlinkOa({ miniAppId, oaId }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['miniApp.get', miniAppId] }),
  })

  const linkedSet = new Set(ma.data?.miniApp?.linkedOaIds ?? [])

  return (
    <YStack p="$4" gap="$4" maxWidth={720}>
      <Heading size="$8">Linked Official Accounts</Heading>
      <Text color="$gray10">
        Linked OAs surface this Mini App on their profile and in users'
        "From your OAs" gallery.
      </Text>

      <YStack gap="$2">
        {myOas.data?.oas.map((o) => {
          const linked = linkedSet.has(o.id)
          return (
            <XStack
              key={o.id}
              p="$3"
              br="$3"
              bw={1}
              boc="$borderColor"
              jc="space-between"
              ai="center"
            >
              <Text>{o.name}</Text>
              <Button
                size="$2"
                theme={linked ? 'red' : 'active'}
                onPress={() =>
                  linked ? unlink.mutate(o.id) : link.mutate(o.id)
                }
              >
                {linked ? 'Unlink' : 'Link'}
              </Button>
            </XStack>
          )
        })}
      </YStack>
    </YStack>
  )
}
```

- [ ] **Step 2: Smoke-test linking**

```bash
bun run dev
```

Open the OA Links page, click Link on an OA, refresh the Mini App settings page — the linked OA's id should appear in `linkedOaIds`.

- [ ] **Step 3: Commit**

```bash
git add "apps/web/app/(app)/developers/console/provider/[providerId]/mini-app/[miniAppId]/oa-links.tsx"
git commit -m "feat(web): mini app OA-link management page"
```

---

# Stage 2 — Public surfaces

Outcome of stage: opening `/m/{miniAppId}` resolves to the underlying LIFF route with a host-rendered header chrome (service name, back, close, action button menu, loading bar). SDK exposes `liff.miniApp.getInfo()` and the extended `permanentLink.createUrlBy({ miniAppId })`.

## Task 2.1: Public metadata endpoint `GET /api/liff/v1/mini-app/:miniAppId`

**Files:**
- Create: `apps/server/src/plugins/mini-app-public.ts`
- Test: `apps/server/src/plugins/mini-app-public.test.ts`

- [ ] **Step 1: Write failing test**

Create `apps/server/src/plugins/mini-app-public.test.ts`:

```ts
import { describe, expect, it, vi, beforeAll, afterAll } from 'vitest'
import Fastify from 'fastify'
import { miniAppPublicPlugin } from './mini-app-public'

function fakeMiniAppService(rows: Record<string, any>) {
  return {
    getMiniApp: vi.fn(async (id: string) => rows[id] ?? null),
    listLinkedOaIds: vi.fn(async () => ['oa-1', 'oa-2']),
    getMiniAppByLiffAppId: vi.fn(),
    getMiniAppByLoginChannelId: vi.fn(),
    listMiniAppsLinkedToOa: vi.fn(),
    listMiniApps: vi.fn(),
    createMiniApp: vi.fn(),
    updateMiniApp: vi.fn(),
    publishMiniApp: vi.fn(),
    unpublishMiniApp: vi.fn(),
    deleteMiniApp: vi.fn(),
    linkOa: vi.fn(),
    unlinkOa: vi.fn(),
  } as any
}

function fakeLiffService() {
  return {
    getLiffAppByDbId: vi.fn(async (_id: string) => ({
      id: 'liff-app-1',
      liffId: '1234567890-abcd',
      endpointUrl: 'https://app.example.com',
    })),
  } as any
}

describe('GET /api/liff/v1/mini-app/:miniAppId', () => {
  it('returns mini app metadata when found', async () => {
    const app = Fastify()
    await app.register((instance) =>
      miniAppPublicPlugin(instance, {
        miniApp: fakeMiniAppService({
          'ma-1': {
            id: 'ma-1',
            providerId: 'p',
            liffAppId: 'liff-app-1',
            name: 'Pizza',
            iconUrl: 'https://x/icon.png',
            description: 'Order pizza',
            category: 'delivery',
            isPublished: true,
            publishedAt: '2026-05-05T00:00:00Z',
            createdAt: '2026-05-05T00:00:00Z',
            updatedAt: '2026-05-05T00:00:00Z',
          },
        }),
        liff: fakeLiffService(),
      }),
    )
    const res = await app.inject({ method: 'GET', url: '/api/liff/v1/mini-app/ma-1' })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.name).toBe('Pizza')
    expect(body.liffId).toBe('1234567890-abcd')
    expect(body.linkedOaIds).toEqual(['oa-1', 'oa-2'])
    await app.close()
  })

  it('returns 404 when not found', async () => {
    const app = Fastify()
    await app.register((instance) =>
      miniAppPublicPlugin(instance, {
        miniApp: fakeMiniAppService({}),
        liff: fakeLiffService(),
      }),
    )
    const res = await app.inject({ method: 'GET', url: '/api/liff/v1/mini-app/missing' })
    expect(res.statusCode).toBe(404)
    await app.close()
  })
})
```

- [ ] **Step 2: Run test, expect failure**

```bash
bun run --cwd apps/server test mini-app-public
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement plugin**

Create `apps/server/src/plugins/mini-app-public.ts`:

```ts
import type { FastifyInstance } from 'fastify'
import type { createMiniAppService } from '../services/mini-app'
import type { createLiffService } from '../services/liff'

type MiniAppPublicDeps = {
  miniApp: ReturnType<typeof createMiniAppService>
  liff: ReturnType<typeof createLiffService> & {
    getLiffAppByDbId?: (id: string) => Promise<{ liffId: string; endpointUrl: string } | null>
  }
}

export async function miniAppPublicPlugin(
  app: FastifyInstance,
  deps: MiniAppPublicDeps,
): Promise<void> {
  app.get<{ Params: { miniAppId: string } }>(
    '/api/liff/v1/mini-app/:miniAppId',
    async (request, reply) => {
      const { miniAppId } = request.params
      const m = await deps.miniApp.getMiniApp(miniAppId)
      if (!m) return reply.status(404).send({ error: 'Mini App not found' })
      const linkedOaIds = await deps.miniApp.listLinkedOaIds(miniAppId)
      // Resolve LIFF id from the underlying oaLiffApp row
      const liffAppRow = deps.liff.getLiffAppByDbId
        ? await deps.liff.getLiffAppByDbId(m.liffAppId)
        : null
      return reply.send({
        id: m.id,
        name: m.name,
        iconUrl: m.iconUrl ?? null,
        description: m.description ?? null,
        category: m.category ?? null,
        liffId: liffAppRow?.liffId ?? null,
        isPublished: m.isPublished,
        linkedOaIds,
      })
    },
  )
}
```

- [ ] **Step 4: Add `getLiffAppByDbId` helper**

Modify `apps/server/src/services/liff.ts` to add a getter by primary key:

```ts
async function getLiffAppByDbId(id: string) {
  const [app] = await db.select().from(oaLiffApp).where(eq(oaLiffApp.id, id)).limit(1)
  return app ?? null
}
```

Add `getLiffAppByDbId` to the returned object.

- [ ] **Step 5: Run tests, expect pass**

```bash
bun run --cwd apps/server test mini-app-public
```

Expected: 2 tests PASS.

- [ ] **Step 6: Wire plugin into the server bootstrap**

Modify `apps/server/src/index.ts` to register the plugin alongside `liffPublicPlugin`:

```ts
import { miniAppPublicPlugin } from './plugins/mini-app-public'

// after liffPublicPlugin registration:
await app.register((instance) => miniAppPublicPlugin(instance, { miniApp, liff }))
```

- [ ] **Step 7: Commit**

```bash
git add apps/server/src/plugins/mini-app-public.ts \
        apps/server/src/plugins/mini-app-public.test.ts \
        apps/server/src/services/liff.ts \
        apps/server/src/index.ts
git commit -m "feat(server): public mini app metadata endpoint"
```

---

## Task 2.2: `/m/[miniAppId]` SSR route

**Files:**
- Create: `apps/web/app/(public)/m/[miniAppId]/index.tsx`

- [ ] **Step 1: Inspect M4's `/liff/[liffId]` route as the reference pattern**

```bash
ls "apps/web/app/(public)/liff/"
cat "apps/web/app/(public)/liff/[liffId]/index.tsx"
```

- [ ] **Step 2: Create the route**

Create `apps/web/app/(public)/m/[miniAppId]/index.tsx`:

```tsx
import { LoaderProps, redirect, useLoader } from 'one'
import { MiniAppShell } from '../../liff/MiniAppShell'

export async function loader({ params, request }: LoaderProps) {
  const miniAppId = params.miniAppId as string
  const url = new URL(request.url)
  const apiBase = process.env.VITE_API_BASE_URL ?? url.origin

  const res = await fetch(`${apiBase}/api/liff/v1/mini-app/${miniAppId}`)
  if (res.status === 404) {
    throw new Response('Mini App not found', { status: 404 })
  }
  if (!res.ok) {
    throw new Response('Failed to load Mini App', { status: 500 })
  }
  const m = (await res.json()) as {
    id: string
    name: string
    iconUrl: string | null
    description: string | null
    category: string | null
    liffId: string | null
    isPublished: boolean
    linkedOaIds: string[]
  }

  if (!m.isPublished) {
    // Provider-admin gating happens inside the LIFF route; here we
    // surface a "not yet published" page for unauthenticated viewers.
    // For MVP, render a simple message.
    return { miniApp: m, allowed: false }
  }

  return { miniApp: m, allowed: true }
}

export default function MiniAppEntryPage() {
  const { miniApp, allowed } = useLoader<typeof loader>()

  if (!allowed) {
    return (
      <div style={{ padding: 32 }}>
        <h2>This Mini App is not yet published.</h2>
      </div>
    )
  }

  if (!miniApp.liffId) {
    return (
      <div style={{ padding: 32 }}>
        <h2>This Mini App has no underlying LIFF app configured.</h2>
      </div>
    )
  }

  return <MiniAppShell miniApp={miniApp} />
}
```

(The `MiniAppShell` component is created in Task 2.6.)

- [ ] **Step 3: Recents recording**

Recents are recorded on the server when the metadata endpoint is hit by an authenticated viewer. Defer recents recording to Task 2.8 (after we add the SDK bootstrap injection).

- [ ] **Step 4: Smoke-test**

```bash
bun run dev
```

Open `/m/<miniAppId>` for an unpublished Mini App: shows "not yet published" page. Publish it, refresh: would render `<MiniAppShell />` (component still empty until Task 2.6).

- [ ] **Step 5: Commit**

```bash
git add "apps/web/app/(public)/m/[miniAppId]/index.tsx"
git commit -m "feat(web): /m/{miniAppId} SSR entry route"
```

---

## Task 2.3: `/m/[miniAppId]/[...rest]` path-suffix route

**Files:**
- Create: `apps/web/app/(public)/m/[miniAppId]/[...rest].tsx`

- [ ] **Step 1: Create the route**

```tsx
import { LoaderProps, useLoader } from 'one'
import { MiniAppShell } from '../../liff/MiniAppShell'

export async function loader({ params, request }: LoaderProps) {
  const miniAppId = params.miniAppId as string
  const rest = (params.rest as string[] | string | undefined) ?? []
  const restPath = Array.isArray(rest) ? rest.join('/') : rest
  const url = new URL(request.url)
  const apiBase = process.env.VITE_API_BASE_URL ?? url.origin

  const res = await fetch(`${apiBase}/api/liff/v1/mini-app/${miniAppId}`)
  if (!res.ok) {
    throw new Response('Mini App not found', { status: 404 })
  }
  const m = await res.json()
  return { miniApp: m, restPath, search: url.search, hash: '' }
}

export default function MiniAppRestPage() {
  const { miniApp, restPath, search } = useLoader<typeof loader>()
  if (!miniApp.isPublished) {
    return (
      <div style={{ padding: 32 }}>
        <h2>This Mini App is not yet published.</h2>
      </div>
    )
  }
  return (
    <MiniAppShell
      miniApp={miniApp}
      forwardPath={`/${restPath}${search}`}
    />
  )
}
```

- [ ] **Step 2: Smoke-test**

Open `/m/<id>/orders/123?ref=abc` — eventually (after Task 2.6) should mount the LIFF iframe at `https://endpoint/orders/123?ref=abc`.

- [ ] **Step 3: Commit**

```bash
git add "apps/web/app/(public)/m/[miniAppId]/[...rest].tsx"
git commit -m "feat(web): mini app permanent link path-suffix route"
```

---

## Task 2.4: SDK bootstrap fields + `liff.miniApp.getInfo()`

**Files:**
- Modify: `packages/liff/src/liff.ts`
- Test: `packages/liff/src/liff.miniapp.test.ts`

- [ ] **Step 1: Inspect the existing bootstrap shape**

```bash
rtk grep -n "VineLiffBootstrap\|window.VineLIFF" packages/liff/src/liff.ts
```

- [ ] **Step 2: Write failing test**

Create `packages/liff/src/liff.miniapp.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { LiffImpl } from './liff'

describe('liff.miniApp.getInfo()', () => {
  it('returns mini app info from bootstrap when present', async () => {
    const impl = new LiffImpl()
    ;(impl as any).bootstrap = {
      apiBaseUrl: 'https://x',
      liffId: 'abc',
      endpointOrigin: 'https://app',
      miniAppId: 'ma-1',
      miniApp: {
        name: 'Pizza',
        iconUrl: 'https://x/icon',
        description: 'Order pizza',
        category: 'delivery',
      },
    }
    const info = (impl as any).getMiniAppInfo()
    expect(info).toEqual({
      id: 'ma-1',
      name: 'Pizza',
      iconUrl: 'https://x/icon',
      description: 'Order pizza',
      category: 'delivery',
    })
  })

  it('returns null when no mini app on bootstrap', () => {
    const impl = new LiffImpl()
    ;(impl as any).bootstrap = {
      apiBaseUrl: 'https://x',
      liffId: 'abc',
      endpointOrigin: 'https://app',
    }
    expect((impl as any).getMiniAppInfo()).toBeNull()
  })
})
```

- [ ] **Step 3: Run test, expect failure**

```bash
bun run --cwd packages/liff test miniapp
```

Expected: FAIL — `getMiniAppInfo is not a function`.

- [ ] **Step 4: Extend the bootstrap type and add the method**

Modify `packages/liff/src/liff.ts`:

```ts
// Add to the VineLiffBootstrap type:
export type VineLiffBootstrap = {
  // …existing fields…
  miniAppId?: string
  miniApp?: {
    name: string
    iconUrl: string | null
    description: string | null
    category: string | null
  }
}

// Add getMiniAppInfo to LiffImpl:
getMiniAppInfo() {
  if (!this.bootstrap.miniAppId || !this.bootstrap.miniApp) return null
  return {
    id: this.bootstrap.miniAppId,
    name: this.bootstrap.miniApp.name,
    iconUrl: this.bootstrap.miniApp.iconUrl,
    description: this.bootstrap.miniApp.description,
    category: this.bootstrap.miniApp.category,
  }
}
```

Expose `liff.miniApp.getInfo()` on the public SDK surface (in the same file where the public `liff` object is constructed):

```ts
const liff = {
  // …existing methods…
  miniApp: {
    getInfo: () => impl.getMiniAppInfo(),
  },
}
```

Extend `permanentLink.createUrlBy` to accept `{ miniAppId? }` and emit `/m/{id}/...`:

```ts
permanentLink: {
  createUrlBy: (params: { path?: string; miniAppId?: string } = {}) => {
    const { path = '', miniAppId } = params
    const base = miniAppId
      ? `${impl.getApiBaseUrl()}/m/${miniAppId}`
      : `${impl.getApiBaseUrl()}/liff/${impl.getBootstrap().liffId}`
    return path ? `${base}${path.startsWith('/') ? path : `/${path}`}` : base
  },
},
```

- [ ] **Step 5: Run tests**

```bash
bun run --cwd packages/liff test
```

Expected: all pass including new mini-app test.

- [ ] **Step 6: Commit**

```bash
git add packages/liff/src/liff.ts packages/liff/src/liff.miniapp.test.ts
git commit -m "feat(liff): bootstrap miniApp fields + liff.miniApp.getInfo + extended permanentLink"
```

---

## Task 2.5: `MiniAppActionMenu` (built-in action button menu)

**Files:**
- Create: `apps/web/app/(public)/liff/MiniAppActionMenu.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { useState } from 'react'
import { Button, Popover, Stack, Text, YStack } from '~/interface/ui'
import { showToast } from '~/interface/toast'

type MiniAppMeta = {
  id: string
  name: string
}

export function MiniAppActionMenu({
  miniApp,
  permanentLink,
  onShareToChat,
}: {
  miniApp: MiniAppMeta
  permanentLink: string
  onShareToChat: () => void
}) {
  const [open, setOpen] = useState(false)

  const copyUrl = async () => {
    await navigator.clipboard.writeText(permanentLink)
    showToast('Link copied')
    setOpen(false)
  }

  const openExternal = () => {
    window.open(permanentLink, '_blank', 'noopener,noreferrer')
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <Button size="$2" circular icon="•••" aria-label="Actions" />
      </Popover.Trigger>
      <Popover.Content
        bordered
        elevate
        p="$2"
        zIndex={9999}
      >
        <YStack gap="$1" minWidth={200}>
          <Stack
            p="$2"
            br="$2"
            hoverStyle={{ bg: '$backgroundHover' }}
            cursor="pointer"
            onPress={() => {
              setOpen(false)
              onShareToChat()
            }}
          >
            <Text>Share to chat</Text>
          </Stack>
          <Stack
            p="$2"
            br="$2"
            hoverStyle={{ bg: '$backgroundHover' }}
            cursor="pointer"
            onPress={copyUrl}
          >
            <Text>Copy URL</Text>
          </Stack>
          <Stack
            p="$2"
            br="$2"
            hoverStyle={{ bg: '$backgroundHover' }}
            cursor="pointer"
            onPress={openExternal}
          >
            <Text>Open in external browser</Text>
          </Stack>
        </YStack>
      </Popover.Content>
    </Popover>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add "apps/web/app/(public)/liff/MiniAppActionMenu.tsx"
git commit -m "feat(web): mini app built-in action button menu"
```

---

## Task 2.6: `MiniAppShell` component

**Files:**
- Create: `apps/web/app/(public)/liff/MiniAppShell.tsx`
- Test: `apps/web/app/(public)/liff/MiniAppShell.test.tsx`

- [ ] **Step 1: Inspect the existing `LiffBrowser`**

```bash
ls "apps/web/app/(public)/liff/"
cat "apps/web/app/(public)/liff/LiffBrowser.tsx"
```

Note how it injects bootstrap and creates the iframe.

- [ ] **Step 2: Create the shell**

```tsx
import { useState, useRef } from 'react'
import { LiffBrowser } from './LiffBrowser'
import { MiniAppActionMenu } from './MiniAppActionMenu'
import { Stack, Text, XStack, YStack } from '~/interface/ui'
import { useRouter } from 'one'

type MiniAppMeta = {
  id: string
  name: string
  iconUrl: string | null
  description: string | null
  category: string | null
  liffId: string | null
}

export function MiniAppShell({
  miniApp,
  forwardPath,
}: {
  miniApp: MiniAppMeta
  forwardPath?: string
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const iframeRef = useRef<HTMLIFrameElement | null>(null)

  const permanentLink =
    typeof window !== 'undefined'
      ? `${window.location.origin}/m/${miniApp.id}`
      : ''

  const endpointDomain = (() => {
    try {
      return new URL(window.location.href).hostname
    } catch {
      return ''
    }
  })()

  const onClose = () => {
    if (window.history.length > 1) router.back()
    else window.close()
  }

  const onBack = () => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        { type: 'liff:host:back' },
        '*',
      )
    } else {
      router.back()
    }
  }

  const onShareToChat = () => {
    // Reuse existing shareTargetPicker route — open it as a modal
    router.push(
      `/share-target-picker?text=${encodeURIComponent(permanentLink)}`,
    )
  }

  return (
    <YStack f={1} bg="$background">
      <XStack
        p="$2"
        ai="center"
        gap="$2"
        bbw={1}
        bbc="$borderColor"
        bg="$backgroundStrong"
      >
        <Stack
          w={32}
          h={32}
          ai="center"
          jc="center"
          br="$10"
          hoverStyle={{ bg: '$backgroundHover' }}
          cursor="pointer"
          onPress={onBack}
          accessibilityLabel="Back"
        >
          <Text>←</Text>
        </Stack>
        <YStack f={1}>
          <Text fontWeight="600" numberOfLines={1}>
            {miniApp.name}
          </Text>
          <Text fontSize="$1" color="$gray10" numberOfLines={1}>
            {endpointDomain}
          </Text>
        </YStack>
        <MiniAppActionMenu
          miniApp={{ id: miniApp.id, name: miniApp.name }}
          permanentLink={permanentLink}
          onShareToChat={onShareToChat}
        />
        <Stack
          w={32}
          h={32}
          ai="center"
          jc="center"
          br="$10"
          hoverStyle={{ bg: '$backgroundHover' }}
          cursor="pointer"
          onPress={onClose}
          accessibilityLabel="Close"
        >
          <Text>×</Text>
        </Stack>
      </XStack>
      {loading && <Stack h={2} bg="$blue10" />}
      <Stack f={1}>
        {miniApp.liffId && (
          <LiffBrowser
            liffId={miniApp.liffId}
            forwardPath={forwardPath}
            miniApp={{
              id: miniApp.id,
              name: miniApp.name,
              iconUrl: miniApp.iconUrl,
              description: miniApp.description,
              category: miniApp.category,
            }}
            onIframeRef={(ref) => (iframeRef.current = ref)}
            onLoad={() => setLoading(false)}
          />
        )}
      </Stack>
    </YStack>
  )
}
```

- [ ] **Step 3: Extend `LiffBrowser` to pass mini-app fields into the bootstrap**

Modify `apps/web/app/(public)/liff/LiffBrowser.tsx` — when constructing the bootstrap object passed to the iframe, include `miniAppId` and `miniApp` if provided:

```ts
const bootstrap = {
  // …existing fields…
  miniAppId: props.miniApp?.id,
  miniApp: props.miniApp
    ? {
        name: props.miniApp.name,
        iconUrl: props.miniApp.iconUrl,
        description: props.miniApp.description,
        category: props.miniApp.category,
      }
    : undefined,
}
```

Add `forwardPath`, `miniApp`, `onIframeRef`, `onLoad` to the props type, and pipe them through to the iframe URL / handlers.

- [ ] **Step 4: Smoke-test**

```bash
bun run dev
```

Open `/m/<id>`: header chrome renders with name + close + back + action menu. Click action button → menu shows three options. Copy URL → toast appears.

- [ ] **Step 5: Commit**

```bash
git add "apps/web/app/(public)/liff/MiniAppShell.tsx" \
        "apps/web/app/(public)/liff/LiffBrowser.tsx"
git commit -m "feat(web): MiniAppShell header chrome with action button menu"
```

---

## Task 2.7: Recents recording on `/m/{id}` resolution

**Files:**
- Modify: `packages/db/src/schema-login.ts`
- Modify: `packages/db/src/migrations/20260505000001_mini_app_tables.ts`
- Modify: `apps/server/src/services/mini-app.ts`
- Modify: `apps/server/src/plugins/mini-app-public.ts`

- [ ] **Step 1: Extend the migration with `miniAppRecent`**

Append to the SQL block in `20260505000001_mini_app_tables.ts`:

```sql
CREATE TABLE "miniAppRecent" (
  "userId" text NOT NULL,
  "miniAppId" uuid NOT NULL REFERENCES "miniApp"("id") ON DELETE CASCADE,
  "lastOpenedAt" timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY ("userId", "miniAppId")
);
CREATE INDEX "miniAppRecent_userId_lastOpened_idx" ON "miniAppRecent"("userId", "lastOpenedAt" DESC);
```

Update the `down()` to drop `miniAppRecent` before `miniApp`.

- [ ] **Step 2: Add Drizzle entry**

In `schema-login.ts`:

```ts
export const miniAppRecent = pgTable(
  'miniAppRecent',
  {
    userId: text('userId').notNull(),
    miniAppId: uuid('miniAppId')
      .notNull()
      .references(() => miniApp.id, { onDelete: 'cascade' }),
    lastOpenedAt: timestamp('lastOpenedAt', { mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.miniAppId] }),
    index('miniAppRecent_userId_lastOpened_idx').on(table.userId, table.lastOpenedAt),
  ],
)
```

- [ ] **Step 3: Add service methods**

In `apps/server/src/services/mini-app.ts`:

```ts
import { miniAppRecent } from '@vine/db/schema-login'

async function recordRecent(input: { userId: string; miniAppId: string }) {
  await db
    .insert(miniAppRecent)
    .values({
      userId: input.userId,
      miniAppId: input.miniAppId,
      lastOpenedAt: new Date().toISOString(),
    })
    .onConflictDoUpdate({
      target: [miniAppRecent.userId, miniAppRecent.miniAppId],
      set: { lastOpenedAt: new Date().toISOString() },
    })
}

async function listRecent(userId: string, limit = 12) {
  const rows = await db
    .select({ miniApp })
    .from(miniAppRecent)
    .innerJoin(miniApp, eq(miniApp.id, miniAppRecent.miniAppId))
    .where(and(eq(miniAppRecent.userId, userId), eq(miniApp.isPublished, true)))
    .orderBy(desc(miniAppRecent.lastOpenedAt))
    .limit(limit)
  return rows.map((r) => r.miniApp)
}

async function listForUserOas(userId: string, excludeMiniAppIds: string[] = []) {
  const rows = await db
    .select({ miniApp })
    .from(miniAppOaLink)
    .innerJoin(miniApp, eq(miniApp.id, miniAppOaLink.miniAppId))
    .innerJoin(oaFriendship, eq(oaFriendship.oaId, miniAppOaLink.oaId))
    .where(
      and(
        eq(oaFriendship.userId, userId),
        eq(oaFriendship.status, 'friend'),
        eq(miniApp.isPublished, true),
        excludeMiniAppIds.length
          ? sql`${miniApp.id} NOT IN ${excludeMiniAppIds}`
          : sql`TRUE`,
      ),
    )
  return rows.map((r) => r.miniApp)
}

// Add to the returned object
return {
  // ...
  recordRecent,
  listRecent,
  listForUserOas,
}
```

(Add necessary imports: `oaFriendship` from `@vine/db/schema-oa`, `miniAppRecent`.)

- [ ] **Step 4: Wire recording into the public metadata endpoint**

Modify `apps/server/src/plugins/mini-app-public.ts` to record recents when the request includes a Vine session:

```ts
import { getAuthDataFromRequest } from '@take-out/better-auth-utils/server'
import { toWebRequest } from '../utils'

// In the GET handler, after a successful 200 response:
const webReq = toWebRequest(request)
const authData = await getAuthDataFromRequest(deps.auth, webReq)
if (authData?.id && m.isPublished) {
  await deps.miniApp.recordRecent({ userId: authData.id, miniAppId })
}
```

(Add `auth` to `MiniAppPublicDeps`. Update wiring in `index.ts`.)

- [ ] **Step 5: Run migration and tests**

```bash
bun run --cwd packages/db migrate:up
bun run --cwd apps/server test mini-app-public mini-app
```

Expected: migration up; tests still pass.

- [ ] **Step 6: Commit**

```bash
git add packages/db/src/migrations/20260505000001_mini_app_tables.ts \
        packages/db/src/schema-login.ts \
        apps/server/src/services/mini-app.ts \
        apps/server/src/plugins/mini-app-public.ts \
        apps/server/src/index.ts
git commit -m "feat(server): record mini app recents on permanent-link resolution"
```

---

# Stage 3 — Discovery

Outcome of stage: published Mini Apps surface in the user's personal gallery (Recents + From your OAs), the public directory, and OAs' linked-apps section.

## Task 3.1: Gallery RPCs

**Files:**
- Modify: `packages/proto/proto/mini-app/v1/mini-app.proto`
- Modify: `apps/server/src/connect/mini-app.ts`

- [ ] **Step 1: Extend the proto**

Append to `mini-app.proto`:

```proto
message ListPublishedRequest {
  optional string category = 1;
  optional string search_query = 2;
  optional uint32 limit = 3;
  optional uint32 offset = 4;
}
message ListPublishedResponse {
  repeated MiniApp mini_apps = 1;
  uint32 total = 2;
}

message ListMyGalleryRequest {}
message ListMyGalleryResponse {
  repeated MiniApp recents = 1;
  repeated MiniApp from_oas = 2;
}

message ListLinkedToOaRequest { string oa_id = 1; }
message ListLinkedToOaResponse { repeated MiniApp mini_apps = 1; }
```

Add to the `MiniAppService` block:

```proto
rpc ListPublished(ListPublishedRequest) returns (ListPublishedResponse);
rpc ListMyGallery(ListMyGalleryRequest) returns (ListMyGalleryResponse);
rpc ListLinkedToOa(ListLinkedToOaRequest) returns (ListLinkedToOaResponse);
```

```bash
bun run proto:generate
```

- [ ] **Step 2: Implement handlers**

Extend `apps/server/src/connect/mini-app.ts`:

```ts
async listPublished(req, ctx) {
  const limit = Math.min(Math.max(req.limit ?? 50, 1), 100)
  const offset = req.offset ?? 0
  const rows = await deps.miniApp.listPublished({
    category: req.category || undefined,
    searchQuery: req.searchQuery || undefined,
    limit,
    offset,
  })
  const protoRows = await Promise.all(rows.items.map((r) => toProtoMiniApp(deps, r)))
  return { miniApps: protoRows, total: rows.total }
},

async listMyGallery(_req, ctx) {
  const auth = requireAuthData(ctx)
  const recents = await deps.miniApp.listRecent(auth.id, 12)
  const recentIds = recents.map((m) => m.id)
  const fromOas = await deps.miniApp.listForUserOas(auth.id, recentIds)
  return {
    recents: await Promise.all(recents.map((r) => toProtoMiniApp(deps, r))),
    fromOas: await Promise.all(fromOas.map((r) => toProtoMiniApp(deps, r))),
  }
},

async listLinkedToOa(req, ctx) {
  if (!req.oaId) throw new ConnectError('oaId required', Code.InvalidArgument)
  const rows = await deps.miniApp.listMiniAppsLinkedToOa(req.oaId)
  const published = rows.filter((r) => r.isPublished)
  return {
    miniApps: await Promise.all(published.map((r) => toProtoMiniApp(deps, r))),
  }
},
```

- [ ] **Step 3: Add `listPublished` to the service factory**

In `apps/server/src/services/mini-app.ts`:

```ts
import { ilike, or } from 'drizzle-orm'

async function listPublished(input: {
  category?: string
  searchQuery?: string
  limit: number
  offset: number
}) {
  const where = and(
    eq(miniApp.isPublished, true),
    input.category ? eq(miniApp.category, input.category) : sql`TRUE`,
    input.searchQuery
      ? or(
          ilike(miniApp.name, `%${input.searchQuery}%`),
          ilike(miniApp.description, `%${input.searchQuery}%`),
        )
      : sql`TRUE`,
  )
  const items = await db
    .select()
    .from(miniApp)
    .where(where)
    .orderBy(desc(miniApp.publishedAt))
    .limit(input.limit)
    .offset(input.offset)
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(miniApp)
    .where(where)
  return { items, total: count }
}

return { /* ... */ listPublished }
```

- [ ] **Step 4: Type-check + commit**

```bash
bun run check:all
git add packages/proto apps/server/src/connect/mini-app.ts apps/server/src/services/mini-app.ts
git commit -m "feat(server): mini app gallery and directory RPCs"
```

---

## Task 3.2: Personal gallery — Recents + From your OAs

**Files:**
- Create: `apps/web/app/(app)/home/(tabs)/main/mini-apps/index.tsx`

- [ ] **Step 1: Create the page**

```tsx
import { Link } from 'one'
import { useTanQuery } from '~/data/useTanQuery'
import { miniAppClient } from '~/connect/clients'
import { Heading, ScrollView, Stack, Text, XStack, YStack } from '~/interface/ui'

function Card({ m }: { m: { id: string; name: string; iconUrl?: string; category?: string } }) {
  return (
    <Link href={`/m/${m.id}`}>
      <YStack
        w={120}
        gap="$1"
        p="$2"
        br="$3"
        hoverStyle={{ bg: '$backgroundHover' }}
      >
        <Stack
          w={104}
          h={104}
          br="$3"
          ai="center"
          jc="center"
          bg="$gray3"
          overflow="hidden"
        >
          {m.iconUrl && <img src={m.iconUrl} width={104} height={104} alt={m.name} />}
        </Stack>
        <Text fontWeight="600" numberOfLines={1}>
          {m.name}
        </Text>
        {m.category && (
          <Text fontSize="$1" color="$gray10" numberOfLines={1}>
            {m.category}
          </Text>
        )}
      </YStack>
    </Link>
  )
}

export default function MiniAppsTab() {
  const gallery = useTanQuery({
    queryKey: ['miniApp.myGallery'],
    queryFn: () => miniAppClient.listMyGallery({}),
  })

  return (
    <YStack p="$3" gap="$4">
      <Heading size="$8">Mini Apps</Heading>

      <YStack gap="$2">
        <Text fontWeight="600">Recents</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <XStack gap="$2">
            {gallery.data?.recents.map((m) => <Card key={m.id} m={m} />)}
            {gallery.data?.recents.length === 0 && (
              <Text color="$gray10">No recently used Mini Apps yet.</Text>
            )}
          </XStack>
        </ScrollView>
      </YStack>

      <YStack gap="$2">
        <Text fontWeight="600">From your OAs</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <XStack gap="$2">
            {gallery.data?.fromOas.map((m) => <Card key={m.id} m={m} />)}
            {gallery.data?.fromOas.length === 0 && (
              <Text color="$gray10">
                No Mini Apps from OAs you follow yet.
              </Text>
            )}
          </XStack>
        </ScrollView>
      </YStack>

      <Link href="/mini-apps">
        <Text color="$blue10">Explore the public directory →</Text>
      </Link>
    </YStack>
  )
}
```

- [ ] **Step 2: Smoke-test**

```bash
bun run dev
```

Navigate the home tabs to find the "Mini Apps" tab. Open a Mini App, then return — it should appear in Recents.

- [ ] **Step 3: Commit**

```bash
git add "apps/web/app/(app)/home/(tabs)/main/mini-apps/index.tsx"
git commit -m "feat(web): mini app personal gallery (recents + from your OAs)"
```

---

## Task 3.3: Public directory page

**Files:**
- Create: `apps/web/app/(public)/mini-apps/index.tsx`

- [ ] **Step 1: Create the page**

```tsx
import { useState } from 'react'
import { Link } from 'one'
import { useTanQuery } from '~/data/useTanQuery'
import { miniAppClient } from '~/connect/clients'
import {
  Button,
  Heading,
  Input,
  ScrollView,
  Stack,
  Text,
  XStack,
  YStack,
} from '~/interface/ui'

export default function PublicDirectoryPage() {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<string | undefined>()
  const [offset, setOffset] = useState(0)

  const list = useTanQuery({
    queryKey: ['miniApp.listPublished', search, category, offset],
    queryFn: () =>
      miniAppClient.listPublished({
        searchQuery: search || undefined,
        category,
        limit: 50,
        offset,
      }),
  })

  const categories = ['reservation', 'queue', 'delivery', 'shopping', 'other']

  return (
    <YStack p="$4" gap="$3">
      <Heading size="$10">Mini Apps</Heading>

      <Input
        value={search}
        onChangeText={(s) => {
          setSearch(s)
          setOffset(0)
        }}
        placeholder="Search Mini Apps..."
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <XStack gap="$2">
          <Button
            theme={!category ? 'active' : undefined}
            size="$2"
            onPress={() => {
              setCategory(undefined)
              setOffset(0)
            }}
          >
            All
          </Button>
          {categories.map((c) => (
            <Button
              key={c}
              theme={category === c ? 'active' : undefined}
              size="$2"
              onPress={() => {
                setCategory(c)
                setOffset(0)
              }}
            >
              {c}
            </Button>
          ))}
        </XStack>
      </ScrollView>

      <YStack gap="$2">
        {list.data?.miniApps.map((m) => (
          <Link key={m.id} href={`/m/${m.id}`}>
            <XStack
              p="$3"
              gap="$3"
              br="$3"
              hoverStyle={{ bg: '$backgroundHover' }}
              ai="center"
            >
              <Stack
                w={56}
                h={56}
                br="$3"
                ai="center"
                jc="center"
                bg="$gray3"
                overflow="hidden"
              >
                {m.iconUrl && <img src={m.iconUrl} width={56} height={56} alt="" />}
              </Stack>
              <YStack f={1}>
                <Text fontWeight="600">{m.name}</Text>
                {m.description && (
                  <Text fontSize="$2" color="$gray10" numberOfLines={1}>
                    {m.description}
                  </Text>
                )}
                {m.category && (
                  <Text fontSize="$1" color="$gray9">
                    {m.category}
                  </Text>
                )}
              </YStack>
            </XStack>
          </Link>
        ))}
      </YStack>

      {list.data && list.data.total > offset + 50 && (
        <Button onPress={() => setOffset(offset + 50)}>Show more</Button>
      )}
    </YStack>
  )
}
```

- [ ] **Step 2: Smoke-test**

```bash
bun run dev
```

Open `/mini-apps`. Confirm published Mini Apps render, search filters work, category chips filter.

- [ ] **Step 3: Commit**

```bash
git add "apps/web/app/(public)/mini-apps/index.tsx"
git commit -m "feat(web): public mini app directory at /mini-apps"
```

---

## Task 3.4: OA-profile linked-apps section

**Files:**
- Modify: the OA profile screen (locate via `rtk grep -l "oa.*profile\|OaProfilePage" apps/web/app`)

- [ ] **Step 1: Locate and inspect the OA profile screen**

```bash
rtk grep -rln "OaProfile\|oa profile" apps/web/app
```

Open the located file (typically `apps/web/app/(app)/oa/[oaId]/index.tsx`).

- [ ] **Step 2: Add a Linked Mini Apps section**

Insert near the bottom of the profile screen (above any "Rich Menu" / similar section):

```tsx
import { useTanQuery } from '~/data/useTanQuery'
import { miniAppClient } from '~/connect/clients'

// inside the component:
const linkedApps = useTanQuery({
  queryKey: ['miniApp.linkedToOa', oaId],
  queryFn: () => miniAppClient.listLinkedToOa({ oaId }),
})

{linkedApps.data?.miniApps.length ? (
  <YStack gap="$2" mt="$3">
    <Text fontWeight="600">Mini Apps</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <XStack gap="$2">
        {linkedApps.data.miniApps.map((m) => (
          <Link key={m.id} href={`/m/${m.id}`}>
            <YStack w={120} ai="center">
              <Stack w={56} h={56} br="$3" overflow="hidden" bg="$gray3">
                {m.iconUrl && <img src={m.iconUrl} width={56} height={56} alt="" />}
              </Stack>
              <Text fontSize="$2" numberOfLines={1}>
                {m.name}
              </Text>
            </YStack>
          </Link>
        ))}
      </XStack>
    </ScrollView>
  </YStack>
) : null}
```

- [ ] **Step 3: Smoke-test**

Open an OA profile that has linked Mini Apps. Confirm they render. Open one — `/m/{id}`.

- [ ] **Step 4: Commit**

```bash
git add "<oa-profile-path>"
git commit -m "feat(web): linked mini apps section on OA profile"
```

---

## Task 3.5: OA Manager — read-only Linked Mini Apps panel

**Files:**
- Modify: the OA Manager OA detail screen (locate via `rtk grep -l "OaManager\|oa manager detail" apps/web/app`)

- [ ] **Step 1: Locate and add the panel**

Reuse the same `listLinkedToOa` data, render as a small panel showing names + counts. Add a small note: "To edit linked Mini Apps, go to the developer console for the Mini App."

- [ ] **Step 2: Commit**

```bash
git add <path>
git commit -m "feat(web): OA manager read-only linked mini apps panel"
```

---

# Stage 4 — Service Messages

Outcome of stage: a Mini App developer registers Service Message templates in the developer console, and their backend can call `POST /api/oa/v2/mini-app/notifier/send` to deliver a Flex-rendered message into the user's "Mini App 通知" chat with a footer linking to the originating Mini App. Rate limit of 5/24h per (miniAppId, userId) enforced.

## Task 4.1: Schema additions — `oa.kind`, `message.miniAppId`, `miniAppServiceMessageTemplate` + seed system OA

**Files:**
- Create: `packages/db/src/migrations/20260505000002_mini_app_service_messages.ts`
- Modify: `packages/db/src/schema-oa.ts`
- Modify: `packages/db/src/schema-public.ts`
- Modify: `packages/db/src/schema-login.ts`

- [ ] **Step 1: Write the migration**

```ts
import type { PoolClient } from 'pg'

const sql = `
ALTER TABLE "officialAccount"
  ADD COLUMN "kind" text NOT NULL DEFAULT 'user';

ALTER TABLE "message"
  ADD COLUMN "miniAppId" uuid REFERENCES "miniApp"("id") ON DELETE SET NULL;
CREATE INDEX "message_miniAppId_idx" ON "message"("miniAppId");

CREATE TABLE "miniAppServiceMessageTemplate" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "miniAppId" uuid NOT NULL REFERENCES "miniApp"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "kind" text NOT NULL,
  "languageTag" text NOT NULL,
  "flexJson" jsonb NOT NULL,
  "paramsSchema" jsonb NOT NULL,
  "useCase" text NOT NULL DEFAULT '',
  "createdAt" timestamptz DEFAULT now() NOT NULL,
  "updatedAt" timestamptz DEFAULT now() NOT NULL,
  UNIQUE("miniAppId", "name")
);
CREATE INDEX "miniAppSMT_miniAppId_idx" ON "miniAppServiceMessageTemplate"("miniAppId");

-- Seed the platform-system OA "Mini App 通知"
INSERT INTO "oaProvider" ("id", "name", "ownerId")
VALUES ('00000000-0000-0000-0000-000000000001', 'Vine Platform', 'system')
ON CONFLICT (id) DO NOTHING;

INSERT INTO "officialAccount"
  ("id", "providerId", "name", "uniqueId", "channelSecret", "kind", "status")
VALUES
  ('00000000-0000-0000-0000-000000001001',
   '00000000-0000-0000-0000-000000000001',
   'Mini App 通知', 'mini-app-notice', 'platform-system-no-secret',
   'platform_system', 'active')
ON CONFLICT (id) DO NOTHING;
`

export async function up(client: PoolClient): Promise<void> {
  await client.query(sql)
}

export async function down(client: PoolClient): Promise<void> {
  await client.query(`
    DROP TABLE IF EXISTS "miniAppServiceMessageTemplate";
    ALTER TABLE "message" DROP COLUMN IF EXISTS "miniAppId";
    ALTER TABLE "officialAccount" DROP COLUMN IF EXISTS "kind";
  `)
}
```

- [ ] **Step 2: Update Drizzle schemas**

`schema-oa.ts` — add `kind` to `officialAccount`:

```ts
kind: text('kind').notNull().default('user').$type<'user' | 'platform_system'>(),
```

`schema-public.ts` — add `miniAppId` to `message`:

```ts
miniAppId: uuid('miniAppId'),
```

`schema-login.ts` — add `miniAppServiceMessageTemplate`:

```ts
import { jsonb } from 'drizzle-orm/pg-core'

export const miniAppServiceMessageTemplate = pgTable(
  'miniAppServiceMessageTemplate',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    miniAppId: uuid('miniAppId')
      .notNull()
      .references(() => miniApp.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    kind: text('kind').notNull(),
    languageTag: text('languageTag').notNull(),
    flexJson: jsonb('flexJson').notNull(),
    paramsSchema: jsonb('paramsSchema').notNull(),
    useCase: text('useCase').notNull().default(''),
    createdAt: timestamp('createdAt', { mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp('updatedAt', { mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [index('miniAppSMT_miniAppId_idx').on(table.miniAppId)],
)
```

- [ ] **Step 3: Run migration**

```bash
bun run --cwd packages/db migrate:up
psql -c "SELECT id, name, kind FROM \"officialAccount\" WHERE kind='platform_system';"
```

Expected: one row showing the platform-system OA.

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/migrations/20260505000002_mini_app_service_messages.ts \
        packages/db/src/schema-oa.ts \
        packages/db/src/schema-public.ts \
        packages/db/src/schema-login.ts
git commit -m "feat(db): mini app service messages schema + seeded platform-system OA"
```

---

## Task 4.2: Update Zero schema for `message.miniAppId`

**Files:**
- Modify: `packages/zero-schema/src/models/message.ts`

- [ ] **Step 1: Add `miniAppId` to the Zero message model**

Modify the columns block:

```ts
export const schema = table('message')
  .columns({
    id: string(),
    chatId: string(),
    senderId: string().optional(),
    senderType: string(),
    type: string(),
    text: string().optional(),
    metadata: string().optional(),
    replyToMessageId: string().optional(),
    createdAt: number(),
    oaId: string().optional(),
    miniAppId: string().optional(),
  })
  .primaryKey('id')
```

- [ ] **Step 2: Regenerate Zero schema**

Per the `zero-schema-migration` skill, run:

```bash
bun run --cwd packages/zero-schema generate
```

Expected: regenerated `tables.ts`, `models.ts`, `syncedQueries.ts`, `syncedMutations.ts` reflect the new column.

- [ ] **Step 3: Rebuild Zero publication**

Per `zero-schema-migration`, follow the publication rebuild step (typically `bun run --cwd packages/zero-schema rebuild-publication` or equivalent — exact command per the skill).

- [ ] **Step 4: Commit**

```bash
git add packages/zero-schema
git commit -m "feat(zero): add miniAppId to message model"
```

---

## Task 4.3: Service template service factory + tests

**Files:**
- Create: `apps/server/src/services/mini-app-service-message-templates.ts`
- Test: `apps/server/src/services/mini-app-service-message-templates.test.ts`

- [ ] **Step 1: Write tests**

```ts
import { describe, expect, it, vi } from 'vitest'
import { createMiniAppTemplateService, BUILTIN_TEMPLATE_KINDS } from './mini-app-service-message-templates'

describe('createMiniAppTemplateService', () => {
  it('caps templates per mini app at 20', async () => {
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(new Array(20).fill({ id: 'x' })),
        }),
      }),
      insert: vi.fn(),
    }
    const svc = createMiniAppTemplateService({ db: db as any })
    await expect(
      svc.createTemplate({
        miniAppId: 'ma-1',
        kind: 'reservation_confirmation',
        languageTag: 'en',
        flexJson: { type: 'bubble' },
        paramsSchema: [],
        useCase: 'test',
        name: 'reservation_confirmation_en',
      }),
    ).rejects.toThrow(/maximum 20/)
  })

  it('exposes 5 builtin kinds', () => {
    expect(BUILTIN_TEMPLATE_KINDS).toEqual([
      'reservation_confirmation',
      'queue_position',
      'delivery_update',
      'generic_notification',
      'custom_flex',
    ])
  })
})
```

- [ ] **Step 2: Implement service**

```ts
import { and, eq } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { schema } from '@vine/db'
import { miniAppServiceMessageTemplate } from '@vine/db/schema-login'

export const BUILTIN_TEMPLATE_KINDS = [
  'reservation_confirmation',
  'queue_position',
  'delivery_update',
  'generic_notification',
  'custom_flex',
] as const

export type TemplateKind = (typeof BUILTIN_TEMPLATE_KINDS)[number]

type Deps = { db: NodePgDatabase<typeof schema> }

export type ParamSpec = {
  name: string
  required: boolean
  kind: 'text' | 'uri'
  recommended?: number
  soft?: number
  hard?: number
}

export const BUILTIN_DEFAULTS: Record<
  TemplateKind,
  { flexJson: unknown; paramsSchema: ParamSpec[] }
> = {
  reservation_confirmation: {
    flexJson: { type: 'bubble', body: { type: 'box', layout: 'vertical', contents: [] } },
    paramsSchema: [
      { name: 'title', required: true, kind: 'text', recommended: 10, soft: 36, hard: 50 },
      { name: 'date', required: true, kind: 'text' },
      { name: 'button_uri_1', required: true, kind: 'uri' },
    ],
  },
  queue_position: {
    flexJson: { type: 'bubble', body: { type: 'box', layout: 'vertical', contents: [] } },
    paramsSchema: [
      { name: 'position', required: true, kind: 'text' },
      { name: 'button_uri_1', required: true, kind: 'uri' },
    ],
  },
  delivery_update: {
    flexJson: { type: 'bubble', body: { type: 'box', layout: 'vertical', contents: [] } },
    paramsSchema: [
      { name: 'status', required: true, kind: 'text' },
      { name: 'button_uri_1', required: true, kind: 'uri' },
    ],
  },
  generic_notification: {
    flexJson: { type: 'bubble', body: { type: 'box', layout: 'vertical', contents: [] } },
    paramsSchema: [
      { name: 'title', required: true, kind: 'text' },
      { name: 'body', required: true, kind: 'text' },
      { name: 'button_uri_1', required: false, kind: 'uri' },
    ],
  },
  custom_flex: {
    flexJson: { type: 'bubble' },
    paramsSchema: [],
  },
}

export function createMiniAppTemplateService(deps: Deps) {
  const { db } = deps

  async function listTemplates(miniAppId: string) {
    return db
      .select()
      .from(miniAppServiceMessageTemplate)
      .where(eq(miniAppServiceMessageTemplate.miniAppId, miniAppId))
  }

  async function createTemplate(input: {
    miniAppId: string
    kind: string
    name: string
    languageTag: string
    flexJson: unknown
    paramsSchema: ParamSpec[]
    useCase: string
  }) {
    if (!BUILTIN_TEMPLATE_KINDS.includes(input.kind as TemplateKind)) {
      throw new Error(`Unknown template kind: ${input.kind}`)
    }
    const existing = await db
      .select()
      .from(miniAppServiceMessageTemplate)
      .where(eq(miniAppServiceMessageTemplate.miniAppId, input.miniAppId))
    if (existing.length >= 20) {
      throw new Error('A Mini App can have a maximum 20 templates')
    }
    const [row] = await db
      .insert(miniAppServiceMessageTemplate)
      .values({
        miniAppId: input.miniAppId,
        kind: input.kind,
        name: input.name,
        languageTag: input.languageTag,
        flexJson: input.flexJson,
        paramsSchema: input.paramsSchema,
        useCase: input.useCase,
      })
      .returning()
    return row
  }

  async function getTemplate(id: string) {
    const [row] = await db
      .select()
      .from(miniAppServiceMessageTemplate)
      .where(eq(miniAppServiceMessageTemplate.id, id))
      .limit(1)
    return row ?? null
  }

  async function getTemplateByName(miniAppId: string, name: string) {
    const [row] = await db
      .select()
      .from(miniAppServiceMessageTemplate)
      .where(
        and(
          eq(miniAppServiceMessageTemplate.miniAppId, miniAppId),
          eq(miniAppServiceMessageTemplate.name, name),
        ),
      )
      .limit(1)
    return row ?? null
  }

  async function updateTemplate(
    id: string,
    input: {
      languageTag?: string
      flexJson?: unknown
      paramsSchema?: ParamSpec[]
      useCase?: string
    },
  ) {
    const [row] = await db
      .update(miniAppServiceMessageTemplate)
      .set({
        ...(input.languageTag !== undefined && { languageTag: input.languageTag }),
        ...(input.flexJson !== undefined && { flexJson: input.flexJson }),
        ...(input.paramsSchema !== undefined && { paramsSchema: input.paramsSchema }),
        ...(input.useCase !== undefined && { useCase: input.useCase }),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(miniAppServiceMessageTemplate.id, id))
      .returning()
    return row ?? null
  }

  async function deleteTemplate(id: string) {
    await db
      .delete(miniAppServiceMessageTemplate)
      .where(eq(miniAppServiceMessageTemplate.id, id))
  }

  return {
    listTemplates,
    createTemplate,
    getTemplate,
    getTemplateByName,
    updateTemplate,
    deleteTemplate,
  }
}
```

- [ ] **Step 3: Run tests**

```bash
bun run --cwd apps/server test mini-app-service-message-templates
```

Expected: 2 tests PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/services/mini-app-service-message-templates.ts \
        apps/server/src/services/mini-app-service-message-templates.test.ts
git commit -m "feat(server): mini app service-message template service"
```

---

## Task 4.4: Service-Message renderer + send service

**Files:**
- Create: `apps/server/src/services/mini-app-service-message.ts`
- Test: `apps/server/src/services/mini-app-service-message.test.ts`

- [ ] **Step 1: Write tests**

```ts
import { describe, expect, it, vi } from 'vitest'
import {
  renderTemplate,
  validateParams,
  RateLimitError,
  TemplateValidationError,
} from './mini-app-service-message'

describe('mini-app service message renderer', () => {
  it('substitutes ${name} placeholders', () => {
    const out = renderTemplate(
      { type: 'bubble', body: { type: 'text', text: 'Hello ${name}' } },
      { name: 'Noah' },
    )
    expect(out).toEqual({
      type: 'bubble',
      body: { type: 'text', text: 'Hello Noah' },
    })
  })

  it('rejects missing required params', () => {
    expect(() =>
      validateParams(
        [{ name: 'title', required: true, kind: 'text' }],
        {},
      ),
    ).toThrowError(TemplateValidationError)
  })

  it('hard-cap fails when text exceeds limit', () => {
    expect(() =>
      validateParams(
        [{ name: 'x', required: true, kind: 'text', hard: 5 }],
        { x: '123456' },
      ),
    ).toThrowError(/hard limit/)
  })

  it('rejects non-https uri params', () => {
    expect(() =>
      validateParams(
        [{ name: 'u', required: true, kind: 'uri' }],
        { u: 'javascript:alert(1)' },
      ),
    ).toThrowError(/uri/i)
  })
})
```

- [ ] **Step 2: Implement renderer + send orchestrator**

```ts
import { and, eq, gt, sql } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { randomUUID } from 'crypto'
import type { schema } from '@vine/db'
import { message, chat, chatMember } from '@vine/db/schema-public'
import { officialAccount, oaFriendship } from '@vine/db/schema-oa'
import type { ParamSpec } from './mini-app-service-message-templates'

export class TemplateValidationError extends Error {
  constructor(msg: string) {
    super(msg)
    this.name = 'TemplateValidationError'
  }
}

export class RateLimitError extends Error {
  constructor(public retryAfterSec: number) {
    super('rate limit exceeded')
    this.name = 'RateLimitError'
  }
}

export class MiniAppNotPublishedError extends Error {
  constructor() {
    super('Mini App is not published')
    this.name = 'MiniAppNotPublishedError'
  }
}

export function validateParams(
  schemaList: ParamSpec[],
  params: Record<string, unknown>,
): void {
  for (const spec of schemaList) {
    const v = params[spec.name]
    if (spec.required && (v == null || v === '')) {
      throw new TemplateValidationError(`Missing required param: ${spec.name}`)
    }
    if (v != null) {
      if (spec.kind === 'text') {
        if (typeof v !== 'string') {
          throw new TemplateValidationError(`Param ${spec.name} must be text`)
        }
        if (spec.hard && v.length > spec.hard) {
          throw new TemplateValidationError(
            `Param ${spec.name} exceeds hard limit (${spec.hard})`,
          )
        }
      } else if (spec.kind === 'uri') {
        if (typeof v !== 'string') {
          throw new TemplateValidationError(`Param ${spec.name} must be a uri string`)
        }
        if (!/^https:\/\//.test(v)) {
          throw new TemplateValidationError(
            `Param ${spec.name} must be an https URI`,
          )
        }
      }
    }
  }
}

function deepReplace(node: unknown, params: Record<string, unknown>): unknown {
  if (typeof node === 'string') {
    return node.replace(/\$\{([a-zA-Z0-9_]+)\}/g, (_, key) => {
      const v = params[key]
      return v == null ? '' : String(v)
    })
  }
  if (Array.isArray(node)) return node.map((n) => deepReplace(n, params))
  if (node && typeof node === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(node)) out[k] = deepReplace(v, params)
    return out
  }
  return node
}

export function renderTemplate(flexJson: unknown, params: Record<string, unknown>): unknown {
  return deepReplace(flexJson, params)
}

export const SYSTEM_OA_ID = '00000000-0000-0000-0000-000000001001'

type Deps = { db: NodePgDatabase<typeof schema> }

export function createMiniAppServiceMessageService(deps: Deps) {
  const { db } = deps

  async function ensureFriendshipAndChat(userId: string): Promise<{ chatId: string }> {
    // Auto-friend the user with the system OA if not already
    const [friend] = await db
      .select()
      .from(oaFriendship)
      .where(and(eq(oaFriendship.oaId, SYSTEM_OA_ID), eq(oaFriendship.userId, userId)))
      .limit(1)
    if (!friend) {
      await db.insert(oaFriendship).values({
        oaId: SYSTEM_OA_ID,
        userId,
        status: 'friend',
      })
    }
    // Resolve or create the OA→user chat
    const [existing] = await db
      .select({ id: chat.id })
      .from(chat)
      .innerJoin(chatMember, eq(chatMember.chatId, chat.id))
      .where(
        and(
          eq(chat.type, 'oa'),
          eq(chat.oaId, SYSTEM_OA_ID),
          eq(chatMember.userId, userId),
        ),
      )
      .limit(1)
    if (existing?.id) return { chatId: existing.id }

    const newChatId = randomUUID()
    const now = Date.now()
    await db.insert(chat).values({
      id: newChatId,
      type: 'oa',
      oaId: SYSTEM_OA_ID,
      createdAt: new Date(now).toISOString(),
    })
    await db.insert(chatMember).values({
      chatId: newChatId,
      userId,
      status: 'accepted',
      createdAt: new Date(now).toISOString(),
    })
    return { chatId: newChatId }
  }

  async function checkRateLimit(input: {
    miniAppId: string
    userId: string
  }): Promise<void> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(message)
      .innerJoin(chatMember, eq(chatMember.chatId, message.chatId))
      .where(
        and(
          eq(message.miniAppId, input.miniAppId),
          eq(chatMember.userId, input.userId),
          gt(message.createdAt, since),
        ),
      )
    if (count >= 5) {
      throw new RateLimitError(86400)
    }
  }

  async function sendServiceMessage(input: {
    miniAppId: string
    userId: string
    flexJson: unknown
    isTest?: boolean
  }) {
    if (!input.isTest) {
      await checkRateLimit({ miniAppId: input.miniAppId, userId: input.userId })
    }
    const { chatId } = await ensureFriendshipAndChat(input.userId)
    const messageId = randomUUID()
    const now = new Date().toISOString()
    await db.insert(message).values({
      id: messageId,
      chatId,
      senderType: 'oa',
      type: 'flex',
      metadata: JSON.stringify({ flex: input.flexJson }),
      createdAt: now,
      oaId: SYSTEM_OA_ID,
      miniAppId: input.miniAppId,
    })
    return { messageId, chatId }
  }

  return { ensureFriendshipAndChat, checkRateLimit, sendServiceMessage }
}
```

- [ ] **Step 3: Run tests**

```bash
bun run --cwd apps/server test mini-app-service-message
```

Expected: 4 tests PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/services/mini-app-service-message.ts \
        apps/server/src/services/mini-app-service-message.test.ts
git commit -m "feat(server): mini app service-message renderer, validator, rate-limit, sender"
```

---

## Task 4.5: Public send endpoint `POST /api/oa/v2/mini-app/notifier/send`

**Files:**
- Create: `apps/server/src/plugins/mini-app-notifier.ts`
- Test: `apps/server/src/plugins/mini-app-notifier.test.ts`

- [ ] **Step 1: Inspect existing OA messaging access-token validation**

```bash
rtk grep -n "channelAccessToken\|oaAccessToken\|messaging api auth" apps/server/src/plugins/oa-messaging.ts | head -20
```

(Note the existing pattern for resolving an OA from a Bearer token; we'll do the same but resolve a Login Channel.)

- [ ] **Step 2: Write tests**

```ts
import { describe, expect, it, vi } from 'vitest'
import Fastify from 'fastify'
import { miniAppNotifierPlugin } from './mini-app-notifier'

function deps(overrides: Partial<any> = {}) {
  return {
    miniApp: {
      getMiniAppByLiffAppId: vi.fn(async () => ({
        id: 'ma-1',
        liffAppId: 'liff-app-1',
        isPublished: true,
      })),
      getMiniApp: vi.fn(),
      ...overrides.miniApp,
    },
    template: {
      getTemplateByName: vi.fn(async () => ({
        id: 't-1',
        miniAppId: 'ma-1',
        name: 'reservation_confirmation_en',
        kind: 'reservation_confirmation',
        languageTag: 'en',
        flexJson: { type: 'bubble', body: { type: 'text', text: 'Hi ${name}' } },
        paramsSchema: [{ name: 'name', required: true, kind: 'text' }],
        useCase: 'reservation',
      })),
      ...overrides.template,
    },
    serviceMessage: {
      sendServiceMessage: vi.fn(async () => ({ messageId: 'mid-1', chatId: 'c-1' })),
      ...overrides.serviceMessage,
    },
    auth: {
      validateLoginChannelAccessToken: vi.fn(async (t: string) =>
        t === 'good-channel-token' ? { loginChannelId: 'lc-1' } : null,
      ),
      resolveLiffAccessToken: vi.fn(async (t: string) =>
        t === 'good-liff-token'
          ? { userId: 'u-1', liffAppId: 'liff-app-1', loginChannelId: 'lc-1' }
          : null,
      ),
      ...overrides.auth,
    },
  }
}

async function build(d: any) {
  const app = Fastify()
  await app.register((i) => miniAppNotifierPlugin(i, d))
  return app
}

describe('POST /api/oa/v2/mini-app/notifier/send', () => {
  it('sends a service message on the happy path', async () => {
    const d = deps()
    const app = await build(d)
    const res = await app.inject({
      method: 'POST',
      url: '/api/oa/v2/mini-app/notifier/send',
      headers: { Authorization: 'Bearer good-channel-token' },
      payload: {
        liffAccessToken: 'good-liff-token',
        templateName: 'reservation_confirmation_en',
        params: { name: 'Noah' },
      },
    })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toEqual({ status: 'sent', messageId: 'mid-1' })
    await app.close()
  })

  it('401 on bad channel token', async () => {
    const d = deps()
    const app = await build(d)
    const res = await app.inject({
      method: 'POST',
      url: '/api/oa/v2/mini-app/notifier/send',
      headers: { Authorization: 'Bearer bad' },
      payload: {
        liffAccessToken: 'good-liff-token',
        templateName: 'reservation_confirmation_en',
        params: { name: 'x' },
      },
    })
    expect(res.statusCode).toBe(401)
    await app.close()
  })

  it('403 when mini app not published', async () => {
    const d = deps({
      miniApp: {
        getMiniAppByLiffAppId: vi.fn(async () => ({
          id: 'ma-1',
          liffAppId: 'liff-app-1',
          isPublished: false,
        })),
      },
    })
    const app = await build(d)
    const res = await app.inject({
      method: 'POST',
      url: '/api/oa/v2/mini-app/notifier/send',
      headers: { Authorization: 'Bearer good-channel-token' },
      payload: {
        liffAccessToken: 'good-liff-token',
        templateName: 'reservation_confirmation_en',
        params: { name: 'x' },
      },
    })
    expect(res.statusCode).toBe(403)
    await app.close()
  })

  it('422 on missing required param', async () => {
    const d = deps()
    const app = await build(d)
    const res = await app.inject({
      method: 'POST',
      url: '/api/oa/v2/mini-app/notifier/send',
      headers: { Authorization: 'Bearer good-channel-token' },
      payload: {
        liffAccessToken: 'good-liff-token',
        templateName: 'reservation_confirmation_en',
        params: {},
      },
    })
    expect(res.statusCode).toBe(422)
    await app.close()
  })
})
```

- [ ] **Step 3: Implement plugin**

```ts
import type { FastifyInstance } from 'fastify'
import {
  TemplateValidationError,
  RateLimitError,
  validateParams,
  renderTemplate,
} from '../services/mini-app-service-message'
import type { createMiniAppService } from '../services/mini-app'
import type { createMiniAppTemplateService } from '../services/mini-app-service-message-templates'
import type { createMiniAppServiceMessageService } from '../services/mini-app-service-message'

type Deps = {
  miniApp: ReturnType<typeof createMiniAppService>
  template: ReturnType<typeof createMiniAppTemplateService>
  serviceMessage: ReturnType<typeof createMiniAppServiceMessageService>
  auth: {
    validateLoginChannelAccessToken: (
      token: string,
    ) => Promise<{ loginChannelId: string } | null>
    resolveLiffAccessToken: (
      token: string,
    ) => Promise<{ userId: string; liffAppId: string; loginChannelId: string } | null>
  }
}

type Body = { liffAccessToken: string; templateName: string; params: Record<string, unknown> }

export async function miniAppNotifierPlugin(app: FastifyInstance, deps: Deps): Promise<void> {
  app.post<{ Body: Body }>('/api/oa/v2/mini-app/notifier/send', async (request, reply) => {
    const authHeader = request.headers.authorization ?? ''
    const channelToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
    const channel = channelToken
      ? await deps.auth.validateLoginChannelAccessToken(channelToken)
      : null
    if (!channel) {
      return reply.status(401).send({ error: 'Invalid or missing Login Channel access token' })
    }

    // Resolve the LIFF access token first — it encodes which LIFF app the
    // request is targeting. This is robust even when multiple LIFF apps live
    // under the same Login Channel.
    const liffCtx = await deps.auth.resolveLiffAccessToken(request.body.liffAccessToken)
    if (!liffCtx) {
      return reply.status(401).send({ error: 'Invalid LIFF access token' })
    }

    const m = await deps.miniApp.getMiniAppByLiffAppId(liffCtx.liffAppId)
    if (!m) {
      return reply.status(404).send({ error: 'No Mini App wraps this LIFF app' })
    }

    // Verify the LIFF app's Login Channel matches the channel access token.
    if (liffCtx.loginChannelId !== channel.loginChannelId) {
      return reply
        .status(403)
        .send({ error: 'Channel access token does not match this Mini App' })
    }

    if (!m.isPublished) {
      return reply.status(403).send({ error: 'Mini App is not published' })
    }

    const tpl = await deps.template.getTemplateByName(m.id, request.body.templateName)
    if (!tpl) {
      return reply.status(404).send({ error: 'Template not found for this Mini App' })
    }

    try {
      validateParams(tpl.paramsSchema as any, request.body.params)
    } catch (e) {
      if (e instanceof TemplateValidationError) {
        return reply.status(422).send({ error: e.message })
      }
      throw e
    }

    const rendered = renderTemplate(tpl.flexJson, request.body.params)

    try {
      const result = await deps.serviceMessage.sendServiceMessage({
        miniAppId: m.id,
        userId: liffCtx.userId,
        flexJson: rendered,
      })
      return reply.send({ status: 'sent', messageId: result.messageId })
    } catch (e) {
      if (e instanceof RateLimitError) {
        return reply
          .status(429)
          .send({ error: 'Rate limit exceeded', retryAfterSec: e.retryAfterSec })
      }
      throw e
    }
  })
}
```

- [ ] **Step 3.5: Add `resolveAccessTokenAny` helper to `liff-runtime-token`**

The existing `resolveAccessToken(token, liffId)` requires the caller to know the LIFF ID upfront. The notifier flow needs to decode the token *before* it knows which LIFF app the request is for. Add a sibling helper:

Modify `apps/server/src/services/liff-runtime-token.ts` — add to the returned object:

```ts
function resolveAccessTokenAny(token: string): LiffAccessTokenContext | null {
  const ctx = verify<LiffAccessTokenContext>(token, secret)
  if (!ctx) return null
  if (ctx.kind !== 'access') return null
  if (ctx.exp < now()) return null
  return ctx
}

return { createAccessToken, resolveAccessToken, resolveAccessTokenAny, createLaunchToken, resolveLaunchToken }
```

Add a unit test in `apps/server/src/services/liff-runtime-token.test.ts`:

```ts
it('resolveAccessTokenAny decodes a valid token without requiring liffId', () => {
  const svc = createLiffRuntimeTokenService({ secret: 'x' })
  const token = svc.createAccessToken({
    liffId: 'l-1',
    userId: 'u-1',
    scopes: [],
  })
  const ctx = svc.resolveAccessTokenAny(token)
  expect(ctx?.liffId).toBe('l-1')
  expect(ctx?.userId).toBe('u-1')
})
```

- [ ] **Step 4: Adapt existing token validators**

Wire `auth.validateLoginChannelAccessToken` and `auth.resolveLiffAccessToken` to the existing implementations:

```ts
// apps/server/src/index.ts
import { liffRuntimeToken } from './services/liff-runtime-token'
import { resolveLoginChannelAccessToken } from './services/oa-messaging' // existing

const auth = {
  validateLoginChannelAccessToken: async (token: string) => {
    // Existing OA Messaging API resolves OA channel access tokens; reuse the same
    // mechanism but project to loginChannel via oaLiffApp.loginChannelId.
    return resolveLoginChannelAccessToken(token)
  },
  resolveLiffAccessToken: async (token: string) => {
    // The existing M4 helper validates the token and returns liffId + userId.
    // Map liffId → liffApp row (which has loginChannelId + db id).
    const ctx = liffRuntimeToken.resolveAccessTokenAny(token)
    if (!ctx) return null
    const app = await liff.getLiffApp(ctx.liffId)
    if (!app) return null
    return {
      userId: ctx.userId,
      liffAppId: app.id,
      loginChannelId: app.loginChannelId,
    }
  },
}

await app.register((instance) =>
  miniAppNotifierPlugin(instance, {
    miniApp,
    template: miniAppTemplate,
    serviceMessage: miniAppSvcMsg,
    auth,
  }),
)
```

(`resolveLoginChannelAccessToken` may need to be added in `oa-messaging.ts` if not already exported. If not, add a thin export that wraps the existing OA-channel-access-token validator and returns `{ loginChannelId }` instead of `{ oaId }`.)

- [ ] **Step 5: Run tests**

```bash
bun run --cwd apps/server test mini-app-notifier
```

Expected: 4 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/plugins/mini-app-notifier.ts \
        apps/server/src/plugins/mini-app-notifier.test.ts \
        apps/server/src/index.ts
git commit -m "feat(server): public mini app notifier send endpoint"
```

---

## Task 4.6: Template RPCs + `SendTestServiceMessage`

**Files:**
- Modify: `packages/proto/proto/mini-app/v1/mini-app.proto`
- Modify: `apps/server/src/connect/mini-app.ts`

- [ ] **Step 1: Extend proto**

```proto
message ParamSpec {
  string name = 1;
  bool required = 2;
  string kind = 3; // "text" | "uri"
  optional uint32 hard = 4;
}
message ServiceTemplate {
  string id = 1;
  string mini_app_id = 2;
  string name = 3;
  string kind = 4;
  string language_tag = 5;
  string flex_json = 6;
  repeated ParamSpec params_schema = 7;
  string use_case = 8;
  string created_at = 9;
  string updated_at = 10;
}

message ListServiceTemplatesRequest { string mini_app_id = 1; }
message ListServiceTemplatesResponse { repeated ServiceTemplate templates = 1; }

message CreateServiceTemplateRequest {
  string mini_app_id = 1;
  string kind = 2;
  string language_tag = 3;
  string name = 4;
  string flex_json = 5;
  repeated ParamSpec params_schema = 6;
  string use_case = 7;
}
message CreateServiceTemplateResponse { ServiceTemplate template = 1; }

message UpdateServiceTemplateRequest {
  string id = 1;
  optional string flex_json = 2;
  repeated ParamSpec params_schema = 3;
  optional string use_case = 4;
  optional string language_tag = 5;
}
message UpdateServiceTemplateResponse { ServiceTemplate template = 1; }

message DeleteServiceTemplateRequest { string id = 1; }
message DeleteServiceTemplateResponse {}

message SendTestServiceMessageRequest {
  string template_id = 1;
  map<string, string> params = 2;
}
message SendTestServiceMessageResponse {
  string message_id = 1;
  string chat_id = 2;
}
```

Append to `MiniAppService`:

```proto
rpc ListServiceTemplates(ListServiceTemplatesRequest) returns (ListServiceTemplatesResponse);
rpc CreateServiceTemplate(CreateServiceTemplateRequest) returns (CreateServiceTemplateResponse);
rpc UpdateServiceTemplate(UpdateServiceTemplateRequest) returns (UpdateServiceTemplateResponse);
rpc DeleteServiceTemplate(DeleteServiceTemplateRequest) returns (DeleteServiceTemplateResponse);
rpc SendTestServiceMessage(SendTestServiceMessageRequest) returns (SendTestServiceMessageResponse);
```

```bash
bun run proto:generate
```

- [ ] **Step 2: Implement handlers**

In `apps/server/src/connect/mini-app.ts` extend `MiniAppHandlerDeps`:

```ts
type MiniAppHandlerDeps = {
  miniApp: ReturnType<typeof createMiniAppService>
  template: ReturnType<typeof createMiniAppTemplateService>
  serviceMessage: ReturnType<typeof createMiniAppServiceMessageService>
  auth: AuthServer
}
```

Add handlers:

```ts
function toProtoTemplate(row: any) {
  return {
    id: row.id,
    miniAppId: row.miniAppId,
    name: row.name,
    kind: row.kind,
    languageTag: row.languageTag,
    flexJson: JSON.stringify(row.flexJson),
    paramsSchema: row.paramsSchema,
    useCase: row.useCase,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

async listServiceTemplates(req, ctx) {
  requireAuthData(ctx)
  if (!req.miniAppId) throw new ConnectError('miniAppId required', Code.InvalidArgument)
  const rows = await deps.template.listTemplates(req.miniAppId)
  return { templates: rows.map(toProtoTemplate) }
},

async createServiceTemplate(req, ctx) {
  requireAuthData(ctx)
  if (!req.miniAppId) throw new ConnectError('miniAppId required', Code.InvalidArgument)
  if (!req.name) throw new ConnectError('name required', Code.InvalidArgument)
  if (!req.kind) throw new ConnectError('kind required', Code.InvalidArgument)
  let flex: unknown
  try { flex = JSON.parse(req.flexJson) } catch { throw new ConnectError('Invalid flexJson', Code.InvalidArgument) }
  try {
    const row = await deps.template.createTemplate({
      miniAppId: req.miniAppId,
      kind: req.kind,
      name: req.name,
      languageTag: req.languageTag || 'en',
      flexJson: flex,
      paramsSchema: req.paramsSchema as any,
      useCase: req.useCase || '',
    })
    return { template: toProtoTemplate(row) }
  } catch (e) {
    throw new ConnectError(
      e instanceof Error ? e.message : 'create failed',
      Code.InvalidArgument,
    )
  }
},

async updateServiceTemplate(req, ctx) {
  requireAuthData(ctx)
  if (!req.id) throw new ConnectError('id required', Code.InvalidArgument)
  let flex: unknown | undefined
  if (req.flexJson) {
    try { flex = JSON.parse(req.flexJson) } catch { throw new ConnectError('Invalid flexJson', Code.InvalidArgument) }
  }
  const row = await deps.template.updateTemplate(req.id, {
    flexJson: flex,
    paramsSchema: req.paramsSchema?.length ? (req.paramsSchema as any) : undefined,
    useCase: req.useCase,
    languageTag: req.languageTag,
  })
  if (!row) throw new ConnectError('Template not found', Code.NotFound)
  return { template: toProtoTemplate(row) }
},

async deleteServiceTemplate(req, ctx) {
  requireAuthData(ctx)
  if (!req.id) throw new ConnectError('id required', Code.InvalidArgument)
  await deps.template.deleteTemplate(req.id)
  return {}
},

async sendTestServiceMessage(req, ctx) {
  const auth = requireAuthData(ctx)
  if (!req.templateId) throw new ConnectError('templateId required', Code.InvalidArgument)
  const tpl = await deps.template.getTemplate(req.templateId)
  if (!tpl) throw new ConnectError('Template not found', Code.NotFound)
  const params = Object.fromEntries(req.params ?? [])
  try {
    validateParams(tpl.paramsSchema as any, params)
  } catch (e) {
    throw new ConnectError(
      e instanceof Error ? e.message : 'param validation failed',
      Code.InvalidArgument,
    )
  }
  const rendered = renderTemplate(tpl.flexJson, params) as any
  // Mark the test message visually
  if (rendered?.body?.contents) {
    rendered.body.contents.unshift({
      type: 'text',
      text: '[TEST]',
      weight: 'bold',
      color: '#FF6B6B',
    })
  }
  const out = await deps.serviceMessage.sendServiceMessage({
    miniAppId: tpl.miniAppId,
    userId: auth.id,
    flexJson: rendered,
    isTest: true,
  })
  return { messageId: out.messageId, chatId: out.chatId }
},
```

(Imports: `validateParams`, `renderTemplate` from `../services/mini-app-service-message`.)

- [ ] **Step 3: Wire new deps in routes / index**

Pass `template` and `serviceMessage` into `miniAppHandler`.

- [ ] **Step 4: Type-check + commit**

```bash
bun run check:all
git add packages/proto apps/server/src/connect/mini-app.ts apps/server/src/index.ts
git commit -m "feat(server): mini app service-template RPCs + SendTestServiceMessage"
```

---

## Task 4.7: Console — Service Message Templates tab

**Files:**
- Create: `apps/web/app/(app)/developers/console/provider/[providerId]/mini-app/[miniAppId]/service-templates.tsx`

- [ ] **Step 1: Create the page**

```tsx
import { useParams } from 'one'
import { useState } from 'react'
import { useTanQuery, useTanMutation, queryClient } from '~/data/useTanQuery'
import { miniAppClient } from '~/connect/clients'
import {
  Button,
  Heading,
  Input,
  Select,
  Stack,
  Text,
  XStack,
  YStack,
} from '~/interface/ui'
import { showToast } from '~/interface/toast'

const KINDS = [
  'reservation_confirmation',
  'queue_position',
  'delivery_update',
  'generic_notification',
  'custom_flex',
]

export default function ServiceTemplatesPage() {
  const { miniAppId } = useParams<{ miniAppId: string }>()
  const list = useTanQuery({
    queryKey: ['miniApp.templates', miniAppId],
    queryFn: () => miniAppClient.listServiceTemplates({ miniAppId }),
  })

  const [showAdd, setShowAdd] = useState(false)
  const [kind, setKind] = useState(KINDS[0])
  const [language, setLanguage] = useState('en')
  const [name, setName] = useState('')
  const [flexJson, setFlexJson] = useState('{ "type": "bubble" }')
  const [useCase, setUseCase] = useState('')

  const create = useTanMutation({
    mutationFn: () =>
      miniAppClient.createServiceTemplate({
        miniAppId,
        kind,
        languageTag: language,
        name,
        flexJson,
        paramsSchema: [],
        useCase,
      }),
    onSuccess: () => {
      showToast('Template added')
      setShowAdd(false)
      setName('')
      setUseCase('')
      queryClient.invalidateQueries({ queryKey: ['miniApp.templates', miniAppId] })
    },
    onError: (e) => showToast(`Failed: ${(e as Error).message}`),
  })

  const remove = useTanMutation({
    mutationFn: (id: string) => miniAppClient.deleteServiceTemplate({ id }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['miniApp.templates', miniAppId] }),
  })

  const test = useTanMutation({
    mutationFn: (templateId: string) =>
      miniAppClient.sendTestServiceMessage({ templateId, params: {} }),
    onSuccess: () => showToast('Test message sent — check your "Mini App 通知" chat'),
    onError: (e) => showToast(`Failed: ${(e as Error).message}`),
  })

  return (
    <YStack p="$4" gap="$4" maxWidth={720}>
      <XStack jc="space-between" ai="center">
        <Heading size="$8">Service Message Templates</Heading>
        <Button onPress={() => setShowAdd(!showAdd)}>{showAdd ? 'Cancel' : 'Add'}</Button>
      </XStack>

      {showAdd && (
        <YStack
          p="$3"
          br="$3"
          bw={1}
          boc="$borderColor"
          gap="$2"
        >
          <Text>Kind</Text>
          <Select value={kind} onValueChange={setKind}>
            <Select.Trigger><Select.Value /></Select.Trigger>
            <Select.Content>
              {KINDS.map((k) => (
                <Select.Item key={k} value={k}>
                  <Select.ItemText>{k}</Select.ItemText>
                </Select.Item>
              ))}
            </Select.Content>
          </Select>

          <Text>Language</Text>
          <Input value={language} onChangeText={setLanguage} placeholder="en, zh-Hant, ..." />

          <Text>Template name</Text>
          <Input
            value={name}
            onChangeText={setName}
            placeholder={`${kind}_${language}`}
          />

          <Text>Flex JSON</Text>
          <Input
            multiline
            numberOfLines={8}
            value={flexJson}
            onChangeText={setFlexJson}
          />

          <Text>Use case</Text>
          <Input value={useCase} onChangeText={setUseCase} />

          <Button
            theme="active"
            disabled={!name || create.isPending}
            onPress={() => create.mutate()}
          >
            {create.isPending ? 'Adding...' : 'Add'}
          </Button>
        </YStack>
      )}

      <YStack gap="$2">
        {list.data?.templates.map((t) => (
          <Stack
            key={t.id}
            p="$3"
            br="$3"
            bw={1}
            boc="$borderColor"
          >
            <XStack jc="space-between" ai="center">
              <YStack>
                <Text fontWeight="600">{t.name}</Text>
                <Text fontSize="$1" color="$gray10">
                  {t.kind} · {t.languageTag}
                </Text>
                {t.useCase && (
                  <Text fontSize="$2" color="$gray10">
                    {t.useCase}
                  </Text>
                )}
              </YStack>
              <XStack gap="$2">
                <Button size="$2" onPress={() => test.mutate(t.id)}>
                  Send test
                </Button>
                <Button
                  size="$2"
                  theme="red"
                  onPress={() => remove.mutate(t.id)}
                >
                  Delete
                </Button>
              </XStack>
            </XStack>
          </Stack>
        ))}
        {list.data?.templates.length === 0 && (
          <Text color="$gray10">No templates yet.</Text>
        )}
      </YStack>
    </YStack>
  )
}
```

- [ ] **Step 2: Smoke-test**

Open the page, add a template, click "Send test" — message arrives in your "Mini App 通知" chat.

- [ ] **Step 3: Commit**

```bash
git add "apps/web/app/(app)/developers/console/provider/[providerId]/mini-app/[miniAppId]/service-templates.tsx"
git commit -m "feat(web): mini app service template management page"
```

---

## Task 4.8: Chat renderer — Service Message footer

**Files:**
- Modify: existing chat message bubble factory (locate via `rtk grep -rln "MessageBubbleFactory\|FlexBubble" apps/web/src/chat`)

- [ ] **Step 1: Locate the factory**

```bash
rtk grep -rln "MessageBubbleFactory\|renderFlex" apps/web/src apps/web/app | head -5
```

Open the file. Note how it dispatches by `message.type`.

- [ ] **Step 2: Add footer rendering**

In the factory, after rendering the Flex bubble, when `message.miniAppId` is non-null, append:

```tsx
import { useTanQuery } from '~/data/useTanQuery'
import { miniAppClient } from '~/connect/clients'
import { Link } from 'one'

function ServiceMessageFooter({ miniAppId }: { miniAppId: string }) {
  const meta = useTanQuery({
    queryKey: ['miniApp.publicMeta', miniAppId],
    queryFn: async () => {
      const r = await fetch(`/api/liff/v1/mini-app/${miniAppId}`)
      if (!r.ok) return null
      return (await r.json()) as { id: string; name: string; iconUrl: string | null }
    },
  })
  if (!meta.data) return null
  return (
    <Link href={`/m/${miniAppId}`}>
      <XStack
        ai="center"
        gap="$2"
        p="$2"
        bg="$gray2"
        br="$2"
        mt="$1"
      >
        {meta.data.iconUrl && (
          <Stack w={20} h={20} br="$1" overflow="hidden">
            <img src={meta.data.iconUrl} width={20} height={20} alt="" />
          </Stack>
        )}
        <Text fontSize="$2" color="$gray11" numberOfLines={1}>
          {meta.data.name}
        </Text>
      </XStack>
    </Link>
  )
}

// Inside the bubble factory, after the rendered flex content:
{message.miniAppId && <ServiceMessageFooter miniAppId={message.miniAppId} />}
```

- [ ] **Step 3: Smoke-test**

```bash
bun run dev
```

Trigger a test send (Task 4.7) → open the "Mini App 通知" chat → verify footer renders → tap → opens `/m/{miniAppId}`.

- [ ] **Step 4: Commit**

```bash
git add <factory-path>
git commit -m "feat(chat): service message footer linking to originating mini app"
```

---

## Task 4.9: Integration test — end-to-end Service Message

**Files:**
- Modify: `scripts/integration.ts`

- [ ] **Step 1: Locate the existing LIFF integration scenarios**

```bash
rtk grep -n "LIFF\|liff fixture" scripts/integration.ts | head -10
```

- [ ] **Step 2: Add an end-to-end Mini App / Service-Message scenario**

Add a scenario:

```ts
// 1. Create provider, login channel, LIFF app, mini app, publish, link OA.
// 2. Add a `reservation_confirmation_en` template via the RPC.
// 3. Issue Login Channel access token, LIFF access token.
// 4. POST /api/oa/v2/mini-app/notifier/send with valid tokens + params.
// 5. Assert 200 { status: 'sent', messageId }.
// 6. Query Zero / DB for the message — assert it lives in the user's chat with
//    miniAppId set and senderOaKind = 'platform_system'.
// 7. Repeat send 5 more times within 24h — 6th attempt returns 429.
```

(Use the existing helpers in `scripts/integration.ts` — these are already established by M1 / M4 integration tests.)

- [ ] **Step 3: Run integration suite**

```bash
bun scripts/integration.ts
```

Expected: all scenarios PASS, including the new Mini App E2E.

- [ ] **Step 4: Commit**

```bash
git add scripts/integration.ts
git commit -m "test(integration): end-to-end mini app service message flow"
```

---

## Task 4.10: Acceptance & docs

**Files:**
- Modify: `ROADMAP.md`
- Modify: `docs/messaging-api-vine.md` (add a Service Messages section)

- [ ] **Step 1: Update the ROADMAP**

In `ROADMAP.md`:
- Move M5 entry from "Recommended Next Theme" candidate to "Status: complete" under Milestones.
- Make OA Manager parity the next recommended theme.

- [ ] **Step 2: Document the public Service Messages API**

Append a section to `docs/messaging-api-vine.md`:

```markdown
## Mini App Service Messages

POST /api/oa/v2/mini-app/notifier/send

Headers:
  Authorization: Bearer {loginChannelAccessToken}

Body:
  {
    "liffAccessToken": "...",
    "templateName": "reservation_confirmation_en",
    "params": { "name": "Noah", "button_uri_1": "https://..." }
  }

Responses:
  200 { "status": "sent", "messageId": "..." }
  401 invalid Login Channel access token / LIFF access token
  403 Mini App not published, template not in this Mini App, or token-channel mismatch
  404 Mini App or template not found
  422 param validation / Flex validation
  429 { "error": "...", "retryAfterSec": 86400 } — 5/24h per (miniAppId, userId)

Differences from official LINE:
- No service-notification-token chain. Each send is one-shot. Rate-limited to
  5 messages per 24 hours per (miniAppId, userId) instead of LINE's stateful
  remainingCount / 1-year session model.
- No region-specific notice chats. All Service Messages from all Mini Apps in
  the Vine instance land in a single per-user "Mini App 通知" chat.
- No verified-vs-unverified split. Any published Mini App may send Service
  Messages.
```

- [ ] **Step 3: Run all checks**

```bash
bun run check:all
bun run --cwd apps/server test
bun scripts/integration.ts
```

Expected: green across the board.

- [ ] **Step 4: Commit**

```bash
git add ROADMAP.md docs/messaging-api-vine.md
git commit -m "docs: m5 mini app platform completion"
```

---

# Final Verification

- [ ] All 4 stages green:
  - `bun run check:all` PASS
  - `bun run --cwd apps/server test` PASS
  - `bun run --cwd packages/liff test` PASS
  - `bun run --cwd packages/zero-schema test` PASS
  - `bun scripts/integration.ts` PASS

- [ ] Manual smoke checklist (against `bun run dev`):
  - Create a Mini App that wraps an existing LIFF app, set icon + name + description, publish it.
  - Open `/m/{id}` — header chrome renders with name, back, close, action button menu.
  - Action menu Share / Copy / Open external all behave as documented.
  - `/m/{id}/orders/123?ref=abc` mounts the LIFF iframe at the underlying endpoint with path/query/hash.
  - Personal gallery's "Recents" updates after opening the Mini App.
  - Linking the Mini App to an OA you follow surfaces it under "From your OAs".
  - Public directory at `/mini-apps` lists the published Mini App, search/filter work.
  - Add a service template, click "Send test" → message arrives in your "Mini App 通知" chat with footer linking to the Mini App.
  - Production send via curl: `curl -H "Authorization: Bearer <login-channel-access-token>" -d '{...}' http://localhost:3000/api/oa/v2/mini-app/notifier/send` returns `{ status: "sent" }`.
  - Sixth send within 24 h returns `429`.
  - Bare `/liff/{liffId}` route (M4 behavior) still works without chrome.
  - All M4 tests still pass.
