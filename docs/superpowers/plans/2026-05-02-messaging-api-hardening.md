# Messaging API Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the Profile API stub, add the loading animation endpoint with chat UI, and add access token management to the developer console.

**Architecture:** Profile API queries `userPublic` directly. Loading animation uses a Zero-synced `chatOaLoading` ephemeral table written server-side and read client-side with a local `setTimeout` for expiry. Access token UI calls existing `IssueAccessToken`/`ListAccessTokens`/`RevokeAccessToken` RPCs.

**Tech Stack:** Fastify (server routes), Drizzle ORM (DB), Zero (sync layer), Tamagui + React Query (frontend), ConnectRPC (`oaClient`), Vitest (tests)

**Spec:** `docs/superpowers/specs/2026-05-02-messaging-api-hardening-design.md`

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `apps/server/src/plugins/oa-messaging.ts` | Modify | Profile API real data; loading animation endpoint |
| `apps/server/src/plugins/oa-messaging.test.ts` | Modify | Tests for profile API and loading animation |
| `apps/server/src/services/oa-messaging.ts` | Modify | Delete chatOaLoading row on message delivery; add cleanup fn |
| `apps/server/src/index.ts` | Modify | Register 60s cleanup interval for expired loading rows |
| `packages/db/src/schema-public.ts` | Modify | Add `chatOaLoading` table |
| `packages/zero-schema/src/models/chatOaLoading.ts` | Create | Zero model + read permission |
| `packages/zero-schema/src/generated/tables.ts` | Modify | Export new model |
| `packages/zero-schema/src/relationships.ts` | Modify | Add `chatOaLoadingRelationships` + update `allRelationships` |
| `packages/zero-schema/src/queries/chatOaLoading.ts` | Create | Zero query helper |
| `apps/web/src/interface/message/TypingIndicator.tsx` | Create | Three-dot animation component |
| `apps/web/app/(app)/home/(tabs)/talks/[chatId].tsx` | Modify | Wire Zero query + render TypingIndicator |
| `apps/web/app/(app)/developers/console/channel/[channelId]/AccessTokenSection.tsx` | Create | Token issue/list/revoke UI |
| `apps/web/app/(app)/developers/console/channel/[channelId]/MessagingApiTab.tsx` | Modify | Add AccessTokenSection |

---

## Task 1: Profile API — return real user data

**Files:**
- Modify: `apps/server/src/plugins/oa-messaging.ts`
- Modify: `apps/server/src/plugins/oa-messaging.test.ts`

- [ ] **Step 1: Write failing tests**

Add this `describe` block to `apps/server/src/plugins/oa-messaging.test.ts` (before the closing of the file):

```typescript
describe('oaMessagingPlugin — Get Profile', () => {
  it('returns 401 when no Bearer token', async () => {
    const mockDb = makeMockDb([], [])
    const { app } = createTestApp(mockDb)
    await app.ready()
    const res = await app.inject({
      method: 'GET',
      url: oaApiPath('/bot/profile/user-123'),
    })
    await app.close()
    expect(res.statusCode).toBe(401)
  })

  it('returns 404 when user not found', async () => {
    // selectCallCount=1 → token, selectCallCount=2 → empty user
    const mockLimit1 = vi.fn().mockResolvedValue([{ oaId, token: validToken, expiresAt: null }])
    const mockLimit2 = vi.fn().mockResolvedValue([])
    let selectCallCount = 0
    const mockSelect = vi.fn().mockImplementation(() => {
      selectCallCount++
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: selectCallCount === 1 ? mockLimit1 : mockLimit2,
          }),
        }),
      }
    })
    const mockInsert = vi.fn().mockReturnValue({ values: vi.fn().mockReturnThis() })
    const mockUpdate = vi.fn().mockReturnValue({ set: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis() })
    const { app } = createTestApp({ mockSelect, mockInsert, mockUpdate })
    await app.ready()
    const res = await app.inject({
      method: 'GET',
      url: oaApiPath('/bot/profile/user-missing'),
      headers: { authorization: `Bearer ${validToken}` },
    })
    await app.close()
    expect(res.statusCode).toBe(404)
  })

  it('returns real displayName and pictureUrl', async () => {
    const mockLimit1 = vi.fn().mockResolvedValue([{ oaId, token: validToken, expiresAt: null }])
    const mockLimit2 = vi.fn().mockResolvedValue([{ id: userId, name: 'Alice', image: 'https://example.com/pic.jpg' }])
    let selectCallCount = 0
    const mockSelect = vi.fn().mockImplementation(() => {
      selectCallCount++
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: selectCallCount === 1 ? mockLimit1 : mockLimit2,
          }),
        }),
      }
    })
    const mockInsert = vi.fn().mockReturnValue({ values: vi.fn().mockReturnThis() })
    const mockUpdate = vi.fn().mockReturnValue({ set: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis() })
    const { app } = createTestApp({ mockSelect, mockInsert, mockUpdate })
    await app.ready()
    const res = await app.inject({
      method: 'GET',
      url: oaApiPath(`/bot/profile/${userId}`),
      headers: { authorization: `Bearer ${validToken}` },
    })
    await app.close()
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.userId).toBe(userId)
    expect(body.displayName).toBe('Alice')
    expect(body.pictureUrl).toBe('https://example.com/pic.jpg')
  })

  it('returns empty string for pictureUrl when image is null', async () => {
    const mockLimit1 = vi.fn().mockResolvedValue([{ oaId, token: validToken, expiresAt: null }])
    const mockLimit2 = vi.fn().mockResolvedValue([{ id: userId, name: 'Bob', image: null }])
    let selectCallCount = 0
    const mockSelect = vi.fn().mockImplementation(() => {
      selectCallCount++
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: selectCallCount === 1 ? mockLimit1 : mockLimit2,
          }),
        }),
      }
    })
    const mockInsert = vi.fn().mockReturnValue({ values: vi.fn().mockReturnThis() })
    const mockUpdate = vi.fn().mockReturnValue({ set: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis() })
    const { app } = createTestApp({ mockSelect, mockInsert, mockUpdate })
    await app.ready()
    const res = await app.inject({
      method: 'GET',
      url: oaApiPath(`/bot/profile/${userId}`),
      headers: { authorization: `Bearer ${validToken}` },
    })
    await app.close()
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.pictureUrl).toBe('')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/server && bun test src/plugins/oa-messaging.test.ts --reporter=verbose 2>&1 | tail -20
```
Expected: tests in "Get Profile" fail (404 returns 200 with stub, real data test returns `'User'` not `'Alice'`)

- [ ] **Step 3: Fix the profile handler in `apps/server/src/plugins/oa-messaging.ts`**

Find the Get Profile handler (around line 504) and replace it:

```typescript
  // Get Profile
  fastify.get(
    oaApiPath('/bot/profile/:userId'),
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        await extractOaFromToken(request, db)
        const params = request.params as { userId: string }

        const [user] = await db
          .select()
          .from(userPublic)
          .where(eq(userPublic.id, params.userId))
          .limit(1)

        if (!user) {
          return reply.code(404).send({ message: 'User not found' })
        }

        return await reply.send({
          userId: user.id,
          displayName: user.name ?? '',
          pictureUrl: user.image ?? '',
        })
      } catch (err) {
        if (err instanceof Error && err.message === 'Invalid access token') {
          return reply
            .code(401)
            .send({ message: 'Invalid access token', code: 'INVALID_TOKEN' })
        }
        return reply.code(500).send({ message: 'Internal server error' })
      }
    },
  )
```

Make sure `userPublic` is imported at the top of the file. Check existing imports — it likely comes from `@vine/db`. Add if missing:

```typescript
import { ..., userPublic } from '@vine/db'
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/server && bun test src/plugins/oa-messaging.test.ts --reporter=verbose 2>&1 | tail -20
```
Expected: all "Get Profile" tests pass

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/plugins/oa-messaging.ts apps/server/src/plugins/oa-messaging.test.ts
git commit -m "fix(messaging-api): profile endpoint returns real user data"
```

---

## Task 2: chatOaLoading — DB schema and migration

**Files:**
- Modify: `packages/db/src/schema-public.ts`

- [ ] **Step 1: Add the table to the schema**

In `packages/db/src/schema-public.ts`, add after the `message` table definition:

```typescript
export const chatOaLoading = pgTable('chatOaLoading', {
  id: text('id').primaryKey(),
  chatId: text('chatId').notNull(),
  oaId: text('oaId').notNull(),
  expiresAt: bigint('expiresAt', { mode: 'number' }).notNull(),
})
```

- [ ] **Step 2: Generate the Drizzle migration**

```bash
cd packages/db && npx drizzle-kit generate --name add_chat_oa_loading
```

Expected: a new file created in `packages/db/drizzle/` ending in `_add_chat_oa_loading.sql`

- [ ] **Step 3: Verify the migration SQL**

Open the generated file and confirm it contains:
```sql
CREATE TABLE "chatOaLoading" (
  "id" text PRIMARY KEY NOT NULL,
  "chatId" text NOT NULL,
  "oaId" text NOT NULL,
  "expiresAt" bigint NOT NULL
);
```

- [ ] **Step 4: Apply the migration**

```bash
cd /home/noah/vine && bun run migrate
```

Expected: migration runs without errors

- [ ] **Step 5: Verify table exists in DB**

```bash
docker compose exec db psql -U postgres -d vine -c "\d \"chatOaLoading\""
```

Expected: table columns listed including `expiresAt bigint`

- [ ] **Step 6: Commit**

```bash
git add packages/db/src/schema-public.ts packages/db/drizzle/
git commit -m "feat(db): add chatOaLoading table for loading animation state"
```

---

## Task 3: chatOaLoading — Zero model, relationships, and publication rebuild

**Files:**
- Create: `packages/zero-schema/src/models/chatOaLoading.ts`
- Modify: `packages/zero-schema/src/generated/tables.ts`
- Modify: `packages/zero-schema/src/relationships.ts`
- Create: `packages/zero-schema/src/queries/chatOaLoading.ts`

- [ ] **Step 1: Create the Zero model**

Create `packages/zero-schema/src/models/chatOaLoading.ts`:

```typescript
import { number, string, table } from '@rocicorp/zero'
import { serverWhere } from 'on-zero'

export const schema = table('chatOaLoading')
  .columns({
    id: string(),
    chatId: string(),
    oaId: string(),
    expiresAt: number(),
  })
  .primaryKey('id')

// Only users who are members of the chat can read loading state
export const chatOaLoadingReadPermission = serverWhere('chatOaLoading', (eb, auth) => {
  return eb.exists('members', (q) => q.where('userId', auth?.id || ''))
})
```

- [ ] **Step 2: Export from generated/tables.ts**

In `packages/zero-schema/src/generated/tables.ts`, add the export (keep alphabetical order):

```typescript
export { schema as chatOaLoading } from '../models/chatOaLoading'
```

- [ ] **Step 3: Add relationship and update allRelationships in relationships.ts**

In `packages/zero-schema/src/relationships.ts`, add after `chatMemberRelationships`:

```typescript
export const chatOaLoadingRelationships = relationships(tables.chatOaLoading, ({ many }) => ({
  // Used by chatOaLoadingReadPermission (eb.exists('members', ...))
  members: many({
    sourceField: ['chatId'],
    destSchema: tables.chatMember,
    destField: ['chatId'],
  }),
}))
```

Then add it to `allRelationships`:

```typescript
export const allRelationships = [
  userRelationships,
  todoRelationships,
  userStateRelationships,
  friendshipRelationships,
  chatRelationships,
  chatMemberRelationships,
  chatOaLoadingRelationships,   // ← add this
  messageRelationships,
  entitlementRelationships,
  creatorProfileRelationships,
  stickerPackageRelationships,
  stickerAssetRelationships,
]
```

- [ ] **Step 4: Create the query helper**

Create `packages/zero-schema/src/queries/chatOaLoading.ts`:

```typescript
import { zql } from 'on-zero'
import { chatOaLoadingReadPermission } from '../models/chatOaLoading'

export const chatOaLoadingByChat = (props: { chatId: string; oaId: string }) => {
  return zql.chatOaLoading
    .where(chatOaLoadingReadPermission)
    .where('chatId', props.chatId)
    .where('oaId', props.oaId)
    .limit(1)
}
```

- [ ] **Step 5: Run zero:generate**

```bash
cd apps/web && bun zero:generate
```

Expected: `packages/zero-schema/src/generated/` files updated, no errors

- [ ] **Step 6: Rebuild the Zero publication**

```bash
docker compose run --rm migrate
```

Expected: migration completes, publication rebuilt

- [ ] **Step 7: Restart Zero and backend**

```bash
docker compose restart zero backend
```

Expected: both services restart cleanly

- [ ] **Step 8: Check for errors**

```bash
docker compose logs zero --tail=20
docker compose logs backend --tail=20
```

Expected: no `SchemaVersionNotSupported` errors

- [ ] **Step 9: Run type check**

```bash
cd /home/noah/vine && bun run build 2>&1 | tail -20
```

Expected: no TypeScript errors related to `chatOaLoading`

- [ ] **Step 10: Commit**

```bash
git add packages/zero-schema/src/models/chatOaLoading.ts \
        packages/zero-schema/src/generated/ \
        packages/zero-schema/src/relationships.ts \
        packages/zero-schema/src/queries/chatOaLoading.ts
git commit -m "feat(zero): add chatOaLoading model, relationship, and query"
```

---

## Task 4: Loading animation — server endpoint

**Files:**
- Modify: `apps/server/src/plugins/oa-messaging.ts`
- Modify: `apps/server/src/plugins/oa-messaging.test.ts`

- [ ] **Step 1: Write failing tests**

Add this `describe` block to `apps/server/src/plugins/oa-messaging.test.ts`:

```typescript
describe('oaMessagingPlugin — Loading Animation', () => {
  function makeLoadingMockDb(opts: {
    token?: boolean
    chatMember?: boolean
    chat?: { type: string }
  }) {
    const tokenRow = opts.token !== false ? [{ oaId, token: validToken, expiresAt: null }] : []
    const chatMemberRow = opts.chatMember !== false ? [{ chatId: 'chat-1', oaId }] : []
    const chatRow = opts.chat ? [{ id: 'chat-1', type: opts.chat.type }] : []

    let selectCallCount = 0
    const mockSelect = vi.fn().mockImplementation(() => {
      selectCallCount++
      const resultByCall: unknown[][] = [tokenRow, chatMemberRow, chatRow]
      const result = resultByCall[selectCallCount - 1] ?? []
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue(result) }),
        }),
      }
    })
    const mockInsert = vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoUpdate: vi.fn().mockResolvedValue([]),
      }),
    })
    const mockUpdate = vi.fn().mockReturnValue({ set: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis() })
    return { mockSelect, mockInsert, mockUpdate }
  }

  it('returns 401 when no Bearer token', async () => {
    const { app } = createTestApp(makeLoadingMockDb({ token: false }))
    await app.ready()
    const res = await app.inject({
      method: 'POST',
      url: oaApiPath('/bot/chat/loading/start'),
      payload: { chatId: 'chat-1', loadingSeconds: 5 },
    })
    await app.close()
    expect(res.statusCode).toBe(401)
  })

  it('returns 400 when loadingSeconds < 5', async () => {
    const { app } = createTestApp(makeLoadingMockDb({ chat: { type: 'oa' } }))
    await app.ready()
    const res = await app.inject({
      method: 'POST',
      url: oaApiPath('/bot/chat/loading/start'),
      headers: { authorization: `Bearer ${validToken}` },
      payload: { chatId: 'chat-1', loadingSeconds: 4 },
    })
    await app.close()
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 when loadingSeconds > 60', async () => {
    const { app } = createTestApp(makeLoadingMockDb({ chat: { type: 'oa' } }))
    await app.ready()
    const res = await app.inject({
      method: 'POST',
      url: oaApiPath('/bot/chat/loading/start'),
      headers: { authorization: `Bearer ${validToken}` },
      payload: { chatId: 'chat-1', loadingSeconds: 61 },
    })
    await app.close()
    expect(res.statusCode).toBe(400)
  })

  it('returns 404 when OA is not a member of the chat', async () => {
    const { app } = createTestApp(makeLoadingMockDb({ chatMember: false }))
    await app.ready()
    const res = await app.inject({
      method: 'POST',
      url: oaApiPath('/bot/chat/loading/start'),
      headers: { authorization: `Bearer ${validToken}` },
      payload: { chatId: 'chat-1', loadingSeconds: 5 },
    })
    await app.close()
    expect(res.statusCode).toBe(404)
  })

  it('returns 400 when chat is not type oa', async () => {
    const { app } = createTestApp(makeLoadingMockDb({ chat: { type: 'group' } }))
    await app.ready()
    const res = await app.inject({
      method: 'POST',
      url: oaApiPath('/bot/chat/loading/start'),
      headers: { authorization: `Bearer ${validToken}` },
      payload: { chatId: 'chat-1', loadingSeconds: 5 },
    })
    await app.close()
    expect(res.statusCode).toBe(400)
    const body = JSON.parse(res.body)
    expect(body.message).toContain('one-on-one')
  })

  it('returns 200 and upserts row on success', async () => {
    const mockDb = makeLoadingMockDb({ chat: { type: 'oa' } })
    const { app } = createTestApp(mockDb)
    await app.ready()
    const res = await app.inject({
      method: 'POST',
      url: oaApiPath('/bot/chat/loading/start'),
      headers: { authorization: `Bearer ${validToken}` },
      payload: { chatId: 'chat-1', loadingSeconds: 10 },
    })
    await app.close()
    expect(res.statusCode).toBe(200)
    expect(mockDb.mockInsert).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/server && bun test src/plugins/oa-messaging.test.ts --reporter=verbose 2>&1 | grep -A 3 "Loading Animation"
```
Expected: all "Loading Animation" tests fail (404 because route doesn't exist)

- [ ] **Step 3: Add the endpoint to oa-messaging.ts**

First, add `chatOaLoading` to the imports from `@vine/db` at the top of the file.

Then add this route after the Get Profile handler and before Get Quota:

```typescript
  // Loading animation
  fastify.post(
    oaApiPath('/bot/chat/loading/start'),
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const oaId = await extractOaFromToken(request, db)
        const body = request.body as { chatId: string; loadingSeconds: number }

        const loadingSeconds = Number(body.loadingSeconds)
        if (!Number.isInteger(loadingSeconds) || loadingSeconds < 5 || loadingSeconds > 60) {
          return reply
            .code(400)
            .send({ message: 'loadingSeconds must be an integer between 5 and 60' })
        }

        const [membership] = await db
          .select()
          .from(chatMember)
          .where(and(eq(chatMember.chatId, body.chatId), eq(chatMember.oaId, oaId)))
          .limit(1)

        if (!membership) {
          return reply.code(404).send({ message: 'Chat not found or OA is not a member' })
        }

        const [chatRow] = await db
          .select()
          .from(chat)
          .where(eq(chat.id, body.chatId))
          .limit(1)

        if (!chatRow || chatRow.type !== 'oa') {
          return reply
            .code(400)
            .send({ message: 'Loading animation is only supported for one-on-one OA chats' })
        }

        const expiresAt = Date.now() + loadingSeconds * 1000

        await db
          .insert(chatOaLoading)
          .values({ id: `${body.chatId}_${oaId}`, chatId: body.chatId, oaId, expiresAt })
          .onConflictDoUpdate({
            target: chatOaLoading.id,
            set: { expiresAt },
          })

        return reply.send({})
      } catch (err) {
        if (err instanceof Error && err.message === 'Missing Bearer token') {
          return reply
            .code(401)
            .send({ message: 'Missing Bearer token', code: 'INVALID_TOKEN' })
        }
        if (err instanceof Error && err.message === 'Invalid access token') {
          return reply
            .code(401)
            .send({ message: 'Invalid access token', code: 'INVALID_TOKEN' })
        }
        return reply.code(500).send({ message: 'Internal server error' })
      }
    },
  )
```

Make sure the imports include `chatMember`, `chat`, and `chatOaLoading` from `@vine/db`, and `and` from `drizzle-orm`.

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/server && bun test src/plugins/oa-messaging.test.ts --reporter=verbose 2>&1 | tail -30
```
Expected: all "Loading Animation" tests pass

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/plugins/oa-messaging.ts apps/server/src/plugins/oa-messaging.test.ts
git commit -m "feat(messaging-api): add loading animation endpoint POST /bot/chat/loading/start"
```

---

## Task 5: Loading animation — cleanup on delivery and periodic interval

**Files:**
- Modify: `apps/server/src/services/oa-messaging.ts`
- Modify: `apps/server/src/index.ts`

- [ ] **Step 1: Import chatOaLoading in oa-messaging.ts**

In `apps/server/src/services/oa-messaging.ts`, add `chatOaLoading` to the imports from `@vine/db`.

- [ ] **Step 2: Delete the loading row when OA delivers a message**

In `processPendingDeliveries`, inside the `for (const delivery of deliveries)` loop, after the chat `lastMessageId` update and before the `oaMessageDelivery` status update, add:

```typescript
        // Clear loading animation when OA sends a message to this chat
        await tx
          .delete(chatOaLoading)
          .where(
            and(
              eq(chatOaLoading.chatId, chatId),
              eq(chatOaLoading.oaId, delivery.oaId),
            ),
          )
```

- [ ] **Step 3: Add cleanupExpiredChatLoadings to the service**

At the end of `createOAMessagingService`, before the `return` statement, add:

```typescript
  async function cleanupExpiredChatLoadings() {
    const now = Date.now()
    await deps.db.delete(chatOaLoading).where(lt(chatOaLoading.expiresAt, now))
  }
```

And add it to the returned object:

```typescript
  return {
    // ... existing exports ...
    cleanupExpiredChatLoadings,
  }
```

Make sure `lt` is imported from `drizzle-orm` (it likely already is from existing usage).

- [ ] **Step 4: Register the cleanup interval in index.ts**

In `apps/server/src/index.ts`, after the `webhookRetentionInterval` block, add:

```typescript
const cleanupLoadings = () =>
  oaMessaging
    .cleanupExpiredChatLoadings()
    .catch((err) => logger.error({ err }, '[loading] cleanup failed'))

void cleanupLoadings()
const loadingCleanupInterval = setInterval(() => void cleanupLoadings(), 60_000)
app.addHook('onClose', async () => {
  clearInterval(loadingCleanupInterval)
})
```

- [ ] **Step 5: Run the server test suite to confirm nothing broke**

```bash
cd apps/server && bun test --reporter=verbose 2>&1 | tail -30
```
Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/services/oa-messaging.ts apps/server/src/index.ts
git commit -m "feat(messaging-api): clear loading animation row on message delivery and on interval"
```

---

## Task 6: Loading animation — TypingIndicator component and chat UI

**Files:**
- Create: `apps/web/src/interface/message/TypingIndicator.tsx`
- Modify: `apps/web/app/(app)/home/(tabs)/talks/[chatId].tsx`

- [ ] **Step 1: Create TypingIndicator component**

Create `apps/web/src/interface/message/TypingIndicator.tsx`:

```tsx
import { useEffect, useRef } from 'react'
import { Animated } from 'react-native'
import { XStack } from 'tamagui'

function Dot({ delay }: { delay: number }) {
  const opacity = useRef(new Animated.Value(0.4)).current
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 300, useNativeDriver: true }),
        Animated.delay(600 - delay),
      ]),
    )
    anim.start()
    return () => anim.stop()
  }, [opacity, delay])
  return (
    <Animated.View
      style={{
        opacity,
        width: 7,
        height: 7,
        borderRadius: 3.5,
        backgroundColor: 'white',
        marginHorizontal: 2,
      }}
    />
  )
}

export function TypingIndicator() {
  return (
    <XStack
      bg="$color8"
      px="$3"
      py="$2"
      items="center"
      style={{ borderRadius: 18, alignSelf: 'flex-start' }}
    >
      <Dot delay={0} />
      <Dot delay={200} />
      <Dot delay={400} />
    </XStack>
  )
}
```

- [ ] **Step 2: Wire the Zero query into chatId.tsx**

In `apps/web/app/(app)/home/(tabs)/talks/[chatId].tsx`:

Add imports at the top (only add what isn't already imported):
```typescript
import { useEffect, useRef, useState } from 'react'
import { chatOaLoadingByChat } from '@vine/zero-schema/queries/chatOaLoading'
import { TypingIndicator } from '~/interface/message/TypingIndicator'
```

After the existing `useRichMenu` call, add the Zero query:

```typescript
  const [loadingRows] = useZeroQuery(
    chatOaLoadingByChat,
    { chatId: chatId!, oaId: otherMemberOaId! },
    { enabled: Boolean(chatId && otherMemberOaId) },
  )
  const loadingRow = loadingRows?.[0] ?? null

  const [isOaLoading, setIsOaLoading] = useState(false)

  useEffect(() => {
    if (!loadingRow) {
      setIsOaLoading(false)
      return
    }
    const remaining = loadingRow.expiresAt - Date.now()
    if (remaining <= 0) {
      setIsOaLoading(false)
      return
    }
    setIsOaLoading(true)
    const timer = setTimeout(() => setIsOaLoading(false), remaining)
    return () => clearTimeout(timer)
  }, [loadingRow])
```

- [ ] **Step 3: Render TypingIndicator in the message list area**

In the JSX, find where the `QuickReplyBar` is rendered (around line 362). Just above it, add:

```tsx
      {isOaLoading && (
        <XStack px="$3" pb="$1">
          <TypingIndicator />
        </XStack>
      )}
```

- [ ] **Step 4: Run type check**

```bash
cd /home/noah/vine && bun run build 2>&1 | grep -E "error|Error" | head -20
```
Expected: no TypeScript errors

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/interface/message/TypingIndicator.tsx \
        apps/web/app/\(app\)/home/\(tabs\)/talks/\[chatId\].tsx
git commit -m "feat(chat): add typing indicator for OA loading animation"
```

---

## Task 7: Access token UI in developer console

**Files:**
- Create: `apps/web/app/(app)/developers/console/channel/[channelId]/AccessTokenSection.tsx`
- Modify: `apps/web/app/(app)/developers/console/channel/[channelId]/MessagingApiTab.tsx`

- [ ] **Step 1: Create AccessTokenSection component**

Create `apps/web/app/(app)/developers/console/channel/[channelId]/AccessTokenSection.tsx`:

```tsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, SizableText, XStack, YStack } from 'tamagui'
import { AccessTokenType } from '@vine/proto/oa'
import { oaClient } from '~/features/oa/client'
import { showToast } from '~/interface/toast/Toast'

type Props = { channelId: string }

export function AccessTokenSection({ channelId }: Props) {
  const queryClient = useQueryClient()
  const [revealedToken, setRevealedToken] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['oa', 'accessTokens', channelId],
    queryFn: () => oaClient.listAccessTokens({ officialAccountId: channelId }),
  })

  const issue = useMutation({
    mutationFn: () =>
      oaClient.issueAccessToken({
        officialAccountId: channelId,
        type: AccessTokenType.SHORT_LIVED,
      }),
    onSuccess: (res) => {
      setRevealedToken(res.accessToken)
      void queryClient.invalidateQueries({ queryKey: ['oa', 'accessTokens', channelId] })
    },
    onError: () => showToast('Failed to issue token', { type: 'error' }),
  })

  const revoke = useMutation({
    mutationFn: (tokenId: string) => oaClient.revokeAccessToken({ tokenId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['oa', 'accessTokens', channelId] })
      showToast('Token revoked', { type: 'info' })
    },
    onError: () => showToast('Failed to revoke token', { type: 'error' }),
  })

  function handleCopy(token: string) {
    navigator.clipboard.writeText(token).then(
      () => showToast('Copied', { type: 'info' }),
      () => showToast('Copy failed', { type: 'error' }),
    )
  }

  return (
    <YStack gap="$3" p="$4" borderWidth={1} borderColor="$borderColor" rounded="$2">
      <XStack justify="space-between" items="center">
        <SizableText size="$5" fontWeight="700" color="$color12">
          Channel access token
        </SizableText>
        <Button
          size="$3"
          onPress={() => issue.mutate()}
          disabled={issue.isPending}
        >
          Issue
        </Button>
      </XStack>

      {revealedToken && (
        <YStack gap="$2" p="$3" bg="$color3" rounded="$2">
          <SizableText size="$2" color="$color10">
            Copy this token now — it won't be shown again.
          </SizableText>
          <XStack gap="$2" items="center" flexWrap="wrap">
            <SizableText size="$2" color="$color12" fontFamily="$mono" flex={1}>
              {revealedToken}
            </SizableText>
            <Button size="$2" onPress={() => handleCopy(revealedToken)}>
              Copy
            </Button>
            <Button size="$2" variant="outlined" onPress={() => setRevealedToken(null)}>
              OK
            </Button>
          </XStack>
        </YStack>
      )}

      {isLoading && (
        <SizableText size="$2" color="$color10">Loading...</SizableText>
      )}

      {data?.tokens.length === 0 && !isLoading && (
        <SizableText size="$2" color="$color10">No active tokens.</SizableText>
      )}

      {data?.tokens.map((t) => (
        <XStack
          key={t.id}
          justify="space-between"
          items="center"
          py="$2"
          px="$3"
          borderWidth={1}
          borderColor="$borderColor"
          rounded="$2"
        >
          <YStack gap="$1">
            <SizableText size="$2" color="$color12" fontWeight="500">
              {t.type === AccessTokenType.SHORT_LIVED ? 'Short-lived' : 'JWT v2.1'}
            </SizableText>
            <SizableText size="$1" color="$color10">
              Issued: {new Date(t.createdAt).toLocaleDateString()}
              {t.expiresAt
                ? `  ·  Expires: ${new Date(t.expiresAt).toLocaleDateString()}`
                : ''}
            </SizableText>
          </YStack>
          <Button
            size="$2"
            variant="outlined"
            onPress={() => revoke.mutate(t.id)}
            disabled={revoke.isPending}
          >
            Revoke
          </Button>
        </XStack>
      ))}
    </YStack>
  )
}
```

- [ ] **Step 2: Add AccessTokenSection to MessagingApiTab**

In `apps/web/app/(app)/developers/console/channel/[channelId]/MessagingApiTab.tsx`, add the import and render it first:

```tsx
import { YStack } from 'tamagui'

import { AccessTokenSection } from './AccessTokenSection'
import { MessagingApiGuideSection } from './MessagingApiGuideSection'
import { MessagingApiQuotaSection } from './MessagingApiQuotaSection'
import { TestWebhookSection } from './TestWebhookSection'
import { WebhookErrorsSection } from './WebhookErrorsSection'
import { WebhookSettingsSection } from './WebhookSettingsSection'

export function MessagingApiTab({ channelId }: { channelId: string }) {
  return (
    <YStack gap="$6">
      <AccessTokenSection channelId={channelId} />
      <MessagingApiGuideSection />
      <MessagingApiQuotaSection channelId={channelId} />
      <WebhookSettingsSection channelId={channelId} />
      <WebhookErrorsSection channelId={channelId} />
      <TestWebhookSection channelId={channelId} />
    </YStack>
  )
}
```

- [ ] **Step 3: Run type check**

```bash
cd /home/noah/vine && bun run build 2>&1 | grep -E "error|Error" | head -20
```
Expected: no TypeScript errors

- [ ] **Step 4: Verify proto types compile correctly**

Check that `AccessTokenType` is imported properly:
```bash
grep -r "AccessTokenType" packages/proto/src 2>/dev/null | head -5
```
If the enum path is different, adjust the import in `AccessTokenSection.tsx`.

- [ ] **Step 5: Commit**

```bash
git add "apps/web/app/(app)/developers/console/channel/[channelId]/AccessTokenSection.tsx" \
        "apps/web/app/(app)/developers/console/channel/[channelId]/MessagingApiTab.tsx"
git commit -m "feat(console): add access token issue/list/revoke UI to Messaging API tab"
```

---

## Final verification

- [ ] **Run full test suite**

```bash
cd /home/noah/vine && bun run test 2>&1 | tail -30
```
Expected: all tests pass

- [ ] **Run lint and type check**

```bash
bun run check:all 2>&1 | tail -20
```
Expected: no errors
