---
name: zero
description: Zero data layer guide for this turborepo (vine). Use when working with the Zero sync layer — writing or editing models, queries, mutations, permissions, relationships, pagination, or React hooks (useZeroQuery). Trigger whenever the user mentions zero, zql, useZeroQuery, serverWhere, mutations, zero.mutate, @vine/zero-schema, on-zero, or asks about real-time data syncing, local-first, or data queries in this project. Also trigger when adding a new table, new query, new mutation, or asking about convergence/optimistic updates.
---

# Zero Data Layer (vine turborepo)

This project uses `@rocicorp/zero` + `on-zero` helpers for real-time local-first data sync.

## Project Layout

The canonical data layer lives in `packages/zero-schema/` (`@vine/zero-schema`):

```
packages/zero-schema/src/
├── models/          ← table schema + mutations (one file per table)
├── queries/         ← query functions using zql
├── relationships.ts ← all relationships in one place
├── schema.ts        ← createSchema() composing all tables + relationships
├── generated/       ← AUTO-GENERATED, never edit manually
│   ├── tables.ts
│   ├── models.ts
│   ├── syncedQueries.ts
│   ├── groupedQueries.ts
│   └── types.ts
└── server/          ← server-only code (actions, migrations)
```

The web app imports everything from the package:
```ts
import { todosByUserId } from '@vine/zero-schema/queries/todo'
import { zero, useZeroQuery } from '~/zero/client'
```

The client is set up in `apps/web/src/zero/client.tsx` and exports:
- `useZeroQuery` — React hook for queries
- `zero` — mutation client (`zero.mutate.table.insert/update/delete`)
- `ProvideZero` — provider component
- `zeroEvents` — event bus
- `run` — re-export from on-zero

---

## Models

Each table lives in `packages/zero-schema/src/models/{tableName}.ts`:

```ts
import { boolean, number, string, table } from '@rocicorp/zero'
import { mutations, serverWhere } from 'on-zero'
import type { TableInsertRow } from 'on-zero'

export type Todo = TableInsertRow<typeof schema>

export const schema = table('todo')
  .columns({
    id: string(),
    userId: string(),
    text: string(),
    completed: boolean(),
    createdAt: number(),
  })
  .primaryKey('id')

const permissions = serverWhere('todo', (_, auth) => {
  return _.cmp('userId', auth?.id || '')
})

export const mutate = mutations(schema, permissions)
```

Passing `schema` and `permissions` to `mutations()` auto-generates CRUD:
```ts
zero.mutate.todo.insert(todo)
zero.mutate.todo.update({ id, ...fields })
zero.mutate.todo.delete({ id })
```

For custom mutation logic:
```ts
export const mutate = mutations(schema, permissions, {
  update: async ({ authData, can, tx }, user) => {
    if (!authData) throw new Error('Unauthorized')
    await can(permissions, authData.id)
    await tx.mutate.userPublic.update(user)
  },
})
```

Available column types (from `@rocicorp/zero`): `string()`, `number()`, `boolean()`, `json()`. Use `.optional()` for nullable columns.

After adding or modifying a model, run:
```bash
bun zero:generate        # in packages/zero-schema/
```

This regenerates `src/generated/` — never edit those files by hand.

---

## Queries

Each query file lives in `packages/zero-schema/src/queries/{tableName}.ts`:

```ts
import { serverWhere, zql } from 'on-zero'

const permission = serverWhere('todo', (_, auth) => {
  return _.cmp('userId', auth?.id || '')
})

export const todosByUserId = (props: { userId: string; limit?: number }) => {
  return zql.todo
    .where(permission)
    .where('userId', props.userId)
    .orderBy('createdAt', 'desc')
    .limit(props.limit ?? 100)
}

export const todoById = (props: { todoId: string }) => {
  return zql.todo.where(permission).where('id', props.todoId).one()
}
```

### useZeroQuery in React

```tsx
import { useZeroQuery } from '~/zero/client'
import { todosByUserId } from '@vine/zero-schema/queries/todo'

// basic
const [todos, { type }] = useZeroQuery(todosByUserId, { userId })

// with options
const [todos, { type }] = useZeroQuery(
  todosByUserId,
  { userId: userId || '' },
  { enabled: Boolean(userId) }
)

const isLoading = type === 'unknown'
```

The `type` field: `'unknown'` = loading, `'complete'` = synced.

---

## Permissions

`serverWhere` runs only on the server — never exposes auth logic to the client. The first arg is the `_` query builder (conventionally named `_` in this project):

```ts
// owns the row
serverWhere('todo', (_, auth) => _.cmp('userId', auth?.id || ''))

// admin or self
serverWhere('userPublic', (_, auth) =>
  _.or(_.cmpLit(auth?.role || '', '=', 'admin'), _.cmp('id', auth?.id || ''))
)

// public read
serverWhere('post', () => true)
```

For filtering based on relationships (e.g. block lists), use `exists()` — but only after defining the relationship in `relationships.ts`:

```ts
const notBlocked = serverWhere('post', (_, auth) => {
  if (!auth?.id) return true
  return _.not(_.exists('authorBlockedBy', (b) => b.where('blockerId', auth.id)))
})
```

---

## Relationships

All relationships go in `packages/zero-schema/src/relationships.ts`. Import from `generated/tables` (not models directly):

```ts
import { relationships } from '@rocicorp/zero'
import * as tables from './generated/tables'

export const todoRelationships = relationships(tables.todo, ({ one }) => ({
  user: one({
    sourceField: ['userId'],
    destSchema: tables.userPublic,
    destField: ['id'],
  }),
}))

export const allRelationships = [
  userRelationships,
  todoRelationships,
  userStateRelationships,
]
```

Then use `.related()` in queries:

```ts
export const userWithState = (props: { userId: string }) => {
  return zql.userPublic
    .where(permission)
    .where('id', props.userId)
    .one()
    .related('state', (q) => q.where('userId', props.userId).one())
}
```

Always add each new relationship group to `allRelationships` — `schema.ts` uses it via `allRelationships`.

---

## Pagination

Use `.start()` for cursor-based pagination:

```ts
export const postsPaginated = (props: {
  pageSize: number
  cursor?: { id: string; createdAt: number } | null
}) => {
  let query = zql.post
    .where(permission)
    .orderBy('createdAt', 'desc')
    .orderBy('id', 'desc')
    .limit(props.pageSize)

  if (props.cursor) {
    query = query.start(props.cursor)
  }

  return query
}
```

Always include the primary key as a secondary sort to make cursors stable.

---

## Convergence (client + server must match)

Mutations run on **both** client (optimistic) and server. They must produce identical state — if a mutation generates different data on each run, the client will diverge and sync will fail.

**Bad** — non-deterministic:
```ts
async insert(ctx, post) {
  await ctx.tx.mutate.post.insert({
    ...post,
    id: randomId(),        // different every run!
    createdAt: Date.now()  // timing differs!
  })
}
```

**Good** — caller generates IDs and timestamps before calling the mutation:
```ts
// caller (React component or hook):
const newTodo = {
  id: crypto.randomUUID(),   // generated once, passed in
  userId,
  text,
  completed: false,
  createdAt: Date.now(),     // generated once, passed in
}
zero.mutate.todo.insert(newTodo)

// mutation just passes through:
async insert(ctx, todo) {
  await ctx.tx.mutate.todo.insert(todo)

  // server-only side effects are fine — they don't affect local state
  if (ctx.server) {
    ctx.server.asyncTasks.push(async () => {
      await ctx.server.actions.analyticsActions().logEvent(ctx.authData.id, 'todo_created')
    })
  }
}
```

Async tasks run after the transaction commits — use them for notifications, analytics, emails.

### Optimistic vs awaited

```ts
// optimistic — updates UI immediately, no await
zero.mutate.todo.update({ id, completed: true })

// wait for server confirmation
const result = await zero.mutate.todo.update({ id, completed: true }).server
```

---

## Schema Registration

`packages/zero-schema/src/schema.ts` composes everything:

```ts
import { createSchema } from '@rocicorp/zero'
import * as tables from './generated/tables'
import { allRelationships } from './relationships'

export const schema = createSchema({
  tables: Object.values(tables),
  relationships: allRelationships,
  enableLegacyQueries: false,
})
```

You don't edit this file when adding a new table — just run `bun zero:generate` and the generated tables are picked up automatically.

---

## Server Actions

Server-only business logic goes in `packages/zero-schema/src/server/actions/`:

```ts
// src/server/actions/analyticsActions.ts
export const analyticsActions = {
  logEvent: async (userId: string, event: string) => { ... }
}
```

Register in `createServerActions.ts`:
```ts
export const createServerActions = () => ({
  analyticsActions,
  userActions,
})
```

Access from mutation context via `ctx.server.actions.analyticsActions()`.

---

## Anti-Patterns

### Waterfall: useAuth() vs useUser()

```tsx
// BAD — causes waterfall (waits for DB round-trip before querying)
const { user } = useUser()
const [todos] = useZeroQuery(todosByUserId, { userId: user?.id || '' })

// GOOD — useAuth() reads from JWT, available immediately
const auth = useAuth()
const [todos] = useZeroQuery(todosByUserId, { userId: auth?.user?.id || '' }, { enabled: Boolean(auth?.user?.id) })
```

### N+1 Queries in Lists

```tsx
// BAD — fires a query per list item
function TodoCard({ todo }) {
  const [user] = useZeroQuery(userById, { userId: todo.userId })
  return <div>{user?.name}</div>
}

// GOOD — load relation in the parent query
export const todosWithUser = () => {
  return zql.todo.where(permission).related('user', (q) => q.one())
}

function TodoCard({ todo }) {
  return <div>{todo.user?.name}</div>  // already loaded
}
```

### Client-Side Filtering

```tsx
// BAD — two round trips, data leaks risk
const [blocked] = useZeroQuery(blockedUsers, { userId })
const [posts] = useZeroQuery(posts, { excludeIds: blocked.map(b => b.id) })

// GOOD — filter server-side with exists()
const notBlocked = serverWhere('post', (_, auth) => {
  if (!auth?.id) return true
  return _.not(_.exists('authorBlockedBy', (b) => b.where('blockerId', auth.id)))
})
```

### Index/Detail Query Design

Design list queries to include everything the detail page needs, so navigating from list → detail is instant (Zero's local cache already has the data):

```ts
// list query — includes everything detail needs
export const feedPosts = (props: { limit: number }) => {
  return zql.post
    .where(permission)
    .limit(props.limit)
    .related('user', (q) => q.one())
    .related('comments', (q) => q.limit(50).related('user', (u) => u.one()))
}

// detail query — same relations, single item
export const postDetail = (props: { postId: string }) => {
  return zql.post
    .where(permission)
    .where('id', props.postId)
    .one()
    .related('user', (q) => q.one())
    .related('comments', (q) => q.limit(50).related('user', (u) => u.one()))
}
```

---

## Soft Deletes

```ts
// model column
deleted: boolean()

// mutation
async delete(ctx, { id }) {
  await ctx.tx.mutate.post.update({ id, deleted: true })
}

// all queries filter it out
.where('deleted', false)
```

---

## Debugging

Add `?debug=2` to the URL for detailed Zero sync logs.

The `zero` instance is exposed on `window.zero` in development for console debugging.

---

## Workflow Summary: Adding a New Table

1. Create `packages/zero-schema/src/models/{name}.ts` — define `schema`, `permissions`, `mutate`
2. Create `packages/zero-schema/src/queries/{name}.ts` — write query functions with `zql`
3. Add relationships in `packages/zero-schema/src/relationships.ts` — push to `allRelationships`
4. Run `bun zero:generate` in `packages/zero-schema/` — regenerates `src/generated/`
5. Use `useZeroQuery(queryFn, args)` in React, `zero.mutate.{table}.*` for mutations
6. IDs and timestamps must be generated by the caller before passing to mutations (convergence rule)
