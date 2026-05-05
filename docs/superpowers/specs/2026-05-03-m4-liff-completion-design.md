# Milestone 4: LIFF Completion

**Date:** 2026-05-03  
**Status:** Ready for review  
**Scope:** Complete Vine's existing LIFF runtime so mini apps can run a real LINE-like happy path.

---

## Context

Vine already has a LIFF foundation:

- `loginChannel` and `oaLiffApp` database tables.
- Login Channel and LIFF App ConnectRPC CRUD.
- Developer console screens for listing, creating, and deleting LIFF apps.
- Public LIFF metadata endpoint: `GET /api/liff/v1/apps/:liffId`.
- `@vine/liff` SDK with `init`, `ready`, `getContext`, `getProfile`,
  `getFriendship`, `sendMessages`, `shareTargetPicker`, `closeWindow`,
  `isApiAvailable`, and `permanentLink.createUrlBy`.
- Web iframe and native WebView `LiffBrowser` containers.
- `/liff/[liffId]` route and `shareTargetPicker` integration coverage.

M4 is therefore not a new LIFF implementation. It is a completion pass that
connects the missing runtime behavior, tightens LINE-like validation, and
adds integration coverage for the APIs a mini app developer expects to use.

Vine remains a self-hosted LINE clone. This work must not call official LINE
cloud APIs, require LINE Developers Console channel IDs, or depend on
`api.line.me`.

---

## Goals

1. Make `@vine/liff` usable for a third-party mini app running inside Vine.
2. Support `getProfile`, `sendMessages`, `shareTargetPicker`, permanent links,
   and `closeWindow` as an end-to-end runtime path.
3. Match LINE LIFF message limits where they make sense for Vine.
4. Reuse Vine's existing message renderers and validation instead of creating a
   second message model.
5. Keep unsupported LINE surfaces explicit rather than silently accepting data
   that Vine cannot render.

---

## Non-Goals

- External LINE LIFF compatibility guarantees.
- Calling LINE-hosted APIs or validating official LINE tokens.
- Public mini app marketplace, app review, payments, or shortcuts.
- Template message rendering. Vine intentionally prefers Flex Messages and
  treats template messages as unsupported in chat UI.
- LIFF `sendMessages` / `shareTargetPicker` support for imagemap. LINE LIFF
  docs do not list imagemap for these methods even though Vine supports
  imagemap elsewhere.
- Full `LiffError` parity for every official LINE error code. M4 should return
  useful, stable errors for the supported APIs.

---

## Runtime Completion

### 0. Host API Origin / SDK Bootstrap

M4 must support real third-party LIFF endpoints, not only same-origin test
fixtures. A LIFF app hosted at `https://app.example.com` still needs to call
Vine-owned APIs such as `/api/liff/v1/apps/:liffId` and `/api/liff/v1/me`.

The LIFF host injects a small bootstrap object before the app initializes:

```ts
window.VineLIFF = {
  apiBaseUrl: "https://vine.example.com",
  liffId: "1234567890-abcd",
  endpointOrigin: "https://app.example.com",
  chatId: "chat-id-or-undefined",
  contextType: "utou", // "utou" | "group" | "external"
  lineVersion: "14.0.0",
}
```

`@vine/liff` reads `window.VineLIFF.apiBaseUrl` and uses it for Vine API calls.
If the bootstrap object is absent, the SDK falls back to `window.location.origin`
for existing same-origin fixtures and external-browser behavior.

The host validates all child `postMessage` events against the configured
endpoint origin. Messages from other origins are ignored. Native WebView
handlers apply the same logical check against the configured endpoint URL before
acting on `liff:*` messages.

### 1. Profile Endpoint

Add `GET /api/liff/v1/me`.

The endpoint authenticates the current Vine user using the same Vine auth/session
mechanism used by the app. It returns the LIFF profile shape used by the SDK:

```json
{
  "userId": "user-id",
  "displayName": "Noah",
  "pictureUrl": "https://...",
  "statusMessage": null
}
```

`displayName` comes from `userPublic.name` with a username fallback. `pictureUrl`
comes from `userPublic.image`. `statusMessage` is `null` unless Vine later adds a
public status field.

`@vine/liff.getProfile()` should work against this route. The client should not
send decoded profile fields back to the server.

### 2. Permanent Link Path Handling

Support permanent-link-style LIFF URLs:

```text
/liff/{liffId}/foo?x=1#bar
```

When the route opens the LIFF app, it resolves the endpoint URL from
`/api/liff/v1/apps/:liffId`, then appends the extra LIFF path, query, and fragment to
the endpoint URL:

```text
endpointUrl = https://app.example.com/base
opened URL  = https://app.example.com/base/foo?x=1#bar
```

If no extra path is present, existing `/liff/{liffId}` behavior remains unchanged.
This is Vine's self-hosted equivalent of LINE permanent links; the host stays
under Vine's `/liff/{liffId}` namespace.

### 3. Chat Context For `sendMessages`

`liff.sendMessages()` sends to the chat room where the LIFF app was opened.
Vine must therefore know the source chat. M4 requires a chat-launched LIFF context:

- The LIFF host route accepts a Vine-owned launch token when a LIFF app is
  opened from a chat.
- The launch token is short-lived and resolves server-side to `{ liffId, chatId,
  userId }`.
- `LiffBrowser` exposes this context to the SDK via `window.VineLIFF`.
- `liff.getContext()` returns `type: "utou" | "group"` when a valid chat context
  exists, and `type: "external"` otherwise.
- `sendMessages` is available only when the host has a valid `chatId`, the user
  is a member of that chat, and the LIFF app has `chat_message.write` in its
  configured scopes.

If any condition is missing, `sendMessages` rejects. It must not send to a
guessed chat.

### 4. Launch Context

M4 defines three launch modes:

| Launch mode | Source | `getContext().type` | `sendMessages` |
| --- | --- | --- | --- |
| Chat launch | Vine opens `/liff/{liffId}` with a valid short-lived launch token from a direct or OA chat. | `utou` | Enabled |
| Group launch | Vine opens `/liff/{liffId}` with a valid short-lived launch token from a group chat. | `group` | Enabled |
| External launch | Developer preview, copied LIFF URL, permanent link without launch token, or any non-chat entry point. | `external` | Rejected with a stable permission error |

`sendMessages` is enabled only for chat and group launches. External launches can
still use `init`, `getProfile`, `getContext`, `shareTargetPicker`, permanent
links, and `closeWindow`, but `sendMessages` rejects with a stable permission
error.

---

## Message Validation

M4 should introduce a shared LIFF message validator used by both
`sendMessages` and `shareTargetPicker`. It should reuse Vine's existing
Messaging API validation where possible, then apply LIFF-specific restrictions.

### Shared Rules

- `messages` is required.
- Max 5 messages.
- Reject unknown message types.
- Reject `quickReply` on LIFF-originated messages.
- Reject `quoteToken`.
- Reject `text.emojis`.
- Reject `video.trackingId`.
- Preserve metadata in the same shape expected by `MessageBubbleFactory`.
- Use caller-generated IDs and timestamps for Zero mutations.

### `sendMessages` Matrix

| Type | Support | Notes |
| --- | --- | --- |
| `text` | Yes | Store `text`; reject `emojis` and `quoteToken`. |
| `sticker` | Yes | Store `packageId` and numeric `stickerId` in metadata. Require entitlement for Vine marketplace stickers. Allow only public/system sticker package IDs without entitlement. |
| `image` | Yes | Store `originalContentUrl` / `previewImageUrl` metadata. URLs must be HTTPS. |
| `video` | Yes | Store `originalContentUrl` / `previewImageUrl`; reject `trackingId`. URLs must be HTTPS. |
| `audio` | Yes | Store `originalContentUrl` and optional `duration`. URL must be HTTPS. |
| `location` | Yes | Store `title`, `address`, `latitude`, `longitude`; render through existing `LocationBubble`. |
| `flex` | Yes | Validate with Flex schema plus LIFF URI-only action restriction. |
| `template` | No | Vine does not render template messages. Use Flex. |
| `imagemap` | No | Not listed in LINE LIFF `sendMessages` support. |

### `shareTargetPicker` Matrix

| Type | Support | Notes |
| --- | --- | --- |
| `text` | Yes | Same restrictions as `sendMessages`. |
| `image` | Yes | Same media metadata as `sendMessages`. |
| `video` | Yes | Same media metadata as `sendMessages`; reject `trackingId`. |
| `audio` | Yes | Same media metadata as `sendMessages`. |
| `location` | Yes | Same location metadata as `sendMessages`. |
| `flex` | Yes | URI-only actions. |
| `sticker` | No | LINE LIFF `shareTargetPicker` docs do not list sticker. |
| `template` | No | Vine does not render template messages. |
| `imagemap` | No | Not listed in LINE LIFF `shareTargetPicker` support. |

### Flex URI-Only Restriction

LINE LIFF allows Flex Messages for `sendMessages` and `shareTargetPicker`, but
only URI actions are allowed. M4 should add a traversal helper that walks every
Flex action field and rejects any action whose `type` is not `uri`.

The helper should cover action fields on bubbles, boxes, buttons, images, text,
icons, and videos according to Vine's existing `@vine/flex-schema` model. This
helper should be scoped to LIFF validation only; regular OA Messaging API Flex
validation keeps its broader action support.

---

## Host Behavior

### `liff:sendMessages`

`@vine/liff.sendMessages()` already posts `liff:sendMessages` to the parent. M4
adds host handlers in web and native `LiffBrowser`:

1. Receive `{ type: "liff:sendMessages", messages }`.
2. Validate the message origin against the LIFF app endpoint origin.
3. Validate LIFF context and `chat_message.write`.
4. Validate the message array with the `sendMessages` matrix.
5. Insert each message into Zero with `senderType: "user"` and the current user's
   ID.
6. Update chat ordering through the existing Zero `message.send` mutator.
7. Post a success or failure result back to the child frame/WebView.

The SDK should resolve `sendMessages()` only after the host confirms insertion.

### `liff:shareTargetPicker`

`ShareTargetPicker` currently sends only text messages. M4 should update it to
use the same LIFF message conversion path as `sendMessages`, with the
`shareTargetPicker` matrix. When a target is selected, each supported message is
inserted into the selected chat or newly created direct chat.

The host validates the `liff:shareTargetPicker` message origin before opening the
picker. Invalid origins are ignored.

The picker result remains LINE-like:

- `{ status: "sent" }` on successful send.
- `false` when the picker is canceled.
- Reject only for validation or runtime errors before the user completes sending.

### `liff:closeWindow`

Existing close handling should be covered by integration tests. On web, closing
can navigate back or dismiss the LIFF shell. On native, it should close the
WebView surface according to existing navigation conventions.

The host validates the `liff:closeWindow` message origin before closing the LIFF
surface.

---

## Developer Console

Keep console work narrow:

- Show the LIFF URL for each app.
- Show/copy a permanent-link base URL.
- Add an "Open" or "Preview" action that opens `/liff/{liffId}`.
- Keep full gallery, marketplace, approval, analytics, and payment settings out
  of M4.

---

## Testing

### Unit Tests

- LIFF message validator:
  - accepts valid supported message types for each method.
  - rejects more than 5 messages.
  - rejects `quickReply`, `quoteToken`, `text.emojis`, `video.trackingId`.
  - rejects template and imagemap.
  - rejects sticker for `shareTargetPicker`.
  - rejects non-URI Flex actions in LIFF mode.
- `/api/liff/v1/me` route:
  - returns current user's profile.
  - rejects unauthenticated requests.
- SDK bootstrap:
  - external endpoint apps call Vine APIs through `window.VineLIFF.apiBaseUrl`.
  - same-origin fixtures continue to work without bootstrap.
  - host ignores `liff:*` messages from non-endpoint origins.
- Permanent-link resolver:
  - preserves bare `/liff/{liffId}` behavior.
  - appends path, query, and hash to endpoint URL.
- Launch context:
  - valid short-lived launch token resolves to chat or group context.
  - missing or invalid launch context produces `external` context.
  - `sendMessages` rejects in external context with a stable permission error.

### Integration Tests

Expand the LIFF fixture to cover:

1. `liff.init()`.
2. `liff.getContext()`.
3. `liff.getProfile()`.
4. `liff.sendMessages()` with text, media, location, sticker, and Flex URI action.
5. `liff.shareTargetPicker()` with text, media, location, and Flex URI action.
6. `liff.closeWindow()`.
7. invalid cases: too many messages, template, imagemap, and non-URI Flex action.

---

## Acceptance Criteria

- A registered LIFF app can open through `/liff/{liffId}` and
  `/liff/{liffId}/path?query#hash`.
- A third-party LIFF app hosted outside Vine can call `init`, `getProfile`, and
  host-mediated APIs through the injected Vine API base URL.
- `liff.getProfile()` returns the current Vine user's LIFF profile.
- `liff.getContext()` distinguishes chat-launched and external launches.
- External launches can use `getProfile` and `shareTargetPicker`; `sendMessages`
  rejects with a stable permission error.
- `liff.sendMessages()` sends supported message types to the source chat and
  rejects unsupported or invalid payloads.
- `liff.shareTargetPicker()` shares supported message types to selected targets
  and rejects unsupported or invalid payloads.
- The LIFF host ignores `liff:*` postMessages from origins other than the
  configured endpoint origin.
- Template and imagemap are explicitly rejected for LIFF send/share APIs.
- Existing OA Messaging API behavior is unchanged.
- M4 tests pass without relying on official LINE APIs.
