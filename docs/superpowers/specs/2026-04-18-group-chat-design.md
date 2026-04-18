# Group Chat Design Spec

**Date:** 2026-04-18
**Status:** Draft - awaiting user review

## Overview

Add full LINE-like group chat functionality to Vine, including group creation, member management, admin roles, invite links (web + native), and group info management. This is a differentiator from LINE which lacks web-based group invite links.

## Architecture

### Schema Changes

**`chat` table (packages/db/src/schema-public.ts):**

| Column | Type | Purpose |
|--------|------|---------|
| `name` | text (nullable) | Group display name |
| `image` | text (nullable) | Group avatar URL |
| `description` | text (nullable) | Group description |
| `inviteCode` | text (nullable, unique) | Web invite link code |
| `albumCount` | int (default 0) | Placeholder for future album feature |
| `noteCount` | int (default 0) | Placeholder for future note feature |

**`chatMember` table (packages/db/src/schema-public.ts):**

| Column | Type | Purpose |
|--------|------|---------|
| `role` | text (nullable, default 'member') | 'owner' \| 'admin' \| 'member' (null for OA members) |

DB check: `role IS NULL OR oaId IS NULL` — OA members don't have roles.

### Zero Schema Updates

**`chat` model (packages/zero-schema/src/models/chat.ts):**

Add columns: `name`, `image`, `description`, `inviteCode`, `albumCount`, `noteCount`

**`chatMember` model (packages/zero-schema/src/models/chatMember.ts):**

Add column: `role`

### New Zero Mutations

| Mutation | Location | Purpose |
|----------|----------|---------|
| `createGroupChat` | `chat.ts` | Create group with name, image, creator as owner, add initial members |
| `addMembers` | `chatMember.ts` | Add users to group (admin+ only) |
| `removeMember` | `chatMember.ts` | Remove member (admin+ only, can't remove owner) |
| `leaveGroup` | `chatMember.ts` | Member leaves (must transfer ownership if owner) |
| `updateGroupInfo` | `chat.ts` | Update name/image/description (owner/admin) |
| `transferOwnership` | `chatMember.ts` | Transfer ownership to another member |
| `generateInviteLink` | `chat.ts` | Generate/refresh invite code (16-char alphanumeric via crypto.randomUUID) |
| `revokeInviteLink` | `chat.ts` | Clear invite code |
| `joinViaInvite` | `chatMember.ts` | Join group via invite code |

### New Zero Queries

| Query | Location | Purpose |
|-------|----------|---------|
| `groupInfo` | `chat.ts` | Get group details (name, image, description, member count, invite code) |
| `groupMembersWithRoles` | `chatMember.ts` | Get all members with roles |
| `validateInviteCode` | `chat.ts` | Check if invite code is valid and return group info |

### Permission Matrix

| Action | Owner | Admin | Member |
|--------|-------|-------|--------|
| Update group info | ✅ | ✅ | ❌ |
| Add members | ✅ | ✅ | ❌ |
| Remove members | ✅ | ✅ | ❌ |
| Transfer ownership | ✅ | ❌ | ❌ |
| Leave group | ✅ (must transfer first) | ✅ | ✅ |
| Generate/revoke invite | ✅ | ✅ | ❌ |

## Data Flow

### Create Group Chat

1. User opens create group dialog → selects friends → confirms
2. Frontend generates IDs (`chatId`, `memberId`s) + timestamp
3. Calls `zero.mutate.chat.createGroupChat({ name, image, memberIds, createdAt })`
4. Mutation inserts `chat` row (type='group'), then `chatMember` rows (creator='owner', others='member')
5. Zero syncs → all members see new group in chat list

### Add Members

1. Admin opens group info → "Add members" → selects friends
2. Calls `zero.mutate.chatMember.addMembers({ chatId, userIds })`
3. Mutation checks caller has admin/owner role, inserts new `chatMember` rows
4. New members receive group via Zero sync

### Remove/Leave

1. Admin removes member OR member leaves
2. Calls `removeMember` or `leaveGroup` mutation
3. Mutation deletes `chatMember` row
4. Zero syncs → removed member loses access

### Invite Link (Web + Native)

1. Owner/admin calls `generateInviteLink({ chatId })` → sets `inviteCode`
2. Share link: `https://{host}/invite/{inviteCode}` or `vine://invite/{code}`
3. Recipient opens link → public page shows group preview
4. If logged in: "Join" → `joinViaInvite({ inviteCode })` → redirect to chat
5. If not logged in: "Login to join" → after auth, auto-joins → redirect
6. Owner can revoke via `revokeInviteLink({ chatId })`

## Frontend Components

### New Routes

| Route | Purpose |
|-------|---------|
| `(app)/home/(tabs)/talks/create-group` | Create group: name, image, select friends |
| `(app)/home/(tabs)/talks/[chatId]/group-info` | Group info: members, settings, admin controls |
| `(public)/invite/[inviteCode]` | Public invite landing page |

### New Dialogs (`~/interface/dialogs/`)

| Dialog | Purpose |
|--------|---------|
| `CreateGroupDialog` | Name, image upload, friend picker |
| `AddMembersDialog` | Friend picker for adding to existing group |
| `GroupInfoSheet` | Bottom sheet with group details, member list, invite link |
| `InviteLinkDialog` | Show invite URL, QR code, copy/share buttons |

### Updated Components

| Component | Changes |
|-----------|---------|
| `MainPage` | Replace "Groups coming soon" with real group count + navigation |
| `TalksHeader` | Add "create group" action in "+" menu |
| `ChatListItem` | Show group icon + member count for group chats |
| `ChatRoomPage` | Header shows group name, tap → group info sheet |

### Shared: Friend Picker

- Reusable across create group, add members, friend requests
- Multi-select with search, shows name + avatar
- Filters out existing group members

## Error Handling

### Permission Errors

| Scenario | Error | Behavior |
|----------|-------|----------|
| Non-admin manages members | "Only admins can manage members" | Toast + button disabled |
| Owner leaves without transfer | "Transfer ownership first" | Dialog prompts transfer |
| Invalid/expired invite link | "Link no longer valid" | Error page with back |
| Already a member | "Already a member" | Redirect to chat |

### Data Consistency

| Scenario | Handling |
|----------|----------|
| Concurrent add same member | Unique constraint deduplicates |
| Creator leaves mid-creation | Transaction rollback |
| Member removed while viewing | Zero sync removes access, redirect |
| Invite code collision | DB unique constraint, retry |
| 0 members after all leave | Group persists as tombstone; no auto-archive in v1 |

### UI Edge Cases

| Scenario | Handling |
|----------|----------|
| 0 members after all leave | Auto-archive after 24h |
| Large group (100+) | Virtualized list, pagination |
| No friends to invite | "Add friends first" empty state |
| Image upload fails | Retry button, default avatar |

### Rate Limiting (Server-Side)

| Action | Limit |
|--------|-------|
| Join via invite | 5/min per user |
| Create group | 10/hour per user |
| Generate invite link | 3/hour per group |

## Future Work (Out of Scope)

- Group albums
- Group notes
- Group polls
- Announcement mode (admin-only posting)
- Mute group notifications per member
