# Flex Simulator "Send..." Feature Design

**Date:** 2026-04-11  
**Branch:** `line-flex`  
**Status:** Approved

---

## Overview

Add a **"Send..." button** to the Flex Message Simulator (`/developers/flex-simulator`) that lets the currently logged-in user send the current flex JSON as an OA message to themselves via the **"Flex Message sim"** Official Account.

The feature mirrors LINE's Flex Message Simulator "Send Message" dialog, adapted for the vine platform's own OA infrastructure.

---

## Section 1: Architecture & Data Flow

### Shared Constant

New file `packages/db/src/constants.ts`:

```ts
export const FLEX_SIMULATOR_OA_UNIQUE_ID = 'flexmessagesim'
```

Both the seed and server handler import this constant. No environment variable needed — this is a well-known system identifier analogous to `"credential"` (auth provider) or `"oa"` (chat type).

### Seed Additions (`packages/db/src/seed/ensureSeed.ts`)

When `NODE_ENV=development` and `VITE_DEMO_MODE=1`:

1. Insert `oaProvider` — `{ name: "Vine Developers" }`
2. Insert `officialAccount` — `{ name: "Flex Message sim", uniqueId: "flexmessagesim", description: "Send Flex Messages to yourself for testing", status: "active" }`

No `oaFriendship` is pre-seeded — users must add the OA as a friend manually.

### Proto Additions (`packages/proto/proto/oa/v1/oa.proto`)

Two new RPCs added to the OA service:

```protobuf
// Fetch a single OA by its public uniqueId (handle)
rpc ResolveOfficialAccount(ResolveOfficialAccountRequest)
    returns (ResolveOfficialAccountResponse);

// Send the current flex JSON as a message from the Flex Sim OA to the caller
rpc SimulatorSendFlexMessage(SimulatorSendFlexMessageRequest)
    returns (SimulatorSendFlexMessageResponse);

message ResolveOfficialAccountRequest {
  string unique_id = 1;
}

message ResolveOfficialAccountResponse {
  OfficialAccountSummary account = 1;
}

message SimulatorSendFlexMessageRequest {
  string flex_json = 1;
}

message SimulatorSendFlexMessageResponse {}
```

### Server Handler (`apps/server/src/connect/oa.ts`)

**`resolveOfficialAccount`:**
1. Query `officialAccount` where `uniqueId = req.uniqueId`
2. Not found → throw `ConnectError(Code.NotFound)`
3. Return `OfficialAccountSummary`

**`simulatorSendFlexMessage`:**
1. Get authenticated user from ctx (Better Auth session)
2. Look up Flex Sim OA via `FLEX_SIMULATOR_OA_UNIQUE_ID`
3. Query `oaFriendship` for `(userId, oaId)` — not found → throw `ConnectError(Code.FailedPrecondition, "Not a friend of Flex Message sim OA")`
4. Parse and validate `req.flexJson` as valid JSON
5. Find or create an OA chat: query `chat` where `type='oa'` with members `(userId, oaId)`; if none exists, insert `chat` + two `chatMember` rows (idempotent)
6. Insert message: `{ type: 'flex', senderType: 'oa', oaId: flexSimOA.id, metadata: req.flexJson }`
7. Return `{}`

---

## Section 2: Header Context & Layout

### `FlexSimulatorHeaderContext.tsx`

Extend existing context type to add `sendHandler` alongside the existing `resetHandler`:

```ts
type FlexSimulatorHeaderContextType = {
  resetHandler: (() => void) | null
  setResetHandler: (fn: (() => void) | null) => void
  sendHandler: (() => void) | null        // new
  setSendHandler: (fn: (() => void) | null) => void  // new
}
```

### `_layout.tsx`

Add "Send..." button immediately after the Reset button in the header:

```tsx
<Button size="$2" onPress={() => resetHandler?.()} disabled={!resetHandler}>
  Reset
</Button>
<Button size="$2" onPress={() => sendHandler?.()} disabled={!sendHandler}>
  Send...
</Button>
```

### `index.tsx`

- Register `sendHandler` via `setSendHandler` in `useEffect` (same pattern as `resetHandler`)
- Handler calls `setDialogOpen(true)`
- Manages `dialogOpen: boolean` state
- Renders `<FlexSimulatorSendDialog>` and `<OADetailSheet>` (from `useOADetailSheet()`)
- Passes `openDetail` into the dialog as a prop

---

## Section 3: Dialog Component

New file: `apps/web/app/(app)/developers/flex-simulator/FlexSimulatorSendDialog.tsx`

### Props

```ts
type FlexSimulatorSendDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  flexJson: string
  openOADetail: (oa: OADetailData) => void
}
```

### Data Fetching

```ts
// Fetch Flex Sim OA info
const { data: oaData } = useConnectQuery(resolveOfficialAccount, {
  uniqueId: FLEX_SIMULATOR_OA_UNIQUE_ID,
})

// Check friendship status (re-fetched after addOAFriend)
const { data: isFriendData, refetch: refetchFriend } = useConnectQuery(isOAFriend, {
  oaId: oaData?.account?.id,
})

// Send mutation
const { mutate: sendFlexMessage, isPending } = useConnectMutation(simulatorSendFlexMessage)

// Add friend mutation
const { mutate: addFriend, isPending: isAddingFriend } = useConnectMutation(addOAFriend)
```

### Layout

```
┌─ Send Message ────────────────────────────┐
│                                            │
│  Destination:                              │
│   ◉  [avatar]  username                   │  ← current user, pre-selected (visual only)
│                                            │
│  ────────────────────────────────────────  │
│                                            │
│   [oa avatar]  Flex Message sim            │
│   [查看官方帳號]  [加入好友 | 已加好友]     │
│                                            │
│                      [Cancel]  [Send]      │
└────────────────────────────────────────────┘
```

### Behaviour

| Action | Result |
|--------|--------|
| 「查看官方帳號」 | Calls `openOADetail(oaData.account)` → opens `OADetailSheet` |
| 「加入好友」（未加） | Calls `addOAFriend({ oaId })`, on success calls `refetchFriend()`, button becomes 「已加好友」 |
| Send（任何狀態） | Calls `simulatorSendFlexMessage({ flexJson })` |
| Send → `FailedPrecondition` error | `showError(error, '請先加入 Flex Message sim 為好友')` |
| Send → success | Dialog closes + `showToast('已送出', { type: 'success' })` |
| Send in-flight | Send button disabled + loading indicator |

---

## Out of Scope

- QR code scanning (placeholder toast already exists; not part of this feature)
- "Register destination" (not needed — only current user is shown)
- Sending to other users (only self-send via OA is supported)
- Seeding `oaFriendship` (user adds OA as friend manually)

---

## Files Affected

| File | Change |
|------|--------|
| `packages/db/src/constants.ts` | New — `FLEX_SIMULATOR_OA_UNIQUE_ID` constant |
| `packages/db/src/seed/ensureSeed.ts` | Add `oaProvider` + `officialAccount` seed records |
| `packages/proto/proto/oa/v1/oa.proto` | Add `ResolveOfficialAccount` + `SimulatorSendFlexMessage` RPCs |
| `apps/server/src/connect/oa.ts` | Implement both new RPC handlers |
| `apps/web/app/(app)/developers/flex-simulator/FlexSimulatorHeaderContext.tsx` | Add `sendHandler` / `setSendHandler` |
| `apps/web/app/(app)/developers/flex-simulator/_layout.tsx` | Add "Send..." button |
| `apps/web/app/(app)/developers/flex-simulator/index.tsx` | Register `sendHandler`, manage dialog state, render dialog + OADetailSheet |
| `apps/web/app/(app)/developers/flex-simulator/FlexSimulatorSendDialog.tsx` | New dialog component |
