# Chat UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign talks page to match LINE UI reference - LINE-style header with text tabs, full-width search bar, and refined chat/friend list items.

**Architecture:** Extract header into `TalksHeader` component, remove MainHeader from web layout, refine list item layouts. Icons from phosphor via SVG.

**Tech Stack:** Tamagui 2.0, react-native-svg, OneJS routing

---

## File Map

| File | Action | Description |
|------|--------|-------------|
| `apps/web/src/interface/icons/phosphor/ClockIcon.tsx` | Create | ⏱️ icon for hidden chats |
| `apps/web/src/interface/icons/phosphor/FunnelIcon.tsx` | Create | ▤ icon for filter placeholder |
| `apps/web/src/features/chat/ui/TalksHeader.tsx` | Create | Header with tabs, search, icon buttons |
| `apps/web/app/(app)/home/(tabs)/talks/index.tsx` | Modify | Remove old header/search/pills, use TalksHeader |
| `apps/web/app/(app)/home/(tabs)/_layout.tsx` | Modify | Remove MainHeader + Spacer, just Slot |
| `apps/web/src/features/chat/ui/ChatListItem.tsx` | Modify | Refine layout (already close, may need minor tweaks) |
| `apps/web/src/features/chat/ui/FriendListItem.tsx` | Modify | Refine layout to match chat list style |

---

## Task 1: Create ClockIcon

**Files:**
- Create: `apps/web/src/interface/icons/phosphor/ClockIcon.tsx`

- [ ] **Step 1: Create ClockIcon.tsx**

```tsx
import Svg, { Path } from 'react-native-svg'

import { useIconProps } from '~/interface/icons/useIconProps'

import type { IconProps } from '~/interface/icons/types'

export const ClockIcon = (props: IconProps) => {
  const { width, height, fill, ...svgProps } = useIconProps(props)

  return (
    <Svg width={width} height={height} viewBox="0 0 256 256" fill="none" {...svgProps}>
      <Path
        d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm64-88a8,8,0,0,1-8,8H128a8,8,0,0,1-8-8V72a8,8,0,0,1,16,0v48h48A8,8,0,0,1,192,128Z"
        fill={fill}
      />
    </Svg>
  )
}
```

- [ ] **Step 2: Add export to icons index**

Check if there's an index file that exports icons, if so add ClockIcon export.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/interface/icons/phosphor/ClockIcon.tsx
git commit -m "feat(chat): add ClockIcon for hidden chats placeholder"
```

---

## Task 2: Create FunnelIcon

**Files:**
- Create: `apps/web/src/interface/icons/phosphor/FunnelIcon.tsx`

- [ ] **Step 1: Create FunnelIcon.tsx**

```tsx
import Svg, { Path } from 'react-native-svg'

import { useIconProps } from '~/interface/icons/useIconProps'

import type { IconProps } from '~/interface/icons/types'

export const FunnelIcon = (props: IconProps) => {
  const { width, height, fill, ...svgProps } = useIconProps(props)

  return (
    <Svg width={width} height={height} viewBox="0 0 256 256" fill="none" {...svgProps}>
      <Path
        d="M229.66,77.66l-128,128a8,8,0,0,1-11.32,0l-56-56a8,8,0,0,1,11.32-11.32L96,188.69,218.34,66.34a8,8,0,0,1,11.32,11.32Z"
        fill={fill}
      />
    </Svg>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/interface/icons/phosphor/FunnelIcon.tsx
git commit -m "feat(chat): add FunnelIcon for filter placeholder"
```

---

## Task 3: Create TalksHeader Component

**Files:**
- Create: `apps/web/src/features/chat/ui/TalksHeader.tsx`

- [ ] **Step 1: Create TalksHeader.tsx**

```tsx
import { router } from 'one'
import { memo } from 'react'
import { SizableText, Spacer, XStack, YStack } from 'tamagui'

import { Button } from '~/interface/buttons/Button'
import { ClockIcon } from '~/interface/icons/phosphor/ClockIcon'
import { FunnelIcon } from '~/interface/icons/phosphor/FunnelIcon'
import { GearIcon } from '~/interface/icons/phosphor/GearIcon'
import { Input } from '~/interface/forms/Input'

type TalksHeaderProps = {
  activeTab: 'chats' | 'friends'
  onTabChange: (tab: 'chats' | 'friends') => void
  searchQuery: string
  onSearchChange: (query: string) => void
  pendingCount: number
}

export const TalksHeader = memo(({
  activeTab,
  onTabChange,
  searchQuery,
  onSearchChange,
  pendingCount,
}: TalksHeaderProps) => {
  return (
    <YStack bg="$background" pb="$2">
      {/* Tab row with icons */}
      <XStack px="$3" py="$2" justifyContent="space-between" alignItems="center">
        {/* Tab toggle */}
        <XStack gap="$4">
          <SizableText
            size="$4"
            fontWeight={activeTab === 'chats' ? '700' : '400'}
            color={activeTab === 'chats' ? '$color12' : '$color10'}
            cursor="pointer"
            onPress={() => onTabChange('chats')}
          >
            聊天 ▾
          </SizableText>
          <XStack alignItems="center" gap="$1">
            <SizableText
              size="$4"
              fontWeight={activeTab === 'friends' ? '700' : '400'}
              color={activeTab === 'friends' ? '$color12' : '$color10'}
              cursor="pointer"
              onPress={() => onTabChange('friends')}
            >
              好友
            </SizableText>
            {pendingCount > 0 && activeTab === 'friends' && (
              <XStack
                bg="$red9"
                rounded="$10"
                minW={16}
                height={16}
                alignItems="center"
                justifyContent="center"
                px="$1"
              >
                <SizableText size="$1" color="white" fontWeight="bold">
                  {pendingCount}
                </SizableText>
              </XStack>
            )}
          </XStack>
        </XStack>

        {/* Icon buttons */}
        <XStack gap="$3" alignItems="center">
          <Button variant="transparent" cursor="pointer" p="$1">
            <ClockIcon size={20} />
          </Button>
          <Button
            variant="transparent"
            cursor="pointer"
            p="$1"
            onPress={() => router.push('/home/talks/requests')}
          >
            <SizableText size="$4">＋</SizableText>
          </Button>
          <Button
            variant="transparent"
            cursor="pointer"
            p="$1"
            onPress={() => router.push('/home/settings')}
          >
            <GearIcon size={20} />
          </Button>
        </XStack>
      </XStack>

      {/* Search bar row */}
      <XStack px="$3" gap="$2">
        <XStack flex={1} bg="$color3" rounded="$2" alignItems="center" px="$2" py="$1.5">
          <Input
            flex={1}
            bg="transparent"
            borderWidth={0}
            placeholder={activeTab === 'chats' ? '搜尋聊天' : '搜尋好友'}
            value={searchQuery}
            onChangeText={onSearchChange}
            placeholderTextColor="$color10"
          />
          <FunnelIcon size={18} color="$color10" />
        </XStack>
      </XStack>
    </YStack>
  )
})
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/features/chat/ui/TalksHeader.tsx
git commit -m "feat(chat): create TalksHeader component with LINE-style tabs and search"
```

---

## Task 4: Modify talks/index.tsx

**Files:**
- Modify: `apps/web/app/(app)/home/(tabs)/talks/index.tsx`

- [ ] **Step 1: Update talks/index.tsx**

Replace the current header/search/pills section with TalksHeader:

Change imports from:
```tsx
import { useChats } from '~/features/chat/useChats'
import { useFriends } from '~/features/chat/useFriendship'
import { ChatListItem } from '~/features/chat/ui/ChatListItem'
import { FriendListItem } from '~/features/chat/ui/FriendListItem'
import { useAuth } from '~/features/auth/client/authClient'
import { Button } from '~/interface/buttons/Button'
import { Input } from '~/interface/forms/Input'
import { H3 } from '~/interface/text/Headings'
```

To:
```tsx
import { useChats } from '~/features/chat/useChats'
import { useFriends } from '~/features/chat/useFriendship'
import { ChatListItem } from '~/features/chat/ui/ChatListItem'
import { FriendListItem } from '~/features/chat/ui/FriendListItem'
import { TalksHeader } from '~/features/chat/ui/TalksHeader'
import { useAuth } from '~/features/auth/client/authClient'
import { H3 } from '~/interface/text/Headings'
```

Replace the header section (lines ~56-116) with:
```tsx
<TalksHeader
  activeTab={activeTab}
  onTabChange={setActiveTab}
  searchQuery={searchQuery}
  onSearchChange={setSearchQuery}
  pendingCount={pendingCount}
/>
```

- [ ] **Step 2: Verify compilation**

Run: `bun --cwd apps/web run typecheck`
Expected: No errors related to our changes

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/(app)/home/(tabs)/talks/index.tsx
git commit -m "refactor(chat): use TalksHeader instead of inline header"
```

---

## Task 5: Modify _layout.tsx (web)

**Files:**
- Modify: `apps/web/app/(app)/home/(tabs)/_layout.tsx`

- [ ] **Step 1: Simplify _layout.tsx**

Change from:
```tsx
import { Slot } from 'one'
import { Spacer } from 'tamagui'

import { MainHeader } from '~/features/app/MainHeader'

export function TabsLayout() {
  return (
    <>
      <MainHeader />
      <Spacer height={50} />
      <Slot />
    </>
  )
}
```

To:
```tsx
import { Slot } from 'one'

export function TabsLayout() {
  return <Slot />
}
```

- [ ] **Step 2: Verify compilation**

Run: `bun --cwd apps/web run typecheck`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/(app)/home/(tabs)/_layout.tsx
git commit -m "refactor(layout): remove MainHeader from tabs layout for LINE-style header"
```

---

## Task 6: Adjust ChatListItem (if needed)

**Files:**
- Modify: `apps/web/src/features/chat/ui/ChatListItem.tsx`

Review the current layout. According to the spec, the LINE-style chat item should have:
- Avatar: 44px (current uses 48px - may need adjustment)
- Name: 14px bold (current uses size="$4" which is ~16px)
- Time: 11px gray right-aligned (current uses size="$2")
- Preview: 12px gray (current uses size="$3")

- [ ] **Step 1: Review and adjust ChatListItem if needed**

The current layout at lines 22-55 looks close. Check if sizing needs adjustment for LINE-style (44px avatar, 14px name, 11px time, 12px preview).

If adjustments needed, modify the sizes to match LINE reference.

- [ ] **Step 2: Commit only if changed**

```bash
git add apps/web/src/features/chat/ui/ChatListItem.tsx
git commit -m "style(chat): adjust ChatListItem sizing for LINE style"
```

---

## Task 7: Adjust FriendListItem (if needed)

**Files:**
- Modify: `apps/web/src/features/chat/ui/FriendListItem.tsx`

Review the current layout. According to the spec:
- Avatar: 44px (current uses 48px)
- Name: 14px bold (current uses size="$4")
- Status: 11px gray (current uses size="$3")

- [ ] **Step 1: Review and adjust FriendListItem if needed**

Check if sizing needs adjustment. Current implementation at lines 17-30 may need minor tweaks.

- [ ] **Step 2: Commit only if changed**

```bash
git add apps/web/src/features/chat/ui/FriendListItem.tsx
git commit -m "style(chat): adjust FriendListItem sizing for LINE style"
```

---

## Task 8: Run Integration Tests

**Files:**
- Test: `apps/web/src/test/integration/chat-flow.test.ts`

- [ ] **Step 1: Run integration tests**

Run: `bun --cwd apps/web run test:integration`
Expected: All 4 tests pass (or existing test count)

- [ ] **Step 2: Visual verification**

Manual check: talks page should now have LINE-style header with:
- 聊天 ▾ / 好友 text tabs (bold when active, gray when inactive)
- Full-width search bar with gray background and filter icon
- ⏱️ ＋ ⚙️ icons on right side

---

## Verification Checklist

- [ ] ClockIcon created and exports correctly
- [ ] FunnelIcon created and exports correctly
- [ ] TalksHeader component renders with correct structure
- [ ] talks/index.tsx uses TalksHeader and removes old header code
- [ ] _layout.tsx (web) no longer has MainHeader
- [ ] Chat list items display correctly
- [ ] Friend list items display correctly
- [ ] Tab switching works (chats/friends)
- [ ] Search works for both tabs
- [ ] ＋ button navigates to requests
- [ ] ⚙️ button navigates to settings
- [ ] ⏱️ button is placeholder (no action)
- [ ] Integration tests pass

---

## Notes

- Native layout (`_layout.native.tsx`) is NOT changed - bottom tabs already correct
- `NavigationTabs.tsx` (web sidebar) is NOT changed - already has 聊天 and 設定 tabs
- Pending count badge only shows when `activeTab === 'friends'` and `pendingCount > 0`
- Filter icon (▤) is P0 placeholder - click has no action yet
- Hidden chats icon (⏱️) is P0 placeholder - click has no action yet
