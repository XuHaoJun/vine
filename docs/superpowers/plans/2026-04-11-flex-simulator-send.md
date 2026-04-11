# Flex Simulator "Send..." Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Send..." button to the Flex Simulator header that opens a dialog allowing the logged-in user to send the active flex JSON to themselves via the seeded "Flex Message sim" Official Account.

**Architecture:** A `FLEX_SIMULATOR_OA_UNIQUE_ID` constant ('flexmessagesim') ties together the seed, server handler, and frontend. Two new ConnectRPC methods are added to `OAService`: `ResolveOfficialAccount` (look up OA by uniqueId, no auth required) and `SimulatorSendFlexMessage` (auth-guarded: checks friendship, finds/creates OA chat, inserts flex message). The header extends the existing `FlexSimulatorHeaderContext` pattern with a `sendHandler`. The dialog uses `useTanQuery`/`useTanMutation` + `oaClient` following the OADetailSheet pattern.

**Tech Stack:** Drizzle ORM, ConnectRPC (`@connectrpc/connect`), buf protobuf generation, Tamagui Dialog, React Query (`useTanQuery`/`useTanMutation` from `~/query`), vitest

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `packages/db/src/constants.ts` | Create | `FLEX_SIMULATOR_OA_UNIQUE_ID` constant (server/seed) |
| `apps/web/src/features/oa/constants.ts` | Create | Same constant for frontend (avoids importing db package in browser) |
| `packages/proto/proto/oa/v1/oa.proto` | Modify | Add `ResolveOfficialAccount` + `SimulatorSendFlexMessage` RPCs |
| `apps/server/src/services/oa.ts` | Modify | Add `findOfficialAccountByUniqueId` + `simulatorSendFlexMessage` |
| `apps/server/src/services/oa.test.ts` | Modify | Tests for `findOfficialAccountByUniqueId` |
| `apps/server/src/connect/oa.ts` | Modify | Implement two new RPC handlers |
| `packages/db/src/seed/ensureSeed.ts` | Modify | Seed "Flex Message sim" oaProvider + officialAccount |
| `apps/web/app/(app)/developers/flex-simulator/FlexSimulatorHeaderContext.tsx` | Modify | Add `sendHandler` / `setSendHandler` |
| `apps/web/app/(app)/developers/flex-simulator/_layout.tsx` | Modify | Add "Send..." button next to Reset |
| `apps/web/app/(app)/developers/flex-simulator/FlexSimulatorSendDialog.tsx` | Create | Send dialog component |
| `apps/web/app/(app)/developers/flex-simulator/index.tsx` | Modify | Register sendHandler, manage dialog state, render dialog |

---

### Task 1: Create shared FLEX_SIMULATOR_OA_UNIQUE_ID constants

**Files:**
- Create: `packages/db/src/constants.ts`
- Create: `apps/web/src/features/oa/constants.ts`

- [ ] **Create `packages/db/src/constants.ts`:**

```ts
export const FLEX_SIMULATOR_OA_UNIQUE_ID = 'flexmessagesim'
```

- [ ] **Create `apps/web/src/features/oa/constants.ts`:**

```ts
export const FLEX_SIMULATOR_OA_UNIQUE_ID = 'flexmessagesim'
```

- [ ] **Commit:**

```bash
git add packages/db/src/constants.ts apps/web/src/features/oa/constants.ts
git commit -m "feat(oa): add FLEX_SIMULATOR_OA_UNIQUE_ID constant"
```

---

### Task 2: Add proto RPCs and regenerate

**Files:**
- Modify: `packages/proto/proto/oa/v1/oa.proto`

- [ ] **Add these message types to `oa.proto` after the `OfficialAccountSummary` message block (before `service OAService {`):**

```protobuf
// ── Resolve by uniqueId ──

message ResolveOfficialAccountRequest {
  string unique_id = 1;
}

message ResolveOfficialAccountResponse {
  OfficialAccountSummary account = 1;
}

// ── Flex Simulator ──

message SimulatorSendFlexMessageRequest {
  string flex_json = 1;
}

message SimulatorSendFlexMessageResponse {}
```

- [ ] **Add the two RPCs inside `service OAService { }` after `rpc IsOAFriend`:**

```protobuf
  rpc ResolveOfficialAccount(ResolveOfficialAccountRequest) returns (ResolveOfficialAccountResponse);
  rpc SimulatorSendFlexMessage(SimulatorSendFlexMessageRequest) returns (SimulatorSendFlexMessageResponse);
```

- [ ] **Regenerate proto types:**

```bash
bun run --cwd packages/proto build
```

Expected: exits cleanly, generated files in `packages/proto/gen/` updated.

- [ ] **Commit:**

```bash
git add packages/proto/
git commit -m "feat(proto): add ResolveOfficialAccount and SimulatorSendFlexMessage RPCs"
```

---

### Task 3: Add findOfficialAccountByUniqueId to OA service (TDD)

**Files:**
- Modify: `apps/server/src/services/oa.test.ts`
- Modify: `apps/server/src/services/oa.ts`

- [ ] **Write the failing test in `oa.test.ts` — add a new describe block at the end:**

```typescript
describe('createOAService — findOfficialAccountByUniqueId', () => {
  it('returns account when found by uniqueId', async () => {
    const mockDb = createMockDb()
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([
            {
              id: 'oa-uuid',
              name: 'Flex Message sim',
              uniqueId: 'flexmessagesim',
              description: null,
              imageUrl: null,
            },
          ]),
        }),
      }),
    })

    const oa = createOAService({ db: mockDb as any, database: {} as any })
    const result = await oa.findOfficialAccountByUniqueId('flexmessagesim')

    expect(result).not.toBeNull()
    expect(result?.id).toBe('oa-uuid')
    expect(result?.uniqueId).toBe('flexmessagesim')
  })

  it('returns null when OA not found', async () => {
    const mockDb = createMockDb()
    // default createMockDb returns [] for selects

    const oa = createOAService({ db: mockDb as any, database: {} as any })
    const result = await oa.findOfficialAccountByUniqueId('nonexistent')

    expect(result).toBeNull()
  })
})
```

- [ ] **Run test to confirm it fails:**

```bash
bun run --cwd apps/server test -- --reporter=verbose
```

Expected: `TypeError: oa.findOfficialAccountByUniqueId is not a function`

- [ ] **Implement `findOfficialAccountByUniqueId` inside `createOAService` in `oa.ts` (add after the `getOfficialAccount` function):**

```typescript
async function findOfficialAccountByUniqueId(uniqueId: string) {
  const [account] = await db
    .select({
      id: officialAccount.id,
      name: officialAccount.name,
      uniqueId: officialAccount.uniqueId,
      description: officialAccount.description,
      imageUrl: officialAccount.imageUrl,
    })
    .from(officialAccount)
    .where(eq(officialAccount.uniqueId, uniqueId))
    .limit(1)
  return account ?? null
}
```

- [ ] **Add `findOfficialAccountByUniqueId` to the return object at the bottom of `createOAService` (after `verifyWebhook`):**

```typescript
    findOfficialAccountByUniqueId,
```

- [ ] **Run tests to confirm they pass:**

```bash
bun run --cwd apps/server test -- --reporter=verbose
```

Expected: all tests pass.

- [ ] **Commit:**

```bash
git add apps/server/src/services/oa.ts apps/server/src/services/oa.test.ts
git commit -m "feat(oa-service): add findOfficialAccountByUniqueId"
```

---

### Task 4: Add simulatorSendFlexMessage to OA service

**Files:**
- Modify: `apps/server/src/services/oa.ts`

- [ ] **Add these imports to the top of `oa.ts` (after the existing drizzle-orm import line):**

```typescript
import { inArray } from 'drizzle-orm'
import { chat, chatMember, message } from '@vine/db/schema-public'
import { FLEX_SIMULATOR_OA_UNIQUE_ID } from '@vine/db/constants'
```

Note: the existing import line is `import { and, eq, ilike, or, sql } from 'drizzle-orm'` — add `inArray` to that same line instead of a separate import.

- [ ] **Add `simulatorSendFlexMessage` inside `createOAService` (after `isOAFriend`):**

```typescript
async function simulatorSendFlexMessage(userId: string, flexJson: string) {
  // 1. Look up the Flex Sim OA
  const flexSimOA = await findOfficialAccountByUniqueId(FLEX_SIMULATOR_OA_UNIQUE_ID)
  if (!flexSimOA) {
    return { success: false, reason: 'oa_not_found' as const }
  }

  // 2. Check friendship
  const [existingFriendship] = await db
    .select()
    .from(oaFriendship)
    .where(and(eq(oaFriendship.oaId, flexSimOA.id), eq(oaFriendship.userId, userId)))
    .limit(1)

  if (!existingFriendship) {
    return { success: false, reason: 'not_friend' as const }
  }

  // 3. Find or create OA chat between this user and the Flex Sim OA
  const userChatSubquery = db
    .select({ chatId: chatMember.chatId })
    .from(chatMember)
    .where(eq(chatMember.userId, userId))

  const [existingChat] = await db
    .select({ id: chat.id })
    .from(chat)
    .innerJoin(chatMember, eq(chatMember.chatId, chat.id))
    .where(
      and(
        eq(chat.type, 'oa'),
        inArray(chat.id, userChatSubquery),
        eq(chatMember.oaId, flexSimOA.id),
      ),
    )
    .limit(1)

  let chatId: string

  if (existingChat) {
    chatId = existingChat.id
  } else {
    chatId = randomUUID()
    const now = new Date().toISOString()
    await db.insert(chat).values({ id: chatId, type: 'oa', createdAt: now })
    await db.insert(chatMember).values([
      { id: randomUUID(), chatId, userId, joinedAt: now },
      { id: randomUUID(), chatId, oaId: flexSimOA.id, joinedAt: now },
    ])
  }

  // 4. Insert the flex message
  const messageId = randomUUID()
  const sentAt = new Date().toISOString()
  await db.insert(message).values({
    id: messageId,
    chatId,
    senderType: 'oa',
    oaId: flexSimOA.id,
    type: 'flex',
    metadata: flexJson,
    createdAt: sentAt,
  })

  // 5. Update chat's last message pointers
  await db
    .update(chat)
    .set({ lastMessageId: messageId, lastMessageAt: sentAt })
    .where(eq(chat.id, chatId))

  return { success: true as const, chatId }
}
```

- [ ] **Add `simulatorSendFlexMessage` to the return object:**

```typescript
    simulatorSendFlexMessage,
```

- [ ] **Run type check:**

```bash
bun run check:all
```

Expected: no new errors.

- [ ] **Commit:**

```bash
git add apps/server/src/services/oa.ts
git commit -m "feat(oa-service): add simulatorSendFlexMessage"
```

---

### Task 5: Implement ConnectRPC handlers

**Files:**
- Modify: `apps/server/src/connect/oa.ts`

- [ ] **Add `resolveOfficialAccount` and `simulatorSendFlexMessage` to `oaServiceImpl` inside `oaHandler` (after the `isOAFriend` handler):**

```typescript
      async resolveOfficialAccount(req) {
        const account = await deps.oa.findOfficialAccountByUniqueId(req.uniqueId)
        if (!account) {
          throw new ConnectError('Official account not found', Code.NotFound)
        }
        return {
          account: {
            id: account.id,
            name: account.name,
            uniqueId: account.uniqueId,
            description: account.description ?? '',
            imageUrl: account.imageUrl ?? '',
          },
        }
      },

      async simulatorSendFlexMessage(req, ctx) {
        const auth = requireAuthData(ctx)
        const result = await deps.oa.simulatorSendFlexMessage(auth.id, req.flexJson)
        if (!result.success) {
          if (result.reason === 'not_friend') {
            throw new ConnectError(
              '請先加入 Flex Message sim 為好友',
              Code.FailedPrecondition,
            )
          }
          if (result.reason === 'oa_not_found') {
            throw new ConnectError('Flex Simulator OA not found', Code.Internal)
          }
        }
        return {}
      },
```

- [ ] **Run type check — TypeScript will verify the impl satisfies `ServiceImpl<typeof OAService>`:**

```bash
bun run check:all
```

Expected: no errors.

- [ ] **Commit:**

```bash
git add apps/server/src/connect/oa.ts
git commit -m "feat(oa-connect): implement resolveOfficialAccount and simulatorSendFlexMessage"
```

---

### Task 6: Seed "Flex Message sim" OA

**Files:**
- Modify: `packages/db/src/seed/ensureSeed.ts`

- [ ] **Add imports at the top of `ensureSeed.ts` (after the existing schema-public import):**

```typescript
import { oaProvider, officialAccount } from '../schema-oa'
import { FLEX_SIMULATOR_OA_UNIQUE_ID } from '../constants'
```

- [ ] **Add the OA seed block inside `ensureSeed`, before the final `console.info('[seed] Seed data initialization complete')` line:**

```typescript
  // Seed "Flex Message sim" Official Account
  const existingFlexOA = await db
    .select()
    .from(officialAccount)
    .where(eq(officialAccount.uniqueId, FLEX_SIMULATOR_OA_UNIQUE_ID))
    .limit(1)

  if (existingFlexOA.length === 0) {
    const flexProviderId = randomUUID()
    const flexOAId = randomUUID()

    await db.insert(oaProvider).values({
      id: flexProviderId,
      name: 'Vine Developers',
      ownerId: 'system',
      createdAt: now,
      updatedAt: now,
    })

    await db.insert(officialAccount).values({
      id: flexOAId,
      providerId: flexProviderId,
      name: 'Flex Message sim',
      uniqueId: FLEX_SIMULATOR_OA_UNIQUE_ID,
      description: 'Send Flex Messages to yourself for testing',
      channelSecret: bytesToHex(randomBytes(16)),
      status: 'active',
      createdAt: now,
      updatedAt: now,
    })

    console.info(`[seed] Created Flex Message sim OA (id: ${flexOAId})`)
  } else {
    console.info('[seed] Flex Message sim OA already exists, skipping')
  }
```

- [ ] **Run type check:**

```bash
bun run check:all
```

Expected: no errors.

- [ ] **Commit:**

```bash
git add packages/db/src/seed/ensureSeed.ts
git commit -m "feat(seed): seed Flex Message sim Official Account"
```

---

### Task 7: Extend FlexSimulatorHeaderContext with sendHandler

**Files:**
- Modify: `apps/web/app/(app)/developers/flex-simulator/FlexSimulatorHeaderContext.tsx`

- [ ] **Replace the entire file content with:**

```typescript
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

type FlexSimulatorHeaderContextValue = {
  resetHandler: (() => void) | null
  setResetHandler: (fn: (() => void) | null) => void
  sendHandler: (() => void) | null
  setSendHandler: (fn: (() => void) | null) => void
}

const FlexSimulatorHeaderContext = createContext<FlexSimulatorHeaderContextValue | null>(
  null,
)

export function FlexSimulatorHeaderProvider({ children }: { children: ReactNode }) {
  const [resetHandler, setResetHandler] = useState<(() => void) | null>(null)
  const [sendHandler, setSendHandler] = useState<(() => void) | null>(null)
  const value = useMemo(
    () => ({ resetHandler, setResetHandler, sendHandler, setSendHandler }),
    [resetHandler, sendHandler],
  )
  return (
    <FlexSimulatorHeaderContext.Provider value={value}>
      {children}
    </FlexSimulatorHeaderContext.Provider>
  )
}

export function useFlexSimulatorHeader() {
  const ctx = useContext(FlexSimulatorHeaderContext)
  if (!ctx) {
    throw new Error(
      'useFlexSimulatorHeader must be used within FlexSimulatorHeaderProvider',
    )
  }
  return ctx
}
```

- [ ] **Commit:**

```bash
git add apps/web/app/(app)/developers/flex-simulator/FlexSimulatorHeaderContext.tsx
git commit -m "feat(flex-simulator): extend header context with sendHandler"
```

---

### Task 8: Add "Send..." button to layout

**Files:**
- Modify: `apps/web/app/(app)/developers/flex-simulator/_layout.tsx`

- [ ] **In `FlexSimulatorLayoutInner`, change the destructure from:**

```typescript
  const { resetHandler } = useFlexSimulatorHeader()
```

**to:**

```typescript
  const { resetHandler, sendHandler } = useFlexSimulatorHeader()
```

- [ ] **Add the Send... button after the Reset button:**

Change:
```tsx
        <Button size="$2" onPress={() => resetHandler?.()} disabled={!resetHandler}>
          Reset
        </Button>
```

To:
```tsx
        <XStack gap="$2">
          <Button size="$2" onPress={() => resetHandler?.()} disabled={!resetHandler}>
            Reset
          </Button>
          <Button size="$2" onPress={() => sendHandler?.()} disabled={!sendHandler}>
            Send...
          </Button>
        </XStack>
```

- [ ] **Commit:**

```bash
git add apps/web/app/(app)/developers/flex-simulator/_layout.tsx
git commit -m "feat(flex-simulator): add Send... button to header"
```

---

### Task 9: Create FlexSimulatorSendDialog component

**Files:**
- Create: `apps/web/app/(app)/developers/flex-simulator/FlexSimulatorSendDialog.tsx`

- [ ] **Create the file with this content:**

```typescript
import { Dialog, XStack, YStack, SizableText } from 'tamagui'

import { Button } from '~/interface/buttons/Button'
import { showError } from '~/interface/dialogs/actions'
import { showToast } from '~/interface/toast/Toast'
import { useAuth } from '~/features/auth/client/authClient'
import { oaClient } from '~/features/oa/client'
import { FLEX_SIMULATOR_OA_UNIQUE_ID } from '~/features/oa/constants'
import { useTanMutation, useTanQuery, useTanQueryClient } from '~/query'
import type { OADetailData } from '~/interface/dialogs/OADetailSheet'

type FlexSimulatorSendDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  flexJson: string
  openOADetail: (oa: OADetailData) => void
}

export function FlexSimulatorSendDialog({
  open,
  onOpenChange,
  flexJson,
  openOADetail,
}: FlexSimulatorSendDialogProps) {
  const { user } = useAuth()
  const queryClient = useTanQueryClient()

  // Resolve Flex Sim OA info
  const { data: oaData } = useTanQuery({
    queryKey: ['oa', 'resolve', FLEX_SIMULATOR_OA_UNIQUE_ID],
    queryFn: () => oaClient.resolveOfficialAccount({ uniqueId: FLEX_SIMULATOR_OA_UNIQUE_ID }),
    enabled: open,
  })

  const flexSimOA = oaData?.account

  // Check friendship status
  const { data: isFriendData } = useTanQuery({
    queryKey: ['oa', 'isFriend', flexSimOA?.id],
    queryFn: () => oaClient.isOAFriend({ officialAccountId: flexSimOA!.id }),
    enabled: open && !!flexSimOA?.id,
  })

  const isFriend = isFriendData?.isFriend ?? false

  // Add friend mutation
  const addFriend = useTanMutation({
    mutationFn: () => oaClient.addOAFriend({ officialAccountId: flexSimOA!.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['oa', 'isFriend', flexSimOA?.id] })
      queryClient.invalidateQueries({ queryKey: ['oa', 'myFriends'] })
      showToast('已加入好友', { type: 'success' })
    },
    onError: () => {
      showToast('加入好友失敗', { type: 'error' })
    },
  })

  // Send flex message mutation
  const sendFlexMessage = useTanMutation({
    mutationFn: () => oaClient.simulatorSendFlexMessage({ flexJson }),
    onSuccess: () => {
      onOpenChange(false)
      showToast('已送出', { type: 'success' })
    },
    onError: (error) => {
      showError(error, '傳送失敗')
    },
  })

  return (
    <Dialog modal open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          key="overlay"
          animation="quick"
          opacity={0.5}
          enterStyle={{ opacity: 0 }}
          exitStyle={{ opacity: 0 }}
        />
        <Dialog.Content
          bordered
          elevate
          key="content"
          animation={['quick', { opacity: { overshootClamping: true } }]}
          enterStyle={{ x: 0, y: -20, opacity: 0, scale: 0.9 }}
          exitStyle={{ x: 0, y: 10, opacity: 0, scale: 0.95 }}
          gap="$4"
          minWidth={400}
          maxWidth={520}
          p="$5"
        >
          <Dialog.Title size="$6">Send Message</Dialog.Title>

          {/* Destination: current user (pre-selected) */}
          <YStack gap="$2">
            <SizableText size="$3" color="$color11">
              Destination:
            </SizableText>
            <XStack
              borderWidth={1}
              borderColor="$borderColor"
              borderRadius="$3"
              p="$3"
              gap="$3"
              items="center"
            >
              {/* Selected radio indicator */}
              <YStack
                width={18}
                height={18}
                borderRadius={9}
                borderWidth={2}
                borderColor="$blue9"
                items="center"
                justify="center"
              >
                <YStack width={8} height={8} borderRadius={4} bg="$blue9" />
              </YStack>
              {/* User avatar (initial fallback) */}
              <YStack
                width={40}
                height={40}
                borderRadius={20}
                bg="$color5"
                items="center"
                justify="center"
              >
                <SizableText size="$4" color="$color11" fontWeight="600">
                  {user?.name?.[0]?.toUpperCase() ?? 'U'}
                </SizableText>
              </YStack>
              <SizableText size="$4" color="$color12">
                {user?.name ?? ''}
              </SizableText>
            </XStack>
          </YStack>

          {/* Flex Message sim OA section */}
          {flexSimOA && (
            <XStack
              borderTopWidth={1}
              borderColor="$borderColor"
              pt="$3"
              gap="$3"
              items="center"
              justify="space-between"
              flexWrap="wrap"
            >
              <XStack gap="$3" items="center">
                <YStack
                  width={40}
                  height={40}
                  borderRadius={20}
                  bg="$color4"
                  items="center"
                  justify="center"
                >
                  <SizableText size="$3" color="$color10">
                    {flexSimOA.name[0]}
                  </SizableText>
                </YStack>
                <SizableText size="$3" color="$color11">
                  {flexSimOA.name}
                </SizableText>
              </XStack>
              <XStack gap="$2">
                <Button
                  size="$2"
                  variant="outlined"
                  onPress={() =>
                    openOADetail({
                      id: flexSimOA.id,
                      name: flexSimOA.name,
                      oaId: flexSimOA.uniqueId,
                      imageUrl: flexSimOA.imageUrl || undefined,
                    })
                  }
                >
                  查看官方帳號
                </Button>
                {isFriend ? (
                  <Button size="$2" variant="outlined" disabled>
                    已加好友
                  </Button>
                ) : (
                  <Button
                    size="$2"
                    onPress={() => addFriend.mutate()}
                    disabled={addFriend.isPending}
                  >
                    加入好友
                  </Button>
                )}
              </XStack>
            </XStack>
          )}

          {/* Footer */}
          <XStack gap="$3" justify="flex-end" pt="$2">
            <Dialog.Close asChild>
              <Button size="$3" variant="outlined">
                Cancel
              </Button>
            </Dialog.Close>
            <Button
              size="$3"
              onPress={() => sendFlexMessage.mutate()}
              disabled={sendFlexMessage.isPending}
            >
              Send
            </Button>
          </XStack>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  )
}
```

- [ ] **Run type check:**

```bash
bun run check:all
```

Expected: no errors.

- [ ] **Commit:**

```bash
git add apps/web/app/(app)/developers/flex-simulator/FlexSimulatorSendDialog.tsx
git commit -m "feat(flex-simulator): create FlexSimulatorSendDialog component"
```

---

### Task 10: Wire up index.tsx

**Files:**
- Modify: `apps/web/app/(app)/developers/flex-simulator/index.tsx`

- [ ] **Add these imports to `index.tsx`:**

```typescript
import { useOADetailSheet } from '~/interface/dialogs/OADetailSheet'
import { FlexSimulatorSendDialog } from './FlexSimulatorSendDialog'
```

- [ ] **Add `sendDialogOpen` state and `setSendHandler` wiring inside `FlexSimulatorPage`, right after the `setResetHandler` destructure:**

Change:
```typescript
  const { setResetHandler } = useFlexSimulatorHeader()
```

To:
```typescript
  const { setResetHandler, setSendHandler } = useFlexSimulatorHeader()
  const [sendDialogOpen, setSendDialogOpen] = useState(false)
  const { openDetail, DetailSheetComponent } = useOADetailSheet()
```

- [ ] **Register `sendHandler` in `useEffect` (add a second `useEffect` after the existing reset one):**

```typescript
  useEffect(() => {
    setSendHandler(() => () => setSendDialogOpen(true))
    return () => setSendHandler(null)
  }, [setSendHandler])
```

- [ ] **Add the dialog and OA detail sheet to the return JSX (at the bottom of the returned `<YStack>`, before the closing tag):**

```typescript
      <FlexSimulatorSendDialog
        open={sendDialogOpen}
        onOpenChange={setSendDialogOpen}
        flexJson={json}
        openOADetail={openDetail}
      />
      {DetailSheetComponent}
```

- [ ] **Run type check:**

```bash
bun run check:all
```

Expected: no errors.

- [ ] **Commit:**

```bash
git add apps/web/app/(app)/developers/flex-simulator/index.tsx
git commit -m "feat(flex-simulator): wire up Send... dialog in index.tsx"
```

---

### Task 11: Verify in browser

- [ ] **Start the dev stack:**

```bash
bun run dev
```

- [ ] **Navigate to `http://localhost:8081/developers/flex-simulator`**

- [ ] **Verify "Send..." button appears in the header next to "Reset"**

- [ ] **Click "Send..." — confirm dialog opens showing:**
  - Current user avatar + name with pre-selected radio indicator
  - "Flex Message sim" OA row with "查看官方帳號" and "加入好友" buttons

- [ ] **Click "查看官方帳號" — confirm OADetailSheet opens over the dialog**

- [ ] **Click "加入好友" — confirm toast "已加入好友", button changes to "已加好友"**

- [ ] **Click "Send" (now a friend) — confirm dialog closes and toast "已送出"**

- [ ] **Click "Send" again without being a friend (use a fresh test user) — confirm error toast "傳送失敗" with precondition error**

- [ ] **Navigate to `/home/talks` — verify the OA chat with "Flex Message sim" appears and contains the sent flex message**

- [ ] **Run full type check one more time:**

```bash
bun run check:all
```

Expected: clean.
