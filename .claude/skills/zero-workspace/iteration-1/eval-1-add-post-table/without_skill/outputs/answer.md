# Adding a `post` table to the Zero data layer

The Zero schema in this repo lives in `packages/zero-schema/src/models/`. Each table is one file that exports a `schema` (the table definition) plus a `mutate` (mutators + permissions). The closest existing analog to what you're asking for is `models/todo.ts` — a per-user table where each row's `userId` must match the authenticated user. I'll mirror that pattern.

## 1. The model file

Create `packages/zero-schema/src/models/post.ts`:

```typescript
import { number, string, table } from '@rocicorp/zero'
import { mutations, serverWhere } from 'on-zero'

import type { TableInsertRow } from 'on-zero'

export type Post = TableInsertRow<typeof schema>

export const schema = table('post')
  .columns({
    id: string(),
    userId: string(),
    caption: string().optional(),
    imageUrl: string(),
    createdAt: number(),
  })
  .primaryKey('id')

const permissions = serverWhere('post', (_, auth) => {
  return _.cmp('userId', auth?.id || '')
})

export const mutate = mutations(schema, permissions)
```

A few notes on this:

- `caption` is the only optional field — `.optional()` makes it nullable in both Zero and the generated TS types.
- `serverWhere` gates **both reads and writes** on the server. Returning `cmp('userId', auth?.id || '')` means a user can only see/insert/update/delete their own rows — exactly what you asked for. Falling back to `''` when there's no auth ensures unauthenticated clients match nothing.
- `createdAt` is `number()` (epoch ms), matching the convention used by `todo` and `message`.

## 2. Other steps you need to do

Zero is the read/sync layer, but the underlying Postgres table and a few other wiring points are not auto-generated. Here's the full checklist:

### a. Add the Drizzle table in `packages/db/src/schema-public.ts`

Zero replicates from Postgres, so the table has to actually exist there. Add it next to `todo` (see lines 31–41 of `schema-public.ts`):

```typescript
export const post = pgTable(
  'post',
  {
    id: text('id').primaryKey(),
    userId: text('userId').notNull(),
    caption: text('caption'),
    imageUrl: text('imageUrl').notNull(),
    createdAt: timestamp('createdAt', { mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [index('post_userId_idx').on(table.userId)],
)
```

Important: keep this in `schema-public.ts` (not `schema-private.ts`). The migrate script in `packages/db/src/migrate.ts` builds the `zero_takeout` Postgres publication from every `public` table that isn't in `schema-private.ts`, so anything in `schema-public.ts` is automatically picked up by Zero replication.

> Note that the schema column types differ slightly across the two layers — Drizzle uses `timestamp('createdAt', { mode: 'string' })` for `createdAt`, while the Zero model uses `number()`. That mismatch is a known wart in the repo (the `todo` table does the same); follow the existing convention unless you want to refactor both.

### b. Write a migration in `packages/db/src/migrations/`

Add a new file like `20260419120000_add_post.ts` following the pattern in the most recent migration (`20260418000002_group_approval.ts`):

```typescript
import type { PoolClient } from 'pg'

const sql = `CREATE TABLE IF NOT EXISTS "post" (
  "id" text PRIMARY KEY NOT NULL,
  "userId" text NOT NULL,
  "caption" text,
  "imageUrl" text NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "post_userId_idx" ON "post" ("userId");`

export async function up(client: PoolClient) {
  await client.query(sql)
}
```

When migrations run, `ensureZeroPublication()` in `migrate.ts` will drop and recreate the `zero_takeout` publication so the new table is included automatically.

### c. (Optional) Add relationships in `packages/zero-schema/src/relationships.ts`

If you want `post` ↔ `userPublic` traversals in queries (e.g., `query.post.related('user')` or `query.userPublic.related('posts')`), extend `relationships.ts`:

```typescript
export const postRelationships = relationships(tables.post, ({ one }) => ({
  user: one({
    sourceField: ['userId'],
    destSchema: tables.userPublic,
    destField: ['id'],
  }),
}))
```

…and add `postRelationships` to the `allRelationships` array at the bottom of the file. If you also want `userPublic.posts`, add a `many` to the existing `userRelationships` block, mirroring how `todos` is wired.

### d. Re-export the model from `packages/zero-schema/src/index.ts`

Next to the other model re-exports:

```typescript
export * as postModel from './models/post'
```

### e. Regenerate the Zero artifacts

From `packages/zero-schema/`:

```bash
bun zero:generate
```

This runs `on-zero generate`, which rewrites everything under `packages/zero-schema/src/generated/` (`tables.ts`, `models.ts`, `types.ts`, `groupedQueries.ts`, `syncedQueries.ts`, `syncedMutations.ts`). Don't hand-edit those files — the README in that folder explicitly says they're auto-generated.

You may also want to run `bun zero:generate` from `apps/web/` since it has its own copy of the task.

### f. Run the migration & restart the stack

Apply the new Postgres migration (and refresh the publication) the way the rest of the repo does, then restart the local dev services so `zero-cache` picks up the new schema. After that, `zero.mutate.post.insert(...)` and `zero.query.post...` will be available on the client.

---

That's the whole loop: **model file → Drizzle table → migration → (optional) relationships → re-export → regenerate → migrate & restart.** If you also need a custom mutator (e.g., to enforce a max number of posts per user, or to set `createdAt` server-side), add it as a second argument to `mutations(schema, permissions, { ... })` — see `models/message.ts` for a worked example.
