# `useUserPosts` hook

Following the same pattern as `useTodos` / `useChats` in this repo: the ZQL query lives in `packages/zero-schema/src/queries/`, the React hook lives next to the feature in `apps/web/src/features/`, and writes go through `zero.mutate.<table>.<mutator>` from `~/zero/client`.

## 1. Query — `packages/zero-schema/src/queries/post.ts`

Add the user-scoped query alongside whatever else is already in this file. We use `serverWhere` so the same restriction is enforced on the Zero server (a user can only read their own posts), then filter by `userId` and order newest-first — exactly the same shape as `todosByUserId`.

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
```

> If posts should be publicly readable, swap `permission` for whatever read permission you defined on the `post` model (e.g. `postReadPermission` from `../models/post`) — same pattern as `messagesByChatId`.

## 2. Hook — `apps/web/src/features/post/useUserPosts.ts`

```ts
import { postsByUserId } from '@vine/zero-schema/queries/post'
import { useAuth } from '~/features/auth/client/authClient'
import { useZeroQuery, zero } from '~/zero/client'

export interface Post {
  id: string
  userId: string
  caption: string | null
  imageUrl: string
  createdAt: number
}

export function useUserPosts() {
  const { user } = useAuth()
  const userId = user?.id

  const [posts, { type }] = useZeroQuery(
    postsByUserId,
    { userId: userId || '' },
    { enabled: Boolean(userId) },
  )

  const isLoading = type === 'unknown'

  const createPost = (input: { imageUrl: string; caption?: string }) => {
    if (!userId) return

    const newPost: Post = {
      id: crypto.randomUUID(),
      userId,
      caption: input.caption ?? null,
      imageUrl: input.imageUrl,
      createdAt: Date.now(),
    }

    zero.mutate.post.insert(newPost)
  }

  return {
    posts: posts ?? [],
    isLoading,
    createPost,
  }
}
```

A few things worth noting (all copied from the existing hooks):

- `enabled: Boolean(userId)` keeps the query idle until auth resolves, so we don't fire a query with an empty `userId`.
- `type === 'unknown'` is Zero's "we have no local data yet" signal — that's our `isLoading`.
- The query is already `orderBy('createdAt', 'desc')`, so consumers can render `posts` directly. No client-side sort needed.
- `zero.mutate.post.insert(...)` is optimistic — the new row shows up in `posts` on the next render before the server round-trip completes. If you've defined a custom mutator (like `message.send` does), call that instead.

## 3. Using it in a component

```tsx
import { YStack, XStack, Text, Button, Image } from 'tamagui'

import { useUserPosts } from '~/features/post/useUserPosts'

export function MyPostsScreen() {
  const { posts, isLoading, createPost } = useUserPosts()

  if (isLoading) {
    return <Text>Loading…</Text>
  }

  return (
    <YStack gap="$3" p="$4">
      <Button
        onPress={() =>
          createPost({
            imageUrl: 'https://picsum.photos/600',
            caption: 'hello world',
          })
        }
      >
        New post
      </Button>

      {posts.length === 0 ? (
        <Text>No posts yet.</Text>
      ) : (
        posts.map((post) => (
          <YStack key={post.id} gap="$2">
            <Image source={{ uri: post.imageUrl }} width={300} height={300} />
            {post.caption && <Text>{post.caption}</Text>}
            <Text fontSize="$1" opacity={0.6}>
              {new Date(post.createdAt).toLocaleString()}
            </Text>
          </YStack>
        ))
      )}
    </YStack>
  )
}
```

That's it — the data is reactive, so as soon as `createPost` fires, the list re-renders with the new post on top.
