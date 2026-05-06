# Manager OA Chat MVP Design

## Context

Vine is a standalone LINE-like product. This MVP implements the OA-side chat
workspace inside Vine's manager UI; it does not integrate with LINE Official
Account Manager or call `api.line.me`.

The UI reference in `docs/line-ui-reference/manager/oa-chat.md` describes a
four-column OA manager chat workspace. For this MVP, only the `Chats` entry in
COL1 is in scope. The chat list and chat room must use Vine's Zero sync layer so
the manager view updates in real time.

Relevant LINE Developers concepts used only as product reference:

- Messaging API OA chats are one-on-one conversations between a user and an
  official account.
- OA messages can be sent to users as text messages.
- User profile display in OA chat requires only display name and avatar for this
  MVP.
- Read state is distinct from official LINE mark-as-read behavior. Vine will
  track manager-side read state internally.

## Goals

1. Add a manager route for OA-side chats.
2. Show a four-column desktop workspace with:
   - COL1: only `Chats`, active.
   - COL2: realtime OA chat list.
   - COL3: realtime text-only chat room.
   - COL4: minimal user profile with avatar and name.
3. Let the OA owner send text messages as the OA.
4. Show unread dots in COL2 based on Vine manager-side read state.
5. Add basic integration coverage for the manager OA chat flow.
6. Put any required seed data in `packages/db/src/seed/ensureSeed.ts`.

## Non-Goals

- No official LINE cloud integration.
- No tags, notes, block/report, full user profile, settings, or account switcher
  work beyond the existing manager shell.
- No sticker picker, media upload, templates, Flex editor, rich message editor,
  quick replies, scheduled messages, or broadcast/multicast/narrowcast UI.
- No official LINE mark-as-read API behavior.
- No mobile-specific OA manager chat layout in this MVP.

## Architecture

The manager chat workspace uses a hybrid data approach:

- ConnectRPC remains responsible for existing manager shell concerns such as
  loading and authorizing the current OA account.
- Zero owns synced chat state: COL2 chat list, COL3 messages, message sending,
  and manager-side read markers.

The route should live under the existing manager route family:

- `/manager/:oaId/chat`
- `/manager/:oaId/chat/:chatId` for selected chat state

The existing manager layout should add a `Chats` nav item. Since only COL1
Chats is in scope, other OA chat manager nav items from the reference document
should not be added.

## Zero Data Model

Reuse existing tables where possible:

- `chat.type = 'oa'`
- `chatMember.userId` for the user participant
- `chatMember.oaId` for the official account participant
- `chatMember.lastReadMessageId` and `lastReadAt` for read markers
- `message.senderType = 'user' | 'oa'`
- `message.senderId` for user messages
- `message.oaId` for OA messages

Zero currently gates chat and message reads by user chat membership. OA owners
are not chat members, so the MVP needs manager-aware Zero permissions.

Add Zero models for the minimum OA ownership graph:

- `officialAccount`
- `oaProvider`

Add relationships needed by permissions and queries:

- `chatMember.oa`
- `officialAccount.provider`
- any inverse relationship needed to express "this chat has an OA member owned
  by the current auth user"

The permission rule is:

- A logged-in user can read an OA chat if the chat has a `chatMember.oaId` for
  an `officialAccount` whose provider `ownerId` equals `auth.id`.
- A logged-in user can read messages in an OA chat under the same ownership
  rule.
- User-side chat access must continue to work unchanged.

## Zero Queries

Add manager-specific queries under `packages/zero-schema/src/queries/`:

### `oaChatsByOfficialAccountId`

Input:

- `oaId: string`

Returns:

- OA chats for that OA, sorted by `lastMessageAt desc`
- related `members.user`
- related `lastMessage`

The query should only return chats where:

- `chat.type === 'oa'`
- one member row has `oaId === input.oaId`
- the current auth user owns the OA

### `oaMessagesByChatId`

Input:

- `oaId: string`
- `chatId: string`
- optional `limit`

Returns:

- messages for the selected OA chat, sorted by `createdAt asc`
- related `sender` for user messages

The query must verify both OA ownership and that the selected chat belongs to
the requested OA.

### `oaChatMembersByChatId`

Input:

- `oaId: string`
- `chatId: string`

Returns:

- the OA member row
- the user member row with related user profile

This supports COL3 header, COL4 profile, and manager-side read updates.

## Zero Mutations

### `message.sendAsOA`

Input:

- `id: string`
- `chatId: string`
- `oaId: string`
- `text: string`
- `createdAt: number`

Behavior:

1. Require auth.
2. Validate the current auth user owns `oaId`.
3. Validate `chatId` is an OA chat containing `chatMember.oaId = oaId`.
4. Reject empty trimmed text.
5. Insert a `message` row:
   - `senderType = 'oa'`
   - `oaId = input.oaId`
   - `type = 'text'`
   - `text = trimmed input.text`
6. Update `chat.lastMessageId` and `chat.lastMessageAt`.

### `chatMember.markOARead`

Input:

- `chatId: string`
- `oaId: string`
- `lastReadMessageId: string`
- `lastReadAt: number`

Behavior:

1. Require auth.
2. Validate the current auth user owns `oaId`.
3. Find the OA `chatMember` row for `chatId` and `oaId`.
4. Update only that OA member row's `lastReadMessageId` and `lastReadAt`.

## UI Design

### COL1

The manager sidebar shows a `Chats` item and marks it active on the chat route.
Existing manager sections such as rich menus may remain elsewhere in the manager
navigation, but the OA chat reference's settings, tags, broadcasts, and filters
are not part of this MVP.

### COL2

COL2 is a fixed-width chat list panel with:

- search input filtering by user display name
- user avatar
- user display name
- last text preview
- timestamp
- unread dot

Search is local-only for the MVP. The synced chat list is capped, and the first
version does not need server-side search.

Unread dot behavior:

- show unread when `lastMessage.senderType === 'user'` and the OA member row's
  `lastReadMessageId !== lastMessage.id`
- do not show unread for OA-sent latest messages

### COL3

COL3 is the selected chat room:

- header with user avatar and name
- scrollable messages
- text-only composer
- send button

The message renderer may reuse existing chat bubble components where practical.
If existing components assume user perspective, the manager view should map
alignment from the OA perspective: OA messages are "mine"; user messages are
"theirs".

Opening a chat should mark it read when the latest message is from the user by
calling `chatMember.markOARead`.

### COL4

COL4 is intentionally minimal:

- large avatar
- display name

No notes, tags, menus, profile metadata, or user management actions.

## Empty And Loading States

- No chats: show a quiet empty state in COL2.
- No selected chat: COL3 shows an empty selection state.
- Selected chat with no messages: COL3 shows an empty message state.
- Query warming: use the local Zero query state to show loading placeholders.
- Send failure: surface a toast or dialog using existing frontend patterns.

## Integration Test Coverage

Add basic integration coverage for the happy path and access control. Existing
integration test style should be followed.

Minimum cases:

1. Seed or create an OA owned by the test manager user, an OA chat, a user
   participant, and at least one user-sent message.
2. Manager opens `/manager/:oaId/chat` and sees the realtime chat list item.
3. The chat item shows an unread dot when the latest message is from the user.
4. Manager opens the chat and sees the message history plus COL4 avatar/name.
5. Manager sends a text message as the OA.
6. The sent message appears in the chat and the chat list last message updates.
7. Re-opening or selecting the chat clears the unread dot for that OA member.
8. A non-owner cannot access another OA's manager chat data.

If shared fixture data is required, add it to
`packages/db/src/seed/ensureSeed.ts`. Do not create ad hoc test-only seed paths
outside the existing seed workflow.

## Acceptance Criteria

- `/manager/:oaId/chat` renders the manager OA chat workspace.
- COL2 and COL3 are backed by Zero queries and update from synced data.
- OA owner can send a text message as the OA through a Zero mutation.
- Unread dots are based on the OA member row's read marker.
- COL4 displays only avatar and name.
- Non-owner access to OA chat data is denied by server-side Zero permissions.
- Basic integration tests cover list, unread, open chat, send text, and
  unauthorized access.
