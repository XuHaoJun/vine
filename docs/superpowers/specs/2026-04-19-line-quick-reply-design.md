# LINE Quick Reply Design Spec

**Date:** 2026-04-19
**Status:** Draft - awaiting user review
**Scope:** v1 = web-only (`apps/web` running in a browser). C1 action set: `message`, `uri`, `postback`, `datetimepicker`, `clipboard`. Native parity, plus `camera` / `cameraRoll` / `location` actions, are explicit follow-up work.

## Overview

Add LINE-compatible Quick Reply support to Vine's chat. An OA can attach a `quickReply` field (up to 13 buttons) to any outbound message via the existing Messaging API endpoints; the user sees pill buttons above the input area and tapping one fires a per-action behavior (send a text, open a URL, deliver a postback event to the OA's webhook, pick a datetime, or copy text to clipboard).

This is a foundational feature: the postback dispatch path it introduces is reusable by future template / flex button taps and is the first step toward retiring the placeholder `showToast('Postback action')` in `useRichMenu`.

## Action Coverage (v1)

LINE Messaging API spec ([reference](https://developers.line.biz/en/docs/messaging-api/using-quick-reply/)) is the source of truth for the wire format. We ship the C1 subset:

| Action | v1 status | Why this slice |
|---|---|---|
| `message` | Supported | Reuses existing `sendMessage` (Zero mutation). Zero infra cost. |
| `uri` | Supported | Pure client (`Linking.openURL`). Zero infra cost. |
| `postback` | Supported | Introduces the postback dispatch path used by all future button taps. |
| `datetimepicker` | Supported | Native HTML `<input type="date|time|datetime-local">` on web, then dispatched as a postback with `params`. |
| `clipboard` | Supported | Pure client (`navigator.clipboard.writeText`). |
| `camera` / `cameraRoll` / `location` | **Out of v1** | Each requires a reverse user→OA media/location dispatch path that vine does not yet have. Tracked as follow-up. |
| `richmenuswitch` | **Forbidden** | LINE itself disallows it on quick reply. |

## Architecture

### 1. Shared schema — `packages/flex-schema/src/quickReply.ts`

Quick reply re-uses the action vocabulary already defined in `flex-schema`. Putting `QuickReplySchema` next to `FlexActionSchema` keeps action types in one package; the messaging plugin and any future template renderer import from here.

```ts
import * as v from 'valibot'
import {
  FlexMessageActionSchema,
  FlexURIActionSchema,
  FlexPostbackActionSchema,
  FlexDatetimePickerActionSchema,
  FlexClipboardActionSchema,
} from './action'

export const QuickReplyActionSchema = v.union([
  FlexMessageActionSchema,
  FlexURIActionSchema,
  FlexPostbackActionSchema,
  FlexDatetimePickerActionSchema,
  FlexClipboardActionSchema,
])

export const QuickReplyItemSchema = v.object({
  type: v.literal('action'),
  imageUrl: v.optional(v.pipe(v.string(), v.url())),
  action: QuickReplyActionSchema,
})

export const QuickReplySchema = v.object({
  items: v.pipe(
    v.array(QuickReplyItemSchema),
    v.minLength(1),
    v.maxLength(13), // LINE spec
  ),
})

export type QuickReply = v.InferInput<typeof QuickReplySchema>
export type QuickReplyItem = v.InferInput<typeof QuickReplyItemSchema>
export type QuickReplyAction = v.InferInput<typeof QuickReplyActionSchema>
```

Re-export from `packages/flex-schema/src/index.ts`.

**Action subset rationale:** v1 explicitly excludes `camera`, `cameraRoll`, `location` from the union so requests carrying them get rejected at the schema level with a clear path (`items.0.action`). Adding them later is an additive union change.

### 2. Server validation — `apps/server/src/plugins/oa-messaging.ts`

`validateMessage()` currently produces `metadata: string | null` per message type. Quick reply must work for **every** message type (text included), so we extract a single helper that the switch arms call uniformly:

```ts
function attachQuickReply(
  baseMetadata: object | null,
  rawQuickReply: unknown,
): { ok: true; metadata: string | null } | { ok: false; error: string } {
  if (rawQuickReply === undefined) {
    return { ok: true, metadata: baseMetadata ? JSON.stringify(baseMetadata) : null }
  }
  const result = v.safeParse(QuickReplySchema, rawQuickReply)
  if (!result.success) {
    const flat = v.flatten<typeof QuickReplySchema>(result.issues)
    return { ok: false, error: `Invalid quickReply: ${JSON.stringify(flat.nested)}` }
  }
  return {
    ok: true,
    metadata: JSON.stringify({ ...(baseMetadata ?? {}), quickReply: result.output }),
  }
}
```

Each `case` arm in the switch:
- `text`: was `metadata: null`, becomes `attachQuickReply(null, msg.quickReply).metadata`. When no `quickReply`, stays `null` — no DB shape change for messages without it.
- `flex`: `attachQuickReply(result.output, msg.quickReply)` — quickReply lives next to flex `contents`.
- `image` / `video` / `audio` / `sticker` / `location` / `template` (these are *message types*, not the `location` quick-reply *action* which is out of v1): `attachQuickReply(rest, msg.quickReply)` — quickReply lives next to the existing rest fields.

**Error envelope:** validation failure returns `{ message: <error>, code: 'INVALID_QUICK_REPLY' }` with HTTP 400 — same shape as the existing `INVALID_MESSAGE_TYPE` so the OA SDK keeps working.

### 3. Postback dispatch — `apps/server/src/services/oa.ts`

New event builder, sibling to `buildMessageEvent` / `buildFollowEvent`:

```ts
function buildPostbackEvent(input: {
  oaId: string
  userId: string
  replyToken: string
  data: string
  params?: { date?: string; time?: string; datetime?: string }
}) {
  return {
    destination: input.oaId,
    events: [{
      type: 'postback',
      mode: 'active' as const,
      timestamp: Date.now(),
      source: { type: 'user' as const, userId: input.userId },
      webhookEventId: randomUUID(),
      deliveryContext: { isRedelivery: false },
      replyToken: input.replyToken,
      postback: {
        data: input.data,
        ...(input.params ? { params: input.params } : {}),
      },
    }],
  }
}
```

Exposed from the service factory alongside the other `build*Event` functions.

### 4. Postback dispatch endpoint — `apps/server/src/plugins/oa-webhook.ts`

New route, parallel structure to the existing `/api/oa/internal/dispatch`:

```
POST /api/oa/internal/dispatch-postback
body: {
  oaId: string
  userId: string
  chatId: string
  data: string
  params?: { date?: string; time?: string; datetime?: string }
}
```

Steps:
1. `getOfficialAccount(oaId)` — 404 if absent.
2. `getWebhook(oaId)` — 400 if not configured or not `verified`.
3. `registerReplyToken({ oaId, userId, chatId, messageId: null })` — postback is not a message, so `messageId` is null.
4. `buildPostbackEvent({...})` → `JSON.stringify` → `generateWebhookSignature`.
5. `fetch(webhook.url, { headers: { 'x-line-signature': sig } })` with the same 10 s `AbortSignal.timeout` and `failed`-status update on non-2xx as the existing dispatch.

**No DB migration needed.** `oaReplyToken.messageId` (`packages/db/src/schema-oa.ts:180`) is already nullable (`text('messageId')` with no `.notNull()`); `registerReplyToken` just needs a signature change to accept `messageId: string | null`.

### 5. Client renderer — `apps/web/src/interface/message/QuickReplyBar.tsx`

```tsx
type QuickReplyBarProps = {
  items: QuickReplyItem[]
  onAction: (action: QuickReplyAction) => void
}
```

Layout: horizontal `ScrollView` (`horizontal showsHorizontalScrollIndicator={false}`) of pill buttons, white background, sits **directly above** `MessageInput`. Each button:
- Optional `imageUrl` icon (16×16) on the left
- Required `label` text from `action.label`
- Tap → calls `onAction(item.action)`

Reuses existing tamagui tokens for spacing / colors so it matches the chat aesthetic. No new design system primitives.

### 6. Wiring — `apps/web/app/(app)/home/(tabs)/talks/[chatId].tsx`

Three additions to the existing chat room page:

**a) Derived state — which message owns the current bar:**
```tsx
const [dismissedFor, setDismissedFor] = useState<string | null>(null)

const activeQuickReply = useMemo(() => {
  const latest = messages?.[messages.length - 1]
  if (!latest || latest.id === dismissedFor) return null
  if (latest.senderType !== 'oa') return null  // only OA messages can carry quickReply
  const meta = parseMetadata(latest.metadata)
  return (meta?.quickReply as QuickReply | undefined) ?? null
}, [messages, dismissedFor])

// New message arrives → reset dismissal so the next bar can render
useEffect(() => {
  setDismissedFor(null)
}, [messages?.length])
```

**b) Action handler:**
```tsx
const handleQuickReplyAction = useCallback((action: QuickReplyAction) => {
  const latestId = messages?.[messages.length - 1]?.id
  // Disappear rule (full LINE behavior, Q4 option A):
  // datetimepicker / clipboard keep the bar visible; everything else dismisses.
  const keepBar = action.type === 'datetimepicker' || action.type === 'clipboard'
  if (!keepBar && latestId) setDismissedFor(latestId)

  switch (action.type) {
    case 'message':
      sendMessage(action.text)
      break
    case 'uri':
      Linking.openURL(action.uri)
      break
    case 'postback':
      dispatchPostback({ oaId: otherMemberOaId!, chatId, data: action.data })
      if (action.displayText) sendMessage(action.displayText)
      break
    case 'datetimepicker':
      openDateTimePicker(action).then((params) => {
        if (!params) return  // user cancelled
        dispatchPostback({ oaId: otherMemberOaId!, chatId, data: action.data, params })
      })
      break
    case 'clipboard':
      navigator.clipboard.writeText(action.clipboardText)
        .then(() => showToast('已複製', { type: 'info' }))
        .catch(() => showToast('複製失敗', { type: 'error' }))
      break
  }
}, [messages, sendMessage, otherMemberOaId, chatId])
```

**c) Render slot:** between the `ScrollView` and the input row, when `activeQuickReply && inputMode !== 'richmenu'`:
```tsx
{activeQuickReply && inputMode !== 'richmenu' && (
  <QuickReplyBar items={activeQuickReply.items} onAction={handleQuickReplyAction} />
)}
```

### 7. datetimepicker on web — `apps/web/src/features/oa/openDateTimePicker.ts`

Returns `Promise<{ date?: string } | { time?: string } | { datetime?: string } | null>`.

Implementation: programmatically create a hidden `<input type="date|time|datetime-local">`, attach `change` and `cancel` listeners, `.click()` to open the native picker, resolve on `change`, resolve `null` on `cancel` / blur. No new dependency.

`min` / `max` / `initial` from the action are forwarded to the input attributes.

### 8. Postback client helper — `apps/web/src/features/oa/dispatchPostback.ts`

Thin `fetch` wrapper around `POST /api/oa/internal/dispatch-postback`. Mirrors the existing internal-dispatch usage pattern (raw fetch, not ConnectRPC, because this is server-internal infra not part of the public OA API surface).

```ts
export async function dispatchPostback(input: {
  oaId: string
  chatId: string
  data: string
  params?: { date?: string; time?: string; datetime?: string }
}): Promise<{ success: boolean; reason?: string }>
```

Errors are swallowed into `{ success: false, reason }` and the caller decides whether to surface a toast (currently we don't — postback is fire-and-forget, like real LINE).

## Data Flow per Action

| Action | Client side | Server side | OA-side outcome |
|---|---|---|---|
| `message` | `sendMessage(text)` (Zero mutation) | (none, Zero handles) | Message appears in chat history |
| `uri` | `Linking.openURL` | (none) | (none) |
| `postback` | `dispatchPostback({...})` | `buildPostbackEvent` → `fetch(webhook.url)` with `x-line-signature` | OA receives `type=postback` event with `data` |
| `datetimepicker` | native picker → `dispatchPostback({...params})` | same as postback | OA receives `type=postback` with `postback.params.{date|time|datetime}` |
| `clipboard` | `navigator.clipboard.writeText` | (none) | (none) |

## Disappear Rules (Q4 option A — full LINE behavior)

- **Tapping `message` / `uri` / `postback`**: bar dismisses immediately for that message (`setDismissedFor(latestId)`).
- **Tapping `datetimepicker` / `clipboard`**: bar stays visible (per LINE spec — these are repeatable / non-finalizing actions).
- **A new message arrives in the chat**: `useEffect` on `messages.length` resets `dismissedFor` to `null`, which means the bar dismisses for the *previous* latest message and may appear for the *new* latest message if it carries `quickReply`.
- **Page reload**: bar reappears (no persistence). LINE behaves the same.
- **OA messages only**: user-sent or system-sent messages with a stray `quickReply` field in metadata never render a bar (sender check in `activeQuickReply`).

## Error Handling

| Failure | Where | Surface |
|---|---|---|
| `quickReply` schema invalid | Server `validateMessage` | HTTP 400, `code: 'INVALID_QUICK_REPLY'`, `message` includes valibot path |
| Unsupported action type (e.g. `camera`) | Server `validateMessage` (rejected by `QuickReplyActionSchema` union) | Same 400 envelope as above |
| Postback dispatch — OA not found | `/dispatch-postback` | HTTP 404 to client; UI shows toast `OA 未找到` |
| Postback dispatch — webhook missing / unverified | `/dispatch-postback` | HTTP 400 to client; UI shows toast `OA webhook 未設定` |
| Postback dispatch — webhook 4xx/5xx | Server fetch | Mark `oaWebhook.status = 'failed'` (mirrors existing dispatch); client gets `{ success: false }`; UI no-op |
| datetimepicker cancelled | Client | No-op, bar stays |
| `clipboard.writeText` rejected | Client | Toast `複製失敗` |

## Tests

| File | Coverage |
|---|---|
| `packages/flex-schema/src/validation.test.ts` | `QuickReplySchema` accepts each of the 5 v1 actions; rejects `camera` / `cameraRoll` / `location` / `richmenuswitch`; rejects > 13 items; rejects empty items array. |
| `apps/server/src/plugins/oa-messaging.validate.test.ts` | `attachQuickReply` happy path on text / flex / image; missing `quickReply` keeps existing metadata shape unchanged; invalid `quickReply` returns `INVALID_QUICK_REPLY`. |
| `apps/server/src/plugins/oa-webhook.test.ts` (new file if absent) | `POST /api/oa/internal/dispatch-postback` happy path (verifies signature header, body shape, reply token registered with `messageId: null`); 404 on unknown OA; 400 on missing webhook. |
| `apps/server/src/services/oa.test.ts` | `buildPostbackEvent` snapshot — both with and without `params`. |

**No new e2e.** Quick reply UI requires a fixture OA that pushes messages with `quickReply` set; setting that up reliably in Playwright is disproportionate effort for v1. Manual test plan documented in the implementation plan instead.

## Out of Scope (explicit non-goals)

- `camera`, `cameraRoll`, `location` actions — each requires a user → OA reverse media / location dispatch path that vine doesn't have. Separate spec when needed.
- `richmenuswitch` — LINE forbids it on quick reply; we follow.
- Persisting "dismissed" state across page reload — LINE itself doesn't persist either.
- Auto-dispatching every user text message to the OA webhook — orthogonal limitation in vine; tracked separately.
- Postback delivery retries, dead-letter queue, redelivery — matches existing dispatch behavior (single attempt, 10 s timeout, mark failed).
- Mention substitution in `text` (text v2) — separate message type; out of this spec.
- Native (iOS / Android) parity — `Linking`, `Clipboard`, native date pickers behave differently. Web-only v1.

## Future Work

1. **camera / cameraRoll / location actions** — need a user→OA media+location dispatch endpoint, plus client image upload reuse from the media-messages spec, plus geolocation permission UX.
2. **Native parity** — replace `<input type="date">` with `@react-native-community/datetimepicker`, and `navigator.clipboard` with `Clipboard.setStringAsync` from `expo-clipboard`.
3. **Reuse postback dispatch from rich menu / flex buttons** — replace the existing `showToast('Postback action')` placeholders in `useRichMenu.ts` and any future flex `button.action.type === 'postback'` handler.
4. **Postback delivery reliability** — retries with backoff, dead-letter inspection in the OA dashboard.
