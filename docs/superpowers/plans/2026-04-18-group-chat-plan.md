# Group Chat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add full LINE-like group chat functionality including creation, member management, admin roles, web invite links, and group info management.

**Architecture:** Extend existing `chat` and `chatMember` tables with new columns, add Zero mutations for group operations, build frontend components for creation/management/invites.

**Tech Stack:** Zero sync layer, Drizzle ORM, Tamagui UI, OneJS routing, valibot validation

---

## File Map

### Database Schema
- **Modify:** `packages/db/src/schema-public.ts` — Add columns to `chat` and `chatMember` tables

### Zero Schema
- **Modify:** `packages/zero-schema/src/models/chat.ts` — Add columns + new mutations (`createGroupChat`, `updateGroupInfo`, `generateInviteLink`, `revokeInviteLink`)
- **Modify:** `packages/zero-schema/src/models/chatMember.ts` — Add `role` column + new mutations (`addMembers`, `removeMember`, `leaveGroup`, `transferOwnership`, `joinViaInvite`)
- **Modify:** `packages/zero-schema/src/relationships.ts` — Add `chatMember.oa` relationship for OA member display
- **Modify:** `packages/zero-schema/src/queries/chat.ts` — Add `groupInfo`, `groupMembersWithRoles` queries
- **Modify:** `packages/zero-schema/src/generated/*` — Regenerate via `bun run zero:generate`

### Frontend - New Pages
- **Create:** `apps/web/app/(app)/home/(tabs)/talks/create-group.tsx` — Create group page
- **Create:** `apps/web/app/(app)/home/(tabs)/talks/[chatId]/group-info.tsx` — Group info page
- **Create:** `apps/web/app/(public)/invite/[inviteCode]/page.tsx` — Public invite landing page

### Frontend - New Dialogs
- **Create:** `apps/web/src/interface/dialogs/CreateGroupDialog.tsx` — Create group dialog
- **Create:** `apps/web/src/interface/dialogs/AddMembersDialog.tsx` — Add members dialog
- **Create:** `apps/web/src/interface/dialogs/GroupInfoSheet.tsx` — Group info bottom sheet
- **Create:** `apps/web/src/interface/dialogs/InviteLinkDialog.tsx` — Invite link share dialog

### Frontend - New Shared Components
- **Create:** `apps/web/src/interface/friend-picker/FriendPicker.tsx` — Reusable friend picker
- **Create:** `apps/web/src/features/chat/useGroups.ts` — Group-related hooks
- **Create:** `apps/web/src/features/chat/ui/GroupAvatar.tsx` — Group avatar with member initials

### Frontend - Modified Components
- **Modify:** `apps/web/app/(app)/home/(tabs)/main/index.tsx` — Replace "Groups coming soon" placeholder
- **Modify:** `apps/web/src/features/chat/ui/TalksHeader.tsx` — Add create group action
- **Modify:** `apps/web/src/features/chat/ui/ChatListItem.tsx` — Show group icon + member count
- **Modify:** `apps/web/app/(app)/home/(tabs)/talks/[chatId].tsx` — Group-aware header

---

### Task 1: Database Schema Migration

**Files:**
- Modify: `packages/db/src/schema-public.ts`

- [ ] **Step 1: Add columns to `chat` table**

Open `packages/db/src/schema-public.ts` and add the following columns to the `chat` table definition (after `createdAt`):

```typescript
export const chat = pgTable('chat', {
  id: text('id').primaryKey(),
  type: text('type').notNull().$type<'direct' | 'group' | 'oa'>(),
  name: text('name'),
  image: text('image'),
  description: text('description'),
  inviteCode: text('inviteCode').unique(),
  albumCount: integer('albumCount').notNull().default(0),
  noteCount: integer('noteCount').notNull().default(0),
  lastMessageId: text('lastMessageId'),
  lastMessageAt: timestamp('lastMessageAt', { mode: 'string' }),
  createdAt: timestamp('createdAt', { mode: 'string' }).defaultNow().notNull(),
})
```

Note: Add `integer` to the imports from `drizzle-orm/pg-core`.

- [ ] **Step 2: Add `role` column to `chatMember` table**

Add `role` column to the `chatMember` table (after `joinedAt`):

```typescript
role: text('role').$type<'owner' | 'admin' | 'member'>(),
```

Add a new check constraint to the existing constraints array:

```typescript
check(
  'chatMember_role_oa_check',
  sql`(${table.role} IS NULL OR ${table.oaId} IS NULL)`,
),
```

- [ ] **Step 3: Run Drizzle migration**

```bash
bun run --cwd packages/db db:push
```

Expected: Schema updates applied without errors.

---

### Task 2: Zero Schema - Chat Model Updates

**Files:**
- Modify: `packages/zero-schema/src/models/chat.ts`

- [ ] **Step 1: Add new columns to chat schema**

Update the `schema` definition in `packages/zero-schema/src/models/chat.ts`:

```typescript
export const schema = table('chat')
  .columns({
    id: string(),
    type: string(),
    name: string().optional(),
    image: string().optional(),
    description: string().optional(),
    inviteCode: string().optional(),
    albumCount: number().optional(),
    noteCount: number().optional(),
    lastMessageId: string().optional(),
    lastMessageAt: number().optional(),
    createdAt: number(),
  })
  .primaryKey('id')
```

- [ ] **Step 2: Add `createGroupChat` mutation**

Add after the existing `findOrCreateDirectChat` mutation:

```typescript
createGroupChat: async (
  { authData, tx },
  args: {
    chatId: string
    name: string
    image?: string
    memberIds: string[]
    createdAt: number
  },
) => {
  if (!authData) throw new Error('Unauthorized')
  if (args.memberIds.length < 1) throw new Error('Group needs at least 2 members')
  if (!args.memberIds.includes(authData.id)) {
    args.memberIds.unshift(authData.id)
  }

  await tx.mutate.chat.insert({
    id: args.chatId,
    type: 'group',
    name: args.name,
    image: args.image,
    createdAt: args.createdAt,
  })

  for (let i = 0; i < args.memberIds.length; i++) {
    await tx.mutate.chatMember.insert({
      id: `${args.chatId}_${args.memberIds[i]}`,
      chatId: args.chatId,
      userId: args.memberIds[i],
      role: args.memberIds[i] === authData.id ? 'owner' : 'member',
      joinedAt: args.createdAt,
    })
  }
},
```

- [ ] **Step 3: Add `updateGroupInfo` mutation**

```typescript
updateGroupInfo: async (
  { authData, tx },
  args: {
    chatId: string
    name?: string
    image?: string
    description?: string
  },
) => {
  if (!authData) throw new Error('Unauthorized')

  const members = await tx.query.chatMember
    .where('chatId', args.chatId)
    .where('userId', authData.id)
    .run()

  if (members.length === 0) throw new Error('Not a member of this group')

  const member = members[0]
  if (member.role !== 'owner' && member.role !== 'admin') {
    throw new Error('Only owner or admin can update group info')
  }

  const updateData: Record<string, unknown> = { id: args.chatId }
  if (args.name !== undefined) updateData.name = args.name
  if (args.image !== undefined) updateData.image = args.image
  if (args.description !== undefined) updateData.description = args.description

  await tx.mutate.chat.update(updateData)
},
```

- [ ] **Step 4: Add `generateInviteLink` mutation**

```typescript
generateInviteLink: async (
  { authData, tx },
  args: { chatId: string },
) => {
  if (!authData) throw new Error('Unauthorized')

  const members = await tx.query.chatMember
    .where('chatId', args.chatId)
    .where('userId', authData.id)
    .run()

  if (members.length === 0) throw new Error('Not a member of this group')

  const member = members[0]
  if (member.role !== 'owner' && member.role !== 'admin') {
    throw new Error('Only owner or admin can generate invite links')
  }

  const inviteCode = crypto.randomUUID().replace(/-/g, '').slice(0, 16)

  await tx.mutate.chat.update({
    id: args.chatId,
    inviteCode,
  })

  return { inviteCode }
},
```

- [ ] **Step 5: Add `revokeInviteLink` mutation**

```typescript
revokeInviteLink: async (
  { authData, tx },
  args: { chatId: string },
) => {
  if (!authData) throw new Error('Unauthorized')

  const members = await tx.query.chatMember
    .where('chatId', args.chatId)
    .where('userId', authData.id)
    .run()

  if (members.length === 0) throw new Error('Not a member of this group')

  const member = members[0]
  if (member.role !== 'owner' && member.role !== 'admin') {
    throw new Error('Only owner or admin can revoke invite links')
  }

  await tx.mutate.chat.update({
    id: args.chatId,
    inviteCode: null,
  })
},
```

---

### Task 3: Zero Schema - ChatMember Model Updates

**Files:**
- Modify: `packages/zero-schema/src/models/chatMember.ts`

- [ ] **Step 1: Add `role` column to chatMember schema**

Update the `schema` definition:

```typescript
export const schema = table('chatMember')
  .columns({
    id: string(),
    chatId: string(),
    userId: string().optional(),
    role: string().optional(),
    lastReadMessageId: string().optional(),
    lastReadAt: number().optional(),
    joinedAt: number(),
    oaId: string().optional(),
  })
  .primaryKey('id')
```

- [ ] **Step 2: Add `addMembers` mutation**

```typescript
addMembers: async (
  { authData, tx },
  args: {
    chatId: string
    userIds: string[]
    createdAt: number
  },
) => {
  if (!authData) throw new Error('Unauthorized')

  const callerMembers = await tx.query.chatMember
    .where('chatId', args.chatId)
    .where('userId', authData.id)
    .run()

  if (callerMembers.length === 0) throw new Error('Not a member of this group')

  const caller = callerMembers[0]
  if (caller.role !== 'owner' && caller.role !== 'admin') {
    throw new Error('Only owner or admin can add members')
  }

  for (const userId of args.userIds) {
    if (userId === authData.id) continue

    const existing = await tx.query.chatMember
      .where('chatId', args.chatId)
      .where('userId', userId)
      .run()

    if (existing.length > 0) continue

    await tx.mutate.chatMember.insert({
      id: `${args.chatId}_${userId}`,
      chatId: args.chatId,
      userId,
      role: 'member',
      joinedAt: args.createdAt,
    })
  }
},
```

- [ ] **Step 3: Add `removeMember` mutation**

```typescript
removeMember: async (
  { authData, tx },
  args: {
    chatId: string
    targetUserId: string
  },
) => {
  if (!authData) throw new Error('Unauthorized')

  const callerMembers = await tx.query.chatMember
    .where('chatId', args.chatId)
    .where('userId', authData.id)
    .run()

  if (callerMembers.length === 0) throw new Error('Not a member of this group')

  const caller = callerMembers[0]
  if (caller.role !== 'owner' && caller.role !== 'admin') {
    throw new Error('Only owner or admin can remove members')
  }

  const targetMembers = await tx.query.chatMember
    .where('chatId', args.chatId)
    .where('userId', args.targetUserId)
    .run()

  if (targetMembers.length === 0) throw new Error('Target is not a member')

  const target = targetMembers[0]
  if (target.role === 'owner') {
    throw new Error('Cannot remove the owner')
  }

  await tx.mutate.chatMember.delete({ id: target.id })
},
```

- [ ] **Step 4: Add `leaveGroup` mutation**

```typescript
leaveGroup: async (
  { authData, tx },
  args: {
    chatId: string
  },
) => {
  if (!authData) throw new Error('Unauthorized')

  const myMembers = await tx.query.chatMember
    .where('chatId', args.chatId)
    .where('userId', authData.id)
    .run()

  if (myMembers.length === 0) throw new Error('Not a member of this group')

  const me = myMembers[0]
  if (me.role === 'owner') {
    throw new Error('Owner must transfer ownership before leaving')
  }

  await tx.mutate.chatMember.delete({ id: me.id })
},
```

- [ ] **Step 5: Add `transferOwnership` mutation**

```typescript
transferOwnership: async (
  { authData, tx },
  args: {
    chatId: string
    newOwnerId: string
  },
) => {
  if (!authData) throw new Error('Unauthorized')

  const myMembers = await tx.query.chatMember
    .where('chatId', args.chatId)
    .where('userId', authData.id)
    .run()

  if (myMembers.length === 0) throw new Error('Not a member of this group')

  const me = myMembers[0]
  if (me.role !== 'owner') {
    throw new Error('Only owner can transfer ownership')
  }

  const newOwnerMembers = await tx.query.chatMember
    .where('chatId', args.chatId)
    .where('userId', args.newOwnerId)
    .run()

  if (newOwnerMembers.length === 0) throw new Error('New owner is not a member')

  await tx.mutate.chatMember.update({
    id: me.id,
    role: 'member',
  })

  await tx.mutate.chatMember.update({
    id: newOwnerMembers[0].id,
    role: 'owner',
  })
},
```

- [ ] **Step 6: Add `joinViaInvite` mutation**

```typescript
joinViaInvite: async (
  { authData, tx },
  args: {
    inviteCode: string
    createdAt: number
  },
) => {
  if (!authData) throw new Error('Unauthorized')

  const chats = await tx.query.chat
    .where('inviteCode', args.inviteCode)
    .run()

  if (chats.length === 0) throw new Error('Invalid invite code')

  const chat = chats[0]

  const existing = await tx.query.chatMember
    .where('chatId', chat.id)
    .where('userId', authData.id)
    .run()

  if (existing.length > 0) throw new Error('Already a member of this group')

  await tx.mutate.chatMember.insert({
    id: `${chat.id}_${authData.id}`,
    chatId: chat.id,
    userId: authData.id,
    role: 'member',
    joinedAt: args.createdAt,
  })
},
```

---

### Task 4: Zero Schema - Relationships & Queries

**Files:**
- Modify: `packages/zero-schema/src/relationships.ts`
- Modify: `packages/zero-schema/src/queries/chat.ts`

- [ ] **Step 1: Add `oa` relationship to chatMember**

In `packages/zero-schema/src/relationships.ts`, update `chatMemberRelationships`:

```typescript
export const chatMemberRelationships = relationships(tables.chatMember, ({ one }) => ({
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
  chat: one({
    sourceField: ['chatId'],
    destSchema: tables.chat,
    destField: ['id'],
  }),
}))
```

Note: Add `officialAccount` import from `./generated/tables` if not already present. Check `packages/db/src/schema-oa.ts` for the table name.

- [ ] **Step 2: Add group queries**

In `packages/zero-schema/src/queries/chat.ts`, add:

```typescript
export const groupInfo = (props: { chatId: string }) => {
  return zql.chat
    .where('id', props.chatId)
    .where('type', 'group')
    .related('members')
    .limit(1)
}

export const groupMembersWithRoles = (props: { chatId: string }) => {
  return zql.chatMember
    .where('chatId', props.chatId)
    .related('user')
    .orderBy('joinedAt', 'asc')
}
```

- [ ] **Step 3: Regenerate Zero schema**

```bash
bun run zero:generate
```

This regenerates `packages/zero-schema/src/generated/*` with the new columns and mutation validators.

- [ ] **Step 4: Verify generation**

```bash
bun run check:all
```

Expected: No errors.

---

### Task 5: FriendPicker Shared Component

**Files:**
- Create: `apps/web/src/interface/friend-picker/FriendPicker.tsx`

- [ ] **Step 1: Create FriendPicker component**

Create `apps/web/src/interface/friend-picker/FriendPicker.tsx`:

```typescript
import { memo, useState } from 'react'
import { ScrollView, SizableText, XStack, YStack } from 'tamagui'

import { useFriends } from '~/features/chat/useFriendship'
import { Avatar } from '~/interface/avatars/Avatar'
import { Button } from '~/interface/buttons/Button'
import { SearchInput } from '~/interface/forms/SearchInput'

type FriendPickerProps = {
  selectedUserIds: string[]
  onSelectionChange: (userIds: string[]) => void
  excludeUserIds?: string[]
  maxSelection?: number
}

export const FriendPicker = memo(
  ({
    selectedUserIds,
    onSelectionChange,
    excludeUserIds = [],
    maxSelection,
  }: FriendPickerProps) => {
    const { friends } = useFriends()
    const [searchQuery, setSearchQuery] = useState('')

    const filteredFriends =
      friends?.filter((f) => {
        const otherUser = f.requesterId === f.addresseeId ? f.requester : f.addressee
        // This is wrong, need to get the other user properly
        return true
      }) ?? []

    const toggleUser = (userId: string) => {
      if (selectedUserIds.includes(userId)) {
        onSelectionChange(selectedUserIds.filter((id) => id !== userId))
      } else if (!maxSelection || selectedUserIds.length < maxSelection) {
        onSelectionChange([...selectedUserIds, userId])
      }
    }

    return (
      <YStack flex={1}>
        <XStack px="$3" py="$2">
          <SearchInput
            flex={1}
            placeholder="搜尋好友"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </XStack>

        <ScrollView flex={1}>
          {filteredFriends.map((f) => {
            const isSelected = selectedUserIds.includes(f.id)
            return (
              <XStack
                key={f.id}
                px="$3"
                py="$2"
                items="center"
                gap="$3"
                cursor="pointer"
                onPress={() => toggleUser(f.id)}
                bg={isSelected ? '$color3' : 'transparent'}
              >
                <Avatar size={40} image={null} name={f.name ?? 'User'} />
                <SizableText flex={1}>{f.name ?? 'User'}</SizableText>
                {isSelected && <SizableText color="$blue10">✓</SizableText>}
              </XStack>
            )
          })}
        </ScrollView>
      </YStack>
    )
  },
)
```

Wait — the friend data structure uses `friendship` with `requester`/`addressee` relationships. Let me fix this. Read `useFriendship.ts` first:

```bash
cat apps/web/src/features/chat/useFriendship.ts
```

Based on the existing pattern in `MainPage`, friendships are accessed via `useFriends()` which returns `friendship` objects with `requester` and `addressee` properties (each being a user). The FriendPicker needs to extract the "other user" from each friendship.

Fix the filtered logic:

```typescript
const { user: currentUser } = useAuth()
const currentUserId = currentUser?.id ?? ''

const filteredFriends =
  friends
    ?.filter((f) => {
      const otherUser = f.requesterId === currentUserId ? f.addressee : f.requester
      if (!otherUser?.name) return false
      if (excludeUserIds.includes(otherUser.id)) return false
      if (searchQuery) {
        return otherUser.name
          .toLowerCase()
          .includes(searchQuery.toLowerCase())
      }
      return true
    })
    .map((f) => ({
      id: f.requesterId === currentUserId ? f.addresseeId : f.requesterId,
      name: (f.requesterId === currentUserId ? f.addressee : f.requester)?.name ?? '',
      image: (f.requesterId === currentUserId ? f.addressee : f.requester)?.image ?? null,
    })) ?? []
```

And update the render to use the mapped data:

```typescript
{filteredFriends.map((friend) => {
  const isSelected = selectedUserIds.includes(friend.id)
  return (
    <XStack
      key={friend.id}
      px="$3"
      py="$2"
      items="center"
      gap="$3"
      cursor="pointer"
      onPress={() => toggleUser(friend.id)}
      bg={isSelected ? '$color3' : 'transparent'}
    >
      <Avatar size={40} image={friend.image} name={friend.name} />
      <SizableText flex={1}>{friend.name}</SizableText>
      {isSelected && <SizableText color="$blue10">✓</SizableText>}
    </XStack>
  )
})}
```

Add `useAuth` import at the top:

```typescript
import { useAuth } from '~/features/auth/client/authClient'
```

---

### Task 6: CreateGroupDialog

**Files:**
- Create: `apps/web/src/interface/dialogs/CreateGroupDialog.tsx`

- [ ] **Step 1: Create the dialog**

Create `apps/web/src/interface/dialogs/CreateGroupDialog.tsx`:

```typescript
import { useState } from 'react'
import { Sheet, SizableText, YStack, XStack } from 'tamagui'

import { FriendPicker } from '~/interface/friend-picker/FriendPicker'
import { Button } from '~/interface/buttons/Button'
import { Input } from '~/interface/forms/Input'
import { showToast } from '~/interface/toast/Toast'
import { useZero } from '~/zero'

type CreateGroupDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (chatId: string) => void
}

export function CreateGroupDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateGroupDialogProps) {
  const [groupName, setGroupName] = useState('')
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const zero = useZero()

  const handleCreate = async () => {
    if (!groupName.trim()) {
      showToast('請輸入群組名稱', { type: 'error' })
      return
    }
    if (selectedUserIds.length < 1) {
      showToast('請至少選擇一位成員', { type: 'error' })
      return
    }

    const chatId = crypto.randomUUID()
    const memberIds = [crypto.randomUUID(), ...selectedUserIds.map(() => crypto.randomUUID())]
    const createdAt = Date.now()

    try {
      await zero.mutate.chat.createGroupChat({
        chatId,
        name: groupName.trim(),
        memberIds: selectedUserIds,
        createdAt,
      })

      showToast('群組已建立', { type: 'success' })
      onOpenChange(false)
      onSuccess?.(chatId)
    } catch (e) {
      showToast(`建立失敗: ${e.message}`, { type: 'error' })
    }
  }

  return (
    <Sheet modal open={open} onOpenChange={onOpenChange} snapPoints={[100]}>
      <Sheet.Overlay opacity={0.5} enterStyle={{ opacity: 0 }} exitStyle={{ opacity: 0 }} />
      <Sheet.Frame flex={1} bg="$background">
        <YStack flex={1}>
          <XStack px="$3" py="$3" items="center" justify="space-between" borderBottomWidth={1} borderBottomColor="$color4">
            <SizableText size="$6" fontWeight="700">建立群組</SizableText>
            <Button variant="transparent" onPress={() => onOpenChange(false)}>✕</Button>
          </XStack>

          <YStack px="$3" py="$2" gap="$2">
            <SizableText size="$3" fontWeight="600">群組名稱</SizableText>
            <Input
              placeholder="輸入群組名稱"
              value={groupName}
              onChangeText={setGroupName}
            />
          </YStack>

          <YStack flex={1} minH={0}>
            <FriendPicker
              selectedUserIds={selectedUserIds}
              onSelectionChange={setSelectedUserIds}
            />
          </YStack>

          <XStack px="$3" py="$3" borderTopWidth={1} borderTopColor="$color4">
            <Button
              flex={1}
              variant="primary"
              onPress={handleCreate}
              disabled={selectedUserIds.length < 1 || !groupName.trim()}
            >
              建立群組
            </Button>
          </XStack>
        </YStack>
      </Sheet.Frame>
    </Sheet>
  )
}
```

---

### Task 7: GroupInfoSheet & InviteLinkDialog

**Files:**
- Create: `apps/web/src/interface/dialogs/GroupInfoSheet.tsx`
- Create: `apps/web/src/interface/dialogs/InviteLinkDialog.tsx`

- [ ] **Step 1: Create InviteLinkDialog**

Create `apps/web/src/interface/dialogs/InviteLinkDialog.tsx`:

```typescript
import { useState, useEffect } from 'react'
import { Sheet, SizableText, YStack, XStack } from 'tamagui'

import { Button } from '~/interface/buttons/Button'
import { showToast } from '~/interface/toast/Toast'
import { useZero } from '~/zero'

type InviteLinkDialogProps = {
  chatId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  role: 'owner' | 'admin' | 'member'
}

export function InviteLinkDialog({
  chatId,
  open,
  onOpenChange,
  role,
}: InviteLinkDialogProps) {
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const zero = useZero()

  useEffect(() => {
    if (open) {
      // Try to get existing invite code from chat
      // For now, generate if user has permission
      if (role === 'owner' || role === 'admin') {
        handleGenerate()
      }
    }
  }, [open])

  const handleGenerate = async () => {
    try {
      const result = await zero.mutate.chat.generateInviteLink({ chatId })
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
      setInviteUrl(`${baseUrl}/invite/${result.inviteCode}`)
    } catch (e) {
      showToast(`生成失敗: ${e.message}`, { type: 'error' })
    }
  }

  const handleRevoke = async () => {
    try {
      await zero.mutate.chat.revokeInviteLink({ chatId })
      setInviteUrl(null)
      showToast('連結已撤銷', { type: 'info' })
    } catch (e) {
      showToast(`撤銷失敗: ${e.message}`, { type: 'error' })
    }
  }

  const handleCopy = () => {
    if (inviteUrl) {
      navigator.clipboard.writeText(inviteUrl)
      showToast('已複製到剪貼簿', { type: 'success' })
    }
  }

  const handleShare = async () => {
    if (inviteUrl && navigator.share) {
      try {
        await navigator.share({
          title: '加入群組',
          url: inviteUrl,
        })
      } catch {
        // User cancelled share
      }
    } else {
      handleCopy()
    }
  }

  return (
    <Sheet modal open={open} onOpenChange={onOpenChange} snapPoints={[50]}>
      <Sheet.Overlay opacity={0.5} enterStyle={{ opacity: 0 }} exitStyle={{ opacity: 0 }} />
      <Sheet.Frame bg="$background" p="$4">
        <SizableText size="$6" fontWeight="700" mb="$3">邀請連結</SizableText>

        {inviteUrl ? (
          <YStack gap="$3">
            <YStack bg="$color2" p="$3" rounded="$3">
              <SizableText size="$2" numberOfLines={1}>{inviteUrl}</SizableText>
            </YStack>

            <XStack gap="$2">
              <Button flex={1} variant="secondary" onPress={handleCopy}>複製</Button>
              <Button flex={1} variant="primary" onPress={handleShare}>分享</Button>
            </XStack>

            {(role === 'owner' || role === 'admin') && (
              <Button variant="danger" onPress={handleRevoke}>撤銷連結</Button>
            )}
          </YStack>
        ) : (
          <YStack gap="$3" items="center">
            <SizableText size="$3" color="$color10">尚無邀請連結</SizableText>
            {(role === 'owner' || role === 'admin') && (
              <Button variant="primary" onPress={handleGenerate}>生成連結</Button>
            )}
          </YStack>
        )}

        <Button mt="$4" variant="transparent" onPress={() => onOpenChange(false)}>關閉</Button>
      </Sheet.Frame>
    </Sheet>
  )
}
```

- [ ] **Step 2: Create GroupInfoSheet**

Create `apps/web/src/interface/dialogs/GroupInfoSheet.tsx`:

```typescript
import { useState } from 'react'
import { Sheet, SizableText, YStack, XStack, ScrollView } from 'tamagui'

import { Avatar } from '~/interface/avatars/Avatar'
import { Button } from '~/interface/buttons/Button'
import { showToast } from '~/interface/toast/Toast'
import { useZero } from '~/zero'
import { useZeroQuery } from '~/zero'
import { groupMembersWithRoles } from '@vine/zero-schema/queries/chat'
import { InviteLinkDialog } from './InviteLinkDialog'
import { AddMembersDialog } from './AddMembersDialog'

type GroupInfoSheetProps = {
  chatId: string
  groupName: string
  groupImage: string | null
  myRole: 'owner' | 'admin' | 'member' | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function GroupInfoSheet({
  chatId,
  groupName,
  groupImage,
  myRole,
  open,
  onOpenChange,
}: GroupInfoSheetProps) {
  const [showInviteDialog, setShowInviteDialog] = useState(false)
  const [showAddMembersDialog, setShowAddMembersDialog] = useState(false)
  const zero = useZero()

  const { rows: members } = useZeroQuery({
    query: groupMembersWithRoles,
    args: { chatId },
  })

  const handleLeave = async () => {
    try {
      await zero.mutate.chatMember.leaveGroup({ chatId })
      showToast('已離開群組', { type: 'success' })
      onOpenChange(false)
    } catch (e) {
      showToast(`離開失敗: ${e.message}`, { type: 'error' })
    }
  }

  const handleRemoveMember = async (targetUserId: string) => {
    try {
      await zero.mutate.chatMember.removeMember({ chatId, targetUserId })
      showToast('已移除成員', { type: 'success' })
    } catch (e) {
      showToast(`移除失敗: ${e.message}`, { type: 'error' })
    }
  }

  return (
    <>
      <Sheet modal open={open} onOpenChange={onOpenChange} snapPoints={[80]}>
        <Sheet.Overlay opacity={0.5} enterStyle={{ opacity: 0 }} exitStyle={{ opacity: 0 }} />
        <Sheet.Frame flex={1} bg="$background">
          <XStack px="$3" py="$3" items="center" justify="space-between" borderBottomWidth={1} borderBottomColor="$color4">
            <SizableText size="$6" fontWeight="700">群組資訊</SizableText>
            <Button variant="transparent" onPress={() => onOpenChange(false)}>✕</Button>
          </XStack>

          <ScrollView flex={1}>
            {/* Group header */}
            <YStack px="$4" py="$4" items="center">
              <Avatar size={64} image={groupImage} name={groupName} />
              <SizableText size="$6" fontWeight="700" mt="$2">{groupName}</SizableText>
              <SizableText size="$2" color="$color10">{members?.length ?? 0} 位成員</SizableText>
            </YStack>

            {/* Actions */}
            <YStack px="$4" gap="$2">
              {(myRole === 'owner' || myRole === 'admin') && (
                <>
                  <Button variant="secondary" onPress={() => setShowInviteDialog(true)}>
                    邀請連結
                  </Button>
                  <Button variant="secondary" onPress={() => setShowAddMembersDialog(true)}>
                    新增成員
                  </Button>
                </>
              )}
            </YStack>

            {/* Member list */}
            <YStack px="$4" py="$3">
              <SizableText size="$4" fontWeight="600" mb="$2">成員</SizableText>
              {members?.map((m) => (
                <XStack key={m.id} py="$2" items="center" gap="$3">
                  <Avatar size={32} image={m.user?.image ?? null} name={m.user?.name ?? '?'} />
                  <SizableText flex={1}>{m.user?.name ?? '未知'}</SizableText>
                  <SizableText size="$2" color="$color10">
                    {m.role === 'owner' ? '擁有者' : m.role === 'admin' ? '管理員' : ''}
                  </SizableText>
                  {(myRole === 'owner' || myRole === 'admin') && m.role !== 'owner' && (
                    <Button
                      size="$1"
                      variant="danger"
                      onPress={() => handleRemoveMember(m.userId!)}
                    >
                      移除
                    </Button>
                  )}
                </XStack>
              ))}
            </YStack>

            {/* Leave button */}
            <YStack px="$4" py="$3">
              <Button variant="danger" onPress={handleLeave}>
                離開群組
              </Button>
            </YStack>
          </ScrollView>
        </Sheet.Frame>
      </Sheet>

      <InviteLinkDialog
        chatId={chatId}
        open={showInviteDialog}
        onOpenChange={setShowInviteDialog}
        role={myRole ?? 'member'}
      />

      <AddMembersDialog
        chatId={chatId}
        open={showAddMembersDialog}
        onOpenChange={setShowAddMembersDialog}
      />
    </>
  )
}
```

---

### Task 8: AddMembersDialog

**Files:**
- Create: `apps/web/src/interface/dialogs/AddMembersDialog.tsx`

- [ ] **Step 1: Create the dialog**

Create `apps/web/src/interface/dialogs/AddMembersDialog.tsx`:

```typescript
import { useState } from 'react'
import { Sheet, SizableText, YStack, XStack } from 'tamagui'

import { FriendPicker } from '~/interface/friend-picker/FriendPicker'
import { Button } from '~/interface/buttons/Button'
import { showToast } from '~/interface/toast/Toast'
import { useZero } from '~/zero'
import { useZeroQuery } from '~/zero'
import { chatMembersByChatId } from '@vine/zero-schema/queries/chat'

type AddMembersDialogProps = {
  chatId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AddMembersDialog({
  chatId,
  open,
  onOpenChange,
}: AddMembersDialogProps) {
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const zero = useZero()

  const { rows: existingMembers } = useZeroQuery({
    query: chatMembersByChatId,
    args: { chatId },
  })

  const existingUserIds = existingMembers
    ?.filter((m) => m.userId)
    .map((m) => m.userId!) ?? []

  const handleAdd = async () => {
    if (selectedUserIds.length === 0) {
      showToast('請至少選擇一位成員', { type: 'error' })
      return
    }

    try {
      await zero.mutate.chatMember.addMembers({
        chatId,
        userIds: selectedUserIds,
        createdAt: Date.now(),
      })

      showToast('已新增成員', { type: 'success' })
      onOpenChange(false)
    } catch (e) {
      showToast(`新增失敗: ${e.message}`, { type: 'error' })
    }
  }

  return (
    <Sheet modal open={open} onOpenChange={onOpenChange} snapPoints={[80]}>
      <Sheet.Overlay opacity={0.5} enterStyle={{ opacity: 0 }} exitStyle={{ opacity: 0 }} />
      <Sheet.Frame flex={1} bg="$background">
        <XStack px="$3" py="$3" items="center" justify="space-between" borderBottomWidth={1} borderBottomColor="$color4">
          <SizableText size="$6" fontWeight="700">新增成員</SizableText>
          <Button variant="transparent" onPress={() => onOpenChange(false)}>✕</Button>
        </XStack>

        <YStack flex={1} minH={0}>
          <FriendPicker
            selectedUserIds={selectedUserIds}
            onSelectionChange={setSelectedUserIds}
            excludeUserIds={existingUserIds}
          />
        </YStack>

        <XStack px="$3" py="$3" borderTopWidth={1} borderTopColor="$color4">
          <Button
            flex={1}
            variant="primary"
            onPress={handleAdd}
            disabled={selectedUserIds.length === 0}
          >
            新增
          </Button>
        </XStack>
      </Sheet.Frame>
    </Sheet>
  )
}
```

---

### Task 9: Update MainPage Groups Section

**Files:**
- Modify: `apps/web/app/(app)/home/(tabs)/main/index.tsx`

- [ ] **Step 1: Add group count query**

In `apps/web/app/(app)/home/(tabs)/main/index.tsx`, add a hook to count groups. Add imports:

```typescript
import { useZeroQuery } from '~/zero'
import { chatsByUserId } from '@vine/zero-schema/queries/chat'
```

Add inside the component (after `const { user } = useAuth()`):

```typescript
const { rows: allChats } = useZeroQuery({
  query: chatsByUserId,
  args: { userId: user?.id ?? '' },
})

const groupCount = allChats?.filter((c) => c.type === 'group').length ?? 0
```

- [ ] **Step 2: Update Groups row onPress**

Replace the Groups ListItem's `onPress`:

```typescript
<ListItem
  py="$2"
  cursor="pointer"
  onPress={() => {
    if (groupCount > 0) {
      router.push('/home/talks')
    } else {
      showToast('建立你的第一個群組', { type: 'info' })
    }
  }}
  hoverStyle={{ bg: '$backgroundHover' }}
>
```

Update the group count display:

```typescript
<SizableText size="$3" color="$color10">
  {groupCount}
</SizableText>
```

---

### Task 10: Update TalksHeader with Create Group Action

**Files:**
- Modify: `apps/web/src/features/chat/ui/TalksHeader.tsx`

- [ ] **Step 1: Add create group button**

In `TalksHeader.tsx`, add a dropdown or menu for the "+" button. Replace the existing "+" button section:

```typescript
import { useState } from 'react'
import { CreateGroupDialog } from '~/interface/dialogs/CreateGroupDialog'
```

Add state inside the component:

```typescript
const [showCreateGroup, setShowCreateGroup] = useState(false)
```

Replace the "+" button:

```typescript
<Button
  variant="transparent"
  cursor="pointer"
  p="$1"
  onPress={() => setShowCreateGroup(true)}
>
  <SizableText size="$4">＋</SizableText>
</Button>
```

Add at the end of the component (before closing `</YStack>`):

```typescript
<CreateGroupDialog
  open={showCreateGroup}
  onOpenChange={setShowCreateGroup}
  onSuccess={(chatId) => router.push(`/home/talks/${chatId}` as any)}
/>
```

---

### Task 11: Update ChatListItem for Groups

**Files:**
- Modify: `apps/web/src/features/chat/ui/ChatListItem.tsx`

- [ ] **Step 1: Read current file first**

Read the current `ChatListItem.tsx` to understand its props and structure.

- [ ] **Step 2: Update for group display**

The component already receives `name` and `image` as props, so it should work for groups without changes. Add a member count badge for groups:

If the component receives a `type` prop, add:

```typescript
{type === 'group' && (
  <XStack
    bg="$color4"
    rounded="$10"
    px="$1.5"
    py="$0.5"
    items="center"
    justify="center"
  >
    <SizableText size="$1" color="$color12" fontWeight="600">
      👥
    </SizableText>
  </XStack>
)}
```

Check the parent component (`useChats.ts` or the talks list) to ensure `type` is passed through.

---

### Task 12: Update ChatRoomPage for Groups

**Files:**
- Modify: `apps/web/app/(app)/home/(tabs)/talks/[chatId].tsx`

- [ ] **Step 1: Add group info sheet trigger**

Add imports:

```typescript
import { useState } from 'react'
import { GroupInfoSheet } from '~/interface/dialogs/GroupInfoSheet'
```

Add state:

```typescript
const [showGroupInfo, setShowGroupInfo] = useState(false)
```

Determine if this is a group chat and get my role:

```typescript
const isGroupChat = members.length > 2 || (members.length === 2 && !otherMember?.oaId && !otherMember?.userId)
// Better: check chat type from the chat data
```

Actually, we need the chat type. Check how `useMessages` works — it likely has access to chat data. If not, add a Zero query for the chat itself.

Make the header tappable for group chats:

```typescript
<XStack
  shrink={0}
  px="$3"
  py="$2"
  gap="$3"
  items="center"
  borderBottomWidth={1}
  borderBottomColor="$color4"
  cursor={isGroupChat ? 'pointer' : 'default'}
  onPress={isGroupChat ? () => setShowGroupInfo(true) : undefined}
>
```

Add at the end of the component:

```typescript
{isGroupChat && (
  <GroupInfoSheet
    chatId={chatId}
    groupName={groupName}
    groupImage={groupImage}
    myRole={myRole}
    open={showGroupInfo}
    onOpenChange={setShowGroupInfo}
  />
)}
```

---

### Task 13: Create Invite Landing Page

**Files:**
- Create: `apps/web/app/(public)/invite/[inviteCode]/page.tsx`

- [ ] **Step 1: Create the public invite page**

Create `apps/web/app/(public)/invite/[inviteCode]/page.tsx`:

```typescript
import { createRoute, useActiveParams, router } from 'one'
import { memo, useState } from 'react'
import { SizableText, YStack, XStack } from 'tamagui'

import { useAuth } from '~/features/auth/client/authClient'
import { Avatar } from '~/interface/avatars/Avatar'
import { Button } from '~/interface/buttons/Button'
import { showToast } from '~/interface/toast/Toast'
import { useZero } from '~/zero'

const route = createRoute<'/(public)/invite/[inviteCode]'>()

export const InvitePage = memo(() => {
  const { inviteCode } = useActiveParams<{ inviteCode: string }>()
  const { user, isLoading: authLoading } = useAuth()
  const zero = useZero()
  const [joining, setJoining] = useState(false)

  const handleJoin = async () => {
    if (!user) {
      router.push(`/login?redirect=/invite/${inviteCode}` as any)
      return
    }

    setJoining(true)
    try {
      await zero.mutate.chatMember.joinViaInvite({
        inviteCode: inviteCode!,
        createdAt: Date.now(),
      })

      showToast('已加入群組', { type: 'success' })

      // Find the chat and navigate to it
      // For now, redirect to home
      router.push('/home/talks' as any)
    } catch (e) {
      showToast(`加入失敗: ${e.message}`, { type: 'error' })
    } finally {
      setJoining(false)
    }
  }

  if (authLoading) {
    return (
      <YStack flex={1} items="center" justify="center" bg="$background">
        <SizableText color="$color10">載入中...</SizableText>
      </YStack>
    )
  }

  return (
    <YStack flex={1} items="center" justify="center" bg="$background" px="$6">
      <YStack items="center" gap="$4" maxWidth={400}>
        <Avatar size={80} image={null} name="Group" />
        <SizableText size="$8" fontWeight="700">邀請加入群組</SizableText>
        <SizableText size="$3" color="$color10" text="center">
          {user
            ? '點擊下方按鈕加入此群組'
            : '請先登入帳號以加入群組'}
        </SizableText>

        <Button
          variant="primary"
          onPress={handleJoin}
          disabled={joining}
          width="100%"
        >
          {joining ? '加入中...' : user ? '加入群組' : '登入以加入'}
        </Button>
      </YStack>
    </YStack>
  )
})

export default InvitePage
```

---

### Task 14: Create GroupAvatar Component

**Files:**
- Create: `apps/web/src/features/chat/ui/GroupAvatar.tsx`

- [ ] **Step 1: Create GroupAvatar**

Create `apps/web/src/features/chat/ui/GroupAvatar.tsx`:

```typescript
import { memo } from 'react'
import { SizableText, XStack } from 'tamagui'

const AVATAR_COLORS = ['#7a9cbf', '#c4aed0', '#a0c4a0', '#e0b98a']

type GroupAvatarProps = {
  size: number
  names: string[]
  image?: string | null
}

export const GroupAvatar = memo(({ size, names, image }: GroupAvatarProps) => {
  if (image) {
    return (
      <XStack
        width={size}
        height={size}
        shrink={0}
        style={{ borderRadius: 999, backgroundColor: '$color4' }}
        items="center"
        justify="center"
      >
        <SizableText fontSize={size * 0.4} fontWeight="600" color="white">
          {names[0]?.[0]?.toUpperCase() ?? '?'}
        </SizableText>
      </XStack>
    )
  }

  return (
    <XStack
      width={size}
      height={size}
      shrink={0}
      style={{ borderRadius: 999, backgroundColor: AVATAR_COLORS[0] }}
      items="center"
      justify="center"
    >
      <SizableText fontSize={size * 0.4} fontWeight="600" color="white">
        {names[0]?.[0]?.toUpperCase() ?? '?'}
      </SizableText>
    </XStack>
  )
})
```

---

### Task 15: Create useGroups Hook

**Files:**
- Create: `apps/web/src/features/chat/useGroups.ts`

- [ ] **Step 1: Create the hook**

Create `apps/web/src/features/chat/useGroups.ts`:

```typescript
import { useMemo } from 'react'

import { useZeroQuery } from '~/zero'
import { chatsByUserId, chatMembersByChatId } from '@vine/zero-schema/queries/chat'
import { useAuth } from '~/features/auth/client/authClient'

export function useGroups() {
  const { user } = useAuth()
  const userId = user?.id ?? ''

  const { rows: allChats, isLoading } = useZeroQuery({
    query: chatsByUserId,
    args: { userId },
  })

  const groups = useMemo(
    () => allChats?.filter((c) => c.type === 'group') ?? [],
    [allChats],
  )

  return { groups, isLoading }
}

export function useGroupMembers(chatId: string) {
  const { rows: members, isLoading } = useZeroQuery({
    query: chatMembersByChatId,
    args: { chatId },
  })

  const memberNames = useMemo(
    () => members?.filter((m) => m.userId).map((m) => m.user?.name ?? '?') ?? [],
    [members],
  )

  return { members, memberNames, isLoading }
}
```

---

### Task 16: Verification & Cleanup

**Files:**
- All modified files

- [ ] **Step 1: Run type check**

```bash
bun run check:all
```

Fix any type errors.

- [ ] **Step 2: Run format**

```bash
bun run format
```

- [ ] **Step 3: Run tests**

```bash
bun run test
```

- [ ] **Step 4: Start dev server and verify**

```bash
docker compose up -d
bun run dev
```

Test the following flows manually:
1. Create a group with 2+ friends
2. Group appears in chat list
3. Open group chat → tap header → see group info
4. Add members from group info
5. Generate invite link → open in new browser → join
6. Remove member → verify they lose access
7. Leave group → verify it disappears from chat list
8. Try to leave as owner → see error about transferring ownership

---
