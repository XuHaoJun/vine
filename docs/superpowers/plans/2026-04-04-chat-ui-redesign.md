# Chat UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign ChatRoomPage to match LINE-style reference UI with solid #84A1C4 background, sender avatar/name, external timestamps, and LINE-style input bar.

**Architecture:** Direct in-place edits to existing components. No data layer changes. `useMessages` exposes `members` array so `[chatId].tsx` can build a sender lookup map and pass `senderName`/`senderIndex` down to `MessageBubble`.

**Tech Stack:** Tamagui v2 (XStack/YStack/SizableText), react-native-svg (Svg/Path for icons), React hooks

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `apps/web/src/features/chat/useMessages.ts` | Expose `members` array in return value |
| Create | `apps/web/src/features/chat/ui/DateSeparator.tsx` | "今天" pill component |
| Modify | `apps/web/src/features/chat/ui/MessageBubble.tsx` | New layout: avatar+name, external timestamp, cut-corner bubbles |
| Modify | `apps/web/src/features/chat/ui/MessageInput.tsx` | LINE icon bar: +/camera/photo/text+emoji/mic-or-send |
| Modify | `apps/web/app/(app)/home/(tabs)/talks/[chatId].tsx` | bg #84A1C4, DateSeparator, memberMap → MessageBubble |

---

## Task 1: Expose members from useMessages

**Files:**
- Modify: `apps/web/src/features/chat/useMessages.ts`

- [ ] **Add `members` to the return object**

  Open `apps/web/src/features/chat/useMessages.ts`. The `members` variable already exists (line 18). Add it to the return:

  ```ts
  return {
    messages: messages ?? [],
    isLoading,
    myMembership,
    otherMember,
    members: members ?? [],
    sendMessage,
    markRead,
  }
  ```

  Full updated return type (inferred automatically — no explicit type annotation needed).

- [ ] **Verify type-check passes**

  ```bash
  bun run check:all
  ```

  Expected: no errors.

- [ ] **Commit**

  ```bash
  git add apps/web/src/features/chat/useMessages.ts
  git commit -m "feat(chat): expose members array from useMessages"
  ```

---

## Task 2: Create DateSeparator component

**Files:**
- Create: `apps/web/src/features/chat/ui/DateSeparator.tsx`

- [ ] **Create the file**

  ```tsx
  import { SizableText, XStack } from 'tamagui'

  type Props = {
    label: string
  }

  export function DateSeparator({ label }: Props) {
    return (
      <XStack justifyContent="center" marginVertical="$2">
        <SizableText
          fontSize={11}
          color="white"
          backgroundColor="rgba(0,0,0,0.18)"
          paddingHorizontal="$3"
          paddingVertical={3}
          borderRadius={99}
        >
          {label}
        </SizableText>
      </XStack>
    )
  }
  ```

- [ ] **Verify type-check passes**

  ```bash
  bun run check:all
  ```

  Expected: no errors.

- [ ] **Commit**

  ```bash
  git add apps/web/src/features/chat/ui/DateSeparator.tsx
  git commit -m "feat(chat): add DateSeparator component"
  ```

---

## Task 3: Rewrite MessageBubble

**Files:**
- Modify: `apps/web/src/features/chat/ui/MessageBubble.tsx`

The new layout has two branches:
- **Received** (`!isMine`): outer `XStack` row — avatar (top-left, mt=4) + content column (name → `XStack alignItems=flex-end` [bubble + time])
- **Sent** (`isMine`): outer `XStack justifyContent=flex-end` — inner `YStack alignItems=flex-end` → `XStack alignItems=flex-end` [time + bubble]

The `isRead` / "已讀" indicator is removed from the new design (outside of scope per spec).

Avatar background colors cycle by `senderIndex` from a fixed palette.

- [ ] **Replace the entire file**

  ```tsx
  import { memo } from 'react'
  import { SizableText, XStack, YStack } from 'tamagui'

  const AVATAR_COLORS = ['#7a9cbf', '#c4aed0', '#a0c4a0', '#e0b98a']

  type Props = {
    text: string
    isMine: boolean
    createdAt: number
    senderName?: string
    senderIndex?: number
  }

  export const MessageBubble = memo(({ text, isMine, createdAt, senderName, senderIndex }: Props) => {
    const time = new Date(createdAt).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })

    if (isMine) {
      return (
        <XStack justifyContent="flex-end" px="$3" py="$1">
          <YStack alignItems="flex-end" maxWidth="75%">
            <XStack alignItems="flex-end" gap="$1.5">
              <SizableText
                fontSize={10}
                color="rgba(255,255,255,0.85)"
                flexShrink={0}
                marginBottom={2}
              >
                {time}
              </SizableText>
              <YStack
                backgroundColor="#8be872"
                borderRadius={18}
                borderBottomRightRadius={4}
                paddingHorizontal="$3"
                paddingVertical="$2"
                maxWidth="100%"
              >
                <SizableText fontSize={15} color="$gray900" lineHeight={22}>
                  {text}
                </SizableText>
              </YStack>
            </XStack>
          </YStack>
        </XStack>
      )
    }

    const avatarColor = AVATAR_COLORS[(senderIndex ?? 0) % AVATAR_COLORS.length]
    const avatarLetter = (senderName ?? '?')[0]?.toUpperCase() ?? '?'

    return (
      <XStack gap="$2.5" px="$3" py="$1">
        <XStack
          width={38}
          height={38}
          borderRadius={999}
          backgroundColor={avatarColor}
          marginTop={4}
          flexShrink={0}
          alignItems="center"
          justifyContent="center"
        >
          <SizableText fontSize={14} fontWeight="600" color="white">
            {avatarLetter}
          </SizableText>
        </XStack>
        <YStack maxWidth="75%">
          <SizableText
            fontSize={12}
            color="rgba(255,255,255,0.85)"
            marginBottom={4}
            marginLeft={2}
          >
            {senderName ?? ''}
          </SizableText>
          <XStack alignItems="flex-end" gap="$1.5">
            <YStack
              backgroundColor="white"
              borderRadius={18}
              borderTopLeftRadius={4}
              paddingHorizontal="$3"
              paddingVertical="$2"
              maxWidth="100%"
            >
              <SizableText fontSize={15} color="$gray800" lineHeight={22}>
                {text}
              </SizableText>
            </YStack>
            <SizableText
              fontSize={10}
              color="rgba(255,255,255,0.85)"
              flexShrink={0}
              marginBottom={2}
            >
              {time}
            </SizableText>
          </XStack>
        </YStack>
      </XStack>
    )
  })
  ```

- [ ] **Verify type-check passes**

  ```bash
  bun run check:all
  ```

  Expected: no errors. Note: `[chatId].tsx` will have a type error (missing new props) until Task 5 is done — that's expected.

- [ ] **Commit**

  ```bash
  git add apps/web/src/features/chat/ui/MessageBubble.tsx
  git commit -m "feat(chat): rewrite MessageBubble with LINE-style layout"
  ```

---

## Task 4: Rewrite MessageInput

**Files:**
- Modify: `apps/web/src/features/chat/ui/MessageInput.tsx`

Icons are inline SVG via `react-native-svg`. When `text` is empty, show mic icon on the right. When `text` has content, replace mic with a green circle send button.

The `+ ` button is a decorative circle (no action). Camera and photo icons are decorative. Emoji icon is inside the text input (decorative). Only send actually fires `onSend`.

- [ ] **Replace the entire file**

  ```tsx
  import { memo, useState } from 'react'
  import { Pressable } from 'react-native'
  import Svg, { Path } from 'react-native-svg'
  import { XStack, YStack } from 'tamagui'

  import { Input } from '~/interface/forms/Input'

  type Props = {
    onSend: (text: string) => void
    disabled?: boolean
  }

  function CameraIcon() {
    return (
      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth={1.5}>
        <Path
          d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    )
  }

  function PhotoIcon() {
    return (
      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth={1.5}>
        <Path
          d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    )
  }

  function EmojiIcon() {
    return (
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth={1.5}>
        <Path
          d="M15.182 15.182a4.5 4.5 0 01-6.364 0M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75z"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    )
  }

  function MicIcon() {
    return (
      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth={1.5}>
        <Path
          d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    )
  }

  function SendArrowIcon() {
    return (
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2}>
        <Path
          d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    )
  }

  export const MessageInput = memo(({ onSend, disabled }: Props) => {
    const [text, setText] = useState('')

    const handleSend = () => {
      const trimmed = text.trim()
      if (!trimmed) return
      onSend(trimmed)
      setText('')
    }

    const hasText = text.trim().length > 0

    return (
      <XStack
        alignItems="center"
        gap="$2"
        backgroundColor="white"
        paddingHorizontal="$3"
        paddingVertical="$2"
        borderTopWidth={1}
        borderTopColor="$color4"
      >
        {/* + button */}
        <XStack
          width={30}
          height={30}
          borderRadius={999}
          backgroundColor="$gray3"
          alignItems="center"
          justifyContent="center"
          flexShrink={0}
        >
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth={2}>
            <Path d="M12 4.5v15m7.5-7.5h-15" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </XStack>

        {/* Camera */}
        <XStack flexShrink={0} alignItems="center" justifyContent="center">
          <CameraIcon />
        </XStack>

        {/* Photo */}
        <XStack flexShrink={0} alignItems="center" justifyContent="center">
          <PhotoIcon />
        </XStack>

        {/* Text input with emoji icon */}
        <YStack flex={1} position="relative">
          <Input
            backgroundColor="$gray3"
            borderRadius={20}
            borderWidth={0}
            paddingLeft="$3"
            paddingRight="$8"
            paddingVertical="$2"
            placeholder="Aa"
            value={text}
            onChangeText={setText}
            onSubmitEditing={handleSend}
            returnKeyType="send"
            multiline={false}
          />
          <XStack
            position="absolute"
            right={10}
            top={0}
            bottom={0}
            alignItems="center"
            justifyContent="center"
            pointerEvents="none"
          >
            <EmojiIcon />
          </XStack>
        </YStack>

        {/* Mic or Send */}
        {hasText ? (
          <Pressable onPress={handleSend} disabled={disabled}>
            <XStack
              width={36}
              height={36}
              borderRadius={999}
              backgroundColor="#8be872"
              alignItems="center"
              justifyContent="center"
              flexShrink={0}
            >
              <SendArrowIcon />
            </XStack>
          </Pressable>
        ) : (
          <XStack flexShrink={0} alignItems="center" justifyContent="center">
            <MicIcon />
          </XStack>
        )}
      </XStack>
    )
  })
  ```

- [ ] **Verify type-check passes**

  ```bash
  bun run check:all
  ```

  Expected: no errors.

- [ ] **Commit**

  ```bash
  git add apps/web/src/features/chat/ui/MessageInput.tsx
  git commit -m "feat(chat): rewrite MessageInput with LINE-style icon bar"
  ```

---

## Task 5: Update ChatRoomPage

**Files:**
- Modify: `apps/web/app/(app)/home/(tabs)/talks/[chatId].tsx`

Changes:
1. Add `members` to the `useMessages` destructure
2. Build `memberMap` with `useMemo` mapping `userId → { name, index }`
3. Set `backgroundColor="#84A1C4"` on root `YStack`
4. Add `<DateSeparator label="今天" />` before messages
5. Pass `senderName` and `senderIndex` to `MessageBubble`
6. Remove `isRead` prop (removed from MessageBubble in Task 3)

- [ ] **Replace the entire file**

  ```tsx
  import { useLocalSearchParams, createRoute } from 'one'
  import { memo, useEffect, useMemo, useRef } from 'react'
  import { useSafeAreaInsets } from 'react-native-safe-area-context'
  import { ScrollView, SizableText, XStack, YStack } from 'tamagui'

  import { useMessages } from '~/features/chat/useMessages'
  import { DateSeparator } from '~/features/chat/ui/DateSeparator'
  import { MessageBubble } from '~/features/chat/ui/MessageBubble'
  import { MessageInput } from '~/features/chat/ui/MessageInput'
  import { useAuth } from '~/features/auth/client/authClient'
  import { Avatar } from '~/interface/avatars/Avatar'
  import { Button } from '~/interface/buttons/Button'
  import { H3 } from '~/interface/text/Headings'

  const route = createRoute<'/(app)/home/(tabs)/talks/[chatId]'>()

  export const ChatRoomPage = memo(() => {
    const { chatId } = useLocalSearchParams<{ chatId: string }>()
    const { user } = useAuth()
    const userId = user?.id ?? ''
    const insets = useSafeAreaInsets()
    const scrollRef = useRef<ScrollView>(null)

    const { messages, isLoading, members, otherMember, sendMessage, markRead } = useMessages(chatId!)

    // Build a lookup map: userId → { name, index } for sender display
    const memberMap = useMemo(() => {
      const map: Record<string, { name: string; index: number }> = {}
      members.forEach((m, i) => {
        map[m.userId] = { name: m.user?.name ?? '?', index: i }
      })
      return map
    }, [members])

    useEffect(() => {
      if (messages?.length) {
        setTimeout(() => {
          scrollRef.current?.scrollToEnd({ animated: true })
        }, 100)
      }
    }, [messages])

    useEffect(() => {
      if (messages?.length) {
        const latest = messages[messages.length - 1]
        if (latest && latest.senderId !== userId) {
          markRead(latest.id)
        }
      }
    }, [messages, userId, markRead])

    const otherName = otherMember?.user?.name ?? '未知用戶'
    const otherImage = otherMember?.user?.image ?? null

    if (!chatId) {
      return null
    }

    return (
      <YStack flex={1} backgroundColor="#84A1C4">
        {/* Header — unchanged */}
        <XStack
          px="$3"
          py="$2"
          gap="$3"
          items="center"
          borderBottomWidth={1}
          borderBottomColor="$color4"
        >
          <Button variant="transparent" onPress={() => window.history.back()} px="$2">
            ←
          </Button>
          <Avatar size={32} image={otherImage} name={otherName} />
          <H3 flex={1}>{otherName}</H3>
        </XStack>

        <ScrollView ref={scrollRef} pb={insets.bottom}>
          {isLoading ? (
            <YStack p="$6" items="center">
              <SizableText color="rgba(255,255,255,0.7)">載入中...</SizableText>
            </YStack>
          ) : messages?.length === 0 ? (
            <YStack p="$6" items="center">
              <H3 color="rgba(255,255,255,0.7)">還沒有訊息，傳送第一則吧！</H3>
            </YStack>
          ) : (
            <YStack paddingVertical="$2">
              <DateSeparator label="今天" />
              {messages?.map((msg) => {
                const isMine = msg.senderId === userId
                const senderInfo = memberMap[msg.senderId]

                return (
                  <MessageBubble
                    key={msg.id}
                    text={msg.text ?? ''}
                    isMine={isMine}
                    createdAt={msg.createdAt}
                    senderName={isMine ? undefined : senderInfo?.name}
                    senderIndex={isMine ? undefined : senderInfo?.index}
                  />
                )
              })}
            </YStack>
          )}
        </ScrollView>

        <MessageInput onSend={sendMessage} />
      </YStack>
    )
  })

  export default ChatRoomPage
  ```

- [ ] **Verify type-check passes**

  ```bash
  bun run check:all
  ```

  Expected: no errors.

- [ ] **Run dev and verify visually**

  ```bash
  bun run dev
  ```

  Open the app and navigate to a chat room. Check:
  - Background is `#84A1C4`
  - "今天" pill appears above messages
  - Received messages: colored avatar circle (letter) on left, sender name above bubble, timestamp outside-right
  - Sent messages: green bubble on right, timestamp to the left of bubble
  - Input bar: `+` circle, camera icon, photo icon, text field with emoji icon inside, mic icon (empty) or green send button (when typing)

- [ ] **Commit**

  ```bash
  git add apps/web/app/(app)/home/(tabs)/talks/[chatId].tsx
  git commit -m "feat(chat): update ChatRoomPage with redesigned layout and #84A1C4 background"
  ```
