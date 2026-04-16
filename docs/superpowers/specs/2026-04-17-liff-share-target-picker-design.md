# LIFF shareTargetPicker Design

## Goal

Implement `liff.shareTargetPicker()` end-to-end: SDK method → postMessage bridge → full-screen picker UI → Zero-powered friend/chat selection → message sending via Zero mutation.

## Architecture

**Option B: Picker lives in the outer page, not inside LiffBrowser.**

- `LiffBrowser` stays a pure UI container (iframe/WebView), only forwards messages via `onMessage` callback
- The outer page (`/liff/[liffId].tsx`) owns picker state, has Zero client access, and renders the picker overlay
- Picker overlay is a full-screen modal covering the iframe/WebView

## Message Flow

```
Third-party LIFF app (inside iframe/WebView)
  → liff.shareTargetPicker([{ type: 'text', text: 'Hello' }], { isMultiple: true })
  → window.parent.postMessage({ type: 'liff:shareTargetPicker', messages, options })

LiffBrowser.tsx
  → receives message, calls onMessage callback

Outer page (/liff/[liffId].tsx)
  → onMessage sees 'liff:shareTargetPicker', sets showPicker=true, stores pending messages
  → renders <ShareTargetPickerOverlay messages={...} onConfirm={...} onCancel={...} />

ShareTargetPickerOverlay
  → uses useShareTargets() hook (Zero queries: friendsByUserId, chatsByUserId)
  → displays collapsible sections: Friends, Chats (direct only, skip groups)
  → user selects target(s), clicks "Share"
  → calls onConfirm(selectedTargets)

Outer page onConfirm handler
  → for each selected target (chatId), calls zero.mutate.message.send()
  → sends iframe.contentWindow.postMessage({ type: 'liff:shareTargetPicker:done', status: 'sent' })
  → closes picker

Third-party LIFF app
  → Promise resolves with { status: 'sent' }
```

## File Changes

| File | Action | Purpose |
|------|--------|---------|
| `packages/liff/src/liff.ts` | Modify | Add `shareTargetPicker()` method |
| `apps/web/src/interface/liff/LiffBrowser.tsx` | Modify | Add `onShareTargetPicker` callback prop |
| `apps/web/src/interface/liff/LiffBrowser.native.tsx` | Modify | Add `onShareTargetPicker` callback prop |
| `apps/web/src/features/liff/useShareTargets.ts` | Create | Zero query hook for friends + direct chats |
| `apps/web/src/features/liff/ShareTargetPicker.tsx` | Create | Full-screen picker overlay UI |
| `apps/web/app/liff/[liffId].tsx` | Modify | Integrate picker state + message sending |

## Data Model

### Share Target Types

```ts
type ShareTarget =
  | { type: 'friend'; userId: string; name: string; image: string | null; chatId?: string }
  | { type: 'chat'; chatId: string; name: string; image: string | null; lastMessageText?: string }
```

### Zero Queries Used

- `friendsByUserId({ userId })` → accepted friendships with requester/addressee user data
- `chatsByUserId({ userId })` → chats with members, filter to `type === 'direct'`

### Message Sending

Uses existing `zero.mutate.message.send()`:
```ts
zero.mutate.message.send({
  id: crypto.randomUUID(),
  chatId: targetChatId,
  senderId: userId,
  senderType: 'user',
  type: 'text',
  text: message.text,
  createdAt: Date.now(),
})
```

## UI Design

Full-screen overlay matching LINE's share target picker:
- Top: search bar (optional, can use existing `usersByUsername` query)
- Collapsible sections: "Friends" (好友), "Chats" (聊天)
- Each item: avatar + name + radio button (single select) or checkbox (multi-select when `isMultiple: true`)
- Bottom: green "Share" button (disabled until selection made)
- Close button (X) in top-left corner

## Error Handling

- If not logged in: reject with `{ status: 'error', error: 'Not logged in' }`
- If message send fails: reject with `{ status: 'error', error: 'Failed to send' }`
- If user cancels: resolve with `false` (matching LINE SDK behavior)

## Scope

- Text messages only (matching existing `message.send` mutation)
- Direct chats only (skip group chats — chat model has no name field)
- Single or multi-select (`isMultiple` option)
- No search bar in v1 (can add later with `usersByUsername` query)
