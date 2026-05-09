# Manager OA Chat CRM 2A Contact Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the Phase 2A OA contact CRM foundation: synced OA contact data, a contact list mode, and real CRM profile panel fields in the manager chat workspace.

**Architecture:** Sync the existing Postgres `oaFriendship` table through Zero as the OA contact source. Add owner-gated Zero queries that join contacts to public users, then compose those contacts with the existing manager OA chat list on the client to derive last interaction, unread state, and selectable chats. Update the manager chat workspace with a compact mode nav, contact list mode, and a richer profile panel without changing user-side chat behavior.

**Tech Stack:** Zero/on-zero, Drizzle-backed existing tables, Bun, One, Tamagui, Playwright, Vitest/Bun tests.

---

## Scope

This plan implements only Phase 2A from `docs/superpowers/specs/2026-05-09-manager-oa-chat-crm-design.md`.

Included:

- Zero model/query/relationships for existing `oaFriendship` rows.
- Owner-only manager access to OA contact rows.
- `/manager/:oaId/chat` mode switch between chats and contacts.
- Contact list rows with avatar, display name, contact ID, friendship status, last interaction, and unread/status hint.
- Profile panel fields for selected chat/contact.
- Integration coverage for contact list mode and profile panel fields.

Not included:

- Tags.
- Notes.
- Saved filters.
- Retention/export.
- Scheduled sending.
- Standard replies.
- Response hours.
- Broadcast sending.

## File Structure

- Create `packages/zero-schema/src/models/oaFriendship.ts`: Zero schema and manager-owned OA contact read permission for the existing DB table.
- Create `packages/zero-schema/src/queries/oaFriendship.ts`: `oaContactsByOfficialAccountId` query.
- Modify `packages/zero-schema/src/relationships.ts`: add `oaFriendship.user`, `oaFriendship.oa`, and `officialAccount.oaFriendships`.
- Modify generated Zero files by running `bun --filter @vine/zero-schema zero:generate`: `packages/zero-schema/src/generated/*`.
- Modify `packages/zero-schema/src/index.ts`: add model and query re-exports.
- Create `packages/zero-schema/src/__tests__/manager-oa-contacts.test.ts`: permission/query regression tests.
- Create `apps/web/src/features/oa-manager/chat/ManagerOAChatModeNav.tsx`: compact COL1 mode navigation.
- Create `apps/web/src/features/oa-manager/chat/ManagerOAContactList.tsx`: contact list mode for COL2.
- Create `apps/web/src/features/oa-manager/chat/useManagerOAContacts.ts`: Zero contact query hook plus chat-list composition.
- Modify `apps/web/src/features/oa-manager/chat/ManagerOAChatWorkspace.tsx`: add mode state and selected contact/profile wiring.
- Modify `apps/web/src/features/oa-manager/chat/ManagerOAChatList.tsx`: keep chat mode compatible with the shared profile model.
- Modify `apps/web/src/features/oa-manager/chat/ManagerOAChatRoom.tsx`: accept a selected-contact empty state for contacts without chats.
- Modify `apps/web/src/features/oa-manager/chat/ManagerOAProfilePanel.tsx`: render CRM contact fields.
- Modify `apps/web/src/test/integration/manager-oa-chat.test.ts`: cover contact list mode and profile fields.

## Task 1: Sync OA Friendships Through Zero

**Files:**
- Create: `packages/zero-schema/src/models/oaFriendship.ts`
- Create: `packages/zero-schema/src/queries/oaFriendship.ts`
- Modify: `packages/zero-schema/src/relationships.ts`
- Generated: `packages/zero-schema/src/generated/*`
- Test: `packages/zero-schema/src/__tests__/manager-oa-contacts.test.ts`

- [ ] **Step 1: Write failing permission and query tests**

Create `packages/zero-schema/src/__tests__/manager-oa-contacts.test.ts`:

```ts
import { getRawWhere } from 'on-zero'
import { describe, expect, it } from 'vitest'
import { managerOwnedOaFriendshipPermission } from '../models/oaFriendship'
import { oaContactsByOfficialAccountId } from '../queries/oaFriendship'
import type { AuthData } from '../types'
import type { Where } from 'on-zero'

type RecordedRelation = {
  calls: unknown[]
  where: (field: string, value: unknown) => RecordedRelation
  whereExists: (
    relation: string,
    cb: (q: RecordedRelation) => unknown,
  ) => RecordedRelation
}

function recordPermission(permission: Where) {
  const makeRelation = (): RecordedRelation => {
    const calls: unknown[] = []
    return {
      calls,
      where(field: string, value: unknown) {
        calls.push(['where', field, value])
        return this
      },
      whereExists(relation: string, cb: (q: RecordedRelation) => unknown) {
        const child = makeRelation()
        cb(child)
        calls.push(['whereExists', relation, child.calls])
        return this
      },
    }
  }

  const eb = {
    cmp(field: string, value: unknown) {
      return ['cmp', field, value]
    },
    exists(relation: string, cb: (q: RecordedRelation) => unknown) {
      const child = makeRelation()
      cb(child)
      return ['exists', relation, child.calls]
    },
  }

  const raw = getRawWhere(permission)
  const auth: AuthData = { id: 'manager-1', role: undefined }
  return JSON.stringify(raw?.(eb as any, auth))
}

describe('manager OA contact permissions', () => {
  it('requires OA provider ownership for OA contact rows', () => {
    const permission = recordPermission(managerOwnedOaFriendshipPermission)

    expect(permission).toContain('"ownerId","manager-1"')
    expect(permission).not.toContain('"userId","manager-1"')
  })

  it('exports a valid OA contact query builder', () => {
    expect(typeof oaContactsByOfficialAccountId).toBe('function')

    const query = oaContactsByOfficialAccountId({ oaId: 'test-oa-id' })
    expect(query).toBeDefined()
  })
})
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
rtk bun test packages/zero-schema/src/__tests__/manager-oa-contacts.test.ts
```

Expected: FAIL because `../models/oaFriendship` and `../queries/oaFriendship` do not exist.

- [ ] **Step 3: Add the Zero model**

Create `packages/zero-schema/src/models/oaFriendship.ts`:

```ts
import { number, string, table } from '@rocicorp/zero'
import { mutations, serverWhere } from 'on-zero'
import type { TableInsertRow } from 'on-zero'

export type OaFriendship = TableInsertRow<typeof schema>

export const schema = table('oaFriendship')
  .columns({
    id: string(),
    oaId: string(),
    userId: string(),
    status: string(),
    createdAt: number(),
  })
  .primaryKey('id')

export const managerOwnedOaFriendshipPermission = serverWhere(
  'oaFriendship',
  (eb, auth) => {
    const userId = auth?.id || ''
    return eb.exists('oa', (oaQ) =>
      oaQ.whereExists('provider', (providerQ) => providerQ.where('ownerId', userId)),
    )
  },
)

const rejectDirectOaFriendshipMutation = async () => {
  throw new Error('Use an OA contact action')
}

export const mutate = mutations(schema, managerOwnedOaFriendshipPermission, {
  insert: rejectDirectOaFriendshipMutation,
  update: rejectDirectOaFriendshipMutation,
  upsert: rejectDirectOaFriendshipMutation,
  delete: rejectDirectOaFriendshipMutation,
})
```

- [ ] **Step 4: Generate Zero files once so `tables.oaFriendship` exists**

Run:

```bash
rtk bun --filter @vine/zero-schema zero:generate
```

Expected: generated files include `oaFriendship` in `packages/zero-schema/src/generated/tables.ts` and `packages/zero-schema/src/generated/models.ts`.

- [ ] **Step 5: Add relationships and query**

Modify `packages/zero-schema/src/relationships.ts` by adding the friendship relationships near the OA relationships:

```ts
export const oaFriendshipRelationships = relationships(
  tables.oaFriendship,
  ({ one }) => ({
    user: one({
      sourceField: ['userId'],
      destSchema: tables.userPublic,
      destField: ['id'],
    }),
    oa: one({
      sourceField: ['oaId'],
      destSchema: tables.officialAccount,
      destField: ['id'],
    }),
  }),
)
```

Modify `officialAccountRelationships` in `packages/zero-schema/src/relationships.ts`:

```ts
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
    oaFriendships: many({
      sourceField: ['id'],
      destSchema: tables.oaFriendship,
      destField: ['oaId'],
    }),
  }),
)
```

Append the new relationship to `allRelationships`:

```ts
export const allRelationships = [
  userRelationships,
  todoRelationships,
  userStateRelationships,
  friendshipRelationships,
  chatRelationships,
  chatMemberRelationships,
  chatOaLoadingRelationships,
  oaProviderRelationships,
  officialAccountRelationships,
  oaFriendshipRelationships,
  messageRelationships,
  entitlementRelationships,
  creatorProfileRelationships,
  stickerPackageRelationships,
  stickerAssetRelationships,
]
```

Create `packages/zero-schema/src/queries/oaFriendship.ts`:

```ts
import { zql } from 'on-zero'
import { managerOwnedOaFriendshipPermission } from '../models/oaFriendship'

export const oaContactsByOfficialAccountId = (props: {
  oaId: string
  limit?: number
}) => {
  return zql.oaFriendship
    .where(managerOwnedOaFriendshipPermission)
    .where('oaId', props.oaId)
    .where('status', 'friend')
    .related('user')
    .orderBy('createdAt', 'desc')
    .limit(props.limit ?? 100)
}
```

- [ ] **Step 6: Regenerate Zero files**

Run:

```bash
rtk bun --filter @vine/zero-schema zero:generate
```

Expected: generated query registry includes `oaContactsByOfficialAccountId`.

Note: if running locally, restart the Zero server with `docker compose restart zero` to pick up the new model.

- [ ] **Step 7: Run the Zero contact tests**

Run:

```bash
rtk bun test packages/zero-schema/src/__tests__/manager-oa-contacts.test.ts
```

Expected: PASS.

- [ ] **Step 8: Add re-exports to index.ts**

Add the new model and query re-exports to `packages/zero-schema/src/index.ts`:

```ts
// in the Models section:
export * as oaFriendshipModel from './models/oaFriendship'

// in the Queries section:
export * as oaFriendshipQueries from './queries/oaFriendship'
```

- [ ] **Step 9: Commit Task 1**

Run:

```bash
rtk git add packages/zero-schema/src/models/oaFriendship.ts packages/zero-schema/src/queries/oaFriendship.ts packages/zero-schema/src/relationships.ts packages/zero-schema/src/index.ts packages/zero-schema/src/generated packages/zero-schema/src/__tests__/manager-oa-contacts.test.ts
rtk git commit -m "feat: sync oa contacts through zero"
```

Expected: commit created with only Zero model/query/generated/test changes.

## Task 2: Contact Hook And Shared Profile Types

**Files:**
- Create: `apps/web/src/features/oa-manager/chat/useManagerOAContacts.ts`
- Modify: `apps/web/src/features/oa-manager/chat/useManagerOAChats.ts`

- [ ] **Step 1: Add contact hook**

Create `apps/web/src/features/oa-manager/chat/useManagerOAContacts.ts`:

```ts
import { oaContactsByOfficialAccountId } from '@vine/zero-schema/queries/oaFriendship'
import { useMemo } from 'react'
import { useZeroQuery } from '~/zero/client'
import type { ManagerOAChatListItem } from './useManagerOAChats'

export type ManagerOAContactListItem = {
  id: string
  userId: string
  contactId: string
  userName: string
  userImage: string | null
  friendshipStatus: string
  lastInteractionAt: number | null
  chatId: string | null
  hasUnread: boolean
  chatStatus: 'unread' | 'active' | 'no_chat'
}

export function useManagerOAContacts(
  oaId: string | undefined,
  searchQuery: string,
  chats: ManagerOAChatListItem[],
) {
  const [contacts, { type }] = useZeroQuery(
    oaContactsByOfficialAccountId,
    { oaId: oaId ?? '', limit: 100 },
    { enabled: Boolean(oaId) },
  )

  const items = useMemo<ManagerOAContactListItem[]>(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase()
    const chatsByUserId = new Map(chats.map((chat) => [chat.userId, chat]))

    return (contacts ?? [])
      .map((contact) => {
        const user = contact.user
        const chat = chatsByUserId.get(contact.userId)
        const name = user?.name ?? 'Unknown user'
        const hasUnread = chat?.hasUnread ?? false

        return {
          id: contact.id,
          userId: contact.userId,
          contactId: contact.id,
          userName: name,
          userImage: user?.image ?? null,
          friendshipStatus: contact.status,
          lastInteractionAt: chat?.lastMessageAt ?? null,
          chatId: chat?.id ?? null,
          hasUnread,
          chatStatus: hasUnread ? 'unread' : chat ? 'active' : 'no_chat',
        }
      })
      .filter((item) => {
        if (!normalizedSearch) return true
        return (
          item.userName.toLowerCase().includes(normalizedSearch) ||
          item.contactId.toLowerCase().includes(normalizedSearch)
        )
      })
  }, [chats, contacts, searchQuery])

  return {
    contacts: items,
    isLoading: type === 'unknown',
  }
}
```

- [ ] **Step 2: Ensure chat items expose stable user IDs**

Modify `apps/web/src/features/oa-manager/chat/useManagerOAChats.ts` so every item keeps `userId` and does not hide empty IDs during search:

```ts
const userId = userMember?.userId ?? ''

return {
  id: chat.id,
  userId,
  userName: name,
  userImage: user?.image ?? null,
  lastMessageText: lastMessage?.text ?? null,
  lastMessageAt: chat.lastMessageAt ?? null,
  hasUnread,
}
```

The current file already has this shape; keep it if present and only adjust if implementation drift exists.

- [ ] **Step 3: Run typecheck for early hook errors**

Run:

```bash
rtk bun run --cwd apps/web typecheck
```

Expected: PASS or only pre-existing unrelated type errors. Any error in `useManagerOAContacts.ts` must be fixed before continuing.

- [ ] **Step 4: Commit Task 2**

Run:

```bash
rtk git add apps/web/src/features/oa-manager/chat/useManagerOAContacts.ts apps/web/src/features/oa-manager/chat/useManagerOAChats.ts
rtk git commit -m "feat: derive oa manager contacts"
```

Expected: commit created with the contact hook changes.

## Task 3: Contact Mode UI

**Files:**
- Create: `apps/web/src/features/oa-manager/chat/ManagerOAChatModeNav.tsx`
- Create: `apps/web/src/features/oa-manager/chat/ManagerOAContactList.tsx`
- Modify: `apps/web/src/features/oa-manager/chat/ManagerOAChatWorkspace.tsx`
- Modify: `apps/web/src/features/oa-manager/chat/ManagerOAChatRoom.tsx`

- [ ] **Step 1: Add compact mode navigation**

Create `apps/web/src/features/oa-manager/chat/ManagerOAChatModeNav.tsx`:

```tsx
import { SizableText, YStack } from 'tamagui'
import { Pressable } from '~/interface/buttons/Pressable'
import { ChatCircleIcon } from '~/interface/icons/phosphor/ChatCircleIcon'
import { UserIcon } from '~/interface/icons/phosphor/UserIcon'

export type ManagerOAChatMode = 'chats' | 'contacts'

type Props = {
  mode: ManagerOAChatMode
  onModeChange: (mode: ManagerOAChatMode) => void
}

const items = [
  { mode: 'chats' as const, label: 'Chats', icon: ChatCircleIcon },
  { mode: 'contacts' as const, label: 'Contacts', icon: UserIcon },
]

export function ManagerOAChatModeNav({ mode, onModeChange }: Props) {
  return (
    <YStack width={88} shrink={0} borderRightWidth={1} borderColor="$borderColor">
      {items.map((item) => {
        const Icon = item.icon
        const active = mode === item.mode

        return (
          <Pressable
            key={item.mode}
            role="button"
            aria-label={`Show ${item.label}`}
            onPress={() => onModeChange(item.mode)}
            p="$3"
            gap="$2"
            items="center"
            cursor="pointer"
            bg={active ? '$color3' : 'transparent'}
            hoverStyle={{ bg: active ? '$color3' : '$color2' }}
          >
            <Icon size={20} />
            <SizableText size="$1" fontWeight={active ? '700' : '500'} text="center">
              {item.label}
            </SizableText>
          </Pressable>
        )
      })}
    </YStack>
  )
}
```

- [ ] **Step 2: Add contact list component**

Create `apps/web/src/features/oa-manager/chat/ManagerOAContactList.tsx`:

```tsx
import { useRouter } from 'one'
import { ScrollView, SizableText, XStack, YStack } from 'tamagui'
import { Avatar } from '~/interface/avatars/Avatar'
import { Pressable } from '~/interface/buttons/Pressable'
import { Input } from '~/interface/forms/Input'
import type { ManagerOAContactListItem } from './useManagerOAContacts'

type Props = {
  oaId: string
  selectedUserId?: string
  searchQuery: string
  onSearchQueryChange: (value: string) => void
  contacts: ManagerOAContactListItem[]
  isLoading: boolean
  onSelectContact: (contact: ManagerOAContactListItem) => void
}

function formatContactTime(ts: number | null): string {
  if (!ts) return 'No chat yet'
  return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function formatStatus(contact: ManagerOAContactListItem): string {
  if (contact.chatStatus === 'unread') return 'Unread'
  if (contact.chatStatus === 'no_chat') return 'No chat'
  return contact.friendshipStatus === 'friend' ? 'Friend' : contact.friendshipStatus
}

export function ManagerOAContactList({
  oaId,
  selectedUserId,
  searchQuery,
  onSearchQueryChange,
  contacts,
  isLoading,
  onSelectContact,
}: Props) {
  const router = useRouter()

  return (
    <YStack width={300} shrink={0} borderRightWidth={1} borderColor="$borderColor">
      <YStack p="$3" gap="$2" borderBottomWidth={1} borderColor="$borderColor">
        <SizableText size="$3" fontWeight="700">
          Contact list
        </SizableText>
        <Input
          value={searchQuery}
          onChangeText={onSearchQueryChange}
          placeholder="Search contacts"
          size="$3"
        />
      </YStack>
      <ScrollView>
        {isLoading ? (
          <YStack p="$4">
            <SizableText size="$2" color="$color10">
              Loading contacts...
            </SizableText>
          </YStack>
        ) : contacts.length === 0 ? (
          <YStack p="$4">
            <SizableText size="$2" color="$color10">
              No contacts
            </SizableText>
          </YStack>
        ) : (
          contacts.map((contact) => (
            <Pressable
              key={contact.id}
              role="button"
              aria-label={`Open contact ${contact.userName}`}
              onPress={() => {
                onSelectContact(contact)
                if (contact.chatId) {
                  router.push(`/manager/${oaId}/chat/${contact.chatId}` as any)
                }
              }}
              px="$3"
              py="$3"
              cursor="pointer"
              bg={selectedUserId === contact.userId ? '$color3' : 'transparent'}
              hoverStyle={{
                bg: selectedUserId === contact.userId ? '$color3' : '$color2',
              }}
            >
              <XStack gap="$3" items="center">
                <Avatar size={40} image={contact.userImage} name={contact.userName} />
                <YStack flex={1} minW={0} gap="$1">
                  <XStack items="center" justify="space-between" gap="$2">
                    <SizableText size="$3" fontWeight="600" numberOfLines={1}>
                      {contact.userName}
                    </SizableText>
                    {contact.hasUnread ? (
                      <YStack
                        data-testid="contact-unread-dot"
                        width={8}
                        height={8}
                        rounded="$10"
                        bg="$green9"
                      />
                    ) : null}
                  </XStack>
                  <SizableText size="$2" color="$color10" numberOfLines={1}>
                    {formatStatus(contact)} · {formatContactTime(contact.lastInteractionAt)}
                  </SizableText>
                  <SizableText size="$1" color="$color10" numberOfLines={1}>
                    ID {contact.contactId}
                  </SizableText>
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

- [ ] **Step 3: Update the chat room empty state**

Modify `apps/web/src/features/oa-manager/chat/ManagerOAChatRoom.tsx`:

```tsx
type Props = {
  oaId: string
  chatId?: string
  emptyStateLabel?: string
}

export function ManagerOAChatRoom({ oaId, chatId, emptyStateLabel }: Props) {
  // existing hook and state stay the same

  if (!chatId) {
    return (
      <YStack flex={1} items="center" justify="center">
        <SizableText size="$3" color="$color10">
          {emptyStateLabel ?? 'Select a chat'}
        </SizableText>
      </YStack>
    )
  }

  // existing selected-chat rendering stays the same
}
```

- [ ] **Step 4: Wire mode state into the workspace**

Modify `apps/web/src/features/oa-manager/chat/ManagerOAChatWorkspace.tsx`:

```tsx
import { useMemo, useState } from 'react'
import { XStack } from 'tamagui'
import { ManagerOAChatList } from './ManagerOAChatList'
import { ManagerOAChatModeNav, type ManagerOAChatMode } from './ManagerOAChatModeNav'
import { ManagerOAChatRoom } from './ManagerOAChatRoom'
import { ManagerOAContactList } from './ManagerOAContactList'
import { ManagerOAProfilePanel } from './ManagerOAProfilePanel'
import { useManagerOAChats } from './useManagerOAChats'
import {
  useManagerOAContacts,
  type ManagerOAContactListItem,
} from './useManagerOAContacts'

type Props = {
  oaId: string
  chatId?: string
}

export function ManagerOAChatWorkspace({ oaId, chatId }: Props) {
  const [mode, setMode] = useState<ManagerOAChatMode>('chats')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedContact, setSelectedContact] =
    useState<ManagerOAContactListItem | null>(null)
  const { chats, isLoading } = useManagerOAChats(oaId, searchQuery)
  const { contacts, isLoading: contactsLoading } = useManagerOAContacts(
    oaId,
    searchQuery,
    chats,
  )
  const selected = useMemo(
    () => chats.find((chat) => chat.id === chatId) ?? null,
    [chatId, chats],
  )
  const selectedContactFromChat = useMemo(
    () => contacts.find((contact) => contact.userId === selected?.userId) ?? null,
    [contacts, selected?.userId],
  )
  const profileContact = selectedContactFromChat ?? selectedContact

  return (
    <XStack flex={1} minH={0} bg="$background" $platform-web={{ overflow: 'hidden' }}>
      <ManagerOAChatModeNav
        mode={mode}
        onModeChange={(nextMode) => {
          setMode(nextMode)
          setSearchQuery('')
        }}
      />
      {mode === 'contacts' ? (
        <ManagerOAContactList
          oaId={oaId}
          selectedUserId={profileContact?.userId}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          contacts={contacts}
          isLoading={contactsLoading}
          onSelectContact={setSelectedContact}
        />
      ) : (
        <ManagerOAChatList
          oaId={oaId}
          selectedChatId={chatId}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          chats={chats}
          isLoading={isLoading}
        />
      )}
      <ManagerOAChatRoom
        oaId={oaId}
        chatId={chatId}
        emptyStateLabel={
          mode === 'contacts' && profileContact?.chatId === null
            ? 'This contact has no chat yet'
            : undefined
        }
      />
      {selected || profileContact ? (
        <ManagerOAProfilePanel
          name={profileContact?.userName ?? selected?.userName ?? 'Unknown user'}
          image={profileContact?.userImage ?? selected?.userImage ?? null}
          contact={profileContact}
        />
      ) : null}
    </XStack>
  )
}
```

- [ ] **Step 5: Run web typecheck**

Run:

```bash
rtk bun run --cwd apps/web typecheck
```

Expected: PASS or only pre-existing unrelated type errors. Any error in the changed chat files must be fixed before continuing.

- [ ] **Step 6: Commit Task 3**

Run:

```bash
rtk git add apps/web/src/features/oa-manager/chat/ManagerOAChatModeNav.tsx apps/web/src/features/oa-manager/chat/ManagerOAContactList.tsx apps/web/src/features/oa-manager/chat/ManagerOAChatWorkspace.tsx apps/web/src/features/oa-manager/chat/ManagerOAChatRoom.tsx
rtk git commit -m "feat: add manager oa contact list mode"
```

Expected: commit created with contact mode UI changes.

## Task 4: CRM Profile Panel Fields

**Files:**
- Modify: `apps/web/src/features/oa-manager/chat/ManagerOAProfilePanel.tsx`

- [ ] **Step 1: Expand the profile panel props and layout**

Modify `apps/web/src/features/oa-manager/chat/ManagerOAProfilePanel.tsx`:

```tsx
import { SizableText, YStack } from 'tamagui'
import { Avatar } from '~/interface/avatars/Avatar'
import type { ManagerOAContactListItem } from './useManagerOAContacts'

type Props = {
  name: string
  image: string | null
  contact?: ManagerOAContactListItem | null
}

function formatLastInteraction(ts: number | null | undefined): string {
  if (!ts) return 'No chat yet'
  return new Date(ts).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatChatStatus(contact: ManagerOAContactListItem | null | undefined): string {
  if (!contact) return 'Unknown'
  if (contact.chatStatus === 'unread') return 'Unread'
  if (contact.chatStatus === 'no_chat') return 'No chat'
  return 'Active'
}

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <YStack gap="$1">
      <SizableText size="$1" color="$color10">
        {label}
      </SizableText>
      <SizableText size="$2" numberOfLines={2}>
        {value}
      </SizableText>
    </YStack>
  )
}

export function ManagerOAProfilePanel({ name, image, contact }: Props) {
  return (
    <YStack
      width={260}
      shrink={0}
      p="$5"
      gap="$4"
      borderLeftWidth={1}
      borderColor="$borderColor"
    >
      <YStack items="center" gap="$3">
        <Avatar size={88} image={image} name={name} />
        <SizableText size="$5" fontWeight="700" text="center" numberOfLines={2}>
          {name}
        </SizableText>
      </YStack>

      <YStack gap="$3">
        <ProfileField label="Contact ID" value={contact?.contactId ?? 'Unknown'} />
        <ProfileField
          label="Friendship"
          value={contact?.friendshipStatus === 'friend' ? 'Friend' : 'Unknown'}
        />
        <ProfileField
          label="Last interaction"
          value={formatLastInteraction(contact?.lastInteractionAt)}
        />
        <ProfileField label="Chat status" value={formatChatStatus(contact)} />
      </YStack>
    </YStack>
  )
}
```

- [ ] **Step 2: Run web typecheck**

Run:

```bash
rtk bun run --cwd apps/web typecheck
```

Expected: PASS or only pre-existing unrelated type errors. Any error in `ManagerOAProfilePanel.tsx` must be fixed before continuing.

- [ ] **Step 3: Commit Task 4**

Run:

```bash
rtk git add apps/web/src/features/oa-manager/chat/ManagerOAProfilePanel.tsx
rtk git commit -m "feat: show oa contact profile fields"
```

Expected: commit created with profile panel changes.

## Task 5: Integration Coverage

**Files:**
- Modify: `apps/web/src/test/integration/manager-oa-chat.test.ts`

- [ ] **Step 1: Add contact list assertions to the existing owner flow**

Modify the first test in `apps/web/src/test/integration/manager-oa-chat.test.ts` after the chat route loads and before opening the chat:

```ts
await page.getByRole('button', { name: 'Show Contacts' }).click()

await expect(page.getByPlaceholder('Search contacts')).toBeVisible({
  timeout: 10000,
})
await expect(page.getByText('Contact list')).toBeVisible()
await expect(page.getByRole('button', { name: /Open contact Test One/ })).toBeVisible({
  timeout: 20000,
})

await page.getByRole('button', { name: /Open contact Test One/ }).click()

await expect(page.getByText('Contact ID')).toBeVisible()
await expect(page.getByText('Friendship')).toBeVisible()
await expect(page.getByText('Last interaction')).toBeVisible()
await expect(page.getByText('Chat status')).toBeVisible()

await page.getByRole('button', { name: 'Show Chats' }).click()
```

The rest of the existing chat send assertions should remain unchanged.

- [ ] **Step 2: Add non-owner contact data assertion**

Modify the non-owner test in `apps/web/src/test/integration/manager-oa-chat.test.ts` after navigating to `managerChatPath`:

```ts
await expect(page.getByText('Contact list')).toHaveCount(0)
await expect(page.getByText('Contact ID')).toHaveCount(0)
```

Keep the existing assertions that Test One and the seeded message are not visible.

- [ ] **Step 3: Run the focused Playwright integration file**

Run:

```bash
rtk bun scripts/integration.ts --web-only integration/manager-oa-chat.test.ts
```

Expected: PASS. The test should prove the owner can see the contact list/profile fields and a non-owner cannot see manager OA chat/contact data.

- [ ] **Step 4: Commit Task 5**

Run:

```bash
rtk git add apps/web/src/test/integration/manager-oa-chat.test.ts
rtk git commit -m "test: cover manager oa contact list"
```

Expected: commit created with the integration test updates.

## Task 6: Final Verification

**Files:**
- No new source changes expected.

- [ ] **Step 1: Run Zero contact test**

Run:

```bash
rtk bun test packages/zero-schema/src/__tests__/manager-oa-contacts.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run web typecheck**

Run:

```bash
rtk bun run --cwd apps/web typecheck
```

Expected: PASS or only documented pre-existing unrelated errors. If there are errors from Phase 2A files, fix them.

- [ ] **Step 3: Run focused integration**

Run:

```bash
rtk bun scripts/integration.ts --web-only integration/manager-oa-chat.test.ts
```

Expected: PASS.

- [ ] **Step 4: Check final diff**

Run:

```bash
rtk git status --short
rtk git log --oneline -5
```

Expected: working tree contains no unintended source changes. The recent commits should correspond to Tasks 1 through 5.

## Implementation Notes

- Do not modify `apps/web/src/data/`; it is legacy. Use `packages/zero-schema/src/`.
- Do not hand-edit `packages/zero-schema/src/generated/*`; run `rtk bun --filter @vine/zero-schema zero:generate`.
- Do not add a DB migration for `oaFriendship`; the table already exists in `packages/db/src/schema-oa.ts`.
- Do not start extra dev servers. Use `rtk bun scripts/integration.ts ...` for integration verification.
- Keep UI copy neutral to Vine. Do not imply official LINE integration.
- Keep tags/notes as explicit Phase 2B affordances only. This plan must not implement them.
