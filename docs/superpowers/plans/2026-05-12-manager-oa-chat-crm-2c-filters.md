# Manager OA Chat CRM Phase 2C — Filters

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add default chat filters (All, Unread) and saved custom tag-based filters with AND/OR match mode to the OA manager chat workspace.

**Architecture:** A new `oaChatFilter` table (Zero-synced) stores saved filter definitions per OA. The chat workspace sidebar gains a "Chat settings" group with a "Custom filters" entry that opens a management page. A filter dropdown above the chat list lets operators apply filters. Custom filter create/edit uses a modal with tag selection, match mode, and live hit count computed client-side from Zero-synced data.

**Tech Stack:** Drizzle (migration), Zero (model/permissions/mutations/query), Tamagui (UI), Vitest (tests)

**Spec:** `docs/superpowers/specs/2026-05-09-manager-oa-chat-crm-design.md` — Phase 2C section

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `packages/db/src/migrations/20260512000000_oa_chat_filter.ts` | DB migration |
| Create | `packages/db/src/schema-oa-chat-filter.ts` | Drizzle schema (re-exported from schema-oa) |
| Modify | `packages/db/src/schema-oa.ts` | Add `oaChatFilter` table |
| Create | `packages/zero-schema/src/models/oaChatFilter.ts` | Zero model, permission, mutations |
| Modify | `packages/zero-schema/src/relationships.ts` | Add oaChatFilter relationships |
| Modify | `packages/zero-schema/src/index.ts` | Export new model and queries |
| Create | `packages/zero-schema/src/queries/oaChatFilter.ts` | Zero query |
| Modify | `packages/zero-schema/src/generated/models.ts` | Register model (via zero:generate) |
| Modify | `packages/zero-schema/src/generated/tables.ts` | Register table (via zero:generate) |
| Create | `packages/zero-schema/src/__tests__/manager-oa-crm-filters.test.ts` | Permission + mutation tests |
| Create | `apps/web/src/features/oa-manager/chat/useManagerOAChatFilters.ts` | Filter CRUD hook |
| Create | `apps/web/src/features/oa-manager/chat/ManagerOACustomFiltersPage.tsx` | Filter management list page |
| Create | `apps/web/src/features/oa-manager/chat/ManagerOAFilterModal.tsx` | Create/edit modal |
| Create | `apps/web/src/features/oa-manager/chat/ManagerOAChatFilterDropdown.tsx` | Filter selection dropdown |
| Modify | `apps/web/src/features/oa-manager/chat/ManagerOAChatModeNav.tsx` | Add Chat settings group |
| Modify | `apps/web/src/features/oa-manager/chat/ManagerOAChatWorkspace.tsx` | Wire filter dropdown + custom-filters mode |
| Modify | `apps/web/src/features/oa-manager/chat/ManagerOAChatList.tsx` | Accept active filter, show dropdown |
| Create | `apps/web/app/(app)/manager/[oaId]/chat/custom-filters.tsx` | Route for settings page |

---

## Task 1: DB Migration — oaChatFilter Table

**Files:**
- Create: `packages/db/src/migrations/20260512000000_oa_chat_filter.ts`
- Modify: `packages/db/src/schema-oa.ts`

- [ ] **Step 1: Create migration file**

```typescript
// packages/db/src/migrations/20260512000000_oa_chat_filter.ts
import type { PoolClient } from 'pg'

const sql = `
CREATE TABLE "oaChatFilter" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "oaId" uuid NOT NULL REFERENCES "officialAccount"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "matchMode" text NOT NULL DEFAULT 'any',
  "tagIds" text NOT NULL DEFAULT '[]',
  "sortOrder" integer NOT NULL DEFAULT 0,
  "createdAt" timestamptz DEFAULT now() NOT NULL,
  "updatedAt" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX "oaChatFilter_oaId_idx" ON "oaChatFilter"("oaId");
`

export async function up(client: PoolClient): Promise<void> {
  await client.query(sql)
}

export async function down(client: PoolClient): Promise<void> {
  await client.query('DROP TABLE IF EXISTS "oaChatFilter";')
}
```

- [ ] **Step 2: Add Drizzle schema definition**

Add to the bottom of `packages/db/src/schema-oa.ts`:

```typescript
export const oaChatFilter = pgTable(
  'oaChatFilter',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    oaId: uuid('oaId')
      .notNull()
      .references(() => officialAccount.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    matchMode: text('matchMode').notNull().default('any'),
    tagIds: text('tagIds').notNull().default('[]'),
    sortOrder: integer('sortOrder').notNull().default(0),
    createdAt: timestamp('createdAt', { mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp('updatedAt', { mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [index('oaChatFilter_oaId_idx').on(table.oaId)],
)
```

- [ ] **Step 3: Run the migration**

Run: `bun run --cwd packages/db migrate`
Expected: Migration applies cleanly, `oaChatFilter` table created.

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/migrations/20260512000000_oa_chat_filter.ts packages/db/src/schema-oa.ts
git commit -m "feat(db): add oaChatFilter table migration"
```

---

## Task 2: Zero Model — oaChatFilter

**Files:**
- Create: `packages/zero-schema/src/models/oaChatFilter.ts`

- [ ] **Step 1: Write the model file**

```typescript
// packages/zero-schema/src/models/oaChatFilter.ts
import { number, string, table } from '@rocicorp/zero'
/* eslint-disable @typescript-eslint/no-deprecated -- tx.query is the current Zero mutations API */
import { mutations, run, serverWhere, zql } from 'on-zero'
import type { TableInsertRow } from 'on-zero'

export type OaChatFilter = TableInsertRow<typeof schema>

const MAX_FILTERS_PER_OA = 20

async function readRows(
  tx: { query?: Record<string, any> },
  tableName: string,
  build: (query: any) => any,
) {
  const query = tx.query as Record<string, any> | undefined
  const txQuery = query?.[tableName]
  if (txQuery) {
    return build(txQuery).run()
  }

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
  if (!provider || provider.ownerId !== authData.id) {
    throw new Error('Unauthorized')
  }
}

export const schema = table('oaChatFilter')
  .columns({
    id: string(),
    oaId: string(),
    name: string(),
    matchMode: string(),
    tagIds: string(),
    sortOrder: number(),
    createdAt: number(),
    updatedAt: number(),
  })
  .primaryKey('id')

export const managerOwnedOaChatFilterPermission = serverWhere(
  'oaChatFilter',
  (eb, auth) => {
    const userId = auth?.id || ''
    return eb.exists('oa', (oaQ) =>
      oaQ.whereExists('provider', (providerQ) => providerQ.where('ownerId', userId)),
    )
  },
)

function cleanName(name: string): string {
  const trimmed = name.trim()
  if (trimmed.length === 0) throw new Error('Filter name is required')
  if (trimmed.length > 64) throw new Error('Filter name too long (max 64)')
  return trimmed
}

function validateMatchMode(mode: string): 'all' | 'any' {
  if (mode !== 'all' && mode !== 'any') throw new Error('matchMode must be "all" or "any"')
  return mode
}

function validateTagIds(tagIds: string): string[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(tagIds)
  } catch {
    throw new Error('tagIds must be a JSON array')
  }
  if (!Array.isArray(parsed)) throw new Error('tagIds must be a JSON array')
  if (!parsed.every((id) => typeof id === 'string')) {
    throw new Error('tagIds must contain strings')
  }
  return parsed
}

export const mutate = mutations(schema, managerOwnedOaChatFilterPermission, {
  create: async (
    { authData, tx },
    args: {
      id: string
      oaId: string
      name: string
      matchMode: string
      tagIds: string
      sortOrder: number
      createdAt: number
      updatedAt: number
    },
  ) => {
    if (!authData) throw new Error('Unauthorized')
    await assertManagerOwnsOa(tx as { query?: Record<string, any> }, authData, args.oaId)

    const name = cleanName(args.name)
    const matchMode = validateMatchMode(args.matchMode)
    validateTagIds(args.tagIds)

    const existing = await readRows(tx, 'oaChatFilter', (q) =>
      q.where('oaId', args.oaId),
    )
    if (existing.length >= MAX_FILTERS_PER_OA) {
      throw new Error(`Cannot create more than ${MAX_FILTERS_PER_OA} filters`)
    }

    await tx.mutate.oaChatFilter.insert({
      id: args.id,
      oaId: args.oaId,
      name,
      matchMode,
      tagIds: args.tagIds,
      sortOrder: args.sortOrder,
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
      matchMode: string
      tagIds: string
      sortOrder: number
      updatedAt: number
    },
  ) => {
    if (!authData) throw new Error('Unauthorized')
    await assertManagerOwnsOa(tx as { query?: Record<string, any> }, authData, args.oaId)

    const name = cleanName(args.name)
    const matchMode = validateMatchMode(args.matchMode)
    validateTagIds(args.tagIds)

    await tx.mutate.oaChatFilter.update({
      id: args.id,
      name,
      matchMode,
      tagIds: args.tagIds,
      sortOrder: args.sortOrder,
      updatedAt: args.updatedAt,
    })
  },
  deleteFilter: async ({ authData, tx }, args: { id: string; oaId: string }) => {
    if (!authData) throw new Error('Unauthorized')
    await assertManagerOwnsOa(tx as { query?: Record<string, any> }, authData, args.oaId)

    await tx.mutate.oaChatFilter.delete({ id: args.id })
  },
})
```

- [ ] **Step 2: Commit**

```bash
git add packages/zero-schema/src/models/oaChatFilter.ts
git commit -m "feat(zero-schema): add oaChatFilter model with permissions and mutations"
```

---

## Task 3: Zero Relationships, Query, and Registration

**Files:**
- Modify: `packages/zero-schema/src/relationships.ts`
- Create: `packages/zero-schema/src/queries/oaChatFilter.ts`
- Modify: `packages/zero-schema/src/index.ts`

- [ ] **Step 1: Add relationships**

In `packages/zero-schema/src/relationships.ts`, add the oaChatFilter relationships and update the officialAccount relationships.

Add import at the top with the other table imports (already imported via `* as tables`).

Add before the `allRelationships` array:

```typescript
export const oaChatFilterRelationships = relationships(
  tables.oaChatFilter,
  ({ one }) => ({
    oa: one({
      sourceField: ['oaId'],
      destSchema: tables.officialAccount,
      destField: ['id'],
    }),
  }),
)
```

Add `chatFilters` to `officialAccountRelationships`:

```typescript
chatFilters: many({
  sourceField: ['id'],
  destSchema: tables.oaChatFilter,
  destField: ['oaId'],
}),
```

Add `oaChatFilterRelationships` to the `allRelationships` array.

- [ ] **Step 2: Create query file**

```typescript
// packages/zero-schema/src/queries/oaChatFilter.ts
import { zql } from 'on-zero'
import { managerOwnedOaChatFilterPermission } from '../models/oaChatFilter'

export const oaChatFiltersByOfficialAccountId = (props: {
  oaId: string
  limit?: number
}) => {
  return zql.oaChatFilter
    .where(managerOwnedOaChatFilterPermission)
    .where('oaId', props.oaId)
    .orderBy('sortOrder', 'asc')
    .limit(props.limit ?? 20)
}
```

- [ ] **Step 3: Update index.ts exports**

Add to `packages/zero-schema/src/index.ts`:

In the Models section:
```typescript
export * as oaChatFilterModel from './models/oaChatFilter'
```

In the Queries section:
```typescript
export * as oaChatFilterQueries from './queries/oaChatFilter'
```

- [ ] **Step 4: Run zero:generate**

Run: `bun run --cwd packages/zero-schema zero:generate`
Expected: Generated files updated — `models.ts`, `tables.ts`, `syncedMutations.ts`, `syncedQueries.ts` all include `oaChatFilter`.

**Note:** If the Zero dev server is running, you may need to restart it so the new table is included in the sync publication. If you encounter sync issues, invoke the `zero-schema-migration` skill for the full publication rebuild steps.

- [ ] **Step 5: Build and verify**

Run: `bun run build`
Expected: No build errors.

- [ ] **Step 6: Commit**

```bash
git add packages/zero-schema/src/relationships.ts packages/zero-schema/src/queries/oaChatFilter.ts packages/zero-schema/src/index.ts packages/zero-schema/src/generated/
git commit -m "feat(zero-schema): add oaChatFilter relationships, query, and code generation"
```

---

## Task 4: Zero Permission and Mutation Tests

**Files:**
- Create: `packages/zero-schema/src/__tests__/manager-oa-crm-filters.test.ts`

- [ ] **Step 1: Write permission tests**

```typescript
// packages/zero-schema/src/__tests__/manager-oa-crm-filters.test.ts
import { getRawWhere } from 'on-zero'
import { describe, expect, it, vi } from 'vitest'
import {
  managerOwnedOaChatFilterPermission,
  mutate as filterMutate,
} from '../models/oaChatFilter'
import type { AuthData } from '../types'
import type { Where } from 'on-zero'

type RecordedRelation = {
  calls: unknown[]
  where: (field: string, value: unknown) => RecordedRelation
  whereExists: (
    relation: string,
    cb: (q: RecordedRelation) => unknown,
  ) => RecordedRelation
}

function recordPermission(permission: Where) {
  const makeRelation = (): RecordedRelation => {
    const calls: unknown[] = []
    return {
      calls,
      where(field: string, value: unknown) {
        calls.push(['where', field, value])
        return this
      },
      whereExists(relation: string, cb: (q: RecordedRelation) => unknown) {
        const child = makeRelation()
        cb(child)
        calls.push(['whereExists', relation, child.calls])
        return this
      },
    }
  }

  const eb = {
    cmp(field: string, value: unknown) {
      return ['cmp', field, value]
    },
    exists(relation: string, cb: (q: RecordedRelation) => unknown) {
      const child = makeRelation()
      cb(child)
      return ['exists', relation, child.calls]
    },
  }

  const raw = getRawWhere(permission)
  const auth: AuthData = { id: 'manager-1', role: undefined }
  return JSON.stringify(raw?.(eb as any, auth))
}

function makeTx(rows: Record<string, any[]> = {}) {
  const makeQuery = (data: any[], filters: [string, unknown][] = []): any => {
    return {
      where: vi.fn((field: string, value: unknown) =>
        makeQuery(data, [...filters, [field, value]]),
      ),
      run: vi
        .fn()
        .mockResolvedValue(
          data.filter((row) => filters.every(([field, value]) => row[field] === value)),
        ),
    }
  }

  const query: Record<string, any> = {}
  for (const [table, data] of Object.entries(rows)) {
    query[table] = makeQuery(data)
  }
  return {
    query,
    mutate: {
      oaChatFilter: {
        insert: vi.fn().mockResolvedValue(undefined),
        update: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined),
      },
    },
  }
}

const authData: AuthData = { id: 'manager-1', role: undefined }

describe('oaChatFilter permissions', () => {
  it('requires OA provider ownership', () => {
    const permission = recordPermission(managerOwnedOaChatFilterPermission)
    expect(permission).toContain('"ownerId","manager-1"')
    expect(permission).not.toContain('"userId","manager-1"')
  })
})

describe('create filter', () => {
  it('rejects unauthenticated user', async () => {
    const tx = makeTx()
    await expect(
      (filterMutate as any).create(
        { authData: null, tx },
        {
          id: 'filter-1',
          oaId: 'oa-1',
          name: 'VIP',
          matchMode: 'any',
          tagIds: '["tag-1"]',
          sortOrder: 0,
          createdAt: 1000,
          updatedAt: 1000,
        },
      ),
    ).rejects.toThrow('Unauthorized')
  })

  it('rejects non-owner of the OA', async () => {
    const tx = makeTx({
      officialAccount: [{ id: 'oa-1', providerId: 'prov-1' }],
      oaProvider: [{ id: 'prov-1', ownerId: 'other-manager' }],
    })
    await expect(
      (filterMutate as any).create(
        { authData, tx },
        {
          id: 'filter-1',
          oaId: 'oa-1',
          name: 'VIP',
          matchMode: 'any',
          tagIds: '["tag-1"]',
          sortOrder: 0,
          createdAt: 1000,
          updatedAt: 1000,
        },
      ),
    ).rejects.toThrow('Unauthorized')
  })

  it('creates filter with trimmed name', async () => {
    const tx = makeTx({
      officialAccount: [{ id: 'oa-1', providerId: 'prov-1' }],
      oaProvider: [{ id: 'prov-1', ownerId: 'manager-1' }],
      oaChatFilter: [],
    })
    await (filterMutate as any).create(
      { authData, tx },
      {
        id: 'filter-1',
        oaId: 'oa-1',
        name: '  VIP Customers  ',
        matchMode: 'all',
        tagIds: '["tag-1","tag-2"]',
        sortOrder: 0,
        createdAt: 1000,
        updatedAt: 1000,
      },
    )
    expect(tx.mutate.oaChatFilter.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'VIP Customers',
        matchMode: 'all',
        tagIds: '["tag-1","tag-2"]',
      }),
    )
  })

  it('rejects blank filter name', async () => {
    const tx = makeTx({
      officialAccount: [{ id: 'oa-1', providerId: 'prov-1' }],
      oaProvider: [{ id: 'prov-1', ownerId: 'manager-1' }],
      oaChatFilter: [],
    })
    await expect(
      (filterMutate as any).create(
        { authData, tx },
        {
          id: 'filter-1',
          oaId: 'oa-1',
          name: '   ',
          matchMode: 'any',
          tagIds: '[]',
          sortOrder: 0,
          createdAt: 1000,
          updatedAt: 1000,
        },
      ),
    ).rejects.toThrow('Filter name is required')
  })

  it('rejects invalid matchMode', async () => {
    const tx = makeTx({
      officialAccount: [{ id: 'oa-1', providerId: 'prov-1' }],
      oaProvider: [{ id: 'prov-1', ownerId: 'manager-1' }],
      oaChatFilter: [],
    })
    await expect(
      (filterMutate as any).create(
        { authData, tx },
        {
          id: 'filter-1',
          oaId: 'oa-1',
          name: 'Test',
          matchMode: 'invalid',
          tagIds: '[]',
          sortOrder: 0,
          createdAt: 1000,
          updatedAt: 1000,
        },
      ),
    ).rejects.toThrow('matchMode must be "all" or "any"')
  })

  it('rejects invalid tagIds JSON', async () => {
    const tx = makeTx({
      officialAccount: [{ id: 'oa-1', providerId: 'prov-1' }],
      oaProvider: [{ id: 'prov-1', ownerId: 'manager-1' }],
      oaChatFilter: [],
    })
    await expect(
      (filterMutate as any).create(
        { authData, tx },
        {
          id: 'filter-1',
          oaId: 'oa-1',
          name: 'Test',
          matchMode: 'any',
          tagIds: 'not-json',
          sortOrder: 0,
          createdAt: 1000,
          updatedAt: 1000,
        },
      ),
    ).rejects.toThrow('tagIds must be a JSON array')
  })

  it('enforces max 20 filters per OA', async () => {
    const existingFilters = Array.from({ length: 20 }, (_, i) => ({
      id: `filter-${i}`,
      oaId: 'oa-1',
    }))
    const tx = makeTx({
      officialAccount: [{ id: 'oa-1', providerId: 'prov-1' }],
      oaProvider: [{ id: 'prov-1', ownerId: 'manager-1' }],
      oaChatFilter: existingFilters,
    })
    await expect(
      (filterMutate as any).create(
        { authData, tx },
        {
          id: 'filter-new',
          oaId: 'oa-1',
          name: 'Too Many',
          matchMode: 'any',
          tagIds: '[]',
          sortOrder: 20,
          createdAt: 1000,
          updatedAt: 1000,
        },
      ),
    ).rejects.toThrow('Cannot create more than 20 filters')
  })
})

describe('update filter', () => {
  it('updates filter name and tags', async () => {
    const tx = makeTx({
      officialAccount: [{ id: 'oa-1', providerId: 'prov-1' }],
      oaProvider: [{ id: 'prov-1', ownerId: 'manager-1' }],
    })
    await (filterMutate as any).update(
      { authData, tx },
      {
        id: 'filter-1',
        oaId: 'oa-1',
        name: '  Updated  ',
        matchMode: 'all',
        tagIds: '["tag-3"]',
        sortOrder: 1,
        updatedAt: 2000,
      },
    )
    expect(tx.mutate.oaChatFilter.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'filter-1',
        name: 'Updated',
        matchMode: 'all',
        tagIds: '["tag-3"]',
      }),
    )
  })

  it('rejects non-owner update', async () => {
    const tx = makeTx({
      officialAccount: [{ id: 'oa-1', providerId: 'prov-1' }],
      oaProvider: [{ id: 'prov-1', ownerId: 'other-manager' }],
    })
    await expect(
      (filterMutate as any).update(
        { authData, tx },
        {
          id: 'filter-1',
          oaId: 'oa-1',
          name: 'Updated',
          matchMode: 'any',
          tagIds: '[]',
          sortOrder: 0,
          updatedAt: 2000,
        },
      ),
    ).rejects.toThrow('Unauthorized')
  })
})

describe('delete filter', () => {
  it('deletes filter', async () => {
    const tx = makeTx({
      officialAccount: [{ id: 'oa-1', providerId: 'prov-1' }],
      oaProvider: [{ id: 'prov-1', ownerId: 'manager-1' }],
    })
    await (filterMutate as any).deleteFilter(
      { authData, tx },
      { id: 'filter-1', oaId: 'oa-1' },
    )
    expect(tx.mutate.oaChatFilter.delete).toHaveBeenCalledWith({ id: 'filter-1' })
  })

  it('rejects non-owner deletion', async () => {
    const tx = makeTx({
      officialAccount: [{ id: 'oa-1', providerId: 'prov-1' }],
      oaProvider: [{ id: 'prov-1', ownerId: 'other-manager' }],
    })
    await expect(
      (filterMutate as any).deleteFilter(
        { authData, tx },
        { id: 'filter-1', oaId: 'oa-1' },
      ),
    ).rejects.toThrow('Unauthorized')
  })
})
```

- [ ] **Step 2: Run tests**

Run: `bun run --cwd packages/zero-schema test -- --run manager-oa-crm-filters`
Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add packages/zero-schema/src/__tests__/manager-oa-crm-filters.test.ts
git commit -m "test(zero-schema): add oaChatFilter permission and mutation tests"
```

---

## Task 5: useManagerOAChatFilters Hook

**Files:**
- Create: `apps/web/src/features/oa-manager/chat/useManagerOAChatFilters.ts`

- [ ] **Step 1: Create the hook**

```typescript
// apps/web/src/features/oa-manager/chat/useManagerOAChatFilters.ts
import { oaChatFiltersByOfficialAccountId } from '@vine/zero-schema/queries/oaChatFilter'
import { oaContactTagsByOfficialAccountId } from '@vine/zero-schema/queries/oaContactTag'
import { useMemo } from 'react'
import { useZeroQuery, zero, run } from '~/zero/client'
import { showToast } from '~/interface/toast/Toast'

export type ChatFilterItem = {
  id: string
  name: string
  matchMode: 'all' | 'any'
  tagIds: string[]
  sortOrder: number
}

function parseTagIds(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function useManagerOAChatFilters(oaId: string | undefined) {
  const [rawFilters] = useZeroQuery(
    oaChatFiltersByOfficialAccountId,
    { oaId: oaId ?? '' },
    { enabled: Boolean(oaId) },
  )

  const [rawTags] = useZeroQuery(
    oaContactTagsByOfficialAccountId,
    { oaId: oaId ?? '' },
    { enabled: Boolean(oaId) },
  )

  const filters = useMemo<ChatFilterItem[]>(
    () =>
      (rawFilters ?? []).map((f) => ({
        id: f.id,
        name: f.name,
        matchMode: f.matchMode as 'all' | 'any',
        tagIds: parseTagIds(f.tagIds),
        sortOrder: f.sortOrder,
      })),
    [rawFilters],
  )

  const allTags = useMemo(
    () => (rawTags ?? []).map((t) => ({ id: t.id, name: t.name, color: t.color })),
    [rawTags],
  )

  const createFilter = async (
    name: string,
    matchMode: 'all' | 'any',
    tagIds: string[],
  ) => {
    if (!oaId) return
    const id = crypto.randomUUID()
    const now = Date.now()
    const sortOrder = filters.length
    await run(
      zero.mutate.oaChatFilter.create({
        id,
        oaId,
        name,
        matchMode,
        tagIds: JSON.stringify(tagIds),
        sortOrder,
        createdAt: now,
        updatedAt: now,
      }),
    )
  }

  const updateFilter = async (
    id: string,
    name: string,
    matchMode: 'all' | 'any',
    tagIds: string[],
    sortOrder: number,
  ) => {
    if (!oaId) return
    await run(
      zero.mutate.oaChatFilter.update({
        id,
        oaId,
        name,
        matchMode,
        tagIds: JSON.stringify(tagIds),
        sortOrder,
        updatedAt: Date.now(),
      }),
    )
  }

  const deleteFilter = async (id: string) => {
    if (!oaId) return
    await run(zero.mutate.oaChatFilter.deleteFilter({ id, oaId }))
  }

  return { filters, allTags, createFilter, updateFilter, deleteFilter }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/features/oa-manager/chat/useManagerOAChatFilters.ts
git commit -m "feat(web): add useManagerOAChatFilters hook"
```

---

## Task 6: Sidebar Navigation — Add Chat Settings Group

**Files:**
- Modify: `apps/web/src/features/oa-manager/chat/ManagerOAChatModeNav.tsx`

- [ ] **Step 1: Update mode type and add collapsible group**

Replace the entire file content:

```typescript
// apps/web/src/features/oa-manager/chat/ManagerOAChatModeNav.tsx
import { useState } from 'react'
import { SizableText, YStack } from 'tamagui'
import { Pressable } from '~/interface/buttons/Pressable'
import { ChatCircleIcon } from '~/interface/icons/phosphor/ChatCircleIcon'
import { FunnelIcon } from '~/interface/icons/phosphor/FunnelIcon'
import { GearIcon } from '~/interface/icons/phosphor/GearIcon'
import { UserIcon } from '~/interface/icons/phosphor/UserIcon'

export type ManagerOAChatMode = 'chats' | 'contacts' | 'custom-filters'

type Props = {
  mode: ManagerOAChatMode
  onModeChange: (mode: ManagerOAChatMode) => void
}

const mainItems = [
  { mode: 'chats' as const, label: 'Chats', icon: ChatCircleIcon },
  { mode: 'contacts' as const, label: 'Contacts', icon: UserIcon },
]

const settingsItems = [
  { mode: 'custom-filters' as const, label: 'Custom\nfilters', icon: FunnelIcon },
]

export function ManagerOAChatModeNav({ mode, onModeChange }: Props) {
  const isSettingsActive = settingsItems.some((item) => item.mode === mode)
  const [settingsOpen, setSettingsOpen] = useState(isSettingsActive)

  return (
    <YStack width={88} shrink={0} borderRightWidth={1} borderColor="$borderColor">
      {mainItems.map((item) => {
        const Icon = item.icon
        const active = mode === item.mode

        return (
          <Pressable
            key={item.mode}
            role="button"
            aria-label={`Show ${item.label}`}
            onPress={() => onModeChange(item.mode)}
            p="$3"
            gap="$2"
            items="center"
            cursor="pointer"
            bg={active ? '$color3' : 'transparent'}
            hoverStyle={{ bg: active ? '$color3' : '$color2' }}
          >
            <Icon size={20} />
            <SizableText size="$1" fontWeight={active ? '700' : '500'} text="center">
              {item.label}
            </SizableText>
          </Pressable>
        )
      })}

      <YStack borderTopWidth={1} borderColor="$borderColor" mt="$2" pt="$2">
        <Pressable
          role="button"
          aria-label="Chat settings"
          onPress={() => setSettingsOpen((prev) => !prev)}
          p="$3"
          gap="$2"
          items="center"
          cursor="pointer"
          hoverStyle={{ bg: '$color2' }}
        >
          <GearIcon size={20} />
          <SizableText size="$1" fontWeight="500" text="center">
            Chat{'\n'}settings
          </SizableText>
        </Pressable>

        {settingsOpen &&
          settingsItems.map((item) => {
            const Icon = item.icon
            const active = mode === item.mode

            return (
              <Pressable
                key={item.mode}
                role="button"
                aria-label={`Show ${item.label.replace('\n', ' ')}`}
                onPress={() => onModeChange(item.mode)}
                p="$2"
                pl="$4"
                gap="$1"
                items="center"
                cursor="pointer"
                bg={active ? '$color3' : 'transparent'}
                hoverStyle={{ bg: active ? '$color3' : '$color2' }}
              >
                <Icon size={16} />
                <SizableText
                  size="$1"
                  fontWeight={active ? '700' : '500'}
                  text="center"
                >
                  {item.label}
                </SizableText>
              </Pressable>
            )
          })}
      </YStack>
    </YStack>
  )
}
```

- [ ] **Step 2: Verify the build**

Run: `bun run build`
Expected: No type or build errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/oa-manager/chat/ManagerOAChatModeNav.tsx
git commit -m "feat(web): add Chat settings group with Custom filters to sidebar nav"
```

---

## Task 7: Filter Management Page and Route

**Files:**
- Create: `apps/web/src/features/oa-manager/chat/ManagerOACustomFiltersPage.tsx`
- Create: `apps/web/app/(app)/manager/[oaId]/chat/custom-filters.tsx`
- Modify: `apps/web/src/features/oa-manager/chat/ManagerOAChatWorkspace.tsx`

- [ ] **Step 1: Create the management page component**

```typescript
// apps/web/src/features/oa-manager/chat/ManagerOACustomFiltersPage.tsx
import { useState } from 'react'
import { ScrollView, SizableText, XStack, YStack } from 'tamagui'
import { Button } from '~/interface/buttons/Button'
import { Pressable } from '~/interface/buttons/Pressable'
import { dialogConfirm } from '~/interface/dialogs/actions'
import { showToast } from '~/interface/toast/Toast'
import { ManagerOAFilterModal } from './ManagerOAFilterModal'
import {
  useManagerOAChatFilters,
  type ChatFilterItem,
} from './useManagerOAChatFilters'

type Props = {
  oaId: string
  onBackToChat: () => void
}

export function ManagerOACustomFiltersPage({ oaId, onBackToChat }: Props) {
  const { filters, allTags, createFilter, updateFilter, deleteFilter } =
    useManagerOAChatFilters(oaId)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingFilter, setEditingFilter] = useState<ChatFilterItem | null>(null)

  const handleCreate = () => {
    setEditingFilter(null)
    setModalOpen(true)
  }

  const handleEdit = (filter: ChatFilterItem) => {
    setEditingFilter(filter)
    setModalOpen(true)
  }

  const handleDelete = async (filter: ChatFilterItem) => {
    const confirmed = await dialogConfirm({
      title: 'Delete filter?',
      description: `Delete "${filter.name}"? This cannot be undone.`,
    })
    if (!confirmed) return
    try {
      await deleteFilter(filter.id)
      showToast('Filter deleted', { type: 'success' })
    } catch {
      showToast('Failed to delete filter', { type: 'error' })
    }
  }

  const handleSave = async (
    name: string,
    matchMode: 'all' | 'any',
    tagIds: string[],
  ) => {
    try {
      if (editingFilter) {
        await updateFilter(editingFilter.id, name, matchMode, tagIds, editingFilter.sortOrder)
        showToast('Filter updated', { type: 'success' })
      } else {
        await createFilter(name, matchMode, tagIds)
        showToast('Filter created', { type: 'success' })
      }
      setModalOpen(false)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save filter', {
        type: 'error',
      })
    }
  }

  return (
    <YStack flex={1} p="$5" gap="$4" $platform-web={{ overflowY: 'auto' }}>
      <XStack items="center" justify="space-between">
        <XStack items="center" gap="$3">
          <Pressable
            role="button"
            aria-label="Back to chat"
            onPress={onBackToChat}
            cursor="pointer"
          >
            <SizableText size="$2" color="$color10">
              ← Back to chat
            </SizableText>
          </Pressable>
          <SizableText size="$6" fontWeight="700">
            Custom Filters
          </SizableText>
        </XStack>
        <Button
          size="$3"
          onPress={handleCreate}
          disabled={filters.length >= 20}
        >
          New filter
        </Button>
      </XStack>

      <SizableText size="$2" color="$color10">
        Create filters to quickly find chats by tag. You can create up to 20
        filters.
      </SizableText>

      {filters.length === 0 ? (
        <YStack py="$6" items="center">
          <SizableText size="$3" color="$color10">
            No custom filters yet
          </SizableText>
        </YStack>
      ) : (
        <ScrollView>
          <YStack gap="$2">
            {filters.map((filter) => (
              <XStack
                key={filter.id}
                p="$3"
                rounded="$3"
                borderWidth={1}
                borderColor="$borderColor"
                items="center"
                justify="space-between"
                gap="$3"
              >
                <YStack flex={1} gap="$1">
                  <SizableText size="$3" fontWeight="600">
                    {filter.name}
                  </SizableText>
                  <XStack gap="$2" items="center">
                    <SizableText size="$1" color="$color10">
                      {filter.matchMode === 'all' ? 'Match all' : 'Match any'} ·{' '}
                      {filter.tagIds.length} tag{filter.tagIds.length !== 1 ? 's' : ''}
                    </SizableText>
                  </XStack>
                  <XStack gap="$1" flexWrap="wrap" mt="$1">
                    {filter.tagIds.map((tagId) => {
                      const tag = allTags.find((t) => t.id === tagId)
                      return tag ? (
                        <YStack key={tagId} px="$2" py="$1" rounded="$2" bg="$color3">
                          <SizableText size="$1">{tag.name}</SizableText>
                        </YStack>
                      ) : null
                    })}
                  </XStack>
                </YStack>
                <XStack gap="$2">
                  <Button
                    size="$2"
                    variant="outlined"
                    onPress={() => handleEdit(filter)}
                  >
                    Edit
                  </Button>
                  <Button
                    size="$2"
                    variant="outlined"
                    onPress={() => handleDelete(filter)}
                  >
                    Delete
                  </Button>
                </XStack>
              </XStack>
            ))}
          </YStack>
        </ScrollView>
      )}

      {modalOpen && (
        <ManagerOAFilterModal
          oaId={oaId}
          filter={editingFilter}
          allTags={allTags}
          onSave={handleSave}
          onClose={() => setModalOpen(false)}
        />
      )}
    </YStack>
  )
}
```

- [ ] **Step 2: Update workspace to handle custom-filters mode**

In `apps/web/src/features/oa-manager/chat/ManagerOAChatWorkspace.tsx`, add the import and conditional rendering.

Add import:
```typescript
import { ManagerOACustomFiltersPage } from './ManagerOACustomFiltersPage'
```

Replace the return statement's inner content. After the `<ManagerOAChatModeNav>`, wrap the remaining columns in a conditional:

```typescript
{mode === 'custom-filters' ? (
  <ManagerOACustomFiltersPage oaId={oaId} onBackToChat={() => setMode('chats')} />
) : (
  <>
    {mode === 'contacts' ? (
      <ManagerOAContactList ... />
    ) : (
      <ManagerOAChatList ... />
    )}
    <ManagerOAChatRoom ... />
    {(selected || profileContact) && (
      <ManagerOAProfilePanel ... />
    )}
  </>
)}
```

Keep the existing prop wiring for the list/room/panel components unchanged.

- [ ] **Step 3: Create route file**

```typescript
// apps/web/app/(app)/manager/[oaId]/chat/custom-filters.tsx
import { useActiveParams } from 'one'
import { ManagerOAChatWorkspace } from '~/features/oa-manager/chat/ManagerOAChatWorkspace'

export default function ManagerOAChatCustomFiltersPage() {
  const params = useActiveParams<{ oaId: string }>()
  return <ManagerOAChatWorkspace oaId={params.oaId!} initialMode="custom-filters" />
}
```

To support `initialMode`, update the workspace `Props` type and `useState` call:

```typescript
type Props = {
  oaId: string
  chatId?: string
  initialMode?: ManagerOAChatMode
}

export function ManagerOAChatWorkspace({ oaId, chatId, initialMode }: Props) {
  const [mode, setMode] = useState<ManagerOAChatMode>(initialMode ?? 'chats')
  // ...rest unchanged
```

- [ ] **Step 4: Build and verify**

Run: `bun run build`
Expected: Build succeeds. The page renders when navigating to the custom-filters mode.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/oa-manager/chat/ManagerOACustomFiltersPage.tsx apps/web/src/features/oa-manager/chat/ManagerOAChatWorkspace.tsx apps/web/app/\(app\)/manager/\[oaId\]/chat/custom-filters.tsx
git commit -m "feat(web): add Custom Filters management page and route"
```

---

## Task 8: Filter Create/Edit Modal with Live Hit Count

**Files:**
- Create: `apps/web/src/features/oa-manager/chat/ManagerOAFilterModal.tsx`

The modal needs chat data for the live hit count. It uses `useManagerOAChats` for the chat list and `useManagerOAContacts` for tag assignment data.

- [ ] **Step 1: Create the modal component**

```typescript
// apps/web/src/features/oa-manager/chat/ManagerOAFilterModal.tsx
import { useMemo, useState } from 'react'
import { SizableText, XStack, YStack } from 'tamagui'
import { Button } from '~/interface/buttons/Button'
import { Input } from '~/interface/forms/Input'
import { Pressable } from '~/interface/buttons/Pressable'
import type { ChatFilterItem } from './useManagerOAChatFilters'
import { useManagerOAChats } from './useManagerOAChats'
import { useManagerOAContacts } from './useManagerOAContacts'

type TagOption = {
  id: string
  name: string
  color: string | null | undefined
}

type Props = {
  oaId: string
  filter: ChatFilterItem | null
  allTags: TagOption[]
  onSave: (name: string, matchMode: 'all' | 'any', tagIds: string[]) => void
  onClose: () => void
}

export function ManagerOAFilterModal({
  oaId,
  filter,
  allTags,
  onSave,
  onClose,
}: Props) {
  const [name, setName] = useState(filter?.name ?? '')
  const [matchMode, setMatchMode] = useState<'all' | 'any'>(
    filter?.matchMode ?? 'any',
  )
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(
    filter?.tagIds ?? [],
  )
  const [isSaving, setIsSaving] = useState(false)

  const { chats } = useManagerOAChats(oaId, '')
  const { contacts } = useManagerOAContacts(oaId, '', chats)

  const hitCount = useMemo(() => {
    if (selectedTagIds.length === 0) return chats.length

    const chatUserIds = new Set(chats.map((c) => c.userId))
    let count = 0
    for (const contact of contacts) {
      if (!chatUserIds.has(contact.userId)) continue
      const contactTagIds = new Set(contact.tags.map((t) => t.id))
      const matches =
        matchMode === 'all'
          ? selectedTagIds.every((id) => contactTagIds.has(id))
          : selectedTagIds.some((id) => contactTagIds.has(id))
      if (matches) count++
    }
    return count
  }, [chats, contacts, selectedTagIds, matchMode])

  const toggleTag = (tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId],
    )
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await onSave(name, matchMode, selectedTagIds)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <YStack
      position="absolute"
      top={0}
      left={0}
      right={0}
      bottom={0}
      bg="rgba(0,0,0,0.4)"
      items="center"
      justify="center"
      zi={100}
    >
      <YStack
        bg="$background"
        rounded="$4"
        p="$5"
        gap="$4"
        width={420}
        maxH="80%"
        $platform-web={{ overflowY: 'auto' }}
      >
        <SizableText size="$5" fontWeight="700">
          {filter ? 'Edit filter' : 'New filter'}
        </SizableText>

        <YStack gap="$2">
          <SizableText size="$2" fontWeight="600">
            Filter name
          </SizableText>
          <Input
            value={name}
            onChangeText={setName}
            placeholder="e.g. VIP Customers"
            size="$3"
          />
        </YStack>

        <YStack gap="$2">
          <SizableText size="$2" fontWeight="600">
            Match mode
          </SizableText>
          <XStack gap="$2">
            <Button
              size="$3"
              flex={1}
              variant={matchMode === 'any' ? undefined : 'outlined'}
              onPress={() => setMatchMode('any')}
            >
              Match any (OR)
            </Button>
            <Button
              size="$3"
              flex={1}
              variant={matchMode === 'all' ? undefined : 'outlined'}
              onPress={() => setMatchMode('all')}
            >
              Match all (AND)
            </Button>
          </XStack>
        </YStack>

        <YStack gap="$2">
          <SizableText size="$2" fontWeight="600">
            Tags
          </SizableText>
          {allTags.length === 0 ? (
            <SizableText size="$2" color="$color10">
              No tags created yet. Create tags in the profile panel first.
            </SizableText>
          ) : (
            <XStack gap="$2" flexWrap="wrap">
              {allTags.map((tag) => {
                const selected = selectedTagIds.includes(tag.id)
                return (
                  <Pressable
                    key={tag.id}
                    role="button"
                    aria-label={`${selected ? 'Remove' : 'Add'} tag ${tag.name}`}
                    onPress={() => toggleTag(tag.id)}
                    px="$3"
                    py="$2"
                    rounded="$2"
                    bg={selected ? '$color7' : '$color3'}
                    cursor="pointer"
                    hoverStyle={{ bg: selected ? '$color8' : '$color4' }}
                  >
                    <SizableText
                      size="$2"
                      color={selected ? '$color1' : undefined}
                    >
                      {tag.name}
                    </SizableText>
                  </Pressable>
                )
              })}
            </XStack>
          )}
        </YStack>

        <XStack
          p="$3"
          rounded="$3"
          bg="$color3"
          items="center"
          justify="center"
        >
          <SizableText size="$3" fontWeight="600">
            {hitCount} chat{hitCount !== 1 ? 's' : ''} match
          </SizableText>
        </XStack>

        <XStack gap="$3" justify="flex-end">
          <Button size="$3" variant="outlined" onPress={onClose}>
            Cancel
          </Button>
          <Button
            size="$3"
            onPress={handleSave}
            disabled={!name.trim() || isSaving}
          >
            {filter ? 'Save' : 'Create'}
          </Button>
        </XStack>
      </YStack>
    </YStack>
  )
}
```

- [ ] **Step 2: Build and verify**

Run: `bun run build`
Expected: No errors. The modal renders when "New filter" or "Edit" is clicked on the management page.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/oa-manager/chat/ManagerOAFilterModal.tsx
git commit -m "feat(web): add filter create/edit modal with live hit count"
```

---

## Task 9: Filter Dropdown and Chat List Filtering

**Files:**
- Create: `apps/web/src/features/oa-manager/chat/ManagerOAChatFilterDropdown.tsx`
- Modify: `apps/web/src/features/oa-manager/chat/ManagerOAChatList.tsx`
- Modify: `apps/web/src/features/oa-manager/chat/ManagerOAChatWorkspace.tsx`

- [ ] **Step 1: Create the filter dropdown component**

```typescript
// apps/web/src/features/oa-manager/chat/ManagerOAChatFilterDropdown.tsx
import { useState } from 'react'
import { SizableText, XStack, YStack } from 'tamagui'
import { Pressable } from '~/interface/buttons/Pressable'
import type { ChatFilterItem } from './useManagerOAChatFilters'

export type ActiveFilter =
  | { type: 'all' }
  | { type: 'unread' }
  | { type: 'custom'; filterId: string }

type Props = {
  activeFilter: ActiveFilter
  onFilterChange: (filter: ActiveFilter) => void
  customFilters: ChatFilterItem[]
}

function getFilterLabel(active: ActiveFilter, customFilters: ChatFilterItem[]): string {
  if (active.type === 'all') return 'All'
  if (active.type === 'unread') return 'Unread'
  const filter = customFilters.find((f) => f.id === active.filterId)
  return filter?.name ?? 'All'
}

export function ManagerOAChatFilterDropdown({
  activeFilter,
  onFilterChange,
  customFilters,
}: Props) {
  const [open, setOpen] = useState(false)

  const selectFilter = (filter: ActiveFilter) => {
    onFilterChange(filter)
    setOpen(false)
  }

  return (
    <YStack position="relative">
      <Pressable
        role="button"
        aria-label="Select chat filter"
        onPress={() => setOpen((prev) => !prev)}
        px="$3"
        py="$2"
        rounded="$2"
        bg="$color2"
        cursor="pointer"
        hoverStyle={{ bg: '$color3' }}
      >
        <XStack items="center" justify="space-between">
          <SizableText size="$2" fontWeight="600">
            {getFilterLabel(activeFilter, customFilters)}
          </SizableText>
          <SizableText size="$1" color="$color10">
            {open ? '▲' : '▼'}
          </SizableText>
        </XStack>
      </Pressable>

      {open && (
        <YStack
          position="absolute"
          top="100%"
          left={0}
          right={0}
          mt="$1"
          bg="$background"
          rounded="$3"
          borderWidth={1}
          borderColor="$borderColor"
          zi={50}
          elevation="$2"
          $platform-web={{ overflowY: 'auto' }}
          maxH={300}
        >
          <FilterOption
            label="All"
            active={activeFilter.type === 'all'}
            onPress={() => selectFilter({ type: 'all' })}
          />
          <FilterOption
            label="Unread"
            active={activeFilter.type === 'unread'}
            onPress={() => selectFilter({ type: 'unread' })}
          />

          {customFilters.length > 0 && (
            <>
              <YStack
                px="$3"
                py="$2"
                borderTopWidth={1}
                borderColor="$borderColor"
              >
                <SizableText size="$1" color="$color10" fontWeight="600">
                  Custom filters
                </SizableText>
              </YStack>
              {customFilters.map((filter) => (
                <FilterOption
                  key={filter.id}
                  label={filter.name}
                  active={
                    activeFilter.type === 'custom' &&
                    activeFilter.filterId === filter.id
                  }
                  onPress={() =>
                    selectFilter({ type: 'custom', filterId: filter.id })
                  }
                />
              ))}
            </>
          )}
        </YStack>
      )}
    </YStack>
  )
}

function FilterOption({
  label,
  active,
  onPress,
}: {
  label: string
  active: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      role="button"
      aria-label={`Filter: ${label}`}
      onPress={onPress}
      px="$3"
      py="$2"
      cursor="pointer"
      bg={active ? '$color3' : 'transparent'}
      hoverStyle={{ bg: active ? '$color3' : '$color2' }}
    >
      <SizableText size="$2" fontWeight={active ? '700' : '400'}>
        {label}
      </SizableText>
    </Pressable>
  )
}
```

- [ ] **Step 2: Add filter dropdown to chat list**

Modify `apps/web/src/features/oa-manager/chat/ManagerOAChatList.tsx`.

Add imports:
```typescript
import {
  ManagerOAChatFilterDropdown,
  type ActiveFilter,
} from './ManagerOAChatFilterDropdown'
import type { ChatFilterItem } from './useManagerOAChatFilters'
```

Add props:
```typescript
type Props = {
  oaId: string
  selectedChatId?: string
  searchQuery: string
  onSearchQueryChange: (value: string) => void
  chats: ManagerOAChatListItem[]
  contacts: ManagerOAContactListItem[]
  isLoading: boolean
  activeFilter: ActiveFilter
  onFilterChange: (filter: ActiveFilter) => void
  customFilters: ChatFilterItem[]
}
```

Add the dropdown above the search input in the header area:

```typescript
<YStack p="$3" gap="$2" borderBottomWidth={1} borderColor="$borderColor">
  <ManagerOAChatFilterDropdown
    activeFilter={activeFilter}
    onFilterChange={onFilterChange}
    customFilters={customFilters}
  />
  <Input
    value={searchQuery}
    onChangeText={onSearchQueryChange}
    placeholder="Search chats"
    size="$3"
  />
</YStack>
```

- [ ] **Step 3: Wire filtering logic in the workspace**

Modify `apps/web/src/features/oa-manager/chat/ManagerOAChatWorkspace.tsx`.

Add imports:
```typescript
import { useManagerOAChatFilters, type ChatFilterItem } from './useManagerOAChatFilters'
import type { ActiveFilter } from './ManagerOAChatFilterDropdown'
```

Add state and hook:
```typescript
const [activeFilter, setActiveFilter] = useState<ActiveFilter>({ type: 'all' })
const { filters: customFilters } = useManagerOAChatFilters(oaId)
```

Add a `filteredChats` memo that applies the active filter:
```typescript
const filteredChats = useMemo(() => {
  if (activeFilter.type === 'all') return chats
  if (activeFilter.type === 'unread') return chats.filter((c) => c.hasUnread)

  const filter = customFilters.find((f) => f.id === activeFilter.filterId)
  if (!filter || filter.tagIds.length === 0) return chats

  return chats.filter((chat) => {
    const contact = contacts.find((c) => c.userId === chat.userId)
    if (!contact) return false
    const contactTagIds = new Set(contact.tags.map((t) => t.id))
    return filter.matchMode === 'all'
      ? filter.tagIds.every((id) => contactTagIds.has(id))
      : filter.tagIds.some((id) => contactTagIds.has(id))
  })
}, [chats, contacts, activeFilter, customFilters])
```

Pass `filteredChats` instead of `chats` to `ManagerOAChatList`, and pass the new filter props:

```typescript
<ManagerOAChatList
  oaId={oaId}
  selectedChatId={chatId}
  searchQuery={searchQuery}
  onSearchQueryChange={setSearchQuery}
  chats={filteredChats}
  contacts={contacts}
  isLoading={isLoading}
  activeFilter={activeFilter}
  onFilterChange={setActiveFilter}
  customFilters={customFilters}
/>
```

- [ ] **Step 4: Build and verify**

Run: `bun run build`
Expected: No errors. Full build passes.

- [ ] **Step 5: Run all tests**

Run: `bun run test`
Expected: All existing tests still pass, new filter tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/oa-manager/chat/ManagerOAChatFilterDropdown.tsx apps/web/src/features/oa-manager/chat/ManagerOAChatList.tsx apps/web/src/features/oa-manager/chat/ManagerOAChatWorkspace.tsx
git commit -m "feat(web): add filter dropdown to chat list with All, Unread, and custom filter support"
```

---

## Task 10: Manual Verification

- [ ] **Step 1: Start dev environment**

Run: `docker compose up -d && bun run dev`

- [ ] **Step 2: Verify sidebar navigation**

Navigate to `/manager/:oaId/chat`. Confirm:
- "Chats" and "Contacts" modes still work as before
- "Chat settings" group appears below a divider
- Clicking "Chat settings" expands to show "Custom filters"
- Clicking "Custom filters" shows the management page

- [ ] **Step 3: Verify filter CRUD**

On the Custom Filters page:
- Click "New filter" — modal opens
- Enter name, select tags, toggle AND/OR, observe hit count updates
- Save — filter appears in the list
- Edit — modal opens with saved values pre-filled
- Delete — confirm dialog, filter removed

- [ ] **Step 4: Verify filter dropdown**

Switch back to Chats mode:
- Filter dropdown appears above search bar
- "All" is default, shows all chats
- "Unread" filters to unread chats only
- Custom filters appear in dropdown under "Custom filters" heading
- Selecting a custom filter filters the chat list by tags

- [ ] **Step 5: Verify no regressions**

- Chat list still works (select chat, read messages, send messages)
- Contact list still works (select contact, view profile)
- Profile panel still shows tags and notes
- Tag CRUD in profile panel still works

- [ ] **Step 6: Run full checks**

Run: `bun run check:all`
Expected: No lint or type errors.

- [ ] **Step 7: Final commit if any fixups needed**

```bash
git add -A
git commit -m "fix(web): address review feedback from manual verification"
```
