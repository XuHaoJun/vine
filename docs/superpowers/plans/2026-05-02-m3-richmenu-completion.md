# Milestone 3 Rich Menu Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the remaining five M3 gaps: rich menu postback dispatch, `richmenuswitch` tab switching, alias management UI, per-user rich menu UI, and per-area click insights.

**Architecture:** Two independent blocks. Block 1 (Tasks 1–5) is server+chat infrastructure with no UI. Block 2 (Tasks 6–10) is the manager UI that consumes the new RPCs. DB migration and OA service additions land first so all other tasks have a stable foundation.

**Tech Stack:** Protobuf (protoc-gen-es), ConnectRPC (`@connectrpc/connect`), Drizzle ORM, Vitest, React/Tamagui, React Query (`useTanQuery`/`useTanMutation`)

**Plan review amendments applied:** `switchRichMenu` and click tracking must validate the session user against the OA/chat before mutating or recording analytics; async webhook delivery errors should be logged, not swallowed or retried inline. Alias manager RPCs must mirror the existing Messaging API alias validation. The manager UI must preserve/create `richmenuswitch` actions, avoid bottom-of-file imports, use server-side filtering for menu-assigned users, and show click counts on area overlays as well as in the stats table.

---

## File map

**New files:**
- `packages/db/src/migrations/20260502000002_add_oa_rich_menu_click.ts`
- `apps/server/src/connect/oa-richmenu-m3.test.ts`
- `apps/server/src/services/oa-richmenu-click.int.test.ts`
- `apps/web/app/(app)/manager/[oaId]/richmenu/users.tsx`

**Modified files:**
- `packages/db/src/schema-oa.ts` — add `oaRichMenuClick` table
- `packages/proto/proto/oa/v1/oa.proto` — add 9 messages + 9 RPCs
- `packages/proto/gen/oa/v1/oa_pb.ts` — regenerated (do not hand-edit)
- `apps/server/src/services/oa.ts` — add `buildRichMenuSwitchPostbackEvent`, `isUserChatMember`, `addRichMenuClick`, `getRichMenuClickStats`, `listOAUsersWithRichMenus`
- `apps/server/src/connect/oa.ts` — add 9 new RPC handlers
- `apps/web/app/(app)/home/(tabs)/talks/[chatId].tsx` — fix postback dispatch + add richmenuswitch
- `apps/web/app/(app)/manager/[oaId]/richmenu/[richMenuId].tsx` — add Aliases + Assigned Users + Stats sections
- `apps/web/app/(app)/manager/[oaId]/richmenu/index.tsx` — add "Users" nav link
- `apps/web/src/features/oa-manager/richmenu/RichMenuEditor.tsx` — add/preserve richmenuswitch action editing and click-count overlay badges
- `apps/web/src/features/oa-manager/richmenu/AreaOverlay.tsx` — render optional click-count badge

---

## Task 1: DB migration and schema

**Files:**
- Modify: `packages/db/src/schema-oa.ts`
- Create: `packages/db/src/migrations/20260502000002_add_oa_rich_menu_click.ts`

- [ ] **Step 1: Add `oaRichMenuClick` to schema-oa.ts**

Open `packages/db/src/schema-oa.ts`. After the `oaDefaultRichMenu` block (around line 167) add:

```typescript
export const oaRichMenuClick = pgTable(
  'oaRichMenuClick',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    oaId: uuid('oaId')
      .notNull()
      .references(() => officialAccount.id, { onDelete: 'cascade' }),
    richMenuId: text('richMenuId').notNull(),
    areaIndex: integer('areaIndex').notNull(),
    clickedAt: timestamp('clickedAt', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('oaRichMenuClick_oaId_richMenuId_idx').on(table.oaId, table.richMenuId),
    index('oaRichMenuClick_oaId_clickedAt_idx').on(table.oaId, table.clickedAt),
  ],
)
```

Make sure `integer` is already imported at the top of the file. If not, add it to the drizzle-orm/pg-core import.

- [ ] **Step 2: Create migration file**

Create `packages/db/src/migrations/20260502000002_add_oa_rich_menu_click.ts`:

```typescript
import type { PoolClient } from 'pg'

const sql = `
CREATE TABLE "oaRichMenuClick" (
  "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "oaId"       UUID NOT NULL REFERENCES "officialAccount"(id) ON DELETE CASCADE,
  "richMenuId" TEXT NOT NULL,
  "areaIndex"  INTEGER NOT NULL,
  "clickedAt"  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "oaRichMenuClick_oaId_richMenuId_idx" ON "oaRichMenuClick" ("oaId", "richMenuId");
CREATE INDEX "oaRichMenuClick_oaId_clickedAt_idx"  ON "oaRichMenuClick" ("oaId", "clickedAt");
`

export async function up(client: PoolClient): Promise<void> {
  await client.query(sql)
}

export async function down(client: PoolClient): Promise<void> {
  await client.query(`DROP TABLE IF EXISTS "oaRichMenuClick";`)
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/db/src/schema-oa.ts packages/db/src/migrations/20260502000002_add_oa_rich_menu_click.ts
git commit -m "feat(db): add oaRichMenuClick table for rich menu area analytics"
```

---

## Task 2: OA service additions

**Files:**
- Modify: `apps/server/src/services/oa.ts`
- Create: `apps/server/src/services/oa-richmenu-click.int.test.ts`

- [ ] **Step 1: Add `oaRichMenuClick` and `userPublic` imports**

At the top of `apps/server/src/services/oa.ts`, extend existing imports:

```typescript
// Add oaRichMenuClick to the schema-oa import:
import {
  // ... existing imports ...
  oaRichMenuClick,
} from '@vine/db/schema-oa'

// Add userPublic to the schema-public import (line ~19):
import { chat, chatMember, message, userPublic } from '@vine/db/schema-public'
```

- [ ] **Step 2: Add `buildRichMenuSwitchPostbackEvent`**

After the existing `buildPostbackEvent` function (around line 449 in oa.ts), add:

```typescript
function buildRichMenuSwitchPostbackEvent(input: {
  oaId: string
  userId: string
  replyToken: string
  data: string
  newRichMenuAliasId: string
  status: 'SUCCESS' | 'RICHMENU_ALIAS_ID_NOTFOUND' | 'RICHMENU_NOTFOUND' | 'FAILED'
}) {
  return {
    destination: input.oaId,
    events: [
      {
        type: 'postback' as const,
        mode: 'active' as const,
        timestamp: Date.now(),
        source: { type: 'user' as const, userId: input.userId },
        webhookEventId: randomUUID(),
        deliveryContext: { isRedelivery: false },
        replyToken: input.replyToken,
        postback: {
          data: input.data,
          params: {
            newRichMenuAliasId: input.newRichMenuAliasId,
            status: input.status,
          },
        },
      },
    ],
  }
}
```

- [ ] **Step 3: Add `addRichMenuClick`**

Near the alias/user-link functions, add:

```typescript
async function addRichMenuClick(input: {
  oaId: string
  richMenuId: string
  areaIndex: number
}) {
  await db.insert(oaRichMenuClick).values({
    oaId: input.oaId,
    richMenuId: input.richMenuId,
    areaIndex: input.areaIndex,
  })
}
```

- [ ] **Step 4: Add `getRichMenuClickStats`**

```typescript
async function getRichMenuClickStats(oaId: string, richMenuId: string) {
  const rows = await db
    .select({
      areaIndex: oaRichMenuClick.areaIndex,
      clickCount: sql<number>`cast(count(*) as int)`,
    })
    .from(oaRichMenuClick)
    .where(
      and(
        eq(oaRichMenuClick.oaId, oaId),
        eq(oaRichMenuClick.richMenuId, richMenuId),
      ),
    )
    .groupBy(oaRichMenuClick.areaIndex)
  return rows
}
```

Add `sql` and `and` to the drizzle-orm import at the top if not already present.

- [ ] **Step 5: Add `isUserChatMember` and `listOAUsersWithRichMenus`**

Add a chat membership helper near the OA friendship functions. `switchRichMenu` uses this to match the existing internal postback dispatch authorization model: session-required and member-of-chat-required.

```typescript
async function isUserChatMember(userId: string, chatId: string) {
  const [member] = await db
    .select({ id: chatMember.id })
    .from(chatMember)
    .where(and(eq(chatMember.chatId, chatId), eq(chatMember.userId, userId)))
    .limit(1)
  return Boolean(member)
}
```

```typescript
async function listOAUsersWithRichMenus(input: {
  oaId: string
  richMenuId?: string | undefined
}) {
  const conditions = [eq(oaFriendship.oaId, input.oaId)]
  if (input.richMenuId) {
    conditions.push(eq(oaRichMenuUserLink.richMenuId, input.richMenuId))
  }

  return db
    .select({
      userId: oaFriendship.userId,
      userName: userPublic.name,
      userImage: userPublic.image,
      assignedRichMenuId: oaRichMenuUserLink.richMenuId,
    })
    .from(oaFriendship)
    .leftJoin(
      oaRichMenuUserLink,
      and(
        eq(oaRichMenuUserLink.oaId, oaFriendship.oaId),
        eq(oaRichMenuUserLink.userId, oaFriendship.userId),
      ),
    )
    .leftJoin(userPublic, eq(userPublic.id, oaFriendship.userId))
    .where(and(...conditions))
}
```

- [ ] **Step 6: Export the new functions**

In the `return` statement at the bottom of `createOAService` (around line 1100+), add:

```typescript
buildRichMenuSwitchPostbackEvent,
isUserChatMember,
addRichMenuClick,
getRichMenuClickStats,
listOAUsersWithRichMenus,
```

- [ ] **Step 7: Add DB integration coverage for click stats**

Create `apps/server/src/services/oa-richmenu-click.int.test.ts` to prove the migration-backed table and aggregation work with PostgreSQL:

```typescript
import { randomUUID } from 'crypto'
import { describe, expect, it } from 'vitest'
import { officialAccount, oaProvider, oaRichMenu } from '@vine/db/schema-oa'
import { withRollbackDb } from '../test/integration-db'
import { createOAService } from './oa'

describe('oa rich menu click stats', () => {
  it('records clicks and aggregates them by area', async () => {
    await withRollbackDb(async (db) => {
      const suffix = randomUUID()
      const [provider] = await db
        .insert(oaProvider)
        .values({ name: 'Provider', ownerId: 'owner-1' })
        .returning()
      const [oa] = await db
        .insert(officialAccount)
        .values({
          providerId: provider.id,
          name: 'OA',
          uniqueId: `oa-click-${suffix}`,
          channelSecret: 'secret',
        })
        .returning()
      await db.insert(oaRichMenu).values({
        oaId: oa.id,
        richMenuId: 'rm-1',
        name: 'Menu',
        chatBarText: 'Menu',
        selected: false,
        sizeWidth: 2500,
        sizeHeight: 1686,
        areas: [
          { bounds: { x: 0, y: 0, width: 100, height: 100 }, action: { type: 'message', text: 'a' } },
          { bounds: { x: 100, y: 0, width: 100, height: 100 }, action: { type: 'message', text: 'b' } },
        ],
      })

      const oaService = createOAService({ db, database: {} as any })
      await oaService.addRichMenuClick({ oaId: oa.id, richMenuId: 'rm-1', areaIndex: 0 })
      await oaService.addRichMenuClick({ oaId: oa.id, richMenuId: 'rm-1', areaIndex: 0 })
      await oaService.addRichMenuClick({ oaId: oa.id, richMenuId: 'rm-1', areaIndex: 1 })

      const stats = await oaService.getRichMenuClickStats(oa.id, 'rm-1')
      expect(stats).toEqual(
        expect.arrayContaining([
          { areaIndex: 0, clickCount: 2 },
          { areaIndex: 1, clickCount: 1 },
        ]),
      )
    })
  })
})
```

- [ ] **Step 8: Verify types compile**

```bash
bun run --cwd apps/server typecheck 2>&1 | head -30
docker compose up -d pgdb migrate
ZERO_UPSTREAM_DB=postgresql://user:password@localhost:5533/postgres bun run --cwd apps/server test:integration:db -- oa-richmenu-click
```

Expected: no new type errors and the focused DB integration test passes. If `sql` is not imported add `sql` to `import { ..., sql } from 'drizzle-orm'`.

- [ ] **Step 9: Commit**

```bash
git add apps/server/src/services/oa.ts apps/server/src/services/oa-richmenu-click.int.test.ts
git commit -m "feat(oa-service): add richmenuswitch event builder, click tracking, and user-richmenus query"
```

---

## Task 3: Proto additions and codegen

**Files:**
- Modify: `packages/proto/proto/oa/v1/oa.proto`
- Regenerate: `packages/proto/gen/oa/v1/oa_pb.ts`

- [ ] **Step 1: Add new messages to the proto file**

In `packages/proto/proto/oa/v1/oa.proto`, after the `UploadRichMenuImageResponse {}` message (around line 594), add:

```protobuf
// ── Rich Menu Switch ──

message SwitchRichMenuRequest {
  string official_account_id = 1;
  string chat_id = 2;
  string rich_menu_alias_id = 3;
  string data = 4;
}

message SwitchRichMenuResponse {
  string status = 1;
  optional string new_rich_menu_alias_id = 2;
}

// ── Rich Menu Aliases (manager) ──

message RichMenuAliasItem {
  string rich_menu_alias_id = 1;
  string rich_menu_id = 2;
  string created_at = 3;
}

message ListRichMenuAliasesRequest {
  string official_account_id = 1;
}

message ListRichMenuAliasesResponse {
  repeated RichMenuAliasItem aliases = 1;
}

message CreateRichMenuAliasRequest {
  string official_account_id = 1;
  string rich_menu_alias_id = 2;
  string rich_menu_id = 3;
}

message CreateRichMenuAliasResponse {
  RichMenuAliasItem alias = 1;
}

message DeleteRichMenuAliasManagerRequest {
  string official_account_id = 1;
  string rich_menu_alias_id = 2;
}

message DeleteRichMenuAliasManagerResponse {}

// ── Per-user Rich Menu (manager) ──

message OAUserRichMenuInfo {
  string user_id = 1;
  optional string user_name = 2;
  optional string user_image = 3;
  optional string assigned_rich_menu_id = 4;
}

message ListOAUsersWithRichMenusRequest {
  string official_account_id = 1;
  optional string rich_menu_id = 2; // when set, return only users explicitly assigned to this menu
}

message ListOAUsersWithRichMenusResponse {
  repeated OAUserRichMenuInfo users = 1;
}

message LinkRichMenuToUserManagerRequest {
  string official_account_id = 1;
  string user_id = 2;
  string rich_menu_id = 3;
}

message LinkRichMenuToUserManagerResponse {}

message UnlinkRichMenuFromUserManagerRequest {
  string official_account_id = 1;
  string user_id = 2;
}

message UnlinkRichMenuFromUserManagerResponse {}

// ── Rich Menu Click Tracking ──

message TrackRichMenuClickRequest {
  string official_account_id = 1;
  string rich_menu_id = 2;
  int32 area_index = 3;
}

message TrackRichMenuClickResponse {}

message RichMenuAreaStat {
  int32 area_index = 1;
  int32 click_count = 2;
}

message GetRichMenuStatsRequest {
  string official_account_id = 1;
  string rich_menu_id = 2;
}

message GetRichMenuStatsResponse {
  repeated RichMenuAreaStat stats = 1;
}
```

- [ ] **Step 2: Add RPCs to the service**

In the `service OAService { ... }` block, after the `UploadRichMenuImage` rpc line, add:

```protobuf
  rpc SwitchRichMenu(SwitchRichMenuRequest) returns (SwitchRichMenuResponse);
  rpc ListRichMenuAliases(ListRichMenuAliasesRequest) returns (ListRichMenuAliasesResponse);
  rpc CreateRichMenuAlias(CreateRichMenuAliasRequest) returns (CreateRichMenuAliasResponse);
  rpc DeleteRichMenuAliasManager(DeleteRichMenuAliasManagerRequest) returns (DeleteRichMenuAliasManagerResponse);
  rpc ListOAUsersWithRichMenus(ListOAUsersWithRichMenusRequest) returns (ListOAUsersWithRichMenusResponse);
  rpc LinkRichMenuToUserManager(LinkRichMenuToUserManagerRequest) returns (LinkRichMenuToUserManagerResponse);
  rpc UnlinkRichMenuFromUserManager(UnlinkRichMenuFromUserManagerRequest) returns (UnlinkRichMenuFromUserManagerResponse);
  rpc TrackRichMenuClick(TrackRichMenuClickRequest) returns (TrackRichMenuClickResponse);
  rpc GetRichMenuStats(GetRichMenuStatsRequest) returns (GetRichMenuStatsResponse);
```

- [ ] **Step 3: Regenerate**

```bash
bun run --cwd packages/proto build
```

Expected: `packages/proto/gen/oa/v1/oa_pb.ts` updated with new message types and the `OAService` definition now includes the 9 new RPCs.

- [ ] **Step 4: Commit**

```bash
git add packages/proto/proto/oa/v1/oa.proto packages/proto/gen/oa/v1/oa_pb.ts
git commit -m "feat(proto): add rich menu switch, alias, per-user, and click tracking RPCs"
```

---

## Task 4: `switchRichMenu` ConnectRPC handler + test

**Files:**
- Modify: `apps/server/src/connect/oa.ts`
- Create: `apps/server/src/connect/oa-richmenu-m3.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/server/src/connect/oa-richmenu-m3.test.ts`:

```typescript
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { Code } from '@connectrpc/connect'
import { createContextValues } from '@connectrpc/connect'
import { oaHandler } from './oa'
import { connectAuthDataKey } from './auth-context'

vi.mock('@take-out/better-auth-utils/server', () => ({
  getAuthDataFromRequest: vi.fn(),
}))

import { getAuthDataFromRequest } from '@take-out/better-auth-utils/server'
const mockedGetAuthDataFromRequest = vi.mocked(getAuthDataFromRequest)

function makeAuthCtx(userId: string) {
  const values = createContextValues()
  values.set(connectAuthDataKey, { id: userId } as any)
  return {
    values,
    signal: new AbortController().signal,
    timeoutMs: undefined,
    method: {} as any,
    service: {} as any,
    requestMethod: 'POST',
    url: new URL('http://localhost/'),
    peer: { addr: '127.0.0.1' },
    requestHeader: new Headers(),
    responseHeader: new Headers(),
    responseTrailer: new Headers(),
  } as any
}

function makeDeps(oaOverrides: Partial<Record<string, any>> = {}) {
  const oa = {
    getOfficialAccount: vi.fn().mockResolvedValue({ id: 'oa-1', providerId: 'p-1' }),
    getProvider: vi.fn().mockResolvedValue({ id: 'p-1', ownerId: 'owner-1' }),
    getRichMenuAlias: vi.fn().mockResolvedValue(null),
    getRichMenu: vi.fn().mockResolvedValue(null),
    isOAFriend: vi.fn().mockResolvedValue(true),
    isUserChatMember: vi.fn().mockResolvedValue(true),
    linkRichMenuToUser: vi.fn().mockResolvedValue(undefined),
    registerReplyToken: vi.fn().mockResolvedValue({ token: 'reply-token-1' }),
    buildRichMenuSwitchPostbackEvent: vi.fn().mockReturnValue({ destination: 'oa-1', events: [] }),
    ...oaOverrides,
  }
  const webhookDelivery = {
    deliverRealEvent: vi.fn().mockResolvedValue({ kind: 'ok' }),
    verifyWebhook: vi.fn(),
    listDeliveries: vi.fn(),
    getDelivery: vi.fn(),
    redeliver: vi.fn(),
    sendTestWebhookEvent: vi.fn(),
  }
  const capturedImpl: any = {}
  const mockRouter = {
    service: (_desc: any, impl: any) => { Object.assign(capturedImpl, impl) },
  }
  oaHandler({ oa: oa as any, auth: {} as any, drive: {} as any, webhookDelivery })(
    mockRouter as any,
  )
  return { capturedImpl, oa, webhookDelivery }
}

beforeEach(() => {
  mockedGetAuthDataFromRequest.mockReset()
})

describe('switchRichMenu', () => {
  it('returns RICHMENU_ALIAS_ID_NOTFOUND when alias does not exist', async () => {
    const { capturedImpl, oa } = makeDeps({
      getRichMenuAlias: vi.fn().mockResolvedValue(null),
    })
    const ctx = makeAuthCtx('user-1')
    const result = await capturedImpl.switchRichMenu(
      { officialAccountId: 'oa-1', chatId: 'chat-1', richMenuAliasId: 'alias-x', data: 'd' },
      ctx,
    )
    expect(result.status).toBe('RICHMENU_ALIAS_ID_NOTFOUND')
    expect(oa.linkRichMenuToUser).not.toHaveBeenCalled()
  })

  it('returns RICHMENU_NOTFOUND when richMenuId in alias does not exist', async () => {
    const { capturedImpl, oa } = makeDeps({
      getRichMenuAlias: vi.fn().mockResolvedValue({ richMenuAliasId: 'alias-a', richMenuId: 'rm-1' }),
      getRichMenu: vi.fn().mockResolvedValue(null),
    })
    const ctx = makeAuthCtx('user-1')
    const result = await capturedImpl.switchRichMenu(
      { officialAccountId: 'oa-1', chatId: 'chat-1', richMenuAliasId: 'alias-a', data: 'd' },
      ctx,
    )
    expect(result.status).toBe('RICHMENU_NOTFOUND')
    expect(oa.linkRichMenuToUser).not.toHaveBeenCalled()
  })

  it('rejects when session user is not a member of the chat', async () => {
    const { capturedImpl, oa } = makeDeps({
      isUserChatMember: vi.fn().mockResolvedValue(false),
    })
    const ctx = makeAuthCtx('user-1')
    await expect(
      capturedImpl.switchRichMenu(
        { officialAccountId: 'oa-1', chatId: 'chat-1', richMenuAliasId: 'alias-a', data: 'd' },
        ctx,
      ),
    ).rejects.toMatchObject({ code: Code.PermissionDenied })
    expect(oa.linkRichMenuToUser).not.toHaveBeenCalled()
  })

  it('links rich menu and returns SUCCESS, fires webhook async', async () => {
    const { capturedImpl, oa, webhookDelivery } = makeDeps({
      getRichMenuAlias: vi.fn().mockResolvedValue({ richMenuAliasId: 'alias-a', richMenuId: 'rm-1' }),
      getRichMenu: vi.fn().mockResolvedValue({ richMenuId: 'rm-1', name: 'Menu A' }),
    })
    const ctx = makeAuthCtx('user-1')
    const result = await capturedImpl.switchRichMenu(
      { officialAccountId: 'oa-1', chatId: 'chat-1', richMenuAliasId: 'alias-a', data: 'switch-data' },
      ctx,
    )
    expect(result.status).toBe('SUCCESS')
    expect(result.newRichMenuAliasId).toBe('alias-a')
    expect(oa.linkRichMenuToUser).toHaveBeenCalledWith('oa-1', 'user-1', 'rm-1')
    // webhook fires fire-and-forget — just verify it was called
    expect(webhookDelivery.deliverRealEvent).toHaveBeenCalled()
  })

  it('throws UNAUTHENTICATED without session', async () => {
    const { capturedImpl } = makeDeps()
    const values = createContextValues()
    const ctx = {
      values,
      signal: new AbortController().signal,
      timeoutMs: undefined,
      method: {} as any,
      service: {} as any,
      requestMethod: 'POST',
      url: new URL('http://localhost/'),
      peer: { addr: '127.0.0.1' },
      requestHeader: new Headers(),
      responseHeader: new Headers(),
      responseTrailer: new Headers(),
    } as any
    await expect(
      capturedImpl.switchRichMenu(
        { officialAccountId: 'oa-1', chatId: 'chat-1', richMenuAliasId: 'alias-a', data: 'd' },
        ctx,
      ),
    ).rejects.toMatchObject({ code: Code.Unauthenticated })
  })
})
```

- [ ] **Step 2: Run to verify tests fail**

```bash
bun run --cwd apps/server test:unit -- oa-richmenu-m3
```

Expected: 5 tests fail with "capturedImpl.switchRichMenu is not a function" or similar.

- [ ] **Step 3: Add `switchRichMenu` handler to `apps/server/src/connect/oa.ts`**

At the top of `apps/server/src/connect/oa.ts`, import the server logger:

```typescript
import { logger } from '../lib/logger'
```

Inside `oaServiceImpl` (the object passed to `withAuthService`), after the `uploadRichMenuImage` handler (around line 858), add:

```typescript
async switchRichMenu(req, ctx) {
  const auth = requireAuthData(ctx)
  const isMember = await deps.oa.isUserChatMember(auth.id, req.chatId)
  if (!isMember) {
    throw new ConnectError('Forbidden: not a member of this chat', Code.PermissionDenied)
  }
  const isFriend = await deps.oa.isOAFriend(auth.id, req.officialAccountId)
  if (!isFriend) {
    throw new ConnectError('Forbidden: not an OA friend', Code.PermissionDenied)
  }
  const alias = await deps.oa.getRichMenuAlias(req.officialAccountId, req.richMenuAliasId)
  if (!alias) {
    return { status: 'RICHMENU_ALIAS_ID_NOTFOUND' }
  }
  const menu = await deps.oa.getRichMenu(req.officialAccountId, alias.richMenuId)
  if (!menu) {
    return { status: 'RICHMENU_NOTFOUND' }
  }
  await deps.oa.linkRichMenuToUser(req.officialAccountId, auth.id, alias.richMenuId)
  // fire-and-forget webhook delivery — do not await
  deps.webhookDelivery
    .deliverRealEvent({
      oaId: req.officialAccountId,
      buildPayload: async () => {
        const replyTokenRecord = await deps.oa.registerReplyToken({
          oaId: req.officialAccountId,
          userId: auth.id,
          chatId: req.chatId,
          messageId: null,
        })
        return deps.oa.buildRichMenuSwitchPostbackEvent({
          oaId: req.officialAccountId,
          userId: auth.id,
          replyToken: replyTokenRecord.token,
          data: req.data,
          newRichMenuAliasId: req.richMenuAliasId,
          status: 'SUCCESS',
        })
      },
    })
    .catch((err) => {
      logger.error({ err, oaId: req.officialAccountId, chatId: req.chatId }, '[oa] richmenuswitch webhook delivery failed')
    })
  return { status: 'SUCCESS', newRichMenuAliasId: req.richMenuAliasId }
},
```

Do not enqueue webhook events for `RICHMENU_ALIAS_ID_NOTFOUND` or `RICHMENU_NOTFOUND`; return the status to the client and log only unexpected async delivery/build errors.

- [ ] **Step 4: Run tests to verify they pass**

```bash
bun run --cwd apps/server test:unit -- oa-richmenu-m3
```

Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/connect/oa.ts apps/server/src/connect/oa-richmenu-m3.test.ts
git commit -m "feat(connect): add switchRichMenu RPC with alias resolution and async webhook"
```

---

## Task 5: Alias CRUD, per-user, and click tracking ConnectRPC handlers

**Files:**
- Modify: `apps/server/src/connect/oa.ts`
- Modify: `apps/server/src/connect/oa-richmenu-m3.test.ts`

- [ ] **Step 1: Write failing tests for alias CRUD**

Add to `oa-richmenu-m3.test.ts` (extend `makeDeps` oa mock first):

Add to the `oa` mock inside `makeDeps`:
```typescript
getRichMenuAliasList: vi.fn().mockResolvedValue([]),
createRichMenuAlias: vi.fn().mockResolvedValue({ richMenuAliasId: 'alias-new', richMenuId: 'rm-1', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', id: 'uuid', oaId: 'oa-1' }),
deleteRichMenuAlias: vi.fn().mockResolvedValue(undefined),
unlinkRichMenuFromUser: vi.fn().mockResolvedValue(undefined),
listOAUsersWithRichMenus: vi.fn().mockResolvedValue([]),
addRichMenuClick: vi.fn().mockResolvedValue(undefined),
getRichMenuClickStats: vi.fn().mockResolvedValue([]),
isOAFriend: vi.fn().mockResolvedValue(true),
isUserChatMember: vi.fn().mockResolvedValue(true),
```

Then add test suites:

```typescript
describe('listRichMenuAliases', () => {
  it('requires OA ownership', async () => {
    const { capturedImpl, oa } = makeDeps({
      getProvider: vi.fn().mockResolvedValue({ id: 'p-1', ownerId: 'other-user' }),
    })
    const ctx = makeAuthCtx('user-1')
    await expect(
      capturedImpl.listRichMenuAliases({ officialAccountId: 'oa-1' }, ctx),
    ).rejects.toMatchObject({ code: Code.PermissionDenied })
  })

  it('returns alias list for owner', async () => {
    const { capturedImpl, oa } = makeDeps({
      getProvider: vi.fn().mockResolvedValue({ id: 'p-1', ownerId: 'user-1' }),
      getRichMenuAliasList: vi.fn().mockResolvedValue([
        { richMenuAliasId: 'alias-a', richMenuId: 'rm-1', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', id: 'u1', oaId: 'oa-1' },
      ]),
    })
    const ctx = makeAuthCtx('user-1')
    const result = await capturedImpl.listRichMenuAliases({ officialAccountId: 'oa-1' }, ctx)
    expect(result.aliases).toHaveLength(1)
    expect(result.aliases[0].richMenuAliasId).toBe('alias-a')
  })
})

describe('createRichMenuAlias', () => {
  it('creates alias and returns it', async () => {
    const { capturedImpl, oa } = makeDeps({
      getProvider: vi.fn().mockResolvedValue({ id: 'p-1', ownerId: 'user-1' }),
    })
    const ctx = makeAuthCtx('user-1')
    const result = await capturedImpl.createRichMenuAlias(
      { officialAccountId: 'oa-1', richMenuAliasId: 'alias-new', richMenuId: 'rm-1' },
      ctx,
    )
    expect(oa.createRichMenuAlias).toHaveBeenCalledWith({
      oaId: 'oa-1',
      richMenuAliasId: 'alias-new',
      richMenuId: 'rm-1',
    })
    expect(result.alias?.richMenuAliasId).toBe('alias-new')
  })

  it('rejects invalid alias format before writing', async () => {
    const { capturedImpl, oa } = makeDeps({
      getProvider: vi.fn().mockResolvedValue({ id: 'p-1', ownerId: 'user-1' }),
    })
    const ctx = makeAuthCtx('user-1')
    await expect(
      capturedImpl.createRichMenuAlias(
        { officialAccountId: 'oa-1', richMenuAliasId: 'bad alias!', richMenuId: 'rm-1' },
        ctx,
      ),
    ).rejects.toMatchObject({ code: Code.InvalidArgument })
    expect(oa.createRichMenuAlias).not.toHaveBeenCalled()
  })

  it('maps duplicate alias to ALREADY_EXISTS', async () => {
    const duplicate = Object.assign(new Error('duplicate key'), { code: '23505' })
    const { capturedImpl } = makeDeps({
      getProvider: vi.fn().mockResolvedValue({ id: 'p-1', ownerId: 'user-1' }),
      getRichMenu: vi.fn().mockResolvedValue({ richMenuId: 'rm-1', hasImage: true }),
      createRichMenuAlias: vi.fn().mockRejectedValue(duplicate),
    })
    const ctx = makeAuthCtx('user-1')
    await expect(
      capturedImpl.createRichMenuAlias(
        { officialAccountId: 'oa-1', richMenuAliasId: 'alias-new', richMenuId: 'rm-1' },
        ctx,
      ),
    ).rejects.toMatchObject({ code: Code.AlreadyExists })
  })
})

describe('deleteRichMenuAliasManager', () => {
  it('deletes alias', async () => {
    const { capturedImpl, oa } = makeDeps({
      getProvider: vi.fn().mockResolvedValue({ id: 'p-1', ownerId: 'user-1' }),
    })
    const ctx = makeAuthCtx('user-1')
    await capturedImpl.deleteRichMenuAliasManager(
      { officialAccountId: 'oa-1', richMenuAliasId: 'alias-a' },
      ctx,
    )
    expect(oa.deleteRichMenuAlias).toHaveBeenCalledWith('oa-1', 'alias-a')
  })
})

describe('listOAUsersWithRichMenus', () => {
  it('returns users with their rich menu assignments', async () => {
    const { capturedImpl, oa } = makeDeps({
      getProvider: vi.fn().mockResolvedValue({ id: 'p-1', ownerId: 'user-1' }),
      listOAUsersWithRichMenus: vi.fn().mockResolvedValue([
        { userId: 'u-1', userName: 'Alice', userImage: null, assignedRichMenuId: 'rm-1' },
      ]),
    })
    const ctx = makeAuthCtx('user-1')
    const result = await capturedImpl.listOAUsersWithRichMenus(
      { officialAccountId: 'oa-1', richMenuId: 'rm-1' },
      ctx,
    )
    expect(oa.listOAUsersWithRichMenus).toHaveBeenCalledWith({
      oaId: 'oa-1',
      richMenuId: 'rm-1',
    })
    expect(result.users).toHaveLength(1)
    expect(result.users[0].userId).toBe('u-1')
    expect(result.users[0].assignedRichMenuId).toBe('rm-1')
  })
})

describe('linkRichMenuToUserManager', () => {
  it('links menu to user', async () => {
    const { capturedImpl, oa } = makeDeps({
      getProvider: vi.fn().mockResolvedValue({ id: 'p-1', ownerId: 'user-1' }),
    })
    const ctx = makeAuthCtx('user-1')
    await capturedImpl.linkRichMenuToUserManager(
      { officialAccountId: 'oa-1', userId: 'u-2', richMenuId: 'rm-1' },
      ctx,
    )
    expect(oa.linkRichMenuToUser).toHaveBeenCalledWith('oa-1', 'u-2', 'rm-1')
  })
})

describe('unlinkRichMenuFromUserManager', () => {
  it('unlinks menu from user', async () => {
    const { capturedImpl, oa } = makeDeps({
      getProvider: vi.fn().mockResolvedValue({ id: 'p-1', ownerId: 'user-1' }),
    })
    const ctx = makeAuthCtx('user-1')
    await capturedImpl.unlinkRichMenuFromUserManager(
      { officialAccountId: 'oa-1', userId: 'u-2' },
      ctx,
    )
    expect(oa.unlinkRichMenuFromUser).toHaveBeenCalledWith('oa-1', 'u-2')
  })
})

describe('trackRichMenuClick', () => {
  it('records click for an OA friend when area index is valid', async () => {
    const { capturedImpl, oa } = makeDeps({
      getRichMenu: vi.fn().mockResolvedValue({
        richMenuId: 'rm-1',
        areas: [{}, {}, {}],
      }),
    })
    const ctx = makeAuthCtx('user-1')
    await capturedImpl.trackRichMenuClick(
      { officialAccountId: 'oa-1', richMenuId: 'rm-1', areaIndex: 2 },
      ctx,
    )
    expect(oa.addRichMenuClick).toHaveBeenCalledWith({
      oaId: 'oa-1',
      richMenuId: 'rm-1',
      areaIndex: 2,
    })
  })

  it('rejects clicks from non-friends', async () => {
    const { capturedImpl, oa } = makeDeps({
      isOAFriend: vi.fn().mockResolvedValue(false),
    })
    const ctx = makeAuthCtx('user-1')
    await expect(
      capturedImpl.trackRichMenuClick(
        { officialAccountId: 'oa-1', richMenuId: 'rm-1', areaIndex: 0 },
        ctx,
      ),
    ).rejects.toMatchObject({ code: Code.PermissionDenied })
    expect(oa.addRichMenuClick).not.toHaveBeenCalled()
  })

  it('rejects out-of-range area indexes', async () => {
    const { capturedImpl, oa } = makeDeps({
      getRichMenu: vi.fn().mockResolvedValue({ richMenuId: 'rm-1', areas: [{}] }),
    })
    const ctx = makeAuthCtx('user-1')
    await expect(
      capturedImpl.trackRichMenuClick(
        { officialAccountId: 'oa-1', richMenuId: 'rm-1', areaIndex: 2 },
        ctx,
      ),
    ).rejects.toMatchObject({ code: Code.InvalidArgument })
    expect(oa.addRichMenuClick).not.toHaveBeenCalled()
  })
})

describe('getRichMenuStats', () => {
  it('returns aggregated stats for owner', async () => {
    const { capturedImpl, oa } = makeDeps({
      getProvider: vi.fn().mockResolvedValue({ id: 'p-1', ownerId: 'user-1' }),
      getRichMenuClickStats: vi.fn().mockResolvedValue([
        { areaIndex: 0, clickCount: 10 },
        { areaIndex: 1, clickCount: 5 },
      ]),
    })
    const ctx = makeAuthCtx('user-1')
    const result = await capturedImpl.getRichMenuStats(
      { officialAccountId: 'oa-1', richMenuId: 'rm-1' },
      ctx,
    )
    expect(result.stats).toHaveLength(2)
    expect(result.stats[0].clickCount).toBe(10)
  })
})
```

- [ ] **Step 2: Run to verify tests fail**

```bash
bun run --cwd apps/server test:unit -- oa-richmenu-m3
```

Expected: new tests fail with method not found.

- [ ] **Step 3: Add remaining handlers to `oa.ts`**

Inside `oaServiceImpl`, after `switchRichMenu`, add:

```typescript
async listRichMenuAliases(req, ctx) {
  const auth = requireAuthData(ctx)
  await assertOfficialAccountOwnedByUser(deps, req.officialAccountId, auth.id)
  const aliases = await deps.oa.getRichMenuAliasList(req.officialAccountId)
  return {
    aliases: aliases.map((a) => ({
      richMenuAliasId: a.richMenuAliasId,
      richMenuId: a.richMenuId,
      createdAt: a.createdAt,
    })),
  }
},

async createRichMenuAlias(req, ctx) {
  const auth = requireAuthData(ctx)
  await assertOfficialAccountOwnedByUser(deps, req.officialAccountId, auth.id)
  if (!req.richMenuAliasId || req.richMenuAliasId.length > 32 || !/^[a-zA-Z0-9_-]+$/.test(req.richMenuAliasId)) {
    throw new ConnectError('Invalid richMenuAliasId', Code.InvalidArgument)
  }
  const menu = await deps.oa.getRichMenu(req.officialAccountId, req.richMenuId)
  if (!menu || !menu.hasImage) {
    throw new ConnectError('Rich menu not found', Code.InvalidArgument)
  }
  let alias
  try {
    alias = await deps.oa.createRichMenuAlias({
      oaId: req.officialAccountId,
      richMenuAliasId: req.richMenuAliasId,
      richMenuId: req.richMenuId,
    })
  } catch (err) {
    if ((err as { code?: string }).code === '23505') {
      throw new ConnectError('Rich menu alias already exists', Code.AlreadyExists)
    }
    throw err
  }
  return {
    alias: {
      richMenuAliasId: alias.richMenuAliasId,
      richMenuId: alias.richMenuId,
      createdAt: alias.createdAt,
    },
  }
},

async deleteRichMenuAliasManager(req, ctx) {
  const auth = requireAuthData(ctx)
  await assertOfficialAccountOwnedByUser(deps, req.officialAccountId, auth.id)
  const alias = await deps.oa.getRichMenuAlias(req.officialAccountId, req.richMenuAliasId)
  if (!alias) {
    throw new ConnectError('Rich menu alias not found', Code.NotFound)
  }
  await deps.oa.deleteRichMenuAlias(req.officialAccountId, req.richMenuAliasId)
  return {}
},

async listOAUsersWithRichMenus(req, ctx) {
  const auth = requireAuthData(ctx)
  await assertOfficialAccountOwnedByUser(deps, req.officialAccountId, auth.id)
  const users = await deps.oa.listOAUsersWithRichMenus({
    oaId: req.officialAccountId,
    richMenuId: req.richMenuId,
  })
  return {
    users: users.map((u) => ({
      userId: u.userId,
      userName: u.userName ?? undefined,
      userImage: u.userImage ?? undefined,
      assignedRichMenuId: u.assignedRichMenuId ?? undefined,
    })),
  }
},

async linkRichMenuToUserManager(req, ctx) {
  const auth = requireAuthData(ctx)
  await assertOfficialAccountOwnedByUser(deps, req.officialAccountId, auth.id)
  const isFriend = await deps.oa.isOAFriend(req.userId, req.officialAccountId)
  if (!isFriend) {
    throw new ConnectError('User is not an OA friend', Code.FailedPrecondition)
  }
  const menu = await deps.oa.getRichMenu(req.officialAccountId, req.richMenuId)
  if (!menu) {
    throw new ConnectError('Rich menu not found', Code.NotFound)
  }
  await deps.oa.linkRichMenuToUser(req.officialAccountId, req.userId, req.richMenuId)
  return {}
},

async unlinkRichMenuFromUserManager(req, ctx) {
  const auth = requireAuthData(ctx)
  await assertOfficialAccountOwnedByUser(deps, req.officialAccountId, auth.id)
  await deps.oa.unlinkRichMenuFromUser(req.officialAccountId, req.userId)
  return {}
},

async trackRichMenuClick(req, ctx) {
  const auth = requireAuthData(ctx)
  const isFriend = await deps.oa.isOAFriend(auth.id, req.officialAccountId)
  if (!isFriend) {
    throw new ConnectError('Forbidden: not an OA friend', Code.PermissionDenied)
  }
  const menu = await deps.oa.getRichMenu(req.officialAccountId, req.richMenuId)
  if (!menu) {
    throw new ConnectError('Rich menu not found', Code.NotFound)
  }
  const areas = menu.areas as unknown[]
  if (req.areaIndex < 0 || req.areaIndex >= areas.length) {
    throw new ConnectError('Invalid areaIndex', Code.InvalidArgument)
  }
  await deps.oa.addRichMenuClick({
    oaId: req.officialAccountId,
    richMenuId: req.richMenuId,
    areaIndex: req.areaIndex,
  })
  return {}
},

async getRichMenuStats(req, ctx) {
  const auth = requireAuthData(ctx)
  await assertOfficialAccountOwnedByUser(deps, req.officialAccountId, auth.id)
  const stats = await deps.oa.getRichMenuClickStats(req.officialAccountId, req.richMenuId)
  return {
    stats: stats.map((s) => ({
      areaIndex: s.areaIndex,
      clickCount: s.clickCount,
    })),
  }
},
```

- [ ] **Step 4: Run all tests**

```bash
bun run --cwd apps/server test:unit -- oa-richmenu-m3
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/connect/oa.ts apps/server/src/connect/oa-richmenu-m3.test.ts
git commit -m "feat(connect): add alias CRUD, per-user, and click tracking RPC handlers"
```

---

## Task 6: Chat-side fixes

**Files:**
- Modify: `apps/web/app/(app)/home/(tabs)/talks/[chatId].tsx`

- [ ] **Step 1: Fix postback dispatch in `handleRichMenuAreaTap`**

In `[chatId].tsx`, move the existing `dispatchAction = useActionDispatcher(...)` hook above `handleRichMenuAreaTap` before adding it to the callback dependencies. Then find `handleRichMenuAreaTap` (currently around line 200) and replace the `postback` case:

```typescript
// Before:
case 'postback':
  showToast('Postback action', { type: 'info' })
  break

// After:
case 'postback':
  if (action.data && otherMemberOaId) {
    dispatchAction({
      type: 'postback',
      data: action.data,
      displayText: action.displayText,
    })
  }
  break
```

Also remove the `default` toast fallthrough so `richmenuswitch` can be handled next.

- [ ] **Step 2: Add `richmenuswitch` case and required hooks**

First, import `useTanQueryClient` at the top of the file (it may already be imported — check):

```typescript
import { useTanQuery, useTanQueryClient } from '~/query'
```

Inside the component, add after the `dispatchAction` hook:

```typescript
const queryClient = useTanQueryClient()
```

Keep both `dispatchAction` and `queryClient` declared before `handleRichMenuAreaTap`; otherwise the callback dependency array references `dispatchAction` before initialization.

Then add the `richmenuswitch` case inside `handleRichMenuAreaTap`, after the `postback` case:

```typescript
case 'richmenuswitch':
  if (action.richMenuAliasId && otherMemberOaId) {
    oaClient
      .switchRichMenu({
        officialAccountId: otherMemberOaId,
        chatId: chatId ?? '',
        richMenuAliasId: action.richMenuAliasId,
        data: action.data ?? '',
      })
      .then(() => {
        queryClient.invalidateQueries({
          queryKey: ['oa', 'richMenu', 'active', otherMemberOaId],
        })
      })
      .catch(() => {})
  }
  break
```

The `action` type in `handleRichMenuAreaTap` already has `richMenuAliasId?: string` from `useRichMenu`'s `RichMenuArea.action` type.

- [ ] **Step 3: Add fire-and-forget click tracking**

At the start of `handleRichMenuAreaTap`, before the switch statement, add click tracking. First, expose `richMenuId` from `useRichMenu` — it's on `richMenu?.richMenuId`. The hook already returns `richMenu`. Add after the switch:

Actually, add click tracking at the start of the callback so it fires for all action types:

```typescript
const handleRichMenuAreaTap = useCallback(
  (area: {
    action: {
      type: string
      uri?: string
      data?: string
      text?: string
      richMenuAliasId?: string
      displayText?: string
    }
    areaIndex: number
  }) => {
    // fire-and-forget click tracking
    if (otherMemberOaId && richMenu?.richMenuId && area.areaIndex !== undefined) {
      oaClient
        .trackRichMenuClick({
          officialAccountId: otherMemberOaId,
          richMenuId: richMenu.richMenuId,
          areaIndex: area.areaIndex,
        })
        .catch(() => {})
    }
    const { action } = area
    switch (action.type) {
      // ... existing cases ...
    }
  },
  [otherMemberOaId, richMenu?.richMenuId, sendMessage, dispatchAction, queryClient, chatId],
)
```

The `RichMenu` component currently passes `area` objects to `onAreaTap`. Check `apps/web/src/features/chat/ui/RichMenu.tsx` to verify the area tap callback signature — it needs to pass `areaIndex`. If it doesn't include `areaIndex`, add it to the callback in `RichMenu.tsx`:

```typescript
// In RichMenu.tsx, when calling onAreaTap:
onAreaTap({ action: area.action, areaIndex: i })
```

- [ ] **Step 4: Type-check**

```bash
bun run --cwd apps/web typecheck 2>&1 | head -20
```

Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/(app)/home/(tabs)/talks/[chatId].tsx apps/web/src/features/chat/ui/RichMenu.tsx
git commit -m "feat(chat): fix rich menu postback dispatch and add richmenuswitch + click tracking"
```

---

## Task 7: Manager — Alias UI in edit page

**Files:**
- Modify: `apps/web/app/(app)/manager/[oaId]/richmenu/[richMenuId].tsx`
- Modify: `apps/web/src/features/oa-manager/richmenu/RichMenuEditor.tsx`

- [ ] **Step 1: Add/preserve `richmenuswitch` actions in `RichMenuEditor`**

In `apps/web/src/features/oa-manager/richmenu/RichMenuEditor.tsx`, extend the action editor before adding alias UI:

- Change action type state from `'message' | 'uri' | 'postback'` to `'message' | 'uri' | 'postback' | 'richmenuswitch'`.
- Add `actionRichMenuAliasId` state.
- In `handleSelectArea`, populate `actionRichMenuAliasId` when `act.type === 'richmenuswitch'`; keep existing postback state handling unchanged.
- In `commitAction`, create `{ type: 'richmenuswitch', richMenuAliasId: actionRichMenuAliasId, data: actionData }` for `richmenuswitch`.
- In the save `areaPayload`, preserve `richMenuAliasId` in addition to `type`, `label`, `uri`, `data`, `text`, and `displayText`.
- In `EditRichMenuPage`, preserve `richMenuAliasId` when converting loaded proto areas into `Area[]`.

Add UI controls for the new action type in the existing action panel:

```typescript
{(['message', 'uri', 'postback', 'richmenuswitch'] as const).map((t) => (
  <Button
    key={t}
    size="$2"
    variant={actionType === t ? undefined : 'outlined'}
    onPress={() => setActionType(t)}
  >
    {t === 'message'
      ? 'Message'
      : t === 'uri'
        ? 'URI'
        : t === 'postback'
          ? 'Postback'
          : 'Switch'}
  </Button>
))}
```

For `richmenuswitch`, render inputs for alias ID and data:

```typescript
{actionType === 'richmenuswitch' && (
  <>
    <YStack gap="$1">
      <SizableText size="$1" color="$color10">
        Alias ID
      </SizableText>
      <Input
        value={actionRichMenuAliasId}
        onChangeText={setActionRichMenuAliasId}
        placeholder="richmenu-alias-a"
      />
    </YStack>
    <YStack gap="$1">
      <SizableText size="$1" color="$color10">
        Data
      </SizableText>
      <Input value={actionData} onChangeText={setActionData} placeholder="tab=a" />
    </YStack>
  </>
)}
```

- [ ] **Step 2: Add `AliasesSection` component and wire to edit page**

Update the existing top-level imports in `apps/web/app/(app)/manager/[oaId]/richmenu/[richMenuId].tsx` first. Do not add imports near the bottom of the file. The import block should include `useState`, `XStack`, `useTanMutation`, `showToast`, `showError`, `Input`, and `Button`:

```typescript
import { memo, useState } from 'react'
import { SizableText, Spinner, XStack, YStack } from 'tamagui'
import { useTanMutation, useTanQuery, useTanQueryClient } from '~/query'

import { oaClient } from '~/features/oa/client'
import { showError } from '~/interface/dialogs/actions'
import { showToast } from '~/interface/toast/Toast'
import { Input } from '~/interface/forms/Input'
import { Button } from '~/interface/buttons/Button'
```

Then add the component below `EditRichMenuPage` and above `export default`:

```typescript

const AliasesSection = memo(({ oaId, richMenuId }: { oaId: string; richMenuId: string }) => {
  const qc = useTanQueryClient()
  const [newAliasId, setNewAliasId] = useState('')

  const { data, isLoading } = useTanQuery({
    queryKey: ['oa', 'richmenu-aliases', oaId, richMenuId],
    queryFn: () => oaClient.listRichMenuAliases({ officialAccountId: oaId }),
    enabled: !!oaId && !!richMenuId,
  })

  const createMutation = useTanMutation({
    mutationFn: (aliasId: string) =>
      oaClient.createRichMenuAlias({
        officialAccountId: oaId,
        richMenuAliasId: aliasId,
        richMenuId,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['oa', 'richmenu-aliases', oaId, richMenuId] })
      setNewAliasId('')
      showToast('Alias created', { type: 'success' })
    },
    onError: (e) => showError(e, 'Failed to create alias'),
  })

  const deleteMutation = useTanMutation({
    mutationFn: (aliasId: string) =>
      oaClient.deleteRichMenuAliasManager({
        officialAccountId: oaId,
        richMenuAliasId: aliasId,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['oa', 'richmenu-aliases', oaId, richMenuId] })
      showToast('Alias deleted', { type: 'success' })
    },
    onError: (e) => showError(e, 'Failed to delete alias'),
  })

  const aliases = data?.aliases ?? []

  return (
    <YStack gap="$3" borderWidth={1} borderColor="$borderColor" rounded="$3" p="$4">
      <SizableText size="$5" fontWeight="700" color="$color12">
        Aliases
      </SizableText>
      <SizableText size="$2" color="$color10">
        Aliases let rich menu areas use the richmenuswitch action to switch between menus.
      </SizableText>

      {isLoading ? (
        <Spinner size="small" />
      ) : aliases.length === 0 ? (
        <SizableText size="$2" color="$color9">
          No aliases yet.
        </SizableText>
      ) : (
        <YStack gap="$2">
          {aliases.map((alias) => (
            <XStack
              key={alias.richMenuAliasId}
              items="center"
              justify="space-between"
              borderWidth={1}
              borderColor="$borderColor"
              rounded="$2"
              px="$3"
              py="$2"
            >
              <SizableText size="$3" fontWeight="600" color="$color12">
                {alias.richMenuAliasId}
              </SizableText>
              <Button
                size="$2"
                variant="outlined"
                theme="red"
                onPress={() => deleteMutation.mutate(alias.richMenuAliasId)}
              >
                Delete
              </Button>
            </XStack>
          ))}
        </YStack>
      )}

      <XStack gap="$2" items="flex-end">
        <YStack flex={1} gap="$1">
          <SizableText size="$1" color="$color10">
            New alias ID
          </SizableText>
          <Input
            value={newAliasId}
            onChangeText={setNewAliasId}
            placeholder="richmenu-alias-a"
          />
        </YStack>
        <Button
          onPress={() => {
            if (newAliasId.trim()) createMutation.mutate(newAliasId.trim())
          }}
          disabled={!newAliasId.trim() || createMutation.isPending}
        >
          Add
        </Button>
      </XStack>
    </YStack>
  )
})
```

Then in `EditRichMenuPage`, after the `<RichMenuEditor ... />` component, add:

```typescript
<AliasesSection oaId={oaId} richMenuId={richMenuId} />
```

Make sure `Spinner`, `XStack`, `YStack`, `SizableText` from `tamagui` are imported (they already are in this file).

- [ ] **Step 3: Type-check**

```bash
bun run --cwd apps/web typecheck 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/(app)/manager/[oaId]/richmenu/[richMenuId].tsx apps/web/src/features/oa-manager/richmenu/RichMenuEditor.tsx
git commit -m "feat(manager): add aliases section to rich menu edit page"
```

---

## Task 8: Manager — Assigned users section in edit page

**Files:**
- Modify: `apps/web/app/(app)/manager/[oaId]/richmenu/[richMenuId].tsx`

- [ ] **Step 1: Add `AssignedUsersSection` component**

In the same edit page file, add after `AliasesSection`:

```typescript
const AssignedUsersSection = memo(
  ({ oaId, richMenuId }: { oaId: string; richMenuId: string }) => {
    const qc = useTanQueryClient()

    const { data, isLoading } = useTanQuery({
      queryKey: ['oa', 'richmenu-users', oaId, richMenuId],
      queryFn: () =>
        oaClient.listOAUsersWithRichMenus({
          officialAccountId: oaId,
          richMenuId,
        }),
      enabled: !!oaId && !!richMenuId,
    })

    const unlinkMutation = useTanMutation({
      mutationFn: (userId: string) =>
        oaClient.unlinkRichMenuFromUserManager({ officialAccountId: oaId, userId }),
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ['oa', 'richmenu-users', oaId, richMenuId] })
        showToast('User unlinked', { type: 'success' })
      },
      onError: (e) => showError(e, 'Failed to unlink user'),
    })

    const users = data?.users ?? []

    return (
      <YStack gap="$3" borderWidth={1} borderColor="$borderColor" rounded="$3" p="$4">
        <SizableText size="$5" fontWeight="700" color="$color12">
          Assigned users
        </SizableText>
        <SizableText size="$2" color="$color10">
          Users with this menu assigned explicitly (overrides the default).
        </SizableText>

        {isLoading ? (
          <Spinner size="small" />
        ) : users.length === 0 ? (
          <SizableText size="$2" color="$color9">
            No users assigned to this menu.
          </SizableText>
        ) : (
          <YStack gap="$2">
            {users.map((u) => (
              <XStack
                key={u.userId}
                items="center"
                justify="space-between"
                borderWidth={1}
                borderColor="$borderColor"
                rounded="$2"
                px="$3"
                py="$2"
              >
                <SizableText size="$3" color="$color12">
                  {u.userName ?? u.userId}
                </SizableText>
                <Button
                  size="$2"
                  variant="outlined"
                  onPress={() => unlinkMutation.mutate(u.userId)}
                >
                  Unlink
                </Button>
              </XStack>
            ))}
          </YStack>
        )}
      </YStack>
    )
  },
)
```

Add `<AssignedUsersSection oaId={oaId} richMenuId={richMenuId} />` after `<AliasesSection>` in `EditRichMenuPage`.

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/(app)/manager/[oaId]/richmenu/[richMenuId].tsx
git commit -m "feat(manager): add assigned users section to rich menu edit page"
```

---

## Task 9: Manager — Users page

**Files:**
- Create: `apps/web/app/(app)/manager/[oaId]/richmenu/users.tsx`
- Modify: `apps/web/app/(app)/manager/[oaId]/richmenu/index.tsx`

- [ ] **Step 1: Create `users.tsx`**

Create `apps/web/app/(app)/manager/[oaId]/richmenu/users.tsx`:

```typescript
import { useActiveParams, useRouter, createRoute } from 'one'
import { memo } from 'react'
import { SizableText, Spinner, XStack, YStack } from 'tamagui'
import { useTanQuery, useTanMutation, useTanQueryClient } from '~/query'
import { oaClient } from '~/features/oa/client'
import { Button } from '~/interface/buttons/Button'
import { Select } from '~/interface/forms/Select'
import { showToast } from '~/interface/toast/Toast'
import { showError } from '~/interface/dialogs/actions'

const route = createRoute<'/(app)/manager/[oaId]/richmenu/users'>()

export const RichMenuUsersPage = memo(() => {
  const params = useActiveParams<{ oaId: string }>()
  const oaId = params.oaId!
  const router = useRouter()
  const qc = useTanQueryClient()

  const { data: menusData } = useTanQuery({
    queryKey: ['oa', 'richmenu-list', oaId],
    queryFn: () => oaClient.listRichMenus({ officialAccountId: oaId }),
    enabled: !!oaId,
  })

  const { data: usersData, isLoading } = useTanQuery({
    queryKey: ['oa', 'richmenu-users-all', oaId],
    queryFn: () => oaClient.listOAUsersWithRichMenus({ officialAccountId: oaId }),
    enabled: !!oaId,
  })

  const linkMutation = useTanMutation({
    mutationFn: ({ userId, richMenuId }: { userId: string; richMenuId: string }) =>
      oaClient.linkRichMenuToUserManager({ officialAccountId: oaId, userId, richMenuId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['oa', 'richmenu-users-all', oaId] })
      showToast('Menu assigned', { type: 'success' })
    },
    onError: (e) => showError(e, 'Failed to assign menu'),
  })

  const unlinkMutation = useTanMutation({
    mutationFn: (userId: string) =>
      oaClient.unlinkRichMenuFromUserManager({ officialAccountId: oaId, userId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['oa', 'richmenu-users-all', oaId] })
      showToast('Menu unlinked', { type: 'success' })
    },
    onError: (e) => showError(e, 'Failed to unlink menu'),
  })

  const menus = menusData?.menus ?? []
  const users = usersData?.users ?? []

  return (
    <YStack gap="$6">
      <XStack justify="space-between" items="center">
        <YStack gap="$1">
          <SizableText size="$7" fontWeight="700" color="$color12">
            Per-user rich menus
          </SizableText>
          <SizableText size="$2" color="$color10">
            Assign specific menus to individual users. Overrides the default.
          </SizableText>
        </YStack>
        <Button
          variant="outlined"
          onPress={() => router.navigate(`/manager/${oaId}/richmenu` as any)}
        >
          ← Menus
        </Button>
      </XStack>

      {isLoading ? (
        <YStack items="center" py="$10">
          <Spinner size="large" />
        </YStack>
      ) : users.length === 0 ? (
        <YStack py="$10" items="center" borderWidth={1} borderColor="$borderColor" rounded="$4">
          <SizableText size="$4" color="$color11">
            No users have friended this account yet.
          </SizableText>
        </YStack>
      ) : (
        <YStack gap="$2">
          {users.map((u) => (
            <XStack
              key={u.userId}
              borderWidth={1}
              borderColor="$borderColor"
              rounded="$3"
              p="$3"
              gap="$3"
              items="center"
            >
              <YStack flex={1}>
                <SizableText size="$3" fontWeight="600" color="$color12">
                  {u.userName ?? u.userId}
                </SizableText>
                <SizableText size="$1" color="$color10">
                  {u.assignedRichMenuId
                    ? `Assigned: ${menus.find((m) => m.richMenuId === u.assignedRichMenuId)?.name ?? u.assignedRichMenuId}`
                    : 'Using default'}
                </SizableText>
              </YStack>

              <YStack width={220} shrink={0}>
                <Select
                  value={u.assignedRichMenuId ?? '__default__'}
                  onValueChange={(value) => {
                    if (value === '__default__') {
                      unlinkMutation.mutate(u.userId)
                    } else {
                      linkMutation.mutate({ userId: u.userId, richMenuId: value })
                    }
                  }}
                  options={[
                    { label: 'Use default', value: '__default__' },
                    ...menus.map((m) => ({ label: m.name, value: m.richMenuId })),
                  ]}
                />
              </YStack>
            </XStack>
          ))}
        </YStack>
      )}
    </YStack>
  )
})

export default RichMenuUsersPage
```

- [ ] **Step 2: Add "Users" link to rich menu list page**

In `apps/web/app/(app)/manager/[oaId]/richmenu/index.tsx`, in `RichMenuListPage`, add a "Users" button next to the existing "+ Create" button:

```typescript
// Inside the XStack that holds the page header and "+ Create" button, add:
<Button
  variant="outlined"
  onPress={() => router.navigate(`/manager/${oaId}/richmenu/users` as any)}
>
  Per-user
</Button>
```

- [ ] **Step 3: Type-check**

```bash
bun run --cwd apps/web typecheck 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/(app)/manager/[oaId]/richmenu/users.tsx apps/web/app/(app)/manager/[oaId]/richmenu/index.tsx
git commit -m "feat(manager): add per-user rich menu assignment page"
```

---

## Task 10: Manager — Click stats in edit page

**Files:**
- Modify: `apps/web/app/(app)/manager/[oaId]/richmenu/[richMenuId].tsx`
- Modify: `apps/web/src/features/oa-manager/richmenu/RichMenuEditor.tsx`
- Modify: `apps/web/src/features/oa-manager/richmenu/AreaOverlay.tsx`

- [ ] **Step 1: Load stats once in the edit page and pass them to the editor**

In `apps/web/app/(app)/manager/[oaId]/richmenu/[richMenuId].tsx`, add a `getRichMenuStats` query next to the existing `getRichMenu` query:

```typescript
const { data: statsData, isLoading: statsLoading } = useTanQuery({
  queryKey: ['oa', 'richmenu-stats', oaId, richMenuId],
  queryFn: () => oaClient.getRichMenuStats({ officialAccountId: oaId, richMenuId }),
  enabled: !!oaId && !!richMenuId,
})
```

After `areas` is built, derive a count map:

```typescript
const stats = statsData?.stats ?? []
const clickCountsByArea = Object.fromEntries(
  stats.map((s) => [s.areaIndex, s.clickCount]),
) as Record<number, number>
```

Pass the map into `RichMenuEditor`:

```typescript
<RichMenuEditor
  mode="edit"
  oaId={oaId}
  richMenuId={richMenuId}
  initial={initial}
  clickCountsByArea={clickCountsByArea}
  onSaved={handleSaved}
/>
```

- [ ] **Step 2: Add click-count badges to rich menu area overlays**

In `apps/web/src/features/oa-manager/richmenu/RichMenuEditor.tsx`, extend the props so both create and edit modes can accept an optional `clickCountsByArea?: Record<number, number>`. When rendering `AreaOverlay`, pass the count for each area index:

```typescript
<AreaOverlay
  key={area.id}
  area={area}
  label={AREA_LABELS[i] ?? String(i + 1)}
  clickCount={props.clickCountsByArea?.[i] ?? 0}
  scaleFactor={scaleFactor}
  isSelected={selectedAreaId === area.id}
  canvasHeightPx={canvasHeightPx}
  onSelect={handleSelectArea}
  onUpdate={handleUpdateBounds}
  onDelete={handleDeleteArea}
/>
```

In `apps/web/src/features/oa-manager/richmenu/AreaOverlay.tsx`, add an optional `clickCount?: number` prop. Render a small count badge in the overlay corner when `clickCount > 0`. Keep the existing area label and drag handles intact; the badge must not change the overlay bounds or interfere with drag/resize.

- [ ] **Step 3: Add `ClickStatsSection` component**

In the edit page file, add a table component that consumes the already-loaded stats instead of running a second query:

```typescript
const ClickStatsSection = memo(
  ({
    areaCount,
    stats,
    isLoading,
  }: {
    areaCount: number
    stats: Array<{ areaIndex: number; clickCount: number }>
    isLoading: boolean
  }) => {
    const total = stats.reduce((sum, s) => sum + s.clickCount, 0)

    const AREA_LABELS = 'ABCDEFGHIJKLMNOPQRST'

    return (
      <YStack gap="$3" borderWidth={1} borderColor="$borderColor" rounded="$3" p="$4">
        <SizableText size="$5" fontWeight="700" color="$color12">
          Click stats
        </SizableText>

        {isLoading ? (
          <Spinner size="small" />
        ) : stats.length === 0 ? (
          <SizableText size="$2" color="$color9">
            No clicks recorded yet.
          </SizableText>
        ) : (
          <YStack gap="$1">
            {Array.from({ length: areaCount }, (_, i) => {
              const stat = stats.find((s) => s.areaIndex === i)
              const count = stat?.clickCount ?? 0
              const pct = total > 0 ? Math.round((count / total) * 100) : 0
              return (
                <XStack key={i} items="center" gap="$3" py="$1">
                  <SizableText size="$2" fontWeight="600" color="$color11" width={24}>
                    {AREA_LABELS[i] ?? String(i + 1)}
                  </SizableText>
                  <SizableText size="$2" color="$color12" width={48}>
                    {count}
                  </SizableText>
                  <SizableText size="$1" color="$color9">
                    {pct}%
                  </SizableText>
                </XStack>
              )
            })}
            <SizableText size="$1" color="$color10" mt="$1">
              Total: {total}
            </SizableText>
          </YStack>
        )}
      </YStack>
    )
  },
)
```

Add `<ClickStatsSection areaCount={areas.length} stats={stats} isLoading={statsLoading} />` after `<AssignedUsersSection>` in `EditRichMenuPage`.

`areas` is available from the loaded `menu.areas` (already in scope in `EditRichMenuPage`).

- [ ] **Step 4: Type-check**

```bash
bun run --cwd apps/web typecheck 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 5: Run full server unit tests**

```bash
bun run --cwd apps/server test:unit
```

Expected: all tests pass.

- [ ] **Step 6: Final commit**

```bash
git add apps/web/app/(app)/manager/[oaId]/richmenu/[richMenuId].tsx apps/web/src/features/oa-manager/richmenu/RichMenuEditor.tsx apps/web/src/features/oa-manager/richmenu/AreaOverlay.tsx
git commit -m "feat(manager): add per-area click stats section to rich menu edit page"
```

---

## Self-review checklist

- [x] **Spec coverage:**
  - 1a postback fix → Task 6
  - 1b richmenuswitch (ConnectRPC + async webhook + client) → Tasks 2–4, 6
  - Alias management UI in edit page → Tasks 2–5, 7
  - Per-user UI (menu side + user side) → Tasks 2–5, 8, 9
  - Per-area click insights (DB + recording + manager) → Tasks 1–5, 6, 10

- [x] **No placeholders:** All code blocks are complete.

- [x] **Type consistency:**
  - `buildRichMenuSwitchPostbackEvent` defined in Task 2, used in Task 4 ✓
  - `addRichMenuClick` / `getRichMenuClickStats` / `listOAUsersWithRichMenus` defined Task 2, used Tasks 5 + 10 ✓
  - Proto message names: `DeleteRichMenuAliasManagerRequest` matches RPC name `DeleteRichMenuAliasManager` ✓
  - `useTanQueryClient` used in Tasks 7–10 (already used in existing code) ✓
  - Query keys: `['oa', 'richMenu', 'active', oaId]` matches `useRichMenu` hook ✓
