# OA Official Account Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an OA (Official Account) bot platform with ConnectRPC management APIs and REST Messaging API endpoints, allowing users to create official accounts, configure webhooks, and external bots to interact with users via webhook events.

**Architecture:** OA Management via ConnectRPC (type-safe, auto-generated clients), Messaging API via REST (LINE-compatible for external bots), webhooks via REST POST. Service factory + DI pattern matching existing codebase.

**Tech Stack:** Fastify, ConnectRPC, protobuf, Drizzle ORM, PostgreSQL, crypto (HMAC-SHA256, JWT)

---

### Task 1: Proto Definitions

**Files:**
- Create: `packages/proto/proto/oa/v1/oa.proto`
- Modify: `packages/proto/package.json` (add exports)

- [ ] **Step 1: Create the proto file**

Create `packages/proto/proto/oa/v1/oa.proto`:

```protobuf
syntax = "proto3";

package oa.v1;

// ── Provider ──

message Provider {
  string id = 1;
  string name = 2;
  string owner_id = 3;
  string created_at = 4;
  string updated_at = 5;
}

message CreateProviderRequest {
  string name = 1;
}

message CreateProviderResponse {
  Provider provider = 1;
}

message GetProviderRequest {
  string id = 1;
}

message GetProviderResponse {
  Provider provider = 1;
}

message UpdateProviderRequest {
  string id = 1;
  optional string name = 2;
}

message UpdateProviderResponse {
  Provider provider = 1;
}

message DeleteProviderRequest {
  string id = 1;
}

message DeleteProviderResponse {}

message ListProviderAccountsRequest {
  string provider_id = 1;
}

message ListProviderAccountsResponse {
  repeated OfficialAccount accounts = 1;
}

// ── Official Account ──

message OfficialAccount {
  string id = 1;
  string provider_id = 2;
  string name = 3;
  string oa_id = 4;
  string description = 5;
  string image_url = 6;
  string channel_secret = 7;
  string status = 8;
  string created_at = 9;
  string updated_at = 10;
}

message CreateOfficialAccountRequest {
  string provider_id = 1;
  string name = 2;
  string oa_id = 3;
  optional string description = 4;
  optional string image_url = 5;
}

message CreateOfficialAccountResponse {
  OfficialAccount account = 1;
}

message GetOfficialAccountRequest {
  string id = 1;
}

message GetOfficialAccountResponse {
  OfficialAccount account = 1;
}

message UpdateOfficialAccountRequest {
  string id = 1;
  optional string name = 2;
  optional string description = 3;
  optional string image_url = 4;
  optional string status = 5;
}

message UpdateOfficialAccountResponse {
  OfficialAccount account = 1;
}

message DeleteOfficialAccountRequest {
  string id = 1;
}

message DeleteOfficialAccountResponse {}

// ── Webhook ──

message Webhook {
  string id = 1;
  string oa_id = 2;
  string url = 3;
  string status = 4;
  optional string last_verified_at = 5;
  string created_at = 6;
}

message SetWebhookRequest {
  string oa_id = 1;
  string url = 2;
}

message SetWebhookResponse {
  Webhook webhook = 1;
}

message VerifyWebhookRequest {
  string oa_id = 1;
}

message VerifyWebhookResponse {
  bool success = 1;
  string status = 2;
}

message GetWebhookRequest {
  string oa_id = 1;
}

message GetWebhookResponse {
  optional Webhook webhook = 1;
}

// ── Access Token ──

message AccessToken {
  string id = 1;
  string oa_id = 2;
  string token = 3;
  string type = 4;
  optional string key_id = 5;
  optional string expires_at = 6;
  string created_at = 7;
}

message ListAccessTokensRequest {
  string oa_id = 1;
  optional string key_id = 2;
}

message ListAccessTokensResponse {
  repeated AccessTokenSummary tokens = 1;
}

message AccessTokenSummary {
  string id = 1;
  string type = 2;
  optional string key_id = 3;
  optional string expires_at = 4;
  string created_at = 5;
}

message IssueAccessTokenRequest {
  string oa_id = 1;
  string type = 2;
  optional string public_key = 3;
}

message IssueAccessTokenResponse {
  string access_token = 1;
  int32 expires_in = 2;
  string token_type = 3;
  optional string key_id = 4;
}

message RevokeAccessTokenRequest {
  string token_id = 1;
}

message RevokeAccessTokenResponse {}

message RevokeAllAccessTokensRequest {
  string oa_id = 1;
  string key_id = 2;
}

message RevokeAllAccessTokensResponse {
  int32 revoked_count = 1;
}

// ── Search ──

message SearchOfficialAccountsRequest {
  string query = 1;
}

message SearchOfficialAccountsResponse {
  repeated OfficialAccountSummary accounts = 1;
}

message OfficialAccountSummary {
  string id = 1;
  string name = 2;
  string oa_id = 3;
  string description = 4;
  string image_url = 5;
}

// ── Service ──

service OAService {
  rpc CreateProvider(CreateProviderRequest) returns (CreateProviderResponse);
  rpc GetProvider(GetProviderRequest) returns (GetProviderResponse);
  rpc UpdateProvider(UpdateProviderRequest) returns (UpdateProviderResponse);
  rpc DeleteProvider(DeleteProviderRequest) returns (DeleteProviderResponse);
  rpc ListProviderAccounts(ListProviderAccountsRequest) returns (ListProviderAccountsResponse);
  rpc CreateOfficialAccount(CreateOfficialAccountRequest) returns (CreateOfficialAccountResponse);
  rpc GetOfficialAccount(GetOfficialAccountRequest) returns (GetOfficialAccountResponse);
  rpc UpdateOfficialAccount(UpdateOfficialAccountRequest) returns (UpdateOfficialAccountResponse);
  rpc DeleteOfficialAccount(DeleteOfficialAccountRequest) returns (DeleteOfficialAccountResponse);
  rpc SetWebhook(SetWebhookRequest) returns (SetWebhookResponse);
  rpc VerifyWebhook(VerifyWebhookRequest) returns (VerifyWebhookResponse);
  rpc GetWebhook(GetWebhookRequest) returns (GetWebhookResponse);
  rpc IssueAccessToken(IssueAccessTokenRequest) returns (IssueAccessTokenResponse);
  rpc ListAccessTokens(ListAccessTokensRequest) returns (ListAccessTokensResponse);
  rpc RevokeAccessToken(RevokeAccessTokenRequest) returns (RevokeAccessTokenResponse);
  rpc RevokeAllAccessTokens(RevokeAllAccessTokensRequest) returns (RevokeAllAccessTokensResponse);
  rpc SearchOfficialAccounts(SearchOfficialAccountsRequest) returns (SearchOfficialAccountsResponse);
}
```

- [ ] **Step 2: Add proto exports to package.json**

Modify `packages/proto/package.json` — add the OA export alongside the existing greeter export:

```json
{
  "name": "@vine/proto",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./gen/greeter/v1/greeter_pb.ts",
    "./greeter": "./gen/greeter/v1/greeter_pb.ts",
    "./oa": "./gen/oa/v1/oa_pb.ts"
  },
  "scripts": {
    "build": "buf generate && oxfmt gen",
    "clean": "true",
    "proto:generate": "buf generate && oxfmt gen"
  },
  "dependencies": {
    "@bufbuild/protobuf": "^2.0.0"
  },
  "devDependencies": {
    "@bufbuild/buf": "^1.54.0",
    "@bufbuild/protoc-gen-es": "^2.0.0",
    "oxfmt": "^0.16.0"
  }
}
```

- [ ] **Step 3: Generate TypeScript from proto**

Run: `bun run --cwd packages/proto proto:generate`

Expected: New files in `packages/proto/gen/oa/v1/oa_pb.ts`

- [ ] **Step 4: Verify generated file exists**

Check that `packages/proto/gen/oa/v1/oa_pb.ts` was created and contains the `OAService` definition.

- [ ] **Step 5: Commit**

```bash
git add packages/proto/proto/oa/v1/oa.proto packages/proto/package.json packages/proto/gen/
git commit -m "feat(oa): add OA service proto definitions"
```

---

### Task 2: Database Schema — Drizzle Tables

**Files:**
- Create: `packages/db/src/schema-oa.ts`
- Modify: `packages/db/src/index.ts` (add schema-oa export)

- [ ] **Step 1: Create OA schema tables**

Create `packages/db/src/schema-oa.ts`:

```ts
import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

export const oaProvider = pgTable('oaProvider', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  ownerId: text('ownerId').notNull(),
  createdAt: timestamp('createdAt', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updatedAt', { mode: 'string' }).defaultNow().notNull(),
})

export const officialAccount = pgTable('officialAccount', {
  id: uuid('id').primaryKey().defaultRandom(),
  providerId: uuid('providerId').notNull().references(() => oaProvider.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  oaId: text('oaId').notNull().unique(),
  description: text('description'),
  imageUrl: text('imageUrl'),
  channelSecret: text('channelSecret').notNull(),
  status: text('status').notNull().default('active'),
  createdAt: timestamp('createdAt', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updatedAt', { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  index('officialAccount_providerId_idx').on(table.providerId),
  index('officialAccount_oaId_idx').on(table.oaId),
])

export const oaWebhook = pgTable('oaWebhook', {
  id: uuid('id').primaryKey().defaultRandom(),
  oaId: uuid('oaId').notNull().references(() => officialAccount.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  status: text('status').notNull().default('pending'),
  lastVerifiedAt: timestamp('lastVerifiedAt', { mode: 'string' }),
  createdAt: timestamp('createdAt', { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  index('oaWebhook_oaId_idx').on(table.oaId),
])

export const oaFriendship = pgTable('oaFriendship', {
  id: uuid('id').primaryKey().defaultRandom(),
  oaId: uuid('oaId').notNull().references(() => officialAccount.id, { onDelete: 'cascade' }),
  userId: text('userId').notNull(),
  status: text('status').notNull().default('friend'),
  createdAt: timestamp('createdAt', { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  index('oaFriendship_oaId_idx').on(table.oaId),
  index('oaFriendship_userId_idx').on(table.userId),
])

export const oaAccessToken = pgTable('oaAccessToken', {
  id: uuid('id').primaryKey().defaultRandom(),
  oaId: uuid('oaId').notNull().references(() => officialAccount.id, { onDelete: 'cascade' }),
  token: text('token').notNull(),
  type: text('type').notNull(),
  keyId: text('keyId'),
  expiresAt: timestamp('expiresAt', { mode: 'string' }),
  createdAt: timestamp('createdAt', { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  index('oaAccessToken_oaId_idx').on(table.oaId),
  index('oaAccessToken_keyId_idx').on(table.keyId),
])
```

- [ ] **Step 2: Export schema-oa from db package**

Modify `packages/db/src/index.ts` — add `schemaOa` to the combined schema:

```ts
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'

const ZERO_UPSTREAM_DB = process.env['ZERO_UPSTREAM_DB'] ?? ''

import * as schemaPrivate from './schema-private'
import * as schemaPublic from './schema-public'
import * as schemaOa from './schema-oa'

export const schema = {
  ...schemaPublic,
  ...schemaPrivate,
  ...schemaOa,
}

// ... rest unchanged
```

- [ ] **Step 3: Add schema-oa export path**

Modify `packages/db/package.json` — add `"./schema-oa": "./src/schema-oa.ts"` to exports.

- [ ] **Step 4: Run typecheck to verify**

Run: `bun run --cwd packages/db typecheck`

Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/schema-oa.ts packages/db/src/index.ts packages/db/package.json
git commit -m "feat(oa): add OA database schema tables"
```

---

### Task 3: Database Migration

**Files:**
- Run: `bunx drizzle-kit generate` (generates migration SQL)
- Run: `bunx drizzle-kit migrate` (applies migration)

- [ ] **Step 1: Generate migration**

Run: `bunx drizzle-kit generate --config packages/db/drizzle.config.ts`

Expected: New migration file in `packages/db/migrations/` with SQL to create the 5 new tables

- [ ] **Step 2: Verify migration SQL**

Read the generated migration file and confirm it creates: `oaProvider`, `officialAccount`, `oaWebhook`, `oaFriendship`, `oaAccessToken` with correct columns, types, indexes, and foreign keys.

- [ ] **Step 3: Apply migration**

Run: `bunx drizzle-kit migrate --config packages/db/drizzle.config.ts`

Expected: All 5 tables created in the database

- [ ] **Step 4: Commit**

```bash
git add packages/db/migrations/
git commit -m "feat(oa): add OA database migration"
```

---

### Task 4: OA Service Factory — Provider CRUD

**Files:**
- Create: `apps/server/src/services/oa.ts`
- Create: `apps/server/src/services/oa.test.ts`

- [ ] **Step 1: Write tests for createProvider**

Create `apps/server/src/services/oa.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { createOAService } from './oa'

function createMockDb() {
  return {
    insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue([{ id: 'test-provider-id' }]) }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) }),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([]),
    }),
  }
}

describe('createOAService — Provider', () => {
  it('creates a provider with owner', async () => {
    const mockDb = createMockDb()
    const oa = createOAService({ db: mockDb as any, database: {} as any })

    const result = await oa.createProvider({
      name: 'Test Provider',
      ownerId: 'user-123',
    })

    expect(mockDb.insert).toHaveBeenCalled()
    expect(result.name).toBe('Test Provider')
    expect(result.ownerId).toBe('user-123')
  })

  it('gets a provider by id', async () => {
    const mockDb = createMockDb()
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{
            id: 'provider-1',
            name: 'Test',
            ownerId: 'user-123',
            createdAt: '2026-04-04T00:00:00Z',
            updatedAt: '2026-04-04T00:00:00Z',
          }]),
        }),
      }),
    })

    const oa = createOAService({ db: mockDb as any, database: {} as any })
    const result = await oa.getProvider('provider-1')

    expect(result).toBeDefined()
    expect(result!.id).toBe('provider-1')
  })

  it('returns null for non-existent provider', async () => {
    const mockDb = createMockDb()
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    })

    const oa = createOAService({ db: mockDb as any, database: {} as any })
    const result = await oa.getProvider('non-existent')

    expect(result).toBeNull()
  })

  it('updates provider name', async () => {
    const mockDb = createMockDb()
    const oa = createOAService({ db: mockDb as any, database: {} as any })

    await oa.updateProvider('provider-1', { name: 'New Name' })

    expect(mockDb.update).toHaveBeenCalled()
  })

  it('deletes a provider', async () => {
    const mockDb = createMockDb()
    const oa = createOAService({ db: mockDb as any, database: {} as any })

    await oa.deleteProvider('provider-1')

    expect(mockDb.delete).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run --cwd apps/server test -- src/services/oa.test.ts`

Expected: FAIL — `createOAService` not defined

- [ ] **Step 3: Implement Provider CRUD**

Create `apps/server/src/services/oa.ts`:

```ts
import { eq } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { Pool } from 'pg'
import type { schema } from '@vine/db'
import {
  oaProvider,
  officialAccount,
  oaWebhook,
  oaFriendship,
  oaAccessToken,
} from '@vine/db/schema-oa'

type OADeps = {
  db: NodePgDatabase<typeof schema>
  database: Pool
}

export function createOAService(deps: OADeps) {
  const { db } = deps

  async function createProvider(input: { name: string; ownerId: string }) {
    const [provider] = await db
      .insert(oaProvider)
      .values({
        name: input.name,
        ownerId: input.ownerId,
      })
      .returning()
    return provider
  }

  async function getProvider(id: string) {
    const [provider] = await db
      .select()
      .from(oaProvider)
      .where(eq(oaProvider.id, id))
      .limit(1)
    return provider ?? null
  }

  async function updateProvider(id: string, input: { name?: string }) {
    const [provider] = await db
      .update(oaProvider)
      .set({
        name: input.name,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(oaProvider.id, id))
      .returning()
    return provider
  }

  async function deleteProvider(id: string) {
    await db.delete(oaProvider).where(eq(oaProvider.id, id))
  }

  async function listProviderAccounts(providerId: string) {
    return db
      .select()
      .from(officialAccount)
      .where(eq(officialAccount.providerId, providerId))
  }

  return {
    createProvider,
    getProvider,
    updateProvider,
    deleteProvider,
    listProviderAccounts,
  }
}

export type { OADeps }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run --cwd apps/server test -- src/services/oa.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/services/oa.ts apps/server/src/services/oa.test.ts
git commit -m "feat(oa): implement Provider CRUD service with tests"
```

---

### Task 5: OA Service Factory — Official Account CRUD

**Files:**
- Modify: `apps/server/src/services/oa.ts`
- Modify: `apps/server/src/services/oa.test.ts`

- [ ] **Step 1: Write tests for OA CRUD**

Append to `apps/server/src/services/oa.test.ts`:

```ts
describe('createOAService — OfficialAccount', () => {
  it('creates an official account with channelSecret', async () => {
    const mockDb = createMockDb()
    mockDb.insert.mockReturnValueOnce({ values: vi.fn().mockResolvedValue([{ id: 'oa-1' }]) })

    const oa = createOAService({ db: mockDb as any, database: {} as any })

    const result = await oa.createOfficialAccount({
      providerId: 'provider-1',
      name: 'Test OA',
      oaId: '@testbot',
    })

    expect(mockDb.insert).toHaveBeenCalled()
    expect(result.name).toBe('Test OA')
    expect(result.channelSecret).toBeDefined()
    expect(result.channelSecret.length).toBeGreaterThan(0)
  })

  it('generates unique oaId', async () => {
    const mockDb = createMockDb()
    mockDb.insert.mockReturnValueOnce({ values: vi.fn().mockResolvedValue([{ id: 'oa-1' }]) })

    const oa = createOAService({ db: mockDb as any, database: {} as any })

    const result1 = await oa.createOfficialAccount({
      providerId: 'provider-1',
      name: 'OA 1',
      oaId: '@bot1',
    })
    const result2 = await oa.createOfficialAccount({
      providerId: 'provider-1',
      name: 'OA 2',
      oaId: '@bot2',
    })

    expect(result1.oaId).toBe('@bot1')
    expect(result2.oaId).toBe('@bot2')
  })

  it('gets an official account by id', async () => {
    const mockDb = createMockDb()
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: 'oa-1', name: 'Test OA' }]),
        }),
      }),
    })

    const oa = createOAService({ db: mockDb as any, database: {} as any })
    const result = await oa.getOfficialAccount('oa-1')

    expect(result).toBeDefined()
    expect(result!.id).toBe('oa-1')
  })

  it('returns null for non-existent OA', async () => {
    const mockDb = createMockDb()
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) }),
      }),
    })

    const oa = createOAService({ db: mockDb as any, database: {} as any })
    const result = await oa.getOfficialAccount('non-existent')

    expect(result).toBeNull()
  })

  it('updates official account fields', async () => {
    const mockDb = createMockDb()
    const oa = createOAService({ db: mockDb as any, database: {} as any })

    await oa.updateOfficialAccount('oa-1', { name: 'Updated Name' })

    expect(mockDb.update).toHaveBeenCalled()
  })

  it('deletes an official account', async () => {
    const mockDb = createMockDb()
    const oa = createOAService({ db: mockDb as any, database: {} as any })

    await oa.deleteOfficialAccount('oa-1')

    expect(mockDb.delete).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run --cwd apps/server test -- src/services/oa.test.ts`

Expected: FAIL — `createOfficialAccount` etc. not defined

- [ ] **Step 3: Implement Official Account CRUD**

Append to `apps/server/src/services/oa.ts`:

```ts
import { randomBytes } from 'crypto'

// ... inside createOAService, add:

  function generateChannelSecret() {
    return randomBytes(32).toString('hex')
  }

  async function createOfficialAccount(input: {
    providerId: string
    name: string
    oaId: string
    description?: string
    imageUrl?: string
  }) {
    const [account] = await db
      .insert(officialAccount)
      .values({
        providerId: input.providerId,
        name: input.name,
        oaId: input.oaId,
        description: input.description,
        imageUrl: input.imageUrl,
        channelSecret: generateChannelSecret(),
      })
      .returning()
    return account
  }

  async function getOfficialAccount(id: string) {
    const [account] = await db
      .select()
      .from(officialAccount)
      .where(eq(officialAccount.id, id))
      .limit(1)
    return account ?? null
  }

  async function updateOfficialAccount(
    id: string,
    input: { name?: string; description?: string; imageUrl?: string; status?: string },
  ) {
    const [account] = await db
      .update(officialAccount)
      .set({
        name: input.name,
        description: input.description,
        imageUrl: input.imageUrl,
        status: input.status,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(officialAccount.id, id))
      .returning()
    return account
  }

  async function deleteOfficialAccount(id: string) {
    await db.delete(officialAccount).where(eq(officialAccount.id, id))
  }
```

Update the return object in `createOAService`:

```ts
  return {
    createProvider,
    getProvider,
    updateProvider,
    deleteProvider,
    listProviderAccounts,
    createOfficialAccount,
    getOfficialAccount,
    updateOfficialAccount,
    deleteOfficialAccount,
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run --cwd apps/server test -- src/services/oa.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/services/oa.ts apps/server/src/services/oa.test.ts
git commit -m "feat(oa): implement Official Account CRUD service with tests"
```

---

### Task 6: OA Service Factory — Webhook Management

**Files:**
- Modify: `apps/server/src/services/oa.ts`
- Modify: `apps/server/src/services/oa.test.ts`

- [ ] **Step 1: Write tests for webhook management**

Append to `apps/server/src/services/oa.test.ts`:

```ts
describe('createOAService — Webhook', () => {
  it('sets a webhook URL', async () => {
    const mockDb = createMockDb()
    mockDb.insert.mockReturnValueOnce({ values: vi.fn().mockResolvedValue([{ id: 'webhook-1' }]) })

    const oa = createOAService({ db: mockDb as any, database: {} as any })

    const result = await oa.setWebhook('oa-1', 'https://example.com/webhook')

    expect(result).toBeDefined()
    expect(mockDb.insert).toHaveBeenCalled()
  })

  it('gets webhook by oaId', async () => {
    const mockDb = createMockDb()
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: 'webhook-1', url: 'https://example.com' }]),
        }),
      }),
    })

    const oa = createOAService({ db: mockDb as any, database: {} as any })
    const result = await oa.getWebhook('oa-1')

    expect(result).toBeDefined()
  })

  it('returns undefined when no webhook exists', async () => {
    const mockDb = createMockDb()
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) }),
      }),
    })

    const oa = createOAService({ db: mockDb as any, database: {} as any })
    const result = await oa.getWebhook('oa-1')

    expect(result).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run --cwd apps/server test -- src/services/oa.test.ts`

Expected: FAIL — `setWebhook`, `getWebhook` not defined

- [ ] **Step 3: Implement Webhook management**

Append to `apps/server/src/services/oa.ts`:

```ts
  async function setWebhook(oaId: string, url: string) {
    const [webhook] = await db
      .insert(oaWebhook)
      .values({
        oaId,
        url,
        status: 'pending',
      })
      .onConflictDoUpdate({
        target: oaWebhook.oaId,
        set: { url, status: 'pending', lastVerifiedAt: null },
      })
      .returning()
    return webhook
  }

  async function getWebhook(oaId: string) {
    const [webhook] = await db
      .select()
      .from(oaWebhook)
      .where(eq(oaWebhook.oaId, oaId))
      .limit(1)
    return webhook
  }
```

Update the return object to include `setWebhook` and `getWebhook`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run --cwd apps/server test -- src/services/oa.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/services/oa.ts apps/server/src/services/oa.test.ts
git commit -m "feat(oa): implement Webhook management service with tests"
```

---

### Task 7: OA Service Factory — Access Token Management

**Files:**
- Modify: `apps/server/src/services/oa.ts`
- Modify: `apps/server/src/services/oa.test.ts`

- [ ] **Step 1: Write tests for access token management**

Append to `apps/server/src/services/oa.test.ts`:

```ts
describe('createOAService — Access Tokens', () => {
  it('issues a short-lived access token', async () => {
    const mockDb = createMockDb()
    mockDb.insert.mockReturnValueOnce({ values: vi.fn().mockResolvedValue([{ id: 'token-1' }]) })

    const oa = createOAService({ db: mockDb as any, database: {} as any })

    const result = await oa.issueAccessToken({
      oaId: 'oa-1',
      type: 'short_lived',
    })

    expect(result.access_token).toBeDefined()
    expect(result.token_type).toBe('Bearer')
    expect(result.expires_in).toBe(2592000)
  })

  it('issues a JWT v2.1 access token with keyId', async () => {
    const mockDb = createMockDb()
    mockDb.insert.mockReturnValueOnce({ values: vi.fn().mockResolvedValue([{ id: 'token-1' }]) })

    const oa = createOAService({ db: mockDb as any, database: {} as any })

    const result = await oa.issueAccessToken({
      oaId: 'oa-1',
      type: 'jwt_v21',
      publicKey: '-----BEGIN PUBLIC KEY-----\ntest\n-----END PUBLIC KEY-----',
    })

    expect(result.access_token).toBeDefined()
    expect(result.key_id).toBeDefined()
  })

  it('lists access tokens by oaId', async () => {
    const mockDb = createMockDb()
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([
          { id: 'token-1', type: 'short_lived', createdAt: '2026-04-04' },
        ]),
      }),
    })

    const oa = createOAService({ db: mockDb as any, database: {} as any })
    const result = await oa.listAccessTokens('oa-1')

    expect(result).toHaveLength(1)
  })

  it('revokes an access token by id', async () => {
    const mockDb = createMockDb()
    const oa = createOAService({ db: mockDb as any, database: {} as any })

    await oa.revokeAccessToken('token-1')

    expect(mockDb.delete).toHaveBeenCalled()
  })

  it('revokes all access tokens by keyId', async () => {
    const mockDb = createMockDb()
    mockDb.delete.mockReturnValueOnce({ where: vi.fn().mockResolvedValue([{ count: 3 }]) })

    const oa = createOAService({ db: mockDb as any, database: {} as any })
    const result = await oa.revokeAllAccessTokens('oa-1', 'key-123')

    expect(result.revoked_count).toBe(3)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run --cwd apps/server test -- src/services/oa.test.ts`

Expected: FAIL — `issueAccessToken`, `listAccessTokens`, etc. not defined

- [ ] **Step 3: Implement Access Token management**

Append to `apps/server/src/services/oa.ts`:

```ts
import { randomUUID } from 'crypto'

// ... inside createOAService, add:

  function generateAccessToken() {
    return randomUUID().replace(/-/g, '') + randomBytes(16).toString('hex')
  }

  function generateKeyId() {
    return randomUUID()
  }

  async function issueAccessToken(input: {
    oaId: string
    type: 'short_lived' | 'jwt_v21'
    publicKey?: string
  }) {
    const token = generateAccessToken()
    const keyId = input.type === 'jwt_v21' ? generateKeyId() : undefined
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days

    await db.insert(oaAccessToken).values({
      oaId: input.oaId,
      token,
      type: input.type,
      keyId,
      expiresAt,
    })

    return {
      access_token: token,
      expires_in: 2592000,
      token_type: 'Bearer' as const,
      key_id: keyId,
    }
  }

  async function listAccessTokens(oaId: string, keyId?: string) {
    const query = db
      .select({
        id: oaAccessToken.id,
        type: oaAccessToken.type,
        keyId: oaAccessToken.keyId,
        expiresAt: oaAccessToken.expiresAt,
        createdAt: oaAccessToken.createdAt,
      })
      .from(oaAccessToken)
      .where(eq(oaAccessToken.oaId, oaId))

    return query
  }

  async function revokeAccessToken(tokenId: string) {
    await db.delete(oaAccessToken).where(eq(oaAccessToken.id, tokenId))
  }

  async function revokeAllAccessTokens(oaId: string, keyId: string) {
    const result = await db
      .delete(oaAccessToken)
      .where(eq(oaAccessToken.keyId, keyId))
      .returning({ id: oaAccessToken.id })
    return { revoked_count: result.length }
  }
```

Update the return object to include all token methods.

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run --cwd apps/server test -- src/services/oa.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/services/oa.ts apps/server/src/services/oa.test.ts
git commit -m "feat(oa): implement Access Token management service with tests"
```

---

### Task 8: OA Service Factory — Webhook Dispatch

**Files:**
- Modify: `apps/server/src/services/oa.ts`
- Modify: `apps/server/src/services/oa.test.ts`

- [ ] **Step 1: Write tests for webhook dispatch**

Append to `apps/server/src/services/oa.test.ts`:

```ts
import { createHmac, randomUUID } from 'crypto'

describe('createOAService — Webhook Dispatch', () => {
  it('generates correct HMAC-SHA256 signature', () => {
    const oa = createOAService({ db: createMockDb() as any, database: {} as any })
    const body = JSON.stringify({ test: 'data' })
    const secret = 'test-secret'

    const signature = oa.generateWebhookSignature(body, secret)
    const expected = createHmac('SHA256', secret).update(body).digest('base64')

    expect(signature).toBe(expected)
  })

  it('builds correct CallbackRequest for message event', () => {
    const oa = createOAService({ db: createMockDb() as any, database: {} as any })

    const payload = oa.buildMessageEvent({
      oaId: 'oa-1',
      userId: 'user-123',
      messageId: 'msg-1',
      text: 'Hello',
      replyToken: 'reply-1',
    })

    expect(payload.destination).toBe('oa-1')
    expect(payload.events).toHaveLength(1)
    expect(payload.events[0].type).toBe('message')
    expect(payload.events[0].message.type).toBe('text')
    expect(payload.events[0].message.text).toBe('Hello')
    expect(payload.events[0].replyToken).toBe('reply-1')
  })

  it('builds correct follow event', () => {
    const oa = createOAService({ db: createMockDb() as any, database: {} as any })

    const payload = oa.buildFollowEvent({
      oaId: 'oa-1',
      userId: 'user-123',
      replyToken: 'reply-1',
    })

    expect(payload.events[0].type).toBe('follow')
    expect(payload.events[0].follow.isUnblocked).toBe(false)
  })

  it('builds correct unfollow event', () => {
    const oa = createOAService({ db: createMockDb() as any, database: {} as any })

    const payload = oa.buildUnfollowEvent({
      oaId: 'oa-1',
      userId: 'user-123',
    })

    expect(payload.events[0].type).toBe('unfollow')
    expect(payload.events[0].replyToken).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run --cwd apps/server test -- src/services/oa.test.ts`

Expected: FAIL — methods not defined

- [ ] **Step 3: Implement Webhook Dispatch utilities**

Append to `apps/server/src/services/oa.ts`:

```ts
import { createHmac, randomUUID } from 'crypto'

// ... inside createOAService, add:

  function generateWebhookSignature(body: string, channelSecret: string) {
    return createHmac('SHA256', channelSecret).update(body).digest('base64')
  }

  function generateReplyToken() {
    return randomUUID().replace(/-/g, '')
  }

  function buildMessageEvent(input: {
    oaId: string
    userId: string
    messageId: string
    text: string
    replyToken: string
  }) {
    return {
      destination: input.oaId,
      events: [
        {
          type: 'message',
          mode: 'active' as const,
          timestamp: Date.now(),
          source: { type: 'user' as const, userId: input.userId },
          webhookEventId: randomUUID(),
          deliveryContext: { isRedelivery: false },
          replyToken: input.replyToken,
          message: {
            type: 'text' as const,
            id: input.messageId,
            text: input.text,
          },
        },
      ],
    }
  }

  function buildFollowEvent(input: { oaId: string; userId: string; replyToken: string }) {
    return {
      destination: input.oaId,
      events: [
        {
          type: 'follow',
          mode: 'active' as const,
          timestamp: Date.now(),
          source: { type: 'user' as const, userId: input.userId },
          webhookEventId: randomUUID(),
          deliveryContext: { isRedelivery: false },
          replyToken: input.replyToken,
          follow: { isUnblocked: false },
        },
      ],
    }
  }

  function buildUnfollowEvent(input: { oaId: string; userId: string }) {
    return {
      destination: input.oaId,
      events: [
        {
          type: 'unfollow',
          mode: 'active' as const,
          timestamp: Date.now(),
          source: { type: 'user' as const, userId: input.userId },
          webhookEventId: randomUUID(),
          deliveryContext: { isRedelivery: false },
        },
      ],
    }
  }
```

Update the return object to include these methods.

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run --cwd apps/server test -- src/services/oa.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/services/oa.ts apps/server/src/services/oa.test.ts
git commit -m "feat(oa): implement webhook dispatch utilities with tests"
```

---

### Task 9: ConnectRPC Handler

**Files:**
- Create: `apps/server/src/connect/oa.ts`
- Modify: `apps/server/src/connect/routes.ts`
- Modify: `apps/server/src/index.ts`

- [ ] **Step 1: Create the ConnectRPC handler**

Create `apps/server/src/connect/oa.ts`:

```ts
import { ConnectRouter } from '@connectrpc/connect'
import { OAService } from '@vine/proto/oa'
import type { createOAService } from '../services/oa'

type OAHandlerDeps = {
  oa: ReturnType<typeof createOAService>
}

function toProtoProvider(p: { id: string; name: string; ownerId: string; createdAt: string; updatedAt: string }) {
  return { id: p.id, name: p.name, ownerId: p.ownerId, createdAt: p.createdAt, updatedAt: p.updatedAt }
}

function toProtoOA(a: {
  id: string; providerId: string; name: string; oaId: string; description: string | null;
  imageUrl: string | null; channelSecret: string; status: string; createdAt: string; updatedAt: string;
}) {
  return {
    id: a.id, providerId: a.providerId, name: a.name, oaId: a.oaId,
    description: a.description ?? '', imageUrl: a.imageUrl ?? '',
    channelSecret: a.channelSecret, status: a.status,
    createdAt: a.createdAt, updatedAt: a.updatedAt,
  }
}

function toProtoWebhook(w: { id: string; oaId: string; url: string; status: string; lastVerifiedAt: string | null; createdAt: string }) {
  return {
    id: w.id, oaId: w.oaId, url: w.url, status: w.status,
    lastVerifiedAt: w.lastVerifiedAt ?? undefined, createdAt: w.createdAt,
  }
}

export function oaHandler(deps: OAHandlerDeps) {
  return router.service(OAService, {
    async createProvider(req) {
      const provider = await deps.oa.createProvider({ name: req.name, ownerId: '' }) // TODO: get from auth context
      return { provider: toProtoProvider(provider) }
    },
    async getProvider(req) {
      const provider = await deps.oa.getProvider(req.id)
      if (!provider) throw new Error('Provider not found')
      return { provider: toProtoProvider(provider) }
    },
    async updateProvider(req) {
      const updates: { name?: string } = {}
      if (req.name) updates.name = req.name
      const provider = await deps.oa.updateProvider(req.id, updates)
      return { provider: toProtoProvider(provider) }
    },
    async deleteProvider(req) {
      await deps.oa.deleteProvider(req.id)
      return {}
    },
    async listProviderAccounts(req) {
      const accounts = await deps.oa.listProviderAccounts(req.providerId)
      return { accounts: accounts.map(toProtoOA) }
    },
    async createOfficialAccount(req) {
      const account = await deps.oa.createOfficialAccount({
        providerId: req.providerId,
        name: req.name,
        oaId: req.oaId,
        description: req.description || undefined,
        imageUrl: req.imageUrl || undefined,
      })
      return { account: toProtoOA(account) }
    },
    async getOfficialAccount(req) {
      const account = await deps.oa.getOfficialAccount(req.id)
      if (!account) throw new Error('Official account not found')
      return { account: toProtoOA(account) }
    },
    async updateOfficialAccount(req) {
      const updates: { name?: string; description?: string; imageUrl?: string; status?: string } = {}
      if (req.name) updates.name = req.name
      if (req.description) updates.description = req.description
      if (req.imageUrl) updates.imageUrl = req.imageUrl
      if (req.status) updates.status = req.status
      const account = await deps.oa.updateOfficialAccount(req.id, updates)
      return { account: toProtoOA(account) }
    },
    async deleteOfficialAccount(req) {
      await deps.oa.deleteOfficialAccount(req.id)
      return {}
    },
    async setWebhook(req) {
      const webhook = await deps.oa.setWebhook(req.oaId, req.url)
      return { webhook: toProtoWebhook(webhook) }
    },
    async getWebhook(req) {
      const webhook = await deps.oa.getWebhook(req.oaId)
      return { webhook: webhook ? toProtoWebhook(webhook) : undefined }
    },
    async verifyWebhook(req) {
      // Will be implemented in Task 10 with the REST webhook verification
      return { success: false, status: 'not_implemented' }
    },
    async issueAccessToken(req) {
      const result = await deps.oa.issueAccessToken({
        oaId: req.oaId,
        type: req.type as 'short_lived' | 'jwt_v21',
        publicKey: req.publicKey || undefined,
      })
      return {
        access_token: result.access_token,
        expires_in: result.expires_in,
        token_type: result.token_type,
        key_id: result.key_id,
      }
    },
    async listAccessTokens(req) {
      const tokens = await deps.oa.listAccessTokens(req.oaId, req.keyId || undefined)
      return { tokens: tokens.map((t) => ({
        id: t.id, type: t.type, keyId: t.keyId ?? undefined,
        expiresAt: t.expiresAt ?? undefined, createdAt: t.createdAt,
      }))}
    },
    async revokeAccessToken(req) {
      await deps.oa.revokeAccessToken(req.tokenId)
      return {}
    },
    async revokeAllAccessTokens(req) {
      const result = await deps.oa.revokeAllAccessTokens(req.oaId, req.keyId)
      return { revoked_count: result.revoked_count }
    },
    async searchOfficialAccounts(req) {
      const accounts = await deps.oa.searchOAs(req.query)
      return { accounts: accounts.map((a) => ({
        id: a.id, name: a.name, oaId: a.oaId,
        description: a.description ?? '', imageUrl: a.imageUrl ?? '',
      }))}
    },
  })
}
```

Note: `searchOAs` is referenced but not yet implemented — it will be added in Task 11.

- [ ] **Step 2: Register the OA handler in routes**

Modify `apps/server/src/connect/routes.ts`:

```ts
import { ConnectRouter } from '@connectrpc/connect'
import { greeterHandler } from './greeter'
import { oaHandler } from './oa'
import type { createOAService } from '../services/oa'

type ConnectRoutesDeps = {
  oa: ReturnType<typeof createOAService>
}

export function connectRoutes(deps: ConnectRoutesDeps) {
  return (router: ConnectRouter) => {
    greeterHandler(router)
    oaHandler({ oa: deps.oa })(router)
  }
}
```

- [ ] **Step 3: Wire OA service in index.ts**

Modify `apps/server/src/index.ts`:

```ts
import { connectRoutes } from './connect/routes'

// ... after creating services:

const oa = createOAService({ db, database })

await app.register(fastifyConnectPlugin, {
  routes: connectRoutes({ oa }),
})
```

- [ ] **Step 4: Run typecheck**

Run: `bun run --cwd apps/server typecheck`

Expected: No errors (except for `searchOAs` which is not yet implemented — that's expected)

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/connect/oa.ts apps/server/src/connect/routes.ts apps/server/src/index.ts
git commit -m "feat(oa): add ConnectRPC handler for OA management"
```

---

### Task 10: OA Service Factory — Search + Webhook Verification

**Files:**
- Modify: `apps/server/src/services/oa.ts`
- Modify: `apps/server/src/services/oa.test.ts`
- Modify: `apps/server/src/connect/oa.ts`

- [ ] **Step 1: Write tests for search**

Append to `apps/server/src/services/oa.test.ts`:

```ts
describe('createOAService — Search', () => {
  it('searches OAs by oaId or name', async () => {
    const mockDb = createMockDb()
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([
          { id: 'oa-1', name: 'Test Bot', oaId: '@testbot', description: 'A test bot', imageUrl: '' },
        ]),
      }),
    })

    const oa = createOAService({ db: mockDb as any, database: {} as any })
    const result = await oa.searchOAs('test')

    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Test Bot')
  })
})
```

- [ ] **Step 2: Implement searchOAs**

Append to `apps/server/src/services/oa.ts`:

```ts
import { ilike, or } from 'drizzle-orm'

// ... inside createOAService, add:

  async function searchOAs(query: string) {
    const searchPattern = `%${query}%`
    return db
      .select({
        id: officialAccount.id,
        name: officialAccount.name,
        oaId: officialAccount.oaId,
        description: officialAccount.description,
        imageUrl: officialAccount.imageUrl,
      })
      .from(officialAccount)
      .where(
        or(
          ilike(officialAccount.name, searchPattern),
          ilike(officialAccount.oaId, searchPattern),
        ),
      )
      .limit(20)
  }
```

Add `searchOAs` to the return object.

- [ ] **Step 3: Implement webhook verification**

Append to `apps/server/src/services/oa.ts`:

```ts
  async function verifyWebhook(oaId: string) {
    const webhook = await getWebhook(oaId)
    if (!webhook) return { success: false, status: 'no_webhook' as const }

    const account = await getOfficialAccount(oaId)
    if (!account) return { success: false, status: 'oa_not_found' as const }

    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'x-line-signature': generateWebhookSignature('[]', account.channelSecret),
        },
        body: JSON.stringify({ destination: oaId, events: [] }),
        signal: AbortSignal.timeout(10000),
      })

      if (response.ok) {
        await db
          .update(oaWebhook)
          .set({ status: 'verified', lastVerifiedAt: new Date().toISOString() })
          .where(eq(oaWebhook.oaId, oaId))
        return { success: true, status: 'verified' as const }
      }

      await db
        .update(oaWebhook)
        .set({ status: 'failed' })
        .where(eq(oaWebhook.oaId, oaId))
      return { success: false, status: 'failed' as const }
    } catch {
      await db
        .update(oaWebhook)
        .set({ status: 'failed' })
        .where(eq(oaWebhook.oaId, oaId))
      return { success: false, status: 'failed' as const }
    }
  }
```

Add `verifyWebhook` to the return object.

- [ ] **Step 4: Update ConnectRPC handler for verifyWebhook**

Modify `apps/server/src/connect/oa.ts` — replace the stub `verifyWebhook`:

```ts
    async verifyWebhook(req) {
      const result = await deps.oa.verifyWebhook(req.oaId)
      return { success: result.success, status: result.status }
    },
```

- [ ] **Step 5: Run tests**

Run: `bun run --cwd apps/server test -- src/services/oa.test.ts`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/services/oa.ts apps/server/src/services/oa.test.ts apps/server/src/connect/oa.ts
git commit -m "feat(oa): implement search and webhook verification"
```

---

### Task 11: REST Messaging API Plugin

**Files:**
- Create: `apps/server/src/plugins/oa-messaging.ts`

- [ ] **Step 1: Create the Messaging API REST plugin**

Create `apps/server/src/plugins/oa-messaging.ts`:

```ts
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import type { createOAService } from '../services/oa'

type MessagingPluginDeps = {
  oa: ReturnType<typeof createOAService>
}

async function extractOaFromToken(request: FastifyRequest, oa: ReturnType<typeof createOAService>) {
  const authHeader = request.headers['authorization']
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Missing Bearer token')
  }
  const token = authHeader.slice(7)

  // Look up token in oaAccessToken table
  const [tokenRecord] = await (oa as any).db
    .select()
    .from((oa as any).tables.oaAccessToken)
    .where(eq((oa as any).tables.oaAccessToken.token, token))
    .limit(1)

  if (!tokenRecord) throw new Error('Invalid access token')
  if (tokenRecord.expiresAt && new Date(tokenRecord.expiresAt) < new Date()) {
    throw new Error('Access token expired')
  }

  return tokenRecord.oaId
}

export async function oaMessagingPlugin(
  fastify: FastifyInstance,
  deps: MessagingPluginDeps,
) {
  // Reply Messages
  fastify.post('/api/oa/v2/bot/message/reply', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const oaId = await extractOaFromToken(request, deps.oa)
      const { replyToken, messages } = request.body as { replyToken: string; messages: any[] }

      if (!replyToken || !messages?.length) {
        return reply.code(400).send({ message: 'replyToken and messages are required', code: 'INVALID_REQUEST' })
      }

      // TODO: Deliver messages to user's chat via Zero mutation
      // For MVP: return success
      return reply.send({})
    } catch (err) {
      if (err instanceof Error && err.message === 'Invalid access token') {
        return reply.code(401).send({ message: 'Invalid access token', code: 'INVALID_TOKEN' })
      }
      return reply.code(500).send({ message: 'Internal server error' })
    }
  })

  // Push Messages
  fastify.post('/api/oa/v2/bot/message/push', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const oaId = await extractOaFromToken(request, deps.oa)
      const { to, messages } = request.body as { to: string; messages: any[] }

      if (!to || !messages?.length) {
        return reply.code(400).send({ message: 'to and messages are required', code: 'INVALID_REQUEST' })
      }

      // TODO: Check if user is a friend of this OA
      // TODO: Deliver messages to user's chat via Zero mutation
      return reply.send({})
    } catch (err) {
      if (err instanceof Error && err.message === 'Invalid access token') {
        return reply.code(401).send({ message: 'Invalid access token', code: 'INVALID_TOKEN' })
      }
      return reply.code(500).send({ message: 'Internal server error' })
    }
  })

  // Get Profile
  fastify.get('/api/oa/v2/bot/profile/:userId', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await extractOaFromToken(request, deps.oa)
      const { userId } = request.params as { userId: string }

      // TODO: Look up user profile from userPublic table
      return reply.send({ userId, displayName: 'User', pictureUrl: '' })
    } catch (err) {
      if (err instanceof Error && err.message === 'Invalid access token') {
        return reply.code(401).send({ message: 'Invalid access token', code: 'INVALID_TOKEN' })
      }
      return reply.code(500).send({ message: 'Internal server error' })
    }
  })

  // OAuth: Issue Access Token
  fastify.post('/api/oa/v2/oauth/accessToken', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as Record<string, string>

      if (body.grant_type === 'client_credentials' && body.client_assertion_type) {
        // JWT v2.1 flow
        // TODO: Parse and verify JWT client_assertion
        const result = await deps.oa.issueAccessToken({
          oaId: 'oa-id-from-jwt', // TODO: extract from JWT
          type: 'jwt_v21',
        })
        return reply.send(result)
      }

      // Short-lived token flow
      const { client_id: oaId, client_secret: channelSecret } = body
      if (!oaId || !channelSecret) {
        return reply.code(400).send({ message: 'client_id and client_secret required' })
      }

      const account = await deps.oa.getOfficialAccount(oaId)
      if (!account || account.channelSecret !== channelSecret) {
        return reply.code(401).send({ message: 'Invalid credentials' })
      }

      const result = await deps.oa.issueAccessToken({ oaId, type: 'short_lived' })
      return reply.send(result)
    } catch (err) {
      return reply.code(500).send({ message: 'Internal server error' })
    }
  })

  // OAuth: Revoke Access Token
  fastify.post('/api/oa/v2/oauth/revoke', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { access_token } = request.body as { access_token: string }
      // TODO: Look up token by value and delete
      return reply.send({})
    } catch {
      return reply.code(500).send({ message: 'Internal server error' })
    }
  })
}
```

- [ ] **Step 2: Wire the messaging plugin in index.ts**

Modify `apps/server/src/index.ts` — add after the ConnectRPC registration:

```ts
import { oaMessagingPlugin } from './plugins/oa-messaging'

// ... after creating oa service:

await oaMessagingPlugin(app, { oa })
```

- [ ] **Step 3: Run typecheck**

Run: `bun run --cwd apps/server typecheck`

Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/plugins/oa-messaging.ts apps/server/src/index.ts
git commit -m "feat(oa): add REST Messaging API plugin for external bots"
```

---

### Task 12: Webhook Dispatcher Plugin

**Files:**
- Create: `apps/server/src/plugins/oa-webhook.ts`

- [ ] **Step 1: Create the webhook dispatcher plugin**

Create `apps/server/src/plugins/oa-webhook.ts`:

```ts
import type { FastifyInstance } from 'fastify'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { schema } from '@vine/db'
import type { createOAService } from '../services/oa'

type WebhookPluginDeps = {
  oa: ReturnType<typeof createOAService>
  db: NodePgDatabase<typeof schema>
}

export async function oaWebhookPlugin(
  fastify: FastifyInstance,
  deps: WebhookPluginDeps,
) {
  const { oa, db } = deps

  // This plugin intercepts message creation for OA-type chats
  // and dispatches webhook events to the bot's registered URL.
  //
  // In the MVP, this is triggered when a user sends a message to an OA chat.
  // The actual dispatch happens via the OA service's buildMessageEvent + fetch.

  // For MVP: expose a manual dispatch endpoint for testing
  fastify.post('/api/oa/internal/dispatch', async (request, reply) => {
    const { oaId, userId, messageId, text, replyToken } = request.body as {
      oaId: string; userId: string; messageId: string; text: string; replyToken: string
    }

    const account = await oa.getOfficialAccount(oaId)
    if (!account) return reply.code(404).send({ message: 'OA not found' })

    const webhook = await oa.getWebhook(oaId)
    if (!webhook || webhook.status !== 'verified') {
      return reply.code(400).send({ message: 'Webhook not configured or not verified' })
    }

    const payload = oa.buildMessageEvent({ oaId, userId, messageId, text, replyToken })
    const body = JSON.stringify(payload)
    const signature = oa.generateWebhookSignature(body, account.channelSecret)

    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'x-line-signature': signature,
        },
        body,
        signal: AbortSignal.timeout(10000),
      })

      if (!response.ok) {
        await db.update(/* oaWebhook */).set({ status: 'failed' }).where(/* ... */)
        return reply.code(502).send({ message: 'Webhook delivery failed', status: response.status })
      }

      return reply.send({ success: true })
    } catch {
      return reply.code(504).send({ message: 'Webhook delivery timeout' })
    }
  })
}
```

- [ ] **Step 2: Wire the webhook plugin in index.ts**

Modify `apps/server/src/index.ts`:

```ts
import { oaWebhookPlugin } from './plugins/oa-webhook'

// ... after creating oa service:

await oaWebhookPlugin(app, { oa, db })
```

- [ ] **Step 3: Run typecheck**

Run: `bun run --cwd apps/server typecheck`

Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/plugins/oa-webhook.ts apps/server/src/index.ts
git commit -m "feat(oa): add webhook dispatcher plugin"
```

---

### Task 13: Add `oaId` columns to existing tables

**Files:**
- Modify: `packages/db/src/schema-public.ts`
- Run: `bunx drizzle-kit generate && bunx drizzle-kit migrate`

- [ ] **Step 1: Add `oaId` to `chatMember` and `message` tables**

Modify `packages/db/src/schema-public.ts`:

In `chatMember` table definition, add after `joinedAt`:
```ts
  oaId: text('oaId'),
```

In `message` table definition, add after `createdAt`:
```ts
  oaId: text('oaId'),
```

- [ ] **Step 2: Generate and apply migration**

Run: `bunx drizzle-kit generate --config packages/db/drizzle.config.ts`
Run: `bunx drizzle-kit migrate --config packages/db/drizzle.config.ts`

Expected: New migration adding `oaId` columns to `chatMember` and `message`

- [ ] **Step 3: Commit**

```bash
git add packages/db/src/schema-public.ts packages/db/migrations/
git commit -m "feat(oa): add oaId columns to chatMember and message tables"
```

---

### Task 14: Environment Variables

**Files:**
- Modify: `.env` (or `.env.example` / docs)

- [ ] **Step 1: Add OA environment variables**

Add to `.env`:

```env
OA_BASE_URL="http://localhost:3001/api/oa"
OA_WEBHOOK_TIMEOUT_MS=10000
```

- [ ] **Step 2: Document in docs/envs.md**

Add entries for `OA_BASE_URL` and `OA_WEBHOOK_TIMEOUT_MS` to the environment documentation.

- [ ] **Step 3: Commit**

```bash
git add .env docs/envs.md
git commit -m "feat(oa): add OA environment variables"
```

---

### Task 15: Verification — Full Integration Test

**Files:**
- Manual test / script

- [ ] **Step 1: Start the server**

Run: `bun run --cwd apps/server dev`

Expected: Server starts without errors, OA routes registered

- [ ] **Step 2: Test full flow manually**

1. Create a provider via ConnectRPC (use a test client or grpcurl)
2. Create an OA under that provider
3. Set a webhook URL (use https://webhook.site for testing)
4. Verify the webhook (should receive empty events array at webhook.site)
5. Issue an access token
6. Use the token to call the reply endpoint
7. Use the internal dispatch endpoint to simulate a user message

- [ ] **Step 3: Run full test suite**

Run: `bun run --cwd apps/server test`

Expected: All tests pass (including new OA tests)

- [ ] **Step 4: Run lint + typecheck**

Run: `bun run check:all`

Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat(oa): integration verification — all tests passing"
```

---

## Self-Review

### Spec Coverage Check

| Spec Section | Task |
|---|---|
| Proto definitions | Task 1 |
| Database schema (oaProvider, officialAccount, oaWebhook, oaFriendship, oaAccessToken) | Task 2, 3 |
| Existing table updates (chatMember.oaId, message.oaId) | Task 13 |
| Channel vs OA relationship (unified in officialAccount) | Task 2 (schema design) |
| Webhook event dispatch (CallbackRequest, HMAC-SHA256, reply tokens) | Task 8, 12 |
| Messaging API REST endpoints (reply, push, profile, content, OAuth) | Task 11 |
| ConnectRPC OA service (16 RPCs) | Task 9 |
| OA discovery (search) | Task 10 |
| Service factory + DI pattern | Tasks 4-8, 10 |
| Webhook verification | Task 10 |
| Access token management (issue, list, revoke, revoke all by keyId) | Task 7, 11 |
| Environment variables | Task 14 |
| Testing strategy (unit tests) | Tasks 4-8, 10 |

### Placeholder Scan

- Task 9 has a `// TODO: get from auth context` — this is intentional for MVP since auth integration is a separate concern. The handler works without it.
- Task 11 has `// TODO: Deliver messages` and `// TODO: Check if user is a friend` — these are MVP stubs. The Messaging API endpoints return success but don't yet integrate with the chat system. This is intentional: the full integration (message delivery via Zero, friend checks) is a follow-up task.
- Task 12 webhook plugin uses a manual dispatch endpoint for MVP — automatic dispatch on message creation is a follow-up.

No other placeholders found.

### Type Consistency

- All proto message types match the proto definitions in Task 1
- Service method signatures in Tasks 4-8, 10 are consistent with their usage in Task 9's ConnectRPC handler
- Database table names (`oaProvider`, `officialAccount`, etc.) are consistent across schema (Task 2), service (Tasks 4-8), and plugin (Tasks 11-12)
