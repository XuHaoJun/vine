# Manager OA Chat MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the manager-side OA chat MVP with realtime Zero-backed chat list, message room, text sending, minimal profile panel, unread dots, seed data, and integration coverage.

**Architecture:** Keep the manager shell on existing ConnectRPC account loading, but put chat list, messages, OA sending, and OA read state in Zero. Add OA ownership tables and relationships to Zero so server-side permissions can authorize an OA provider owner without making the owner a chat member.

**Tech Stack:** One routes, Tamagui UI, `@vine/zero-schema`, `on-zero` permissions/mutations, Playwright integration tests, Bun/Turbo.

---

## File Map

- Modify `packages/zero-schema/src/models/oaProvider.ts`: add Zero model for `oaProvider`.
- Modify `packages/zero-schema/src/models/officialAccount.ts`: add Zero model for `officialAccount`.
- Modify `packages/zero-schema/src/relationships.ts`: add OA ownership relationships.
- Modify `packages/zero-schema/src/models/chat.ts`: add manager-aware OA chat read permission.
- Modify `packages/zero-schema/src/models/message.ts`: add manager-aware message read permission and `sendAsOA`.
- Modify `packages/zero-schema/src/models/chatMember.ts`: add manager-aware chat member permission and `markOARead`.
- Modify `packages/zero-schema/src/queries/chat.ts`: add `oaChatsByOfficialAccountId` and `oaChatMembersByChatId`.
- Modify `packages/zero-schema/src/queries/message.ts`: add `oaMessagesByChatId`.
- Modify `packages/zero-schema/src/index.ts`: export OA models.
- Regenerate `packages/zero-schema/src/generated/*`.
- Test `packages/zero-schema/src/__tests__/manager-oa-chat.test.ts`: unit coverage for `sendAsOA` and `markOARead`.
- Modify `packages/db/src/seed/ensureSeed.ts`: seed manager-owned OA chat data if integration needs a stable fixture.
- Create `apps/web/src/features/oa-manager/chat/useManagerOAChats.ts`: Zero hook for COL2.
- Create `apps/web/src/features/oa-manager/chat/useManagerOAMessages.ts`: Zero hook for COL3 and read marker.
- Create `apps/web/src/features/oa-manager/chat/ManagerOAChatWorkspace.tsx`: 4-column workspace.
- Create `apps/web/src/features/oa-manager/chat/ManagerOAChatList.tsx`: COL2.
- Create `apps/web/src/features/oa-manager/chat/ManagerOAChatRoom.tsx`: COL3.
- Create `apps/web/src/features/oa-manager/chat/ManagerOAProfilePanel.tsx`: COL4.
- Create `apps/web/app/(app)/manager/[oaId]/chat/index.tsx`: route for empty/first screen.
- Create `apps/web/app/(app)/manager/[oaId]/chat/[chatId].tsx`: selected chat route.
- Modify `apps/web/app/(app)/manager/[oaId]/_layout.tsx`: add `Chats` nav item and route-aware content padding for chat workspace.
- Test `apps/web/src/test/integration/manager-oa-chat.test.ts`: Playwright happy path and access denial coverage.

## Task 1: Add OA Ownership Tables To Zero

**Files:**
- Create: `packages/zero-schema/src/models/oaProvider.ts`
- Create: `packages/zero-schema/src/models/officialAccount.ts`
- Modify: `packages/zero-schema/src/index.ts`
- Modify: `packages/zero-schema/src/relationships.ts`

- [ ] **Step 1: Add the `oaProvider` Zero model**

Create `packages/zero-schema/src/models/oaProvider.ts`:

```ts
import { string, table } from '@rocicorp/zero'
import { mutations, serverWhere } from 'on-zero'

import type { TableInsertRow } from 'on-zero'

export type OAProvider = TableInsertRow<typeof schema>

export const schema = table('oaProvider')
  .columns({
    id: string(),
    name: string(),
    ownerId: string(),
    createdAt: number(),
    updatedAt: number(),
  })
  .primaryKey('id')

export const oaProviderOwnerPermission = serverWhere('oaProvider', (_, auth) => {
  return _.cmp('ownerId', auth?.id || '')
})

export const mutate = mutations(schema, oaProviderOwnerPermission)
```

- [ ] **Step 2: Add the `officialAccount` Zero model**

Create `packages/zero-schema/src/models/officialAccount.ts`:

```ts
import { string, table } from '@rocicorp/zero'
import { mutations, serverWhere } from 'on-zero'

import type { TableInsertRow } from 'on-zero'

export type OfficialAccount = TableInsertRow<typeof schema>

export const schema = table('officialAccount')
  .columns({
    id: string(),
    providerId: string(),
    name: string(),
    uniqueId: string(),
    description: string().optional(),
    imageUrl: string().optional(),
    channelSecret: string(),
    status: string(),
    kind: string(),
    email: string().optional(),
    country: string().optional(),
    company: string().optional(),
    industry: string().optional(),
    createdAt: number(),
    updatedAt: number(),
  })
  .primaryKey('id')

export const officialAccountOwnerPermission = serverWhere(
  'officialAccount',
  (eb, auth) => {
    return eb.exists('provider', (q) => q.where('ownerId', auth?.id || ''))
  },
)

export const mutate = mutations(schema, officialAccountOwnerPermission)
```

- [ ] **Step 3: Export the new models**

Modify `packages/zero-schema/src/index.ts` and add these exports near the other
model exports:

```ts
export * as oaProviderModel from './models/oaProvider'
export * as officialAccountModel from './models/officialAccount'
```

- [ ] **Step 4: Add relationships for OA ownership**

Modify `packages/zero-schema/src/relationships.ts`.

Add an import-backed relationship block after `chatMemberRelationships`:

```ts
export const oaProviderRelationships = relationships(tables.oaProvider, ({ many }) => ({
  officialAccounts: many({
    sourceField: ['id'],
    destSchema: tables.officialAccount,
    destField: ['providerId'],
  }),
}))

export const officialAccountRelationships = relationships(
  tables.officialAccount,
  ({ one, many }) => ({
    provider: one({
      sourceField: ['providerId'],
      destSchema: tables.oaProvider,
      destField: ['id'],
    }),
    chatMembers: many({
      sourceField: ['id'],
      destSchema: tables.chatMember,
      destField: ['oaId'],
    }),
  }),
)
```

Add an `oa` relationship to the existing `chatMemberRelationships` object:

```ts
oa: one({
  sourceField: ['oaId'],
  destSchema: tables.officialAccount,
  destField: ['id'],
}),
```

Append the new relationship exports to `allRelationships`:

```ts
oaProviderRelationships,
officialAccountRelationships,
```

- [ ] **Step 5: Generate Zero schema files**

Run:

```bash
rtk bun --filter @vine/zero-schema zero:generate
```

Expected:

- `packages/zero-schema/src/generated/tables.ts` exports `oaProvider` and `officialAccount`.
- `packages/zero-schema/src/generated/models.ts` includes both new models.
- The command exits `0`.

- [ ] **Step 6: Typecheck the Zero package**

Run:

```bash
rtk bun --filter @vine/zero-schema typecheck
```

Expected: exit `0`.

- [ ] **Step 7: Commit Task 1**

```bash
rtk git add packages/zero-schema/src/models/oaProvider.ts \
  packages/zero-schema/src/models/officialAccount.ts \
  packages/zero-schema/src/index.ts \
  packages/zero-schema/src/relationships.ts \
  packages/zero-schema/src/generated
rtk git commit -m "feat: sync oa ownership tables in zero"
```

## Task 2: Add Manager-Aware Zero Permissions And Queries

**Files:**
- Modify: `packages/zero-schema/src/models/chat.ts`
- Modify: `packages/zero-schema/src/models/message.ts`
- Modify: `packages/zero-schema/src/models/chatMember.ts`
- Modify: `packages/zero-schema/src/queries/chat.ts`
- Modify: `packages/zero-schema/src/queries/message.ts`
- Test: `packages/zero-schema/src/__tests__/manager-oa-chat.test.ts`

- [ ] **Step 1: Add mutation unit tests first**

Create `packages/zero-schema/src/__tests__/manager-oa-chat.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'

import { mutate as chatMemberMutate } from '../models/chatMember'
import { mutate as messageMutate } from '../models/message'

function chain(rows: unknown[]) {
  return {
    where: vi.fn().mockReturnThis(),
    run: vi.fn().mockResolvedValue(rows),
  }
}

function makeTx(overrides: Record<string, any> = {}) {
  const inserted: unknown[] = []
  const chatUpdates: unknown[] = []
  const memberUpdates: unknown[] = []

  return {
    inserted,
    chatUpdates,
    memberUpdates,
    tx: {
      query: {
        officialAccount: chain([{ id: 'oa-1', providerId: 'provider-1' }]),
        oaProvider: chain([{ id: 'provider-1', ownerId: 'manager-1' }]),
        chat: chain([{ id: 'chat-1', type: 'oa' }]),
        chatMember: chain([{ id: 'oa-member-1', chatId: 'chat-1', oaId: 'oa-1' }]),
        ...overrides.query,
      },
      mutate: {
        message: {
          insert: vi.fn(async (msg: unknown) => inserted.push(msg)),
        },
        chat: {
          update: vi.fn(async (patch: unknown) => chatUpdates.push(patch)),
        },
        chatMember: {
          update: vi.fn(async (patch: unknown) => memberUpdates.push(patch)),
        },
        ...overrides.mutate,
      },
    },
  }
}

describe('manager OA chat mutations', () => {
  it('sendAsOA rejects unauthenticated callers', async () => {
    const { tx } = makeTx()

    await expect(
      messageMutate.sendAsOA(
        { authData: undefined, tx } as any,
        {
          id: 'msg-1',
          chatId: 'chat-1',
          oaId: 'oa-1',
          text: 'hello',
          createdAt: 123,
        },
      ),
    ).rejects.toThrow('Unauthorized')
  })

  it('sendAsOA rejects non-owners', async () => {
    const { tx } = makeTx({
      query: {
        oaProvider: chain([{ id: 'provider-1', ownerId: 'other-manager' }]),
      },
    })

    await expect(
      messageMutate.sendAsOA(
        { authData: { id: 'manager-1' }, tx } as any,
        {
          id: 'msg-1',
          chatId: 'chat-1',
          oaId: 'oa-1',
          text: 'hello',
          createdAt: 123,
        },
      ),
    ).rejects.toThrow('Unauthorized')
  })

  it('sendAsOA inserts an OA text message and updates chat last message', async () => {
    const { tx, inserted, chatUpdates } = makeTx()

    await messageMutate.sendAsOA(
      { authData: { id: 'manager-1' }, tx } as any,
      {
        id: 'msg-1',
        chatId: 'chat-1',
        oaId: 'oa-1',
        text: '  hello from OA  ',
        createdAt: 123,
      },
    )

    expect(inserted[0]).toEqual({
      id: 'msg-1',
      chatId: 'chat-1',
      senderType: 'oa',
      oaId: 'oa-1',
      type: 'text',
      text: 'hello from OA',
      createdAt: 123,
    })
    expect(chatUpdates[0]).toEqual({
      id: 'chat-1',
      lastMessageId: 'msg-1',
      lastMessageAt: 123,
    })
  })

  it('markOARead updates only the OA member row', async () => {
    const { tx, memberUpdates } = makeTx()

    await chatMemberMutate.markOARead(
      { authData: { id: 'manager-1' }, tx } as any,
      {
        chatId: 'chat-1',
        oaId: 'oa-1',
        lastReadMessageId: 'msg-user-1',
        lastReadAt: 456,
      },
    )

    expect(memberUpdates[0]).toEqual({
      id: 'oa-member-1',
      lastReadMessageId: 'msg-user-1',
      lastReadAt: 456,
    })
  })
})
```

- [ ] **Step 2: Run the failing tests**

Run:

```bash
rtk bun --cwd packages/zero-schema vitest run src/__tests__/manager-oa-chat.test.ts
```

Expected: failure because `sendAsOA` and `markOARead` do not exist yet.

- [ ] **Step 3: Add OA ownership helper code to `message.ts`**

Modify `packages/zero-schema/src/models/message.ts`. Add this helper above
`export const mutate`:

```ts
async function assertOaOwner(
  tx: { query?: Record<string, any> },
  oaId: string,
  userId: string,
) {
  const query = tx.query as Record<string, any> | undefined
  if (!query?.officialAccount || !query?.oaProvider) {
    throw new Error('Unauthorized')
  }

  const accounts = await query.officialAccount.where('id', oaId).run()
  const account = accounts[0]
  if (!account) throw new Error('Unauthorized')

  const providers = await query.oaProvider.where('id', account.providerId).run()
  const provider = providers[0]
  if (!provider || provider.ownerId !== userId) {
    throw new Error('Unauthorized')
  }
}

async function assertOaChat(
  tx: { query?: Record<string, any> },
  chatId: string,
  oaId: string,
) {
  const query = tx.query as Record<string, any> | undefined
  if (!query?.chat || !query?.chatMember) throw new Error('Unauthorized')

  const chats = await query.chat.where('id', chatId).where('type', 'oa').run()
  if (chats.length === 0) throw new Error('Unauthorized')

  const members = await query.chatMember
    .where('chatId', chatId)
    .where('oaId', oaId)
    .run()
  if (members.length === 0) throw new Error('Unauthorized')
}
```

- [ ] **Step 4: Add manager-aware message read permission**

In `packages/zero-schema/src/models/message.ts`, keep the existing user-member
permission and add:

```ts
export const messageReadPermission = serverWhere('message', (eb, auth) => {
  const userId = auth?.id || ''
  return eb.or(
    eb.exists('members', (q) => q.where('userId', userId)),
    eb.exists('members', (q) =>
      q.whereExists('oa', (oaQ) =>
        oaQ.whereExists('provider', (providerQ) =>
          providerQ.where('ownerId', userId),
        ),
      ),
    ),
  )
})
```

- [ ] **Step 5: Add `message.sendAsOA`**

In the third argument to `mutations(schema, messageReadPermission, { ... })`,
add:

```ts
sendAsOA: async (
  { authData, tx },
  args: {
    id: string
    chatId: string
    oaId: string
    text: string
    createdAt: number
  },
) => {
  if (!authData) throw new Error('Unauthorized')

  const text = args.text.trim()
  if (!text) throw new Error('Message text is required')

  await assertOaOwner(tx as { query?: Record<string, any> }, args.oaId, authData.id)
  await assertOaChat(tx as { query?: Record<string, any> }, args.chatId, args.oaId)

  await tx.mutate.message.insert({
    id: args.id,
    chatId: args.chatId,
    senderType: 'oa',
    oaId: args.oaId,
    type: 'text',
    text,
    createdAt: args.createdAt,
  })

  await tx.mutate.chat.update({
    id: args.chatId,
    lastMessageId: args.id,
    lastMessageAt: args.createdAt,
  })
},
```

- [ ] **Step 6: Add manager-aware chat read permission**

Modify `packages/zero-schema/src/models/chat.ts` and replace
`chatReadPermission` with:

```ts
export const chatReadPermission = serverWhere('chat', (eb, auth) => {
  const userId = auth?.id || ''
  return eb.or(
    eb.exists('members', (q) => q.where('userId', userId)),
    eb.exists('members', (q) =>
      q.whereExists('oa', (oaQ) =>
        oaQ.whereExists('provider', (providerQ) =>
          providerQ.where('ownerId', userId),
        ),
      ),
    ),
  )
})
```

- [ ] **Step 7: Add manager-aware chat member permission and `markOARead`**

Modify `packages/zero-schema/src/models/chatMember.ts`.

Replace `chatMemberPermission` with:

```ts
const chatMemberPermission = serverWhere('chatMember', (eb, auth) => {
  const userId = auth?.id || ''
  return eb.or(
    eb.cmp('userId', userId),
    eb.exists('chat', (q) =>
      q.whereExists('members', (mq) => mq.where('userId', userId)),
    ),
    eb.exists('oa', (oaQ) =>
      oaQ.whereExists('provider', (providerQ) => providerQ.where('ownerId', userId)),
    ),
  )
})
```

Add this helper near the top:

```ts
async function assertOaOwner(
  tx: { query?: Record<string, any> },
  oaId: string,
  userId: string,
) {
  const query = tx.query as Record<string, any> | undefined
  if (!query?.officialAccount || !query?.oaProvider) {
    throw new Error('Unauthorized')
  }

  const accounts = await query.officialAccount.where('id', oaId).run()
  const account = accounts[0]
  if (!account) throw new Error('Unauthorized')

  const providers = await query.oaProvider.where('id', account.providerId).run()
  const provider = providers[0]
  if (!provider || provider.ownerId !== userId) {
    throw new Error('Unauthorized')
  }
}
```

Add this mutation inside the custom mutation object:

```ts
markOARead: async (
  { authData, tx },
  data: {
    chatId: string
    oaId: string
    lastReadMessageId: string
    lastReadAt: number
  },
) => {
  if (!authData) throw new Error('Unauthorized')

  await assertOaOwner(tx as { query?: Record<string, any> }, data.oaId, authData.id)

  const query = tx.query as Record<string, any> | undefined
  if (!query?.chatMember) throw new Error('Unauthorized')

  const members = await query.chatMember
    .where('chatId', data.chatId)
    .where('oaId', data.oaId)
    .run()
  const member = members[0]
  if (!member) throw new Error('Unauthorized')

  await tx.mutate.chatMember.update({
    id: member.id,
    lastReadMessageId: data.lastReadMessageId,
    lastReadAt: data.lastReadAt,
  })
},
```

- [ ] **Step 8: Add manager OA chat queries**

Modify `packages/zero-schema/src/queries/chat.ts`:

```ts
export const oaChatsByOfficialAccountId = (props: { oaId: string }) => {
  return zql.chat
    .where(chatReadPermission)
    .where('type', 'oa')
    .whereExists('members', (q) => q.where('oaId', props.oaId))
    .related('members', (q) => q.related('user').related('oa'))
    .related('lastMessage')
    .orderBy('lastMessageAt', 'desc')
    .limit(50)
}

export const oaChatMembersByChatId = (props: { oaId: string; chatId: string }) => {
  return zql.chatMember
    .where('chatId', props.chatId)
    .whereExists('chat', (q) =>
      q.where(chatReadPermission)
        .where('id', props.chatId)
        .whereExists('members', (mq) => mq.where('oaId', props.oaId)),
    )
    .related('user')
    .related('oa')
}
```

Modify `packages/zero-schema/src/queries/message.ts`:

```ts
export const oaMessagesByChatId = (props: {
  oaId: string
  chatId: string
  limit?: number
}) => {
  return zql.message
    .where(messageReadPermission)
    .where('chatId', props.chatId)
    .whereExists('members', (q) => q.where('oaId', props.oaId))
    .related('sender')
    .orderBy('createdAt', 'asc')
    .limit(props.limit ?? 100)
}
```

- [ ] **Step 9: Regenerate Zero synced query/mutation validators**

Run:

```bash
rtk bun --filter @vine/zero-schema zero:generate
```

Expected: exit `0`, generated query and mutation files include the new manager
queries and mutations.

- [ ] **Step 10: Run unit tests**

Run:

```bash
rtk bun --cwd packages/zero-schema vitest run src/__tests__/manager-oa-chat.test.ts
```

Expected: exit `0`.

- [ ] **Step 11: Run typecheck**

Run:

```bash
rtk bun --filter @vine/zero-schema typecheck
```

Expected: exit `0`.

- [ ] **Step 12: Commit Task 2**

```bash
rtk git add packages/zero-schema/src/models/chat.ts \
  packages/zero-schema/src/models/message.ts \
  packages/zero-schema/src/models/chatMember.ts \
  packages/zero-schema/src/queries/chat.ts \
  packages/zero-schema/src/queries/message.ts \
  packages/zero-schema/src/__tests__/manager-oa-chat.test.ts \
  packages/zero-schema/src/generated
rtk git commit -m "feat: authorize manager oa chats in zero"
```

## Task 3: Seed Stable Manager OA Chat Fixture

**Files:**
- Modify: `packages/db/src/seed/ensureSeed.ts`

- [ ] **Step 1: Add deterministic message seed constants**

Modify `packages/db/src/seed/ensureSeed.ts` near existing OA constants:

```ts
const TEST_OA_CHAT_USER_MESSAGE_TEXT = 'Hello manager, I need help'
const TEST_OA_CHAT_MANAGER_REPLY_TEXT = 'Thanks for reaching out'
```

- [ ] **Step 2: Extend the existing `test1 <-> Test Bot` seed**

In the block that creates the OA friendship and OA chat for `test1`, after
inserting `chatMember` rows, insert a user message and update `chat.lastMessage*`:

```ts
const userMessageId = randomUUID()

await db.insert(message).values({
  id: userMessageId,
  chatId: oaChatId,
  senderId: test1Id,
  senderType: 'user',
  type: 'text',
  text: TEST_OA_CHAT_USER_MESSAGE_TEXT,
  createdAt: now,
})

await db
  .update(chat)
  .set({
    lastMessageId: userMessageId,
    lastMessageAt: now,
  })
  .where(eq(chat.id, oaChatId))
```

Do not set `lastReadMessageId` on the OA member row; the integration test needs
the latest user message to start unread.

- [ ] **Step 3: Make existing seeded friendship repair missing message data**

In the `else` branch for an existing OA friendship, add a lookup for the existing
OA chat between `test1Id` and `testOaId`. If the chat exists and has no
`lastMessageId`, insert `TEST_OA_CHAT_USER_MESSAGE_TEXT` and update
`lastMessageId/lastMessageAt`. Use the existing `db.select().from(chatMember)`
patterns from the same file.

Use this exact guard when a chat row is found:

```ts
if (!existingChat.lastMessageId) {
  const userMessageId = randomUUID()
  await db.insert(message).values({
    id: userMessageId,
    chatId: existingChat.id,
    senderId: test1Id,
    senderType: 'user',
    type: 'text',
    text: TEST_OA_CHAT_USER_MESSAGE_TEXT,
    createdAt: now,
  })
  await db
    .update(chat)
    .set({ lastMessageId: userMessageId, lastMessageAt: now })
    .where(eq(chat.id, existingChat.id))
}
```

- [ ] **Step 4: Run typecheck for DB package**

Run:

```bash
rtk bun --filter @vine/db typecheck
```

Expected: exit `0`.

- [ ] **Step 5: Commit Task 3**

```bash
rtk git add packages/db/src/seed/ensureSeed.ts
rtk git commit -m "test: seed manager oa chat fixture"
```

## Task 4: Add Manager OA Chat Hooks

**Files:**
- Create: `apps/web/src/features/oa-manager/chat/useManagerOAChats.ts`
- Create: `apps/web/src/features/oa-manager/chat/useManagerOAMessages.ts`

- [ ] **Step 1: Create `useManagerOAChats`**

Create `apps/web/src/features/oa-manager/chat/useManagerOAChats.ts`:

```ts
import { useMemo } from 'react'

import { oaChatsByOfficialAccountId } from '@vine/zero-schema/queries/chat'
import { useZeroQuery } from '~/zero/client'

export type ManagerOAChatListItem = {
  id: string
  userId: string
  userName: string
  userImage: string | null
  lastMessageText: string | null
  lastMessageAt: number | null
  hasUnread: boolean
}

export function useManagerOAChats(oaId: string | undefined, searchQuery: string) {
  const [chats, { type }] = useZeroQuery(
    oaChatsByOfficialAccountId,
    { oaId: oaId ?? '' },
    { enabled: Boolean(oaId) },
  )

  const items = useMemo<ManagerOAChatListItem[]>(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase()
    return (chats ?? [])
      .map((chat) => {
        const userMember = chat.members?.find((member) => member.userId)
        const oaMember = chat.members?.find((member) => member.oaId === oaId)
        const user = userMember?.user
        const name = user?.name ?? 'Unknown user'
        const lastMessage = chat.lastMessage
        const hasUnread =
          !!lastMessage &&
          lastMessage.senderType === 'user' &&
          oaMember?.lastReadMessageId !== lastMessage.id

        return {
          id: chat.id,
          userId: userMember?.userId ?? '',
          userName: name,
          userImage: user?.image ?? null,
          lastMessageText: lastMessage?.text ?? null,
          lastMessageAt: chat.lastMessageAt ?? null,
          hasUnread,
        }
      })
      .filter((item) => {
        if (!normalizedSearch) return true
        return item.userName.toLowerCase().includes(normalizedSearch)
      })
  }, [chats, oaId, searchQuery])

  return {
    chats: items,
    isLoading: type === 'unknown',
  }
}
```

- [ ] **Step 2: Create `useManagerOAMessages`**

Create `apps/web/src/features/oa-manager/chat/useManagerOAMessages.ts`:

```ts
import { useCallback, useMemo } from 'react'

import {
  oaChatMembersByChatId,
} from '@vine/zero-schema/queries/chat'
import { oaMessagesByChatId } from '@vine/zero-schema/queries/message'
import { zero, useZeroQuery } from '~/zero/client'

export function useManagerOAMessages(oaId: string | undefined, chatId: string | undefined) {
  const enabled = Boolean(oaId && chatId)

  const [messages, { type: messagesType }] = useZeroQuery(
    oaMessagesByChatId,
    { oaId: oaId ?? '', chatId: chatId ?? '' },
    { enabled },
  )

  const [members] = useZeroQuery(
    oaChatMembersByChatId,
    { oaId: oaId ?? '', chatId: chatId ?? '' },
    { enabled },
  )

  const userMember = useMemo(
    () => members?.find((member) => member.userId) ?? null,
    [members],
  )
  const oaMember = useMemo(
    () => members?.find((member) => member.oaId === oaId) ?? null,
    [members, oaId],
  )

  const sendMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim()
      if (!oaId || !chatId || !trimmed) return
      zero.mutate.message.sendAsOA({
        id: crypto.randomUUID(),
        chatId,
        oaId,
        text: trimmed,
        createdAt: Date.now(),
      })
    },
    [chatId, oaId],
  )

  const markRead = useCallback(
    (lastReadMessageId: string) => {
      if (!oaId || !chatId || !lastReadMessageId) return
      if (oaMember?.lastReadMessageId === lastReadMessageId) return
      zero.mutate.chatMember.markOARead({
        chatId,
        oaId,
        lastReadMessageId,
        lastReadAt: Date.now(),
      })
    },
    [chatId, oaId, oaMember?.lastReadMessageId],
  )

  return {
    messages: messages ?? [],
    isLoading: messagesType === 'unknown',
    userMember,
    oaMember,
    sendMessage,
    markRead,
  }
}
```

- [ ] **Step 3: Typecheck web package**

Run:

```bash
rtk bun --filter @vine/web typecheck
```

Expected: exit `0`.

- [ ] **Step 4: Commit Task 4**

```bash
rtk git add apps/web/src/features/oa-manager/chat/useManagerOAChats.ts \
  apps/web/src/features/oa-manager/chat/useManagerOAMessages.ts
rtk git commit -m "feat: add manager oa chat zero hooks"
```

## Task 5: Build Manager OA Chat UI And Routes

**Files:**
- Create: `apps/web/src/features/oa-manager/chat/ManagerOAChatWorkspace.tsx`
- Create: `apps/web/src/features/oa-manager/chat/ManagerOAChatList.tsx`
- Create: `apps/web/src/features/oa-manager/chat/ManagerOAChatRoom.tsx`
- Create: `apps/web/src/features/oa-manager/chat/ManagerOAProfilePanel.tsx`
- Create: `apps/web/app/(app)/manager/[oaId]/chat/index.tsx`
- Create: `apps/web/app/(app)/manager/[oaId]/chat/[chatId].tsx`
- Modify: `apps/web/app/(app)/manager/[oaId]/_layout.tsx`

- [ ] **Step 1: Create COL2 list component**

Create `apps/web/src/features/oa-manager/chat/ManagerOAChatList.tsx`:

```tsx
import { useRouter } from 'one'
import { Input, ScrollView, SizableText, XStack, YStack } from 'tamagui'

import { Avatar } from '~/interface/avatars/Avatar'
import { Pressable } from '~/interface/buttons/Pressable'

import type { ManagerOAChatListItem } from './useManagerOAChats'

type Props = {
  oaId: string
  selectedChatId?: string
  searchQuery: string
  onSearchQueryChange: (value: string) => void
  chats: ManagerOAChatListItem[]
  isLoading: boolean
}

function formatChatTime(ts: number | null): string {
  if (!ts) return ''
  const date = new Date(ts)
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function ManagerOAChatList({
  oaId,
  selectedChatId,
  searchQuery,
  onSearchQueryChange,
  chats,
  isLoading,
}: Props) {
  const router = useRouter()

  return (
    <YStack width={280} shrink={0} borderRightWidth={1} borderColor="$borderColor">
      <YStack p="$3" borderBottomWidth={1} borderColor="$borderColor">
        <Input
          value={searchQuery}
          onChangeText={onSearchQueryChange}
          placeholder="Search chats"
          size="$3"
        />
      </YStack>
      <ScrollView>
        {isLoading ? (
          <YStack p="$4">
            <SizableText size="$2" color="$color10">
              Loading chats...
            </SizableText>
          </YStack>
        ) : chats.length === 0 ? (
          <YStack p="$4">
            <SizableText size="$2" color="$color10">
              No chats
            </SizableText>
          </YStack>
        ) : (
          chats.map((chat) => (
            <Pressable
              key={chat.id}
              onPress={() => router.push(`/manager/${oaId}/chat/${chat.id}` as any)}
              px="$3"
              py="$3"
              bg={selectedChatId === chat.id ? '$color3' : 'transparent'}
              hoverStyle={{ bg: selectedChatId === chat.id ? '$color3' : '$color2' }}
            >
              <XStack gap="$3" items="center">
                <Avatar size={40} image={chat.userImage} name={chat.userName} />
                <YStack flex={1} minW={0} gap="$1">
                  <XStack items="center" justify="space-between" gap="$2">
                    <SizableText size="$3" fontWeight="600" numberOfLines={1}>
                      {chat.userName}
                    </SizableText>
                    <SizableText size="$1" color="$color10">
                      {formatChatTime(chat.lastMessageAt)}
                    </SizableText>
                  </XStack>
                  <XStack items="center" gap="$2">
                    {chat.hasUnread && (
                      <YStack width={8} height={8} rounded="$10" bg="$green9" />
                    )}
                    <SizableText size="$2" color="$color10" numberOfLines={1}>
                      {chat.lastMessageText ?? ''}
                    </SizableText>
                  </XStack>
                </YStack>
              </XStack>
            </Pressable>
          ))
        )}
      </ScrollView>
    </YStack>
  )
}
```

- [ ] **Step 2: Create COL4 profile component**

Create `apps/web/src/features/oa-manager/chat/ManagerOAProfilePanel.tsx`:

```tsx
import { SizableText, YStack } from 'tamagui'

import { Avatar } from '~/interface/avatars/Avatar'

type Props = {
  name: string
  image: string | null
}

export function ManagerOAProfilePanel({ name, image }: Props) {
  return (
    <YStack
      width={260}
      shrink={0}
      items="center"
      p="$5"
      gap="$3"
      borderLeftWidth={1}
      borderColor="$borderColor"
    >
      <Avatar size={88} image={image} name={name} />
      <SizableText size="$5" fontWeight="700" text="center" numberOfLines={2}>
        {name}
      </SizableText>
    </YStack>
  )
}
```

- [ ] **Step 3: Create COL3 room component**

Create `apps/web/src/features/oa-manager/chat/ManagerOAChatRoom.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react'
import { ScrollView, SizableText, XStack, YStack } from 'tamagui'

import { Avatar } from '~/interface/avatars/Avatar'
import { Button } from '~/interface/buttons/Button'
import { Input } from '~/interface/forms/Input'
import { MessageBubbleFactory } from '~/interface/message/MessageBubbleFactory'

import { useManagerOAMessages } from './useManagerOAMessages'

type Props = {
  oaId: string
  chatId?: string
}

export function ManagerOAChatRoom({ oaId, chatId }: Props) {
  const scrollRef = useRef<ScrollView>(null)
  const [draft, setDraft] = useState('')
  const { messages, isLoading, userMember, sendMessage, markRead } =
    useManagerOAMessages(oaId, chatId)

  const user = userMember?.user
  const userName = user?.name ?? 'Unknown user'
  const userImage = user?.image ?? null

  useEffect(() => {
    const latest = messages[messages.length - 1]
    if (latest?.senderType === 'user') {
      markRead(latest.id)
    }
  }, [markRead, messages])

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50)
    }
  }, [messages.length])

  if (!chatId) {
    return (
      <YStack flex={1} items="center" justify="center">
        <SizableText size="$3" color="$color10">
          Select a chat
        </SizableText>
      </YStack>
    )
  }

  const submit = () => {
    const text = draft.trim()
    if (!text) return
    sendMessage(text)
    setDraft('')
  }

  return (
    <YStack flex={1} minW={0}>
      <XStack height="$6" px="$4" items="center" gap="$3" borderBottomWidth={1} borderColor="$borderColor">
        <Avatar size={36} image={userImage} name={userName} />
        <SizableText size="$4" fontWeight="700" numberOfLines={1}>
          {userName}
        </SizableText>
      </XStack>

      <ScrollView ref={scrollRef} flex={1} bg="$color1">
        {isLoading ? (
          <YStack p="$4">
            <SizableText size="$2" color="$color10">
              Loading messages...
            </SizableText>
          </YStack>
        ) : messages.length === 0 ? (
          <YStack p="$4" items="center">
            <SizableText size="$2" color="$color10">
              No messages
            </SizableText>
          </YStack>
        ) : (
          <YStack p="$3" gap="$2">
            {messages.map((message) => (
              <MessageBubbleFactory
                key={message.id}
                type={message.type}
                text={message.text ?? ''}
                metadata={message.metadata ?? undefined}
                isMine={message.senderType === 'oa'}
                chatId={message.chatId}
                messageId={message.id}
                otherMemberOaId={oaId}
                sendMessage={sendMessage}
                miniAppId={message.miniAppId ?? null}
              />
            ))}
          </YStack>
        )}
      </ScrollView>

      <XStack p="$3" gap="$2" borderTopWidth={1} borderColor="$borderColor">
        <Input
          flex={1}
          value={draft}
          onChangeText={setDraft}
          placeholder="Aa"
          onSubmitEditing={submit}
        />
        <Button onPress={submit} disabled={!draft.trim()}>
          Send
        </Button>
      </XStack>
    </YStack>
  )
}
```

- [ ] **Step 4: Create workspace container**

Create `apps/web/src/features/oa-manager/chat/ManagerOAChatWorkspace.tsx`:

```tsx
import { useMemo, useState } from 'react'
import { XStack } from 'tamagui'

import { useManagerOAChats } from './useManagerOAChats'
import { ManagerOAChatList } from './ManagerOAChatList'
import { ManagerOAChatRoom } from './ManagerOAChatRoom'
import { ManagerOAProfilePanel } from './ManagerOAProfilePanel'

type Props = {
  oaId: string
  chatId?: string
}

export function ManagerOAChatWorkspace({ oaId, chatId }: Props) {
  const [searchQuery, setSearchQuery] = useState('')
  const { chats, isLoading } = useManagerOAChats(oaId, searchQuery)
  const selected = useMemo(
    () => chats.find((chat) => chat.id === chatId) ?? null,
    [chatId, chats],
  )

  return (
    <XStack flex={1} minH={0} bg="$background" $platform-web={{ overflow: 'hidden' }}>
      <ManagerOAChatList
        oaId={oaId}
        selectedChatId={chatId}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        chats={chats}
        isLoading={isLoading}
      />
      <ManagerOAChatRoom oaId={oaId} chatId={chatId} />
      {selected ? (
        <ManagerOAProfilePanel name={selected.userName} image={selected.userImage} />
      ) : null}
    </XStack>
  )
}
```

- [ ] **Step 5: Add routes**

Create `apps/web/app/(app)/manager/[oaId]/chat/index.tsx`:

```tsx
import { useActiveParams } from 'one'

import { ManagerOAChatWorkspace } from '~/features/oa-manager/chat/ManagerOAChatWorkspace'

export default function ManagerOAChatIndexPage() {
  const params = useActiveParams<{ oaId: string }>()
  return <ManagerOAChatWorkspace oaId={params.oaId} />
}
```

Create `apps/web/app/(app)/manager/[oaId]/chat/[chatId].tsx`:

```tsx
import { useActiveParams } from 'one'

import { ManagerOAChatWorkspace } from '~/features/oa-manager/chat/ManagerOAChatWorkspace'

export default function ManagerOAChatDetailPage() {
  const params = useActiveParams<{ oaId: string; chatId: string }>()
  return <ManagerOAChatWorkspace oaId={params.oaId} chatId={params.chatId} />
}
```

- [ ] **Step 6: Add manager sidebar nav and full-height content mode**

Modify `apps/web/app/(app)/manager/[oaId]/_layout.tsx`.

Add:

```ts
const isChatActive = path.includes('/chat')
```

Add a `Chats` `Link` before `Rich menus`:

```tsx
<Link href={`/manager/${oaId}/chat` as any}>
  <Pressable
    role="link"
    py="$2"
    px="$3"
    rounded="$3"
    bg={isChatActive ? '$color3' : 'transparent'}
    hoverStyle={{ bg: isChatActive ? '$color3' : '$color2' }}
  >
    <SizableText
      size="$2"
      fontWeight={isChatActive ? '700' : '500'}
      color={isChatActive ? '$color12' : '$color11'}
    >
      Chats
    </SizableText>
  </Pressable>
</Link>
```

Change the main content wrapper so chat routes are not constrained to
`maxW={1120}` or padded:

```tsx
<YStack flex={1} style={{ minHeight: 0 }} $platform-web={{ overflowY: 'auto' }}>
  {isChatActive ? (
    <Slot />
  ) : (
    <YStack p="$6" maxW={1120} width="100%" mx="auto">
      <Slot />
    </YStack>
  )}
</YStack>
```

- [ ] **Step 7: Typecheck web package**

Run:

```bash
rtk bun --filter @vine/web typecheck
```

Expected: exit `0`.

- [ ] **Step 8: Commit Task 5**

```bash
rtk git add apps/web/src/features/oa-manager/chat \
  apps/web/app/'(app)'/manager/'[oaId]'/chat \
  apps/web/app/'(app)'/manager/'[oaId]'/_layout.tsx
rtk git commit -m "feat: add manager oa chat workspace"
```

## Task 6: Add Integration Tests

**Files:**
- Create: `apps/web/src/test/integration/manager-oa-chat.test.ts`

- [ ] **Step 1: Write integration test**

Create `apps/web/src/test/integration/manager-oa-chat.test.ts`:

```ts
import { expect, test } from '@playwright/test'

import { BASE_URL, loginAsDemo, loginAsTest2 } from './helpers'

test.describe('Manager OA chat', () => {
  test('owner can view unread OA chat and send a reply', async ({ page }) => {
    test.setTimeout(60000)

    await loginAsDemo(page)
    await page.goto(`${BASE_URL}/manager`, { waitUntil: 'domcontentloaded' })
    await page.waitForURL(/\/manager$/, { timeout: 10000 })

    await page.getByText('Test Bot').first().click()
    await page.waitForURL(/\/manager\/.+/, { timeout: 15000 })
    await page.getByText('Chats', { exact: true }).click()
    await page.waitForURL(/\/manager\/.+\/chat$/, { timeout: 15000 })

    await expect(page.getByText('test1', { exact: false })).toBeVisible({
      timeout: 20000,
    })
    await expect(page.getByText('Hello manager, I need help')).toBeVisible({
      timeout: 20000,
    })

    await page.getByText('test1', { exact: false }).first().click()
    await page.waitForURL(/\/manager\/.+\/chat\/.+/, { timeout: 15000 })

    await expect(page.getByText('Hello manager, I need help')).toBeVisible()
    await expect(page.getByText('test1', { exact: false }).first()).toBeVisible()

    await page.getByPlaceholder('Aa').fill('Thanks for reaching out')
    await page.getByRole('button', { name: 'Send' }).click()

    await expect(page.getByText('Thanks for reaching out')).toBeVisible({
      timeout: 10000,
    })
  })

  test('non-owner cannot see manager OA chat data', async ({ page }) => {
    test.setTimeout(60000)

    await loginAsTest2(page)
    await page.goto(`${BASE_URL}/manager`, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('domcontentloaded')

    await expect(page.getByText('Test Bot')).toHaveCount(0)
  })
})
```

- [ ] **Step 2: Run the focused integration test against the local stack**

Run:

```bash
rtk bun run test:integration
```

Expected: manager OA chat tests pass. If the full integration suite is too slow
for local iteration, first run:

```bash
rtk bun --cwd apps/web run test:integration:manual -- manager-oa-chat.test.ts
```

Expected: focused test exits `0` against a clean running local stack.

- [ ] **Step 3: Commit Task 6**

```bash
rtk git add apps/web/src/test/integration/manager-oa-chat.test.ts
rtk git commit -m "test: cover manager oa chat mvp"
```

## Task 7: Final Verification And Cleanup

**Files:**
- Review all files changed by Tasks 1-6.

- [ ] **Step 1: Regenerate and format**

Run:

```bash
rtk bun --filter @vine/zero-schema zero:generate
rtk bun run format
```

Expected: commands exit `0`.

- [ ] **Step 2: Run unit checks**

Run:

```bash
rtk bun run test:unit
```

Expected: exit `0`.

- [ ] **Step 3: Run repo checks**

Run:

```bash
rtk bun run check:all
```

Expected: exit `0`.

- [ ] **Step 4: Run integration suite**

Run:

```bash
rtk bun run test:integration
```

Expected: exit `0`.

- [ ] **Step 5: Inspect final diff**

Run:

```bash
rtk git status --short
rtk git diff --stat HEAD
```

Expected:

- No unrelated files staged.
- Changes are limited to Zero schema, manager OA chat UI, seed fixture, and integration tests.

- [ ] **Step 6: Commit final cleanup if needed**

If formatting or generated files changed after Task 6:

```bash
rtk git add packages/zero-schema/src/generated apps/web packages/db
rtk git commit -m "chore: finalize manager oa chat mvp"
```

Expected: commit succeeds, or no commit is needed because the worktree is clean.

## Self-Review Checklist

- Spec coverage:
  - COL1 Chats route: Task 5.
  - COL2 realtime Zero chat list: Tasks 2, 4, 5.
  - COL3 realtime Zero messages and OA text sending: Tasks 2, 4, 5.
  - COL4 avatar/name only: Task 5.
  - Unread dot and OA-side read marker: Tasks 2, 4, 5, 6.
  - Seed data in `ensureSeed.ts`: Task 3.
  - Basic integration tests: Task 6.
  - Non-owner denial: Tasks 2 and 6.
- Placeholder scan: checked for prohibited placeholder terms and broken task references.
- Type consistency:
  - Query names match route hooks: `oaChatsByOfficialAccountId`, `oaMessagesByChatId`, `oaChatMembersByChatId`.
  - Mutation names match hooks: `message.sendAsOA`, `chatMember.markOARead`.
  - Route paths match spec: `/manager/:oaId/chat` and `/manager/:oaId/chat/:chatId`.
