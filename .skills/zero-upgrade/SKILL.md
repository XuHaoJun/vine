---
name: zero-upgrade
description: Guide for migrating Zero code from the on-zero wrapper (0.x) to native @rocicorp/zero 1.x APIs. Use this skill whenever upgrading Zero, removing on-zero, migrating mutations to defineMutators, replacing serverWhere with in-mutator auth checks, converting queries to defineQueries, or switching from createZeroClient/createZeroServer to ZeroProvider and handleMutateRequest/handleQueryRequest. Also use when someone asks about Zero 1.x patterns, the defineMutator/defineQuery API, or differences between on-zero and native Zero.
---

# Zero Upgrade: on-zero 0.x to Native @rocicorp/zero 1.x

This skill covers migrating from the `on-zero` wrapper library to the native `@rocicorp/zero` 1.x API. The reference implementation is at `learn-projects/zero-mono/apps/zbugs/`.

## Overview of Changes

The `on-zero` wrapper provided convenience APIs (`createZeroClient`, `createZeroServer`, `serverWhere`, `mutations`, `zql`, code generation) on top of `@rocicorp/zero`. Zero 1.x makes these unnecessary — the native API now covers all of those patterns directly, with better type safety and no code generation step.

| Area | on-zero (old) | @rocicorp/zero 1.x (new) |
|------|---------------|--------------------------|
| Schema assembly | Auto-generated via `on-zero generate` | `createSchema({ tables, relationships })` |
| Query builder | `zql.table.where(...)` | `createBuilder(schema)` then `builder.table.where(...)` |
| Query definitions | Synced query functions + `defineQuery()` with valibot | `defineQueries({ name: defineQuery(zod, fn) })` |
| Mutations | `mutations(schema, serverWhere, { ... })` | `defineMutators({ ns: { action: defineMutator(zod, fn) } })` |
| Permissions | `serverWhere('table', (eb, auth) => ...)` | Auth checks inside mutators and query-level filtering |
| Client init | `createZeroClient({ models, schema, groupedQueries })` | `<ZeroProvider schema={schema} mutators={mutators} ...>` |
| Server init | `createZeroServer({ schema, models, ... })` | `handleMutateRequest()` + `handleQueryRequest()` |
| React hooks | `useZeroQuery(queryFn, args, opts)` → `[data, { type }]` | `useQuery(query)` / `useSuspenseQuery(query)` |
| Code generation | Required (`on-zero generate`) | Not needed |
| Validation | valibot | zod (or any StandardSchema v1 validator) |

## Step-by-Step Migration

### 1. Schema: Add createSchema + createBuilder

Table definitions (`table().columns().primaryKey()`) stay exactly the same — they already use `@rocicorp/zero`. What changes is how they're assembled.

**Before (on-zero):** Each model file exports its own `schema` table definition. Auto-generated `tables.ts` and `models.ts` re-export them all. The wrapper stitches everything together internally.

**After (native):** Create an explicit `schema.ts` that assembles all tables and relationships:

```typescript
// packages/zero-schema/src/schema.ts
import { createSchema, createBuilder } from '@rocicorp/zero'
import { schema as user } from './models/user'
import { schema as chat } from './models/chat'
import { schema as message } from './models/message'
import { userRelationships, chatRelationships, ... } from './relationships'

export const schema = createSchema({
  tables: [user, chat, message, ...allTables],
  relationships: [userRelationships, chatRelationships, ...allRelationships],
})

export const builder = createBuilder(schema)
```

The `createBuilder(schema)` call produces a typed query builder with properties for every table: `builder.user`, `builder.chat`, `builder.message`, etc. This replaces the `zql` object from `on-zero`.

### 2. Mutations: Replace mutations() with defineMutators()

This is the biggest change. The `on-zero` wrapper bundles permissions, CRUD overrides, and custom actions into a single `mutations()` call per model. Native Zero separates mutations from permissions and uses a registry pattern.

**Before (on-zero):**
```typescript
import { mutations, serverWhere } from 'on-zero'

const messageReadPermission = serverWhere('message', (eb, auth) => {
  const userId = auth?.id || ''
  return eb.exists('members', q => q.where('userId', userId))
})

export const mutate = mutations(schema, messageReadPermission, {
  insert: rejectFn,
  update: rejectFn,
  send: async ({ authData, tx }, message: Message) => {
    if (!authData) throw new Error('Unauthorized')
    await tx.mutate.message.insert(message)
    await tx.mutate.chat.update({ id: message.chatId, lastMessageId: message.id })
  },
})
```

**After (native):**
```typescript
import { defineMutator, defineMutators, type Transaction } from '@rocicorp/zero'
import { z } from 'zod/mini'

const sendMessageSchema = z.object({
  id: z.string(),
  chatId: z.string(),
  senderId: z.optional(z.string()),
  senderType: z.string(),
  type: z.string(),
  text: z.optional(z.string()),
  metadata: z.optional(z.string()),
  createdAt: z.number(),
})

export const mutators = defineMutators({
  message: {
    send: defineMutator(
      sendMessageSchema,
      async ({ tx, args: message, ctx: authData }) => {
        if (!authData) throw new Error('Unauthorized')
        if (message.senderType === 'user' && message.senderId !== authData.id) {
          throw new Error('Unauthorized')
        }
        await tx.mutate.message.insert(message)
        await tx.mutate.chat.update({
          id: message.chatId,
          lastMessageId: message.id,
          lastMessageAt: message.createdAt,
        })
      },
    ),
  },
})
```

Key differences in the mutation signature:
- `{ authData, tx }` becomes `{ tx, args, ctx }` — auth data moves to `ctx`
- Args are validated by a zod schema before reaching the function
- Reading data inside mutations: `tx.query.table.where(...).run()` becomes `await tx.run(builder.table.where(...).one())`
- No more CRUD override slots (`insert`, `update`, `delete`, `upsert`) — define only the actions you need

#### Reading data inside mutations

**Before (on-zero):** The `tx.query` property or the `readRows` helper:
```typescript
const accounts = await tx.query.officialAccount.where('id', oaId).run()
```

**After (native):** Use `tx.run()` with the builder:
```typescript
const account = await tx.run(builder.officialAccount.where('id', oaId).one())
```

### 3. Permissions: Replace serverWhere with In-Mutator Auth Checks

`serverWhere()` is an `on-zero` construct that attaches row-level permission filters to tables. In native Zero 1.x, `definePermissions()` exists but is deprecated. The recommended pattern is:

1. **Mutator auth**: Check authorization inside each mutator before reading or writing
2. **Query-level filtering**: Apply visibility filters in query definitions using `ctx` (auth data)

**Before (on-zero):**
```typescript
export const chatReadPermission = serverWhere('chat', (eb, auth) => {
  const userId = auth?.id || ''
  return eb.or(
    eb.exists('members', q => q.where('userId', userId)),
    eb.exists('members', q =>
      q.whereExists('oa', oaQ =>
        oaQ.whereExists('provider', pQ => pQ.where('ownerId', userId))
      )
    )
  )
})
```

**After (native):** Move this logic into query definitions:
```typescript
function applyChatPermission(q, auth) {
  if (!auth?.id) return alwaysFalse(q)
  return q.where(({ or, exists }) =>
    or(
      exists('members', q => q.where('userId', auth.id)),
      exists('members', q =>
        q.whereExists('oa', oaQ =>
          oaQ.whereExists('provider', pQ => pQ.where('ownerId', auth.id))
        )
      )
    )
  )
}

// Used in query definitions:
defineQuery(argsSchema, ({ args, ctx: auth }) =>
  applyChatPermission(builder.chat.where('id', args.chatId), auth)
)
```

For mutation-side authorization, check auth before reading or writing:
```typescript
defineMutator(argsSchema, async ({ tx, args, ctx: authData }) => {
  if (!authData) throw new Error('Unauthorized')
  // Check ownership/membership before proceeding
  const member = await tx.run(
    builder.chatMember
      .where('chatId', args.chatId)
      .where('userId', authData.id)
      .one()
  )
  if (!member) throw new Error('Unauthorized')
  // ... proceed with mutation
})
```

### 4. Queries: Replace zql + synced queries with defineQueries

**Before (on-zero):**
```typescript
import { zql, serverWhere } from 'on-zero'

export const chatsByUserId = (props: { userId: string }) => {
  return zql.chat
    .where(chatReadPermission)
    .related('members', q => q.related('user'))
    .related('lastMessage')
    .orderBy('lastMessageAt', 'desc')
    .limit(50)
}
```

**After (native):**
```typescript
import { defineQueries, defineQuery } from '@rocicorp/zero'
import { z } from 'zod/mini'
import { builder } from './schema'

export const queries = defineQueries({
  chatsByUserId: defineQuery(
    z.object({ userId: z.string() }),
    ({ args, ctx: auth }) =>
      applyChatPermission(
        builder.chat
          .related('members', q => q.related('user'))
          .related('lastMessage')
          .orderBy('lastMessageAt', 'desc')
          .limit(50),
        auth,
      ),
  ),
})
```

The `serverWhere` permission is replaced by calling a helper function that applies the same filter logic using the query builder's expression API. The `ctx` parameter carries auth data from the client's `context` option.

### 5. Client Initialization: Replace createZeroClient with ZeroProvider

**Before (on-zero):**
```typescript
import { createZeroClient } from 'on-zero'
import { models } from '@vine/zero-schema/generated/models'
import * as groupedQueries from '@vine/zero-schema/generated/groupedQueries'

export const { useQuery: useZeroQuery, zero, ProvideZero, zeroEvents } =
  createZeroClient({ models, schema, groupedQueries })

// Usage in React:
const [chats, { type }] = useZeroQuery(chatsByUserId, { userId })
```

**After (native):**
```typescript
import { ZeroProvider, useZero, useQuery } from '@rocicorp/zero/react'
import { mutators } from '@vine/zero-schema/mutators'
import { schema } from '@vine/zero-schema/schema'

// In your app root:
<ZeroProvider
  schema={schema}
  mutators={mutators}
  cacheURL={ZERO_SERVER_URL}
  userID={userId}
  auth={sessionToken}
  mutateURL="/api/zero/push"
  queryURL="/api/zero/pull"
  context={authData}
>
  {children}
</ZeroProvider>

// Usage in React components:
const z = useZero()
const chats = useQuery(queries.chatsByUserId({ userId }))
```

Key changes:
- No more `createZeroClient` — use `ZeroProvider` directly
- No more generated `models` or `groupedQueries` imports
- `useZeroQuery(queryFn, args)` returning `[data, { type }]` becomes `useQuery(queries.name(args))`
- `zero.mutate.table.action(args)` becomes `z.mutate(mutators.namespace.action(args))`
- Mutation result is `{ client: Promise, server: Promise }` — you can await either

### 6. Server: Replace createZeroServer with handleMutateRequest/handleQueryRequest

**Before (on-zero):**
```typescript
import { createZeroServer } from 'on-zero/server'

const zero = createZeroServer({
  schema, models, createServerActions, queries,
  database: ZERO_UPSTREAM_DB,
})

// In routes:
const { response } = await zero.handleQueryRequest({ authData, request })
const { response } = await zero.handleMutationRequest({ authData, request })
```

**After (native):**
```typescript
import { handleMutateRequest, handleQueryRequest, mustGetMutator, mustGetQuery } from '@rocicorp/zero/server'

// Mutation endpoint:
fastify.post('/api/zero/push', async (request, reply) => {
  const authData = await getAuthData(request)
  const serverMutators = createServerMutators()

  const response = await handleMutateRequest(
    dbProvider,
    (transact) => transact((tx, name, args) => {
      const mutator = mustGetMutator(serverMutators, name)
      return mutator.fn({ tx, args, ctx: authData })
    }),
    request.query,
    request.body,
    'info',
  )
  reply.send(response)
})

// Query endpoint:
fastify.post('/api/zero/pull', async (request, reply) => {
  const authData = await getAuthData(request)
  reply.send(
    await handleQueryRequest(
      (name, args) => {
        const query = mustGetQuery(queries, name)
        return query.fn({ args, ctx: authData })
      },
      schema,
      request.body,
    )
  )
})
```

The server side needs a database provider. Zero 1.x ships adapters for common ORMs:
- `@rocicorp/zero/server/adapters/drizzle`
- `@rocicorp/zero/server/adapters/pg`
- `@rocicorp/zero/server/adapters/postgresjs`

#### Server mutator overrides

If some mutations need server-only logic (notifications, emails, webhooks), create server-specific overrides:

```typescript
import { defineMutators, defineMutator } from '@rocicorp/zero'
import { mutators as sharedMutators } from '../shared/mutators'

export function createServerMutators() {
  return defineMutators(sharedMutators, {
    message: {
      send: defineMutator(sendMessageSchema, async ({ tx, args, ctx }) => {
        // Run the shared mutator logic
        await sharedMutators.message.send.fn({ tx, args, ctx })
        // Add server-only side effects
        await notifyRecipients(args.chatId, args.id)
      }),
    },
  })
}
```

### 7. Remove Code Generation

Delete the `packages/zero-schema/src/generated/` directory and remove `on-zero generate` from build scripts. The native API's type inference makes code generation unnecessary.

Files to delete:
- `generated/tables.ts`
- `generated/models.ts`
- `generated/syncedQueries.ts`
- `generated/syncedMutations.ts`
- `generated/groupedQueries.ts`
- `generated/types.ts`

Update `package.json` scripts: remove any `zero:generate` or `on-zero generate` commands.

### 8. Update Dependencies

```bash
# Remove on-zero
bun remove on-zero

# Ensure @rocicorp/zero is 1.x
bun add @rocicorp/zero@latest

# Add zod for mutation/query validation (if not already present)
bun add zod
```

## File Layout After Migration

```
packages/zero-schema/src/
  schema.ts              # createSchema + createBuilder (NEW)
  relationships.ts       # Same as before
  mutators.ts            # defineMutators (NEW, replaces per-model mutate exports)
  queries.ts             # defineQueries (NEW, replaces queries/ directory)
  models/
    user.ts              # Table definition only (remove serverWhere + mutations)
    chat.ts              # Table definition only
    message.ts           # Table definition only
    ...
  server/
    server-mutators.ts   # Server-side defineMutators overrides (NEW)
  # generated/           # DELETED
```

## Migration Checklist

1. Create `schema.ts` with `createSchema()` + `createBuilder()`
2. Create `mutators.ts` with `defineMutators()` — move mutation logic from model files
3. Create `queries.ts` with `defineQueries()` — move query functions, inline permission filters
4. Convert `serverWhere` permission expressions to query-level or mutator-level auth helpers
5. Update client init: replace `createZeroClient` with `ZeroProvider`
6. Update React hooks: replace `useZeroQuery` with `useQuery` from `@rocicorp/zero/react`
7. Update mutation calls: `zero.mutate.table.action(args)` → `z.mutate(mutators.ns.action(args))`
8. Update server: replace `createZeroServer` with `handleMutateRequest` + `handleQueryRequest`
9. Add server mutator overrides if needed
10. Delete generated files and `on-zero generate` scripts
11. Remove `on-zero` dependency
12. Run `bun run check:all` to verify types

## Reference

The canonical Zero 1.x reference implementation is `learn-projects/zero-mono/apps/zbugs/`:
- `shared/schema.ts` — schema + builder
- `shared/mutators.ts` — client/shared mutators
- `shared/queries.ts` — query definitions
- `shared/auth.ts` — auth helpers for mutator/query permission checks
- `server/server-mutators.ts` — server-side mutator overrides
- `api/index.ts` — server endpoints with handleMutateRequest/handleQueryRequest
- `src/zero-init.tsx` — ZeroProvider setup
