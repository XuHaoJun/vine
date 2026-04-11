# Flex Message in Chat — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a reusable `MessageBubbleFactory` component that dispatches on message type to render bubble content. Add flex message support in the chat room view. This enables future message types to be added without modifying callers.

**Architecture:** `MessageBubbleFactory` (`~/interface/message/`) is a pure content renderer — input `type` + content data, output the bubble content for that type. It knows nothing about avatars, time labels, or bubble wrappers. The chat view handles bubble framing (avatar, name, time). Factory handles content rendering. Extensible via factory pattern — adding a new type requires only adding a new branch in the factory.

**Tech Stack:** Tamagui, `@vine/line-flex` (`LfBubble`, `LfCarousel`), React

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `~/interface/message/TextBubble.tsx` | Create | Text bubble content component (pure UI) |
| `~/interface/message/MessageBubbleFactory.tsx` | Create | Type-dispatching factory component |
| `apps/web/app/(app)/home/(tabs)/talks/[chatId].tsx` | Modify | Use factory, support flex + OA sender |

---

## Task 1: Create `TextBubble` component

**Files:**
- Create: `~/interface/message/TextBubble.tsx`

- [ ] **Create `TextBubble.tsx`:**

```tsx
import { memo } from 'react'
import { SizableText, YStack } from 'tamagui'

type TextBubbleProps = {
  text: string
  isMine: boolean
}

export const TextBubble = memo(({ text, isMine }: TextBubbleProps) => {
  return (
    <YStack
      bg={isMine ? '#8be872' : 'white'}
      px="$3"
      py="$2"
      maxW="100%"
      style={{ borderRadius: 18, borderBottomRightRadius: isMine ? 4 : undefined, borderTopLeftRadius: isMine ? undefined : 4 }}
    >
      <SizableText fontSize={15} color={isMine ? '#000' : '$gray8'} lineHeight={22}>
        {text}
      </SizableText>
    </YStack>
  )
})
```

Note: styling matches the existing `MessageBubble.tsx` text bubble appearance.

- [ ] **Commit:**

```bash
git add apps/web/src/interface/message/TextBubble.tsx
git commit -m "feat(interface): add TextBubble component"
```

---

## Task 2: Create `MessageBubbleFactory` component

**Files:**
- Create: `~/interface/message/MessageBubbleFactory.tsx`

- [ ] **Create `MessageBubbleFactory.tsx`:**

```tsx
import { memo, useMemo } from 'react'
import { SizableText, YStack } from 'tamagui'
import { LfBubble, LfCarousel } from '@vine/line-flex'
import type { LFexBubble, LFexCarousel, LFexMessage } from '@vine/line-flex'
import { TextBubble } from './TextBubble'

type MessageBubbleFactoryProps = {
  type: string
  text?: string
  metadata?: string
  isMine: boolean
}

export const MessageBubbleFactory = memo(
  ({ type, text, metadata, isMine }: MessageBubbleFactoryProps) => {
    if (type === 'text') {
      return <TextBubble text={text ?? ''} isMine={isMine} />
    }

    if (type === 'flex') {
      return <FlexBubbleContent metadata={metadata ?? ''} isMine={isMine} />
    }

    return <UnsupportedBubble type={type} />
  },
)

type FlexBubbleContentProps = {
  metadata: string
  isMine: boolean
}

const FlexBubbleContent = memo(({ metadata }: FlexBubbleContentProps) => {
  const contents = useMemo(() => {
    try {
      const parsed = JSON.parse(metadata)
      if (parsed?.type === 'flex' && parsed?.contents) {
        return parsed.contents
      }
      if (parsed?.type === 'bubble') {
        return parsed as LFexBubble
      }
      if (parsed?.type === 'carousel') {
        return parsed as LFexCarousel
      }
      return null
    } catch {
      return null
    }
  }, [metadata])

  if (!contents) {
    return (
      <YStack
        bg="white"
        px="$3"
        py="$2"
        style={{ borderRadius: 18 }}
      >
        <SizableText fontSize={13} color="$red10">
          無法解析此 flex 訊息
        </SizableText>
      </YStack>
    )
  }

  if (contents.type === 'carousel') {
    return <LfCarousel {...contents} />
  }

  return <LfBubble {...contents} />
})

type UnsupportedBubbleProps = {
  type: string
}

const UnsupportedBubble = memo(({ type }: UnsupportedBubbleProps) => {
  return (
    <YStack
      bg="white"
      px="$3"
      py="$2"
      style={{ borderRadius: 18 }}
    >
      <SizableText fontSize={13} color="$gray8">
        不支援的訊息類型: {type}
      </SizableText>
    </YStack>
  )
})
```

- [ ] **Run type check:**

```bash
bun run check:all
```

Expected: no errors.

- [ ] **Commit:**

```bash
git add apps/web/src/interface/message/MessageBubbleFactory.tsx
git commit -m "feat(interface): add MessageBubbleFactory for extensible message rendering"
```

---

## Task 3: Update chat room to use `MessageBubbleFactory` and support flex + OA sender

**Files:**
- Modify: `apps/web/app/(app)/home/(tabs)/talks/[chatId].tsx`

**Key changes:**
1. Import `MessageBubbleFactory`
2. Import `AVATAR_COLORS` from `~/features/chat/ui/MessageBubble` (or redefine it)
3. Remove `MessageBubble` import (no longer used)
4. In the messages map: replace `MessageBubble` with the new inline structure that includes avatar + name + time + `MessageBubbleFactory`

The message shape from Zero:
```typescript
{
  id: string
  chatId: string
  senderId?: string
  senderType: 'user' | 'oa'
  type: 'text' | 'flex'   // (extensible)
  text?: string
  metadata?: string        // JSON string for flex
  oaId?: string           // present when senderType === 'oa'
  createdAt: number
}
```

OA sender rendering:
- If `msg.senderType === 'oa'` and `msg.oaId` matches `otherMemberOaId`: show OA avatar (colored circle with initial) and `otherName` (from `oaFriend?.oaName ?? '官方帳號'`) above the bubble
- The OA avatar uses same styling as user avatar but with `bg="$color4"` (distinct from user avatar colors)

**Implementation:**

In the `messages?.map(...)` block, change from:
```tsx
<MessageBubble
  key={msg.id}
  text={msg.text ?? ''}
  isMine={isMine}
  createdAt={msg.createdAt}
  senderName={isMine ? undefined : senderInfo?.name}
  senderIndex={isMine ? undefined : senderInfo?.index}
/>
```

To a wrapper that:
1. Determines if message is from OA sender (`msg.senderType === 'oa'`)
2. For OA sender: shows OA name + avatar above the factory output
3. Uses `MessageBubbleFactory` instead of `MessageBubble`

```tsx
{/* OA sender name + avatar (shown above bubble for oa messages) */}
{msg.senderType === 'oa' && !isMine && (
  <XStack gap="$2.5" px="$3" py="$1" alignItems="center">
    <XStack
      width={38}
      height={38}
      shrink={0}
      items="center"
      justify="center"
      style={{ borderRadius: 999, backgroundColor: '$color4' }}
    >
      <SizableText fontSize={14} fontWeight="600" color="white">
        {(otherName ?? '?')[0]?.toUpperCase() ?? '?'}
      </SizableText>
    </XStack>
    <SizableText fontSize={12} color="rgba(255,255,255,0.85)">
      {otherName ?? '官方帳號'}
    </SizableText>
  </XStack>
)}

<MessageBubbleFactory
  type={msg.type}
  text={msg.text}
  metadata={msg.metadata}
  isMine={isMine}
/>
```

The key insight: `MessageBubbleFactory` replaces the **bubble content only**. The chat room continues to handle avatar, sender name, and time — just like before, but with added OA sender support.

**Avatar logic (preserved from existing `MessageBubble`):**
- Mine: no avatar shown
- Not mine, regular user (`senderType === 'user'`): avatar from `memberMap[msg.senderId]`
- Not mine, OA (`senderType === 'oa'`): avatar from `otherMember` (the OA's avatar)

**Sender name logic (updated):**
- Mine: no name shown
- Not mine, regular user: `senderInfo?.name`
- Not mine, OA: `otherName` (OA name from `oaFriend?.oaName ?? '官方帳號'`)

The full replacement for the message map item:
```tsx
<XStack
  key={msg.id}
  justifyContent={isMine ? 'flex-end' : 'flex-start'}
  px="$3"
  py="$1"
>
  {/* Avatar — mine: none | user: memberMap avatar | oa: otherMember avatar */}
  {!isMine && (
    senderType === 'oa' ? (
      /* OA avatar */
      <XStack
        width={38}
        height={38}
        mt={4}
        shrink={0}
        items="center"
        justify="center"
        style={{ borderRadius: 999, backgroundColor: '$color4' }}
      >
        <SizableText fontSize={14} fontWeight="600" color="white">
          {(otherName ?? '?')[0]?.toUpperCase() ?? '?'}
        </SizableText>
      </XStack>
    ) : (
      /* User avatar */
      <XStack
        width={38}
        height={38}
        mt={4}
        shrink={0}
        items="center"
        justify="center"
        style={{
          borderRadius: 999,
          backgroundColor: AVATAR_COLORS[(senderInfo?.index ?? 0) % AVATAR_COLORS.length],
        }}
      >
        <SizableText fontSize={14} fontWeight="600" color="white">
          {(senderInfo?.name ?? '?')[0]?.toUpperCase() ?? '?'}
        </SizableText>
      </XStack>
    )
  )}

  <YStack maxW="75%">
    {/* Sender name — mine: none | user: senderInfo.name | oa: otherName */}
    {!isMine && (
      <SizableText fontSize={12} color="rgba(255,255,255,0.85)" mb={4} ml={2}>
        {senderType === 'oa' ? otherName ?? '官方帳號' : senderInfo?.name ?? ''}
      </SizableText>
    )}

    {/* Bubble + time */}
    <XStack items="flex-end" gap="$1.5">
      {/* Time */}
      <YStack shrink={0} mb={2}>
        <SizableText fontSize={10} color="rgba(255,255,255,0.85)">
          {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </SizableText>
      </YStack>

      {/* Bubble content via factory */}
      <MessageBubbleFactory
        type={msg.type}
        text={msg.text}
        metadata={msg.metadata}
        isMine={isMine}
      />
    </XStack>
  </YStack>
</XStack>
```

Note: `senderType` should be extracted: `const senderType = msg.senderType as 'user' | 'oa'`. `AVATAR_COLORS` array needs to be imported or defined (same as in `MessageBubble.tsx`). `senderInfo` comes from `msg.senderId ? memberMap[msg.senderId] : undefined`.

- [ ] **Run type check:**

```bash
bun run check:all
```

Expected: no errors.

- [ ] **Commit:**

```bash
git add apps/web/app/\(app\)/home/(tabs)/talks/\[chatId\].tsx
git commit -m "feat(chat): use MessageBubbleFactory and support flex messages"
```

---

## Task 4: Verify in browser

- [ ] Start the dev stack:

```bash
bun run dev
```

- [ ] Navigate to the OA chat with a sent flex message

- [ ] Verify the flex message renders as an actual LINE flex bubble (not text)

- [ ] Verify text messages still render correctly

- [ ] Verify OA sender name is shown above the flex bubble
