# `useUserPosts` hook

This follows the same pattern as `useTodos` — derive `userId` from `useAuth()` (no DB waterfall), call `useZeroQuery` with a query function from `@vine/zero-schema`, and use `zero.mutate.post.insert(...)` for writes. The caller generates the `id` and `createdAt` so the optimistic + server runs converge.

## 1. Query function — `packages/zero-schema/src/queries/post.ts`

Match the shape of `queries/todo.ts`. Permission first (so the server filters before sending rows over the wire), then `where` on `userId`, then `orderBy createdAt desc` for newest-first.

```ts
import { serverWhere, zql } from 'on-zero'

const permission = serverWhere('post', (_, auth) => {
  return _.cmp('userId', auth?.id || '')
})

export const postsByUserId = (props: { userId: string; limit?: number }) => {
  return zql.post
    .where(permission)
    .where('userId', props.userId)
    .orderBy('createdAt', 'desc')
    .limit(props.limit ?? 100)
}

export const postById = (props: { postId: string }) => {
  return zql.post.where(permission).where('id', props.postId).one()
}
```

If the post model already exports a `postReadPermission` (e.g. one that also lets followers/friends read), import and use that instead of redefining `permission` here — same pattern as `messagesByChatId` reusing `messageReadPermission`.

After editing, regenerate so the new query shows up in `generated/syncedQueries.ts` and `generated/groupedQueries.ts`:

```bash
cd packages/zero-schema && bun zero:generate
```

## 2. Hook — `apps/web/src/features/post/useUserPosts.ts`

```ts
import { postsByUserId } from '@vine/zero-schema/queries/post'
import { useAuth } from '~/features/auth/client/authClient'
import { useZeroQuery, zero } from '~/zero/client'

export interface Post {
  id: string
  userId: string
  caption?: string | null
  imageUrl: string
  createdAt: number
}

export function useUserPosts() {
  const auth = useAuth()
  const userId = auth?.user?.id

  const [posts, { type }] = useZeroQuery(
    postsByUserId,
    { userId: userId || '' },
    { enabled: Boolean(userId) },
  )

  const isLoading = type === 'unknown'

  const createPost = (input: { imageUrl: string; caption?: string }) => {
    if (!userId) return

    zero.mutate.post.insert({
      id: crypto.randomUUID(),
      userId,
      imageUrl: input.imageUrl,
      caption: input.caption ?? null,
      createdAt: Date.now(),
    })
  }

  return {
    posts: (posts ?? []) as Post[],
    isLoading,
    createPost,
  }
}
```

Notes on why it looks like this:

- `userId` comes from `useAuth()` (JWT, sync), not `useUser()` (DB round-trip) — avoids a waterfall before the query can start.
- `enabled: Boolean(userId)` skips the query while auth is loading, so we don't fire a query for `userId: ''`.
- `type === 'unknown'` means the local cache is still warming; flip to `'complete'` after the server confirms.
- `id` and `createdAt` are generated in the hook, not inside a custom mutation, so the optimistic and server runs produce identical rows. This matters even for plain `.insert(...)`.
- The insert is fire-and-forget (no `await`) — the row appears in the list instantly via the optimistic cache. Add `await` only if the next step (closing a dialog, navigating) needs the server's confirmation.

## 3. Component usage

```tsx
import { useState } from 'react'
import { Button, Input, Spinner, Text, YStack } from 'tamagui'
import { useUserPosts } from '~/features/post/useUserPosts'

export function MyPostsScreen() {
  const { posts, isLoading, createPost } = useUserPosts()
  const [imageUrl, setImageUrl] = useState('')
  const [caption, setCaption] = useState('')

  if (isLoading) return <Spinner />

  return (
    <YStack gap="$3" p="$4">
      <Input placeholder="Image URL" value={imageUrl} onChangeText={setImageUrl} />
      <Input placeholder="Caption (optional)" value={caption} onChangeText={setCaption} />
      <Button
        disabled={!imageUrl}
        onPress={() => {
          createPost({ imageUrl, caption: caption || undefined })
          setImageUrl('')
          setCaption('')
        }}
      >
        Post
      </Button>

      {posts.map(post => (
        <YStack key={post.id} gap="$1">
          <Text>{post.caption ?? '(no caption)'}</Text>
          <Text fontSize="$2" color="$gray10">
            {new Date(post.createdAt).toLocaleString()}
          </Text>
        </YStack>
      ))}
    </YStack>
  )
}
```

The newly-created post appears at the top immediately (optimistic), then gets confirmed by the server in the background.
