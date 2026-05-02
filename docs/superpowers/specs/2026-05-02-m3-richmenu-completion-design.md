# Milestone 3 Completion: Rich Menu Parity

**Date:** 2026-05-02  
**Status:** Approved for implementation  
**Scope:** Close the remaining gaps in Milestone 3 (Rich Menu Parity)

---

## Context

Milestone 3's server-side Messaging API and ConnectRPC foundations are fully built.
The remaining gaps are:

| Gap | Size |
|---|---|
| Rich menu `postback` action not dispatched in chat | XS |
| `richmenuswitch` action not handled in chat | S |
| Alias management UI missing in manager | M |
| Per-user rich menu manager UI missing | M |
| Per-area click insights missing | M |

Implementation is split into two blocks that can be shipped independently.

---

## Block 1: Chat-side fixes

### 1a. Rich menu postback dispatch fix

**File:** `apps/web/app/(app)/home/(tabs)/talks/[chatId].tsx`

`handleRichMenuAreaTap` currently shows a toast for `postback` actions instead of
dispatching them. Fix: route `postback` through the existing `dispatchAction` hook
(same path as quick reply postback actions). No new infrastructure needed.

**Success criterion:** Tapping a rich menu area with `type: "postback"` fires the
webhook to the OA, identical to tapping a quick reply postback button.

---

### 1b. `richmenuswitch` action

`richmenuswitch` is a platform-level tab-switching action exclusive to rich menus.
It is unrelated to the postback action dispatch flow. Per LINE spec:

1. The platform resolves the alias and switches the per-user rich menu.
2. A postback webhook is fired to the OA with `postback.data` and
   `postback.params: { newRichMenuAliasId, status }`.
3. The client UI updates to show the new menu.

In Vine, steps 2 and 3 happen in parallel after step 1 completes (the server
returns the RPC response as soon as the DB write is done; webhook delivery is
enqueued fire-and-forget via the existing outbox pattern).

#### New ConnectRPC method: `switchRichMenu`

**Proto:**
```proto
message SwitchRichMenuRequest {
  string official_account_id = 1;
  string chat_id = 2;
  string rich_menu_alias_id = 3;
  string data = 4;
}

message SwitchRichMenuResponse {
  string status = 1; // SUCCESS | RICHMENU_ALIAS_ID_NOTFOUND | RICHMENU_NOTFOUND | FAILED
  string new_rich_menu_alias_id = 2; // omitted on failure
}
```

**Server handler (connect/oa.ts):**
1. Verify session (existing auth pattern).
2. Resolve `richMenuAliasId` → `richMenuId` via `oaRichMenuAlias`. If not found: return
   `RICHMENU_ALIAS_ID_NOTFOUND`.
3. Verify `richMenuId` exists in `oaRichMenu`. If not found: return `RICHMENU_NOTFOUND`.
4. Upsert `oaRichMenuUserLink` for `(oaId, sessionUserId)` → new `richMenuId`.
5. Return `SwitchRichMenuResponse { status: "SUCCESS", newRichMenuAliasId }` to client.
6. **In parallel (fire-and-forget):** enqueue postback webhook event to OA with:
   ```json
   {
     "type": "postback",
     "postback": {
       "data": "<data field from action>",
       "params": {
         "newRichMenuAliasId": "<resolved alias>",
         "status": "SUCCESS"
       }
     }
   }
   ```

**Client handler (`handleRichMenuAreaTap` in `[chatId].tsx`):**

Add `richmenuswitch` case:
```ts
case 'richmenuswitch':
  oaClient.switchRichMenu({
    officialAccountId: otherMemberOaId,
    chatId,
    richMenuAliasId: action.richMenuAliasId,
    data: action.data ?? '',
  }).then(() => {
    queryClient.invalidateQueries({ queryKey: ['oa', 'richMenu', 'active', otherMemberOaId] })
  })
  break
```

**Success criterion:** Tapping a `richmenuswitch` area in chat switches the displayed
rich menu immediately and delivers a postback webhook to the OA with the correct
`params.newRichMenuAliasId` and `params.status`.

---

## Block 2: Manager-side additions

### 2a. Alias management UI (in edit page)

**Location:** Bottom of `/manager/[oaId]/richmenu/[richMenuId]` edit page, below the
area editor.

**UI:** "Aliases" section card showing:
- List of existing aliases: `richMenuAliasId` + created date + delete button
- "Add alias" inline form: text input for `richMenuAliasId` + confirm button
- Empty state when no aliases exist

**New ConnectRPC methods** (proto + handler in `connect/oa.ts`):

| Method | Description |
|---|---|
| `listRichMenuAliases(officialAccountId)` | Returns all aliases for this OA, each with `richMenuAliasId` and `richMenuId` |
| `createRichMenuAlias(officialAccountId, richMenuAliasId, richMenuId)` | Creates alias; 409 if ID already taken |
| `deleteRichMenuAlias(officialAccountId, richMenuAliasId)` | Deletes alias |

Server implementations delegate to `oa` service methods already wired in
`oa-richmenu.ts` (the HTTP plugin already has all alias logic).

---

### 2b. Per-user rich menu UI (bidirectional)

#### Entry 1 — From menu side (edit page)

Below the Aliases section: "Assigned users" card showing users currently linked to
this specific menu. Each row: user avatar + name + "Unlink" button.

Data: query `oaRichMenuUserLink WHERE richMenuId = ?` joined with `userPublic`.

#### Entry 2 — From user side (new page)

**Route:** `/manager/[oaId]/richmenu/users`

Lists all users who have friended this OA. Each row:
- User avatar + name
- Currently assigned menu name (or "Default" if no per-user link)
- Dropdown to switch to any menu, or "Use default"

**New ConnectRPC methods:**

| Method | Description |
|---|---|
| `listOAUsersWithRichMenus(officialAccountId)` | Join `oaFriendship` + `oaRichMenuUserLink` + `userPublic`; returns `{ userId, userName, userImage, assignedRichMenuId? }[]` |
| `linkRichMenuToUser(officialAccountId, userId, richMenuId)` | Upserts `oaRichMenuUserLink` |
| `unlinkRichMenuFromUser(officialAccountId, userId)` | Deletes from `oaRichMenuUserLink` |

Navigation: add "Users" tab or link in the rich menu manager layout
(`/manager/[oaId]/richmenu` nav).

---

### 2c. Per-area click insights

#### DB migration

New table `oaRichMenuClick`:

```sql
CREATE TABLE "oaRichMenuClick" (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "oaId"      UUID NOT NULL REFERENCES "officialAccount"(id) ON DELETE CASCADE,
  "richMenuId" TEXT NOT NULL,
  "areaIndex"  INTEGER NOT NULL,
  "clickedAt"  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON "oaRichMenuClick" ("oaId", "richMenuId");
CREATE INDEX ON "oaRichMenuClick" ("oaId", "clickedAt");
```

#### Click recording

`handleRichMenuAreaTap` fires `oaClient.trackRichMenuClick` **in parallel** with
the existing action dispatch (fire-and-forget, errors silently ignored):

```ts
// fire-and-forget — do not await
oaClient.trackRichMenuClick({
  officialAccountId: oaId,
  richMenuId: activeRichMenuId,
  areaIndex,
}).catch(() => {})
```

`activeRichMenuId` is available as `richMenu?.richMenuId` from the existing `useRichMenu` call in `[chatId].tsx`.

**New ConnectRPC method:** `trackRichMenuClick(officialAccountId, richMenuId, areaIndex)`  
Server: inserts one row into `oaRichMenuClick`. Requires session auth (session user
must be a friend of this OA). Returns empty response.

**New ConnectRPC method:** `getRichMenuStats(officialAccountId, richMenuId)`  
Server: `SELECT areaIndex, COUNT(*) FROM oaRichMenuClick WHERE oaId=? AND richMenuId=? GROUP BY areaIndex`  
Returns: `{ stats: { areaIndex: number, clickCount: number }[] }`

#### Manager UI

In the edit page area editor:
- Each area overlay badge shows click count (e.g. small `42` chip in the corner).
- Below the area editor: "Click stats" summary table with columns: Area, Clicks, Share (%).
- Stats are loaded once on page mount via `getRichMenuStats`; no auto-refresh needed.

---

## New proto methods summary

| Method | Block |
|---|---|
| `switchRichMenu` | 1b |
| `listRichMenuAliases` | 2a |
| `createRichMenuAlias` | 2a |
| `deleteRichMenuAlias` | 2a |
| `listOAUsersWithRichMenus` | 2b |
| `linkRichMenuToUser` | 2b |
| `unlinkRichMenuFromUser` | 2b |
| `trackRichMenuClick` | 2c |
| `getRichMenuStats` | 2c |

---

## What is explicitly out of scope

- Time-based click filtering (last 7 / 30 days) in insights UI.
- Click analytics in the public Messaging API (`/api/oa/v2`).
- Rich menu impression tracking (only taps are tracked).
- `richmenuswitch` action support in Flex Messages or quick replies (LINE spec: rich menu only).
- Camera / camera roll / location quick reply actions (no native camera support in web).
