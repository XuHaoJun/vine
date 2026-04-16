---
name: vine-data-fetching
description: Use when choosing how Vine frontend code should read or mutate server data, especially when deciding between Zero, React Query, ConnectRPC, and raw `fetch()`. Trigger when the user mentions `useZeroQuery`, `zero.mutate`, `useTanQuery`, `useTanMutation`, ConnectRPC hooks, streaming RPC, cache invalidation, or asks how data fetching should work in `apps/web`.
---

# Vine Data Fetching

This skill is the short decision layer for client-side server data access in Vine. Prefer the current repo pattern over abstract library guidance.

## Core Rule

Do not use raw `fetch()` for normal server data access in this repo.

Use:

1. Zero for synced entities in the Zero schema
2. React Query for non-Zero HTTP-style data
3. ConnectRPC for RPC service calls

Raw `fetch()` bypasses the repo's usual caching, loading, error, and sync patterns.

## Decision Table

| If the data is... | Use |
| --- | --- |
| in `@vine/zero-schema` and should stay synced | `useZeroQuery` / `zero.mutate` |
| external, one-off, upload/download, analytics, or not part of Zero models | `useTanQuery` / `useTanMutation` |
| a unary ConnectRPC service call | `createClient(...)` + `useTanQuery` / `useTanMutation` |
| a streaming ConnectRPC call | raw `@connectrpc/connect` / `@connectrpc/connect-web` stream APIs |

## Choose Zero When

- the entity already lives in Zero schema
- the feature wants real-time sync
- the UI benefits from local-first reads or offline behavior
- you are doing normal CRUD on synced app data

## Choose React Query When

- the data is not in Zero schema
- the request is an external integration
- the feature is a file upload or download
- the request is operational or analytics-oriented rather than synced product state

## Choose ConnectRPC When

### Unary RPC

The current Vine pattern is:

1. create a typed client with `createClient(Service, connectTransport)`
2. call it from `useTanQuery` or `useTanMutation`
3. invalidate the relevant TanStack query keys after successful mutations

This keeps RPC usage aligned with the rest of the repo's query layer.

### Streaming RPC

Use raw Connect clients for stream lifecycle control such as:

- `onMessage`
- `onError`
- `onComplete`

For detailed Connect workflow, use the `connect` skill.

## Cache Invalidation

If a mutation changes data that you also read with React Query-style hooks, invalidate or update the affected cache entries on success.

```ts
useTanQueryClient().invalidateQueries({
  queryKey: ['some-key'],
})
```

Typical cases:

- list and detail views backed by `useTanQuery`
- Connect unary queries that are wrapped in `useTanQuery`

You usually do not do this style of manual invalidation for normal Zero entity reads because Zero is already the sync layer.

## Relationship To Other Skills

- Use `zero` for schema, query, mutation, relationship, and permission details
- Use `connect` for proto, handler, transport, and client wiring details
- Use `vine-frontend-patterns` when the data choice is only one part of a larger UI flow

## Common Mistakes

- reaching for raw `fetch()` because it feels simpler
- putting synced product data behind React Query instead of Zero
- using Zero for external integrations or file transfers that are not part of the synced model graph
- skipping TanStack invalidation after a Connect client mutation updates cached query data
- using a streaming RPC through a normal query wrapper when raw Connect lifecycle control is needed
- forgetting cache invalidation after a mutation that updates React Query-backed data

## Reference Files

- `apps/web/src/zero/client.tsx`
- `apps/web/src/features/auth/client/connectTransport.ts`
- `apps/web/src/features/oa/client.ts`
- `apps/web/src/query/index.ts`
- `packages/zero-schema/src/queries/`
- `packages/zero-schema/src/models/`
