# Adding `comment` to the Zero schema

Below is everything you need, in the order you should do it. The patterns mirror the existing `message` / `chat` setup in `packages/zero-schema/src/`.

I'm assuming `post` already exists as a model at `packages/zero-schema/src/models/post.ts` with `(id, userId, caption?, imageUrl, createdAt)`, that it's already exported through `generated/tables.ts` (auto), and that there's already a `postRelationships` block in `relationships.ts` you can extend. If the `post` model is not yet there, add it the same way `todo.ts` is structured before doing the steps below.

---

## 1. Comment model

Create `packages/zero-schema/src/models/comment.ts`:

```ts
import { number, string, table } from '@rocicorp/zero'
import { mutations, serverWhere } from 'on-zero'

import type { TableInsertRow } from 'on-zero'

export type Comment = TableInsertRow<typeof schema>

export const schema = table('comment')
  .columns({
    id: string(),
    postId: string(),
    userId: string(),
    text: string(),
    createdAt: number(),
  })
  .primaryKey('id')

// A user can read a comment if either:
//   - they own the post the comment is on, OR
//   - they themselves have commented on that post.
// Relationships used here ('post' one, 'siblings' many) are defined in relationships.ts.
export const commentReadPermission = serverWhere('comment', (eb, auth) => {
  const userId = auth?.id || ''
  return eb.or(
    eb.exists('post', (q) => q.where('userId', userId)),
    eb.exists('siblings', (q) => q.where('userId', userId)),
  )
})

export const mutate = mutations(schema, commentReadPermission, {
  create: async ({ authData, tx }, comment: Comment) => {
    if (!authData) throw new Error('Unauthorized')
    if (comment.userId !== authData.id) throw new Error('Unauthorized')
    await tx.mutate.comment.insert(comment)
  },
})
```

The pattern (`serverWhere` + `eb.exists` on a relationship) is exactly how `messageReadPermission` works in `models/message.ts` — the only twist is the `eb.or(...)` for the two read paths, which is the same combinator used in `models/user.ts`.

---

## 2. Relationships

Edit `packages/zero-schema/src/relationships.ts`:

1. Add a `commentRelationships` block.
2. Add a `comments` relationship to `postRelationships` (so the query in step 3 can `.related('comments', ...)`).
3. Append `commentRelationships` to `allRelationships`.

```ts
// New: needed by commentReadPermission and the post-with-comments query
export const commentRelationships = relationships(tables.comment, ({ one, many }) => ({
  // Used by commentReadPermission (eb.exists('post', ...)) and to fetch the post owner
  post: one({
    sourceField: ['postId'],
    destSchema: tables.post,
    destField: ['id'],
  }),
  // Used by commentReadPermission (eb.exists('siblings', ...))
  // Matches comment rows on the same post — including this row, which is fine
  // because if you authored it, userId === auth.id.
  siblings: many({
    sourceField: ['postId'],
    destSchema: tables.comment,
    destField: ['postId'],
  }),
  // Used by the query for "each comment's author"
  author: one({
    sourceField: ['userId'],
    destSchema: tables.userPublic,
    destField: ['id'],
  }),
}))

// Extend the existing postRelationships with `comments`:
export const postRelationships = relationships(tables.post, ({ many, one }) => ({
  owner: one({
    sourceField: ['userId'],
    destSchema: tables.userPublic,
    destField: ['id'],
  }),
  comments: many({
    sourceField: ['id'],
    destSchema: tables.comment,
    destField: ['postId'],
  }),
}))

export const allRelationships = [
  userRelationships,
  todoRelationships,
  userStateRelationships,
  friendshipRelationships,
  chatRelationships,
  chatMemberRelationships,
  messageRelationships,
  postRelationships,
  commentRelationships, // <-- add
]
```

---

## 3. Query: post + all comments + each author

Create `packages/zero-schema/src/queries/post.ts`:

```ts
import { zql } from 'on-zero'

import { commentReadPermission } from '../models/comment'

// Single post with all its comments, each comment with its author.
// Apply commentReadPermission inside the .related() so the comment list is
// filtered by the same read rules used everywhere else.
export const postWithCommentsById = (props: { postId: string }) => {
  return zql.post
    .where('id', props.postId)
    .related('owner')
    .related('comments', (q) =>
      q.where(commentReadPermission).related('author').orderBy('createdAt', 'asc'),
    )
    .limit(1)
}
```

This follows the exact shape of `messagesByChatId` (uses `serverWhere` + `.related('sender')`) and `chatsByUserId` (nested `.related('members', q => q.related('user'))`).

---

## 4. Wire the model and query into `index.ts`

Edit `packages/zero-schema/src/index.ts` and add:

```ts
// Models
export * as commentModel from './models/comment'

// Queries
export * as postQueries from './queries/post'
```

(Place them next to the existing `messageModel` / `messageQueries` lines.)

---

## 5. Regenerate the auto-generated files

`generated/tables.ts`, `generated/models.ts`, `generated/syncedQueries.ts`, etc. are produced by `on-zero`. Don't edit them by hand — run:

```bash
bun --filter @vine/zero-schema zero:generate
```

(Or from inside `packages/zero-schema`: `bun zero:generate`.) This re-emits `generated/tables.ts` with the new `comment` table, regenerates the synced queries from `queries/post.ts`, and runs `bun lint:fix`.

---

## Ordered checklist

1. **Create `packages/zero-schema/src/models/comment.ts`** — table schema + `commentReadPermission` + `mutate`.
2. **Edit `packages/zero-schema/src/relationships.ts`** — add `commentRelationships`, add `comments` to `postRelationships`, append to `allRelationships`.
3. **Create `packages/zero-schema/src/queries/post.ts`** — `postWithCommentsById`.
4. **Edit `packages/zero-schema/src/index.ts`** — export `commentModel` and `postQueries`.
5. **Run `bun --filter @vine/zero-schema zero:generate`** to refresh `src/generated/*`.
6. **Typecheck**: `bun --filter @vine/zero-schema typecheck` (and ideally restart the `zero` dev service so the new permission/query takes effect).

If you also need a Postgres column for `comment` (Drizzle), add that table in `packages/db/src/schema-public.ts` and run the db migrate flow first — the Zero schema only mirrors columns that exist in Postgres.
