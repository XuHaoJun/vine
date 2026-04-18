# Adding a `post` table to Zero

Here's the model file, followed by the full checklist of steps. The model itself follows the same shape as `packages/zero-schema/src/models/todo.ts` — owner-scoped reads/writes via `serverWhere` on `userId`, with auto-generated CRUD from `mutations()`.

## Proposed model file

```ts
// packages/zero-schema/src/models/post.ts
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

export const postPermission = serverWhere('post', (_, auth) => {
  return _.cmp('userId', auth?.id || '')
})

export const mutate = mutations(schema, postPermission)
```

A couple of notes:

- `caption` uses `.optional()` because you said it's optional. `imageUrl` is required, so no `.optional()`.
- `createdAt` is `number()` (epoch ms) to match `todo.createdAt`, `message.createdAt`, etc. — vine consistently stores timestamps as numbers in Zero.
- The permission is exported (`postPermission`) so the query file can reuse it instead of redefining the same predicate.
- `mutations(schema, postPermission)` auto-generates `zero.mutate.post.insert / .update / .delete`, all gated by the same owner check. You only need a custom mutation if a single user action has to touch multiple tables.

## Suggested query file

```ts
// packages/zero-schema/src/queries/post.ts
import { zql } from 'on-zero'

import { postPermission } from '../models/post'

export const postsByUserId = (props: { userId: string; limit?: number }) => {
  return zql.post
    .where(postPermission)
    .where('userId', props.userId)
    .orderBy('createdAt', 'desc')
    .limit(props.limit ?? 50)
}

export const postById = (props: { postId: string }) => {
  return zql.post.where(postPermission).where('id', props.postId).one()
}
```

Always lead with `.where(postPermission)` so the server filters before sending data over the wire.

## Other steps you need to do

1. **Drizzle migration first.** Add the `post` table in `packages/db/` and apply it. Adding a brand-new table to Zero requires the publication-rebuild dance — load the `zero-schema-migration` skill and follow it; that part is mandatory or pull/push won't see the new table.

2. **Create the model file** at `packages/zero-schema/src/models/post.ts` (the code above).

3. **Re-export the model** from `packages/zero-schema/src/index.ts` next to the others:

   ```ts
   export * as postModel from './models/post'
   ```

   And, if you want the queries module exported too:

   ```ts
   export * as postQueries from './queries/post'
   ```

4. **Create the query file** at `packages/zero-schema/src/queries/post.ts` (the code above).

5. **Add a relationship** in `packages/zero-schema/src/relationships.ts` and append it to `allRelationships`. At minimum a `post → user` belongs-to, and a `user → posts` reverse `many` if you'll list a user's posts via `.related('posts')`:

   ```ts
   export const postRelationships = relationships(tables.post, ({ one }) => ({
     user: one({
       sourceField: ['userId'],
       destSchema: tables.userPublic,
       destField: ['id'],
     }),
   }))
   ```

   Then add `posts: many({ sourceField: ['id'], destSchema: tables.post, destField: ['userId'] })` to `userRelationships`, and push `postRelationships` onto `allRelationships`. Forgetting the `allRelationships` push silently breaks `.related('user')` and `eb.exists('posts', ...)`.

6. **Run codegen** from the package:

   ```bash
   cd packages/zero-schema && bun zero:generate
   ```

   This rewrites `src/generated/` (`tables.ts`, `models.ts`, `syncedQueries.ts`, `groupedQueries.ts`, etc.). Never hand-edit those files.

7. **Restart the Zero server** so the new schema/publication is picked up. After a schema change you also typically need to clear the local Zero cache in the browser (`window.dropAllDatabases()` or the "Reset Zero data" button surfaced via `clearClientData()`) — otherwise the client errors out on the schema mismatch.

8. **Build the React hook** in `apps/web/src/features/post/usePosts.ts`, modeled on `useTodos.ts`. Generate IDs and timestamps in the caller so the optimistic and server runs converge:

   ```tsx
   import { useAuth } from '~/features/auth/useAuth'
   import { useZeroQuery, zero } from '~/zero/client'
   import { postsByUserId } from '@vine/zero-schema/queries/post'

   export function usePosts() {
     const { user } = useAuth()
     const userId = user?.id ?? ''

     const [posts, { type }] = useZeroQuery(
       postsByUserId,
       { userId },
       { enabled: Boolean(userId) },
     )

     const addPost = (imageUrl: string, caption?: string) => {
       zero.mutate.post.insert({
         id: crypto.randomUUID(),
         userId,
         imageUrl,
         caption,
         createdAt: Date.now(),
       })
     }

     const deletePost = (id: string) => zero.mutate.post.delete({ id })

     return { posts, isLoading: type === 'unknown', addPost, deletePost }
   }
   ```

   Use `useAuth()` (JWT-derived) for `userId`, not `useUser()` — the latter waits on a DB round-trip and creates a waterfall before the query can start.

## Things to watch out for

- **Image upload is not Zero's job.** Upload the file via your normal upload flow (REST/RPC/storage SDK) and only store the resulting `imageUrl` string in the `post` row. Zero is for the row, not the binary.
- **Permission covers reads and writes.** The `serverWhere` on `userId` means other users literally can't see or mutate your posts — if you later want a public feed, you'll need a separate permission/query that opens reads up while keeping writes owner-only.
- **Don't filter on the client.** If you later want "my posts from this week", express it in the query (`.where('createdAt', '>', cutoff)`), don't slice the synced array in React.
