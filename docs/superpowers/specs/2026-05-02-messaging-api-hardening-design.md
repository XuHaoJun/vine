# Messaging API Hardening Design

**Date:** 2026-05-02
**Status:** Approved
**Scope:** Milestone 1 hardening + Milestone 2 close-out

## Overview

Three targeted improvements to the Vine Messaging API developer experience:

1. **Profile API** — fix the stub `GET /bot/profile/:userId` to return real user data
2. **Loading Animation** — implement `POST /bot/chat/loading/start` with chat UI indicator
3. **Access Token UI** — add token issue/list/revoke section to the developer console

Template messages are intentionally not supported in Vine; Flex Messages cover the same use case.

---

## Feature 1: Profile API

### Current state

`GET /api/oa/v2/bot/profile/:userId` returns a hardcoded stub:
```json
{ "userId": "...", "displayName": "User", "pictureUrl": "" }
```

### Target behavior

Query `userPublic` table by `userId` and return real data.

**Response shape (LINE-compatible):**
```json
{
  "userId": "<id>",
  "displayName": "<userPublic.name>",
  "pictureUrl": "<userPublic.image | empty string>"
}
```

**Error cases:**
- User not found → 404 `{ "message": "User not found" }`
- Invalid/expired token → 401 (existing pattern)

`statusMessage` and `language` fields are omitted; Vine has no equivalent.

**Scope:** Single server change in `apps/server/src/plugins/oa-messaging.ts`. No schema changes, no Zero migration.

---

## Feature 2: Loading Animation

### LINE API behavior

`POST /v2/bot/chat/loading/start`
- Body: `{ "chatId": "<userId>", "loadingSeconds": 5–60 }`
- Only valid for 1-on-1 OA chats (not group or multi-person)
- Animation disappears after `loadingSeconds` OR when OA sends a new message
- A second call while animation is visible overrides the remaining duration

### Data layer

New table `chatOaLoading` in `packages/db/src/schema-public.ts`:

| Column | Type | Notes |
|---|---|---|
| `id` | text PK | `${chatId}_${oaId}` — acts as upsert key |
| `chatId` | text | Target chat room |
| `oaId` | text | Which OA is loading |
| `expiresAt` | bigint | Unix ms expiry |

Zero model at `packages/zero-schema/src/models/chatOaLoading.ts`:
- Read permission: `serverWhere` checking `eb.exists('members', q => q.where('userId', auth.id))` — same pattern as `message` table
- No client-side mutations (server-only writes)

Requires the standard zero-schema-migration flow:
1. Drizzle migration → `bun run migrate`
2. Add Zero model → `bun zero:generate`
3. Publication rebuild → `docker compose run --rm migrate`

### Server endpoint

```
POST /api/oa/v2/bot/chat/loading/start
Authorization: Bearer <channel access token>
Body: { chatId: string, loadingSeconds: number }
```

Steps:
1. Extract OA from token (`extractOaFromToken`)
2. Validate `loadingSeconds` is in range 5–60
3. Verify OA is a member of `chatId` (query `chatMember` where `oaId = oaId AND chatId = chatId`)
4. Verify `chat.type = 'oa'` (reject group/multi chats)
5. Upsert `chatOaLoading` row: `id = ${chatId}_${oaId}`, `expiresAt = Date.now() + loadingSeconds * 1000`
6. Return `{}`

**Cleanup — two triggers:**
- **On message delivery:** the OA message delivery worker deletes the `chatOaLoading` row for `(chatId, oaId)` after inserting the message into the DB
- **Periodic cleanup:** a `setInterval` registered at server startup (same file as the existing `oaWebhookDelivery` 30-day retention cleanup) that deletes rows where `expiresAt < Date.now()`, running every 60 seconds

### Chat UI

In `apps/web/app/(app)/home/(tabs)/talks/[chatId].tsx`:

1. Only query when `otherMemberOaId` is non-null (i.e. this is a 1-on-1 OA chat):
   ```ts
   const loadingRow = useQuery(
     otherMemberOaId
       ? z.query.chatOaLoading.where('chatId', chatId).where('oaId', otherMemberOaId).one()
       : null
   )
   ```
2. Compute `isOaLoading = !!loadingRow && loadingRow.expiresAt > Date.now()`
3. Use a `useEffect` with `setTimeout(remaining)` to force re-render when the indicator expires client-side (so it disappears even if the server cleanup hasn't fired yet)
4. Render a `TypingIndicator` component (three-dot animation bubble) above the input bar when `isOaLoading` is true — similar visual position to the QuickReplyBar

`TypingIndicator` is a new small component in `apps/web/src/interface/message/`.

---

## Feature 3: Access Token UI

### Current state

Server RPCs are fully implemented:
- `IssueAccessToken(oaId, type)` → returns token string + expiry
- `ListAccessTokens(oaId)` → returns list of `AccessTokenSummary` (id, type, createdAt, expiresAt)
- `RevokeAccessToken(tokenId)` → revokes one token
- `RevokeAllAccessTokens(oaId)` → revokes all

The developer console `MessagingApiTab` has no token UI at all.

### New UI: AccessTokenSection

Added as the **first section** in `MessagingApiTab`, before `MessagingApiGuideSection`.

**Layout:**
```
[Channel access token]
──────────────────────────────────
Token list (type | created | expires)    [Issue new token]
  • SHORT_LIVED  2026-05-01  2026-05-31  [Revoke]
  • SHORT_LIVED  2026-04-15  2026-05-15  [Revoke]

[After issue — one-time reveal]:
  Token: vine_abc123...xyz   [Copy]  [OK]
```

**Behavior:**
- Token string is **only shown once** after issuance (not stored client-side after dismiss)
- "Issue" calls `IssueAccessToken` with `type = ACCESS_TOKEN_TYPE_SHORT_LIVED`
- "Revoke" calls `RevokeAccessToken(tokenId)` then refreshes the list
- List is loaded via React Query (`useQuery`) calling `ListAccessTokens` on mount and after issue/revoke

**File:** New component `AccessTokenSection.tsx` in `apps/web/app/(app)/developers/console/channel/[channelId]/`.

---

## Out of Scope

- `statusMessage` / `language` fields on Profile API
- Loading animation for group chats (LINE does not support this either)
- Long-lived or stateless token types in the access token UI
- Token rotation policies or per-token expiry configuration UI
- Quota enforcement tied to token type
