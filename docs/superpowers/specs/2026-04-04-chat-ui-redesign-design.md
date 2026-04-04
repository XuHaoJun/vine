# Chat UI Redesign — Design Spec

**Date:** 2026-04-04
**Reference:** `docs/line-ui-reference/chat.html`

---

## Goal

Redesign the `ChatRoomPage` UI to match the LINE-style reference. Pure UI change — data layer (Zero hooks, mutations, schema) is unchanged.

---

## Design Decisions

| Element | Decision |
|---------|----------|
| Background | Solid `#84A1C4` (no gradient, no wallpaper) |
| Bubble tails | None — cut-corner radius (iMessage style) |
| Sender info | Avatar + name shown above bubble (LINE style) |
| Timestamp | Outside bubble, bottom-aligned with bubble |
| Input bar | LINE full icon set (+, camera, photo, text+emoji, mic/send) |
| Header | Keep existing: avatar + name + menu icon |
| Emoji reactions | Out of scope |

---

## Files to Change

### 1. `apps/web/src/features/chat/ui/MessageBubble.tsx`

**Received message layout (他人):**

```
XStack gap="$2.5"                          ← outer row
  View (avatar, size=38, mt=4, rounded)    ← top-left, no bottom-align
  YStack                                   ← content column
    Text sender name (fontSize=12)
    XStack alignItems="flex-end" gap="$1.5"
      View bubble (white, br=18, brTopLeft=4)
      Text timestamp (fontSize=10, outside bubble, right of bubble)
```

**Sent message layout (自己):**

```
XStack justifyContent="flex-end"           ← outer row
  YStack alignItems="flex-end"
    XStack alignItems="flex-end" gap="$1.5"
      Text timestamp (fontSize=10, LEFT of bubble)
      View bubble (#8be872, br=18, brBottomRight=4)
```

**Bubble colors:**
- Others: `backgroundColor="white"`, text `color="$gray800"`
- Self: `backgroundColor="#8be872"`, text `color="$gray900"`

**Avatar:**
- Size 38×38, `borderRadius={999}`, `marginTop={4}`, `flexShrink={0}`
- Display first letter of sender name as fallback (no real avatar image for now)
- Background color: pick from a fixed palette by member index (e.g. `['#7a9cbf','#c4aed0','#a0c4a0','#e0b98a']`), consistent per user within the session

---

### 2. `apps/web/src/features/chat/ui/MessageInput.tsx`

**New layout (left to right):**

```
XStack alignItems="center" gap="$2" bg="white" px="$3" py="$2"
  PlusButton (circle, bg=$gray100, size=30)
  CameraIcon (decorative, size=22, color=$gray600)
  PhotoIcon (decorative, size=22, color=$gray600)
  XStack flex=1 relative               ← text input wrapper
    Input (bg=$gray100, borderRadius=20, pl=$3, pr=$9, placeholder="Aa")
    EmojiIcon (absolute right, size=18, decorative)
  MicIcon OR SendButton                ← conditional
```

**Send logic:**
- When input is empty: show mic icon (decorative, `color=$gray600`)
- When input has text: swap mic for green circle send button (`backgroundColor="#8be872"`, arrow icon)
- Send on button press or `onSubmitEditing`

---

### 3. `apps/web/app/(app)/home/(tabs)/talks/[chatId].tsx`

- Set `backgroundColor="#84A1C4"` on the root `YStack`
- Insert `<DateSeparator label="今天" />` before the message list (hardcoded for now; dynamic date grouping is out of scope)

---

### 4. `apps/web/src/features/chat/ui/DateSeparator.tsx` *(new file)*

```tsx
// Props: label: string
// Layout:
XStack justifyContent="center" marginVertical="$2"
  Text
    fontSize={11}
    color="white"
    backgroundColor="rgba(0,0,0,0.18)"
    paddingHorizontal="$3"
    paddingVertical={3}
    borderRadius={99}
```

---

## Out of Scope

- Emoji reaction system (schema changes needed, deferred)
- Functional camera / photo / mic buttons
- Dynamic date grouping (multiple date separators per conversation)
- Header redesign (keeping existing avatar + name + menu)
- Read receipt ("已讀") indicator changes

---

## Not Changing

- `useMessages.ts` — Zero query hooks
- `useChats.ts` — chat list hooks
- Zero schema / mutations
- `TalksPage` (chat list)
- `TalksHeader`
- `ChatListItem`, `FriendListItem`
