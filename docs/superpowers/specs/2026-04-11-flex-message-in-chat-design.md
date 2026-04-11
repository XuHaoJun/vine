# Flex Message Rendering in Chat — Design

**Date:** 2026-04-11  
**Branch:** `line-flex`  
**Status:** Approved

---

## Overview

Abstract flex message rendering into a stable, reusable `MessageBubbleFactory` component so it can be used in chat views and future contexts (e.g. developers/console OA auto-reply). The factory is purely for rendering message **content** — no avatar, no time label, no bubble wrapper.

Future message types (image, sticker, video, etc.) can be added without modifying the factory's callers.

---

## Architecture

### 1. `MessageBubbleFactory` (`~/interface/message/MessageBubbleFactory.tsx`)

**Responsibility:** Given `type` + content data, render the appropriate bubble content.

**Props:**
```typescript
type MessageBubbleFactoryProps = {
  type: 'text' | 'flex' | string   // extensible
  text?: string                     // for text messages
  metadata?: string                 // JSON string — for flex messages
}
```

**Behavior:**
- `type === 'text'`: renders `<TextBubble text={text} />`
- `type === 'flex'`: parses `metadata` as JSON, renders `<LfBubble>` or `<LfCarousel>` accordingly
- Unknown type: renders a fallback placeholder

**TextBubble** (`~/interface/message/TextBubble.tsx`) — a simple text bubble component:
```typescript
type TextBubbleProps = {
  text: string
  isMine: boolean
}
// Renders a styled text bubble matching existing MessageBubble appearance
```

**Directory structure:**
```
~/interface/message/
  MessageBubbleFactory.tsx   // factory component
  TextBubble.tsx            // text bubble sub-component
```

---

## 2. Chat View Update (`/(app)/home/(tabs)/talks/[chatId].tsx`)

The chat room currently uses `MessageBubble` which only renders text. This needs to be updated to:

1. Dispatch on `msg.type` using `MessageBubbleFactory`
2. Show `LfBubble` / `LfCarousel` for flex messages
3. Show sender's OA avatar + name for `senderType === 'oa'` messages

**Changes:**
- Replace the `{text}` interpolation with `<MessageBubbleFactory type={msg.type} text={msg.text} metadata={msg.metadata} />`
- Extract `senderType` and `oaId` from the message
- For `senderType === 'oa'`: show OA avatar (using initial letter) and OA name above the bubble

**OA Avatar rendering** (in chat view, not in factory):
- If `senderType === 'oa'`: show a colored circle avatar with OA name initial
- The OA name comes from the `officialAccount` lookup via `otherMember.oaId`

---

## Data Flow

```
message (from Zero):
{
  id, chatId, senderId, senderType: 'user' | 'oa',
  type: 'text' | 'flex',
  text?: string,          // for type='text'
  metadata?: string,      // JSON string, for type='flex'
  oaId?: string,          // present when senderType='oa'
  createdAt
}

ChatRoomPage:
  messages[] → for each msg:
    - Is mine? → determine isMine
    - senderType='oa'? → show OA avatar + name above bubble
    - type='text'? → <MessageBubbleFactory type='text' text={msg.text} />
    - type='flex'? → <MessageBubbleFactory type='flex' metadata={msg.metadata} />
    - bubble wrapper (time, avatar, name) handled by ChatRoomPage caller
```

---

## Key Principles

1. **Single responsibility**: `MessageBubbleFactory` only renders content based on type. It knows nothing about avatars, time labels, or bubble wrappers.
2. **Extensible without modification**: Adding a new type (e.g. `image`) only requires adding a new branch in the factory — no caller changes needed.
3. **Separation of concerns**: Chat view handles bubble framing (avatar, name, time). Factory handles content rendering.
4. **No business logic in factory**: The factory is a pure UI component — it receives data and renders.

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `~/interface/message/MessageBubbleFactory.tsx` | Create | Type-dispatching factory |
| `~/interface/message/TextBubble.tsx` | Create | Text bubble content component |
| `apps/web/app/(app)/home/(tabs)/talks/[chatId].tsx` | Modify | Use factory, support flex + OA sender |

---

## Edge Cases

- `type === 'flex'` but `metadata` is invalid JSON → render error placeholder inside bubble
- `type` is unknown → render a "unsupported message type" placeholder
- `senderType === 'oa'` but `oaId` is missing → show "官方帳號" as name fallback
