# Chat UI Redesign — LINE Style

**Date:** 2026-04-03
**Scope:** Redesign talks page to match LINE UI reference
**Approach:** Option B — Extract TalksHeader component

---

## 1. Current Issues

The current `talks/index.tsx` doesn't match the LINE UI reference:

| Element | Current | Expected |
|---------|---------|----------|
| Header | MainHeader with "Takeout" branding | LINE-style: 聊天 ▾ / 好友 text tabs + ⏱️ ＋ ⚙️ icons |
| Search bar | Inline with ＋ button, cramped | Full-width row below header, gray background |
| Pill toggle | Outlined buttons | Text tabs (active: bold + ▾, inactive: gray) |
| Chat list items | Name on top row, time on right, preview below | Same layout but refined spacing |
| Bottom tabs | Already correct (聊天 | 設定) | No change needed |

---

## 2. Architecture

### File Changes

| File | Action | Description |
|------|--------|-------------|
| `apps/web/src/features/chat/ui/TalksHeader.tsx` | **Create** | Header component (tab toggle, search, icon buttons) |
| `apps/web/app/(app)/home/(tabs)/talks/index.tsx` | **Modify** | Remove old header/search/pill, use TalksHeader |
| `apps/web/app/(app)/home/(tabs)/_layout.tsx` | **Modify** | Remove MainHeader + Spacer |
| `apps/web/src/features/chat/ui/ChatListItem.tsx` | **Modify** | Refine layout: name+time same row, preview below |
| `apps/web/src/features/chat/ui/FriendListItem.tsx` | **Modify** | Refine layout to match chat list style |

### TalksHeader Component

```tsx
type TalksHeaderProps = {
  activeTab: 'chats' | 'friends'
  onTabChange: (tab: 'chats' | 'friends') => void
  searchQuery: string
  onSearchChange: (query: string) => void
  pendingCount: number
  onNavigateToRequests: () => void
  onNavigateToSettings: () => void
}
```

Structure:
```
┌─────────────────────────────────────┐
│  聊天 ▾  好友          ⏱️  ＋  ⚙️  │  ← Tab toggle + icons
│  ┌─────────────────────────────┐ ▤ │  ← Full-width search + filter
└─────────────────────────────────────┘
```

### talks/index.tsx (after refactor)

```tsx
<TalksHeader
  activeTab={activeTab}
  onTabChange={setActiveTab}
  searchQuery={searchQuery}
  onSearchChange={setSearchQuery}
  pendingCount={pendingCount}
  onNavigateToRequests={() => router.push('/home/talks/requests')}
  onNavigateToSettings={() => router.push('/home/settings')}
/>

{/* Friend sub-tabs (only in friends view) */}
{activeTab === 'friends' && <FriendSubTabs />}

{/* Content list */}
<ScrollView>
  {activeTab === 'chats' ? <ChatList /> : <FriendList />}
</ScrollView>
```

### _layout.tsx (web)

Remove MainHeader and Spacer, just use `<Slot />`:

```tsx
import { Slot } from 'one'

export function TabsLayout() {
  return <Slot />
}
```

### _layout.native.tsx

No changes needed — bottom tabs already correct.

### NavigationTabs.tsx (web sidebar)

No changes needed — already has 聊天 and 設定 tabs.

---

## 3. Design Details

### Tab Toggle (in TalksHeader)

- Not buttons, just text
- Active tab: bold + ▾ indicator
- Inactive tab: gray color
- Click to switch

### Search Bar

- Full-width, gray background (#f0f0f0), border-radius 6px
- Placeholder follows activeTab: "搜尋聊天" / "搜尋好友"
- Right side: ▤ filter icon (P0 placeholder, P1 functionality)

### Icon Buttons (in TalksHeader)

| Icon | Purpose | P0 Behavior |
|------|---------|-------------|
| ⏱️ | Hidden chats/friends | Placeholder, no action |
| ＋ | Add friend | Navigate to requests.tsx |
| ⚙️ | Settings | Navigate to settings page |

### Chat List Item Layout

```
┌──────────────────────────────────────┐
│  [Avatar]  Name           09:40      │
│            Message preview...        │
└──────────────────────────────────────┘
```

- Avatar: 44px, circular, fixed
- Name: 14px, bold, left-aligned
- Time: 11px, gray, right-aligned
- Preview: 12px, gray, truncated

### Friend List Item Layout

```
┌──────────────────────────────────────┐
│  [Avatar]  Name                      │
│            Status message...         │
└──────────────────────────────────────┘
```

- Same avatar style
- Name: 14px, bold
- Status: 11px, gray

---

## 4. Friend Sub-Tabs (Friends View Only)

When in friends view, show sub-tabs below the search bar:

```
好友  |  我的最愛  |  群組  |  社群
```

P0: Only "好友" is functional, others are placeholders.

---

## 5. Error Handling

No new error scenarios. Existing error handling preserved.

---

## 6. Testing

- Visual inspection: matches LINE reference
- Integration tests still pass (4/4)
- No new test files needed (pure UI changes)
