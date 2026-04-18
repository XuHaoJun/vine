# Adding `comment` to the Zero schema

Comments are a textbook "child rows on a parent table that already has its own permissions" — the closest existing model in vine is `message` (gated through `chatMember`). I'll mirror that shape: a `comment` model whose read permission is expressed via relationships on `comment` itself, then a query that loads a `post` with all its comments and each comment's author.

The `post` table already exists, so I'm assuming it has its own `postReadPermission` exported from `models/post.ts` and a `comments` relationship will be appended to whatever already lives in `relationships.ts` for it. If `post` doesn't yet expose `postReadPermission`, add one (`serverWhere('post', () => true)` for fully public, or whatever your product wants).

---

## 1. The model — `packages/zero-schema/src/models/comment.ts`

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

// You can read a comment if:
//   (a) you own the parent post, OR
//   (b) you have commented on the same post yourself.
//
// Both branches go through relationships defined in relationships.ts:
//   - 'post'     one(comment.postId  -> post.id)
//   - 'siblings' many(comment.postId -> comment.postId)  (self-join on postId)
export const commentReadPermission = serverWhere('comment', (eb, auth) => {
  return eb.or(
    eb.exists('post', (q) => q.where('userId', auth?.id || '')),
    eb.exists('siblings', (q) => q.where('userId', auth?.id || '')),
  )
})

export const mutate = mutations(schema, commentReadPermission)
```

Notes worth flagging:

- The `auth?.id || ''` fallback is the vine convention — logged-out users get "no rows match" instead of an exception. Don't switch it to `auth!.id`.
- `eb.exists('post', ...)` and `eb.exists('siblings', ...)` only work once the relationships are registered (step 3). Until then they typecheck but return nothing.
- Passing `(schema, commentReadPermission)` to `mutations()` gives you the standard `insert` / `update` / `delete` actions automatically — `zero.mutate.comment.insert({...})` from React. The permission gates writes too, so a logged-in user can only insert a comment if they'd also be allowed to read it. That's fine for "leave a comment on a post you can already see"; if you ever want stricter write rules (e.g. block edits/deletes by non-author), add a custom mutation here.

---

## 2. The query — `packages/zero-schema/src/queries/post.ts`

If `queries/post.ts` already exists, just append `postWithComments` to it. Otherwise create it:

```ts
import { zql } from 'on-zero'

import { postReadPermission } from '../models/post'

// Single post + every comment + each comment's author, in one synced round-trip.
export const postWithComments = (props: { postId: string }) => {
  return zql.post
    .where(postReadPermission)
    .where('id', props.postId)
    .related('comments', (q) =>
      q.related('author').orderBy('createdAt', 'asc'),
    )
    .limit(1)
}
```

The nested `.related('author')` inside `.related('comments', ...)` is the multi-hop pattern straight from the skill — Zero will sync the post, all of its comments, and each comment's author user row in a single subscription. From React:

```tsx
const [posts] = useZeroQuery(postWithComments, { postId })
const post = posts[0]
const comments = post?.comments ?? []
```

(Use `.limit(1)` rather than inventing `.one()` here to match `chatById` / `groupInfo` in `queries/chat.ts`.)

---

## 3. Relationships — `packages/zero-schema/src/relationships.ts`

Add a new `commentRelationships` block, append a `comments` relationship to whatever `postRelationships` you have, then push `commentRelationships` into `allRelationships`.

```ts
// New block — keep it next to the other definitions.
export const commentRelationships = relationships(tables.comment, ({ many, one }) => ({
  // comment.userId -> userPublic.id   (used by the query as 'author')
  author: one({
    sourceField: ['userId'],
    destSchema: tables.userPublic,
    destField: ['id'],
  }),
  // comment.postId -> post.id         (used by commentReadPermission: post owner check)
  post: one({
    sourceField: ['postId'],
    destSchema: tables.post,
    destField: ['id'],
  }),
  // self-join on postId               (used by commentReadPermission: "I commented on this post")
  siblings: many({
    sourceField: ['postId'],
    destSchema: tables.comment,
    destField: ['postId'],
  }),
}))
```

In `postRelationships`, add the inverse of `comment.post` so the query can call `.related('comments')`:

```ts
export const postRelationships = relationships(tables.post, ({ many, one }) => ({
  // ...whatever you already have (e.g. owner: one(post.userId -> userPublic.id))
  comments: many({
    sourceField: ['id'],
    destSchema: tables.comment,
    destField: ['postId'],
  }),
}))
```

And remember to register the new entry — `schema.ts` only sees relationships that live in this array:

```ts
export const allRelationships = [
  userRelationships,
  // ...existing entries...
  postRelationships,
  commentRelationships,
]
```

Forgetting `allRelationships` is the classic silent failure: `.related('comments')` and `eb.exists('siblings', ...)` will compile but quietly return empty.

---

## 4. Re-export the model — `packages/zero-schema/src/index.ts`

Add it next to the other models so consumers can import it:

```ts
export * as commentModel from './models/comment'
export * as postQueries from './queries/post'
```

---

## Order of operations (checklist)

1. **DB migration first.** Add the `comment` table in `packages/db/` (Drizzle), apply it, and run the publication-rebuild flow from the `zero-schema-migration` skill — Zero will not sync a table the publication doesn't include.
2. **Model:** create `packages/zero-schema/src/models/comment.ts` (section 1).
3. **Relationships:** edit `packages/zero-schema/src/relationships.ts` — add `commentRelationships`, append `comments` to `postRelationships`, push into `allRelationships` (section 3).
4. **Query:** create or extend `packages/zero-schema/src/queries/post.ts` with `postWithComments` (section 2). Confirm `models/post.ts` exports `postReadPermission`; add one if it doesn't.
5. **Re-exports:** update `packages/zero-schema/src/index.ts` (section 4).
6. **Codegen:**

   ```bash
   cd packages/zero-schema && bun zero:generate
   ```

   This rewrites `src/generated/` so `zql.comment`, `zero.mutate.comment.*`, and the synced/grouped query registries pick up the new table and query. Never hand-edit `generated/`.
7. **Restart the Zero server** (the one mounted by `apps/server/src/plugins/zero.ts`) so it loads the new schema. If anyone has a stale local cache after the schema change, the "Reset Zero data" path (`clearClientData()`) clears it.
8. **(Optional) React hook:** add `apps/web/src/features/post/usePostWithComments.ts` that wraps `useZeroQuery(postWithComments, { postId }, { enabled: Boolean(postId) })`, mirroring `useMessages` / `useChats`. The list-includes-detail principle from the skill applies here too — once you have the synced post + comments, navigating into the detail view should be instant.

That's it. The permission gives you "post owner sees everything; commenters see the whole thread they're part of; nobody else sees anything," entirely server-enforced via `serverWhere` + the two relationships on `comment`.
