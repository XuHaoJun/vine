# OA Chat Rich Menu — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Display LINE-compatible rich menus in the OA chat room, with mode switching between text input and rich menu display.

**Architecture:** Add a new ConnectRPC method `GetActiveRichMenu` to resolve and return the active rich menu for an OA (per-user priority, then default). The server returns rich menu metadata + image bytes. Frontend creates dedicated components for the rich menu display and chat bar, integrating mode switching into the existing `MessageInput` and chat room.

**Tech Stack:** ConnectRPC (proto → server handler → web client), Tamagui, React Native (cross-platform), existing OA service + drive service

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `packages/proto/proto/oa/v1/oa.proto` | Modify | Add `GetActiveRichMenu` RPC + messages |
| `packages/proto/gen/oa/v1/oa_pb.ts` | Regenerate | Auto-generated from proto |
| `apps/server/src/connect/oa.ts` | Modify | Implement `GetActiveRichMenu` handler |
| `apps/web/src/features/chat/useRichMenu.ts` | Create | Hook to fetch active rich menu |
| `apps/web/src/features/chat/ui/RichMenu.tsx` | Create | Rich menu image + tap area overlay |
| `apps/web/src/features/chat/ui/RichMenuBar.tsx` | Create | Chat bar (⌨️/📋 toggle + chatBarText) |
| `apps/web/src/features/chat/ui/MessageInput.tsx` | Modify | Support `hasRichMenu`/`mode`/`onToggleMode` props |
| `apps/web/app/(app)/home/(tabs)/talks/[chatId].tsx` | Modify | Fetch rich menu, manage mode state, render components |

---

### Task 1: Add Proto Messages for GetActiveRichMenu

**Files:**
- Modify: `packages/proto/proto/oa/v1/oa.proto`

- [ ] **Step 1: Add messages and RPC to proto**

Add at the end of `oa.proto`, before the `service OAService` block:

```protobuf
// ── Rich Menu (user-facing) ──

message RichMenuArea {
  message Bounds {
    int32 x = 1;
    int32 y = 2;
    int32 width = 3;
    int32 height = 4;
  }
  message Action {
    string type = 1;
    optional string label = 2;
    optional string uri = 3;
    optional string data = 4;
    optional string text = 5;
    optional string rich_menu_alias_id = 6;
    optional string input_option = 7;
    optional string display_text = 8;
  }
  Bounds bounds = 1;
  Action action = 2;
}

message RichMenuData {
  string rich_menu_id = 1;
  string name = 2;
  string chat_bar_text = 3;
  bool selected = 4;
  int32 size_width = 5;
  int32 size_height = 6;
  repeated RichMenuArea areas = 7;
}

message GetActiveRichMenuRequest {
  string official_account_id = 1;
}

message GetActiveRichMenuResponse {
  optional RichMenuData rich_menu = 1;
  optional bytes image = 2;
  optional string image_content_type = 3;
}
```

Add the RPC to the `service OAService` block:

```protobuf
rpc GetActiveRichMenu(GetActiveRichMenuRequest) returns (GetActiveRichMenuResponse);
```

- [ ] **Step 2: Generate TypeScript from proto**

```bash
bun turbo proto:generate
```

Expected: New types generated in `packages/proto/gen/oa/v1/oa_pb.ts` including `GetActiveRichMenuRequest`, `GetActiveRichMenuResponse`, `RichMenuData`, `RichMenuArea`.

---

### Task 2: Implement Server Handler

**Files:**
- Modify: `apps/server/src/connect/oa.ts`

- [ ] **Step 1: Add GetActiveRichMenu handler to OA connect**

In `apps/server/src/connect/oa.ts`, add to the `impl` object:

```ts
async getActiveRichMenu(
  req: GetActiveRichMenuRequest,
  ctx: Context,
): Promise<GetActiveRichMenuResponse> {
  const authData = requireAuthData(ctx)
  const userId = authData.id
  const oaId = req.officialAccountId

  // 1. Try per-user rich menu first
  const userLink = await deps.oa.getRichMenuIdOfUser(oaId, userId)
  let richMenuId: string | null = null
  if (userLink) {
    richMenuId = userLink.richMenuId
  }

  // 2. Fall back to default rich menu
  if (!richMenuId) {
    const defaultMenu = await deps.oa.getDefaultRichMenu(oaId)
    if (defaultMenu) {
      richMenuId = defaultMenu.richMenuId
    }
  }

  if (!richMenuId) {
    return new GetActiveRichMenuResponse({})
  }

  // 3. Get rich menu object
  const menu = await deps.oa.getRichMenu(oaId, richMenuId)
  if (!menu) {
    return new GetActiveRichMenuResponse({})
  }

  const areas = JSON.parse(menu.areas) as Array<{
    bounds: { x: number; y: number; width: number; height: number }
    action: Record<string, string | undefined>
  }>

  // 4. Get image if available
  let imageBytes: Uint8Array | undefined
  let imageContentType: string | undefined
  if (menu.hasImage === 'true') {
    const key = `richmenu/${oaId}/${richMenuId}.jpg`
    const exists = await deps.drive.exists(key)
    if (exists) {
      const file = await deps.drive.get(key)
      imageBytes = new Uint8Array(file.content)
      imageContentType = file.mimeType ?? 'image/jpeg'
    }
  }

  return new GetActiveRichMenuResponse({
    richMenu: {
      richMenuId: menu.richMenuId,
      name: menu.name,
      chatBarText: menu.chatBarText,
      selected: menu.selected === 'true',
      sizeWidth: parseInt(menu.sizeWidth, 10),
      sizeHeight: parseInt(menu.sizeHeight, 10),
      areas: areas.map((a) => ({
        bounds: {
          x: a.bounds.x,
          y: a.bounds.y,
          width: a.bounds.width,
          height: a.bounds.height,
        },
        action: {
          type: a.action.type ?? '',
          label: a.action.label,
          uri: a.action.uri,
          data: a.action.data,
          text: a.action.text,
          richMenuAliasId: a.action.richMenuAliasId,
          inputOption: a.action.inputOption,
          displayText: a.action.displayText,
        },
      })),
    },
    image: imageBytes,
    imageContentType,
  })
},
```

Add required imports at the top:
```ts
import { GetActiveRichMenuResponse } from '@vine/proto/oa'
```

Note: `deps.drive` needs to be added to `OAHandlerDeps`. Check if it's already available via the existing deps, or add it:

```ts
type OAHandlerDeps = {
  oa: ReturnType<typeof createOAService>
  auth: AuthServer
  drive: DriveService  // add if not present
}
```

Also update `routes.ts` to pass `drive` through:
```ts
type ConnectDeps = {
  oa: ReturnType<typeof createOAService>
  auth: AuthServer
  drive: DriveService
}
```

And update `index.ts` to pass `drive` to `connectRoutes`.

- [ ] **Step 2: Run server typecheck**

```bash
bun run --cwd apps/server build
```

Expected: No type errors.

---

### Task 3: Create useRichMenu Hook

**Files:**
- Create: `apps/web/src/features/chat/useRichMenu.ts`

- [ ] **Step 1: Write the hook**

```ts
import { useMemo, useState, useEffect } from 'react'
import { useTanQuery } from '~/query'
import { oaClient } from '~/features/oa/client'

type RichMenuArea = {
  bounds: { x: number; y: number; width: number; height: number }
  action: {
    type: string
    label?: string
    uri?: string
    data?: string
    text?: string
    richMenuAliasId?: string
    inputOption?: string
    displayText?: string
  }
}

type RichMenuData = {
  richMenuId: string
  name: string
  chatBarText: string
  selected: boolean
  sizeWidth: number
  sizeHeight: number
  areas: RichMenuArea[]
}

type UseRichMenuResult = {
  richMenu: RichMenuData | null
  imageUrl: string | null
  isLoading: boolean
}

export function useRichMenu(oaId: string | undefined): UseRichMenuResult {
  const { data, isLoading } = useTanQuery({
    queryKey: ['oa', 'richMenu', 'active', oaId],
    queryFn: async () => {
      if (!oaId) return null
      const res = await oaClient.getActiveRichMenu({
        officialAccountId: oaId,
      })
      if (!res.richMenu) return null

      let imageUrl: string | null = null
      if (res.image && res.image.length > 0) {
        const blob = new Blob([res.image], {
          type: res.imageContentType ?? 'image/jpeg',
        })
        imageUrl = URL.createObjectURL(blob)
      }

      return {
        richMenu: {
          richMenuId: res.richMenu.richMenuId,
          name: res.richMenu.name,
          chatBarText: res.richMenu.chatBarText,
          selected: res.richMenu.selected,
          sizeWidth: res.richMenu.sizeWidth,
          sizeHeight: res.richMenu.sizeHeight,
          areas: res.richMenu.areas.map((a) => ({
            bounds: {
              x: a.bounds?.x ?? 0,
              y: a.bounds?.y ?? 0,
              width: a.bounds?.width ?? 0,
              height: a.bounds?.height ?? 0,
            },
            action: {
              type: a.action?.type ?? '',
              label: a.action?.label,
              uri: a.action?.uri,
              data: a.action?.data,
              text: a.action?.text,
              richMenuAliasId: a.action?.richMenuAliasId,
              inputOption: a.action?.inputOption,
              displayText: a.action?.displayText,
            },
          })),
        },
        imageUrl,
      }
    },
    enabled: Boolean(oaId),
  })

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (data?.imageUrl) {
        URL.revokeObjectURL(data.imageUrl)
      }
    }
  }, [data?.imageUrl])

  return {
    richMenu: data?.richMenu ?? null,
    imageUrl: data?.imageUrl ?? null,
    isLoading,
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
bun run --cwd apps/web build 2>&1 | head -20
```

Expected: No type errors related to the new file.

---

### Task 4: Create RichMenu Component

**Files:**
- Create: `apps/web/src/features/chat/ui/RichMenu.tsx`

- [ ] **Step 1: Write the component**

```tsx
import { memo, useCallback } from 'react'
import { Pressable } from 'react-native'
import { YStack } from 'tamagui'
import { Image } from '~/interface/image/Image'

type RichMenuArea = {
  bounds: { x: number; y: number; width: number; height: number }
  action: {
    type: string
    label?: string
    uri?: string
    data?: string
    text?: string
  }
}

type Props = {
  imageUrl: string
  sizeWidth: number
  sizeHeight: number
  areas: RichMenuArea[]
  onAreaTap: (area: RichMenuArea) => void
}

export const RichMenu = memo(
  ({ imageUrl, sizeWidth, sizeHeight, areas, onAreaTap }: Props) => {
    const aspectRatio = sizeWidth / sizeHeight

    return (
      <YStack position="relative" width="100%" style={{ aspectRatio }}>
        <Image
          src={imageUrl}
          style={{
            width: '100%',
            height: '100%',
            resizeMode: 'contain',
          }}
        />
        {areas.map((area, index) => (
          <Pressable
            key={index}
            onPress={() => onAreaTap(area)}
            style={{
              position: 'absolute',
              left: `${(area.bounds.x / sizeWidth) * 100}%`,
              top: `${(area.bounds.y / sizeHeight) * 100}%`,
              width: `${(area.bounds.width / sizeWidth) * 100}%`,
              height: `${(area.bounds.height / sizeHeight) * 100}%`,
            }}
          />
        ))}
      </YStack>
    )
  },
)
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
bun run --cwd apps/web build 2>&1 | head -20
```

Expected: No errors.

---

### Task 5: Create RichMenuBar Component

**Files:**
- Create: `apps/web/src/features/chat/ui/RichMenuBar.tsx`

- [ ] **Step 1: Write the component**

```tsx
import { memo } from 'react'
import { Pressable } from 'react-native'
import { XStack, SizableText } from 'tamagui'

type Props = {
  chatBarText: string
  isExpanded: boolean
  onToggleExpand: () => void
  onSwitchToKeyboard: () => void
}

export const RichMenuBar = memo(
  ({ chatBarText, isExpanded, onToggleExpand, onSwitchToKeyboard }: Props) => {
    return (
      <XStack bg="white" borderTopWidth={1} borderTopColor="$color4">
        <Pressable onPress={onSwitchToKeyboard}>
          <XStack
            width={44}
            height={44}
            items="center"
            justify="center"
            borderRightWidth={1}
            borderRightColor="$color4"
          >
            <SizableText fontSize={18}>⌨️</SizableText>
          </XStack>
        </Pressable>
        <Pressable onPress={onToggleExpand} style={{ flex: 1 }}>
          <XStack flex={1} items="center" justify="center" gap="$1.5" py="$2.5">
            <SizableText fontSize={13} fontWeight="500" color="$color12">
              {chatBarText}
            </SizableText>
            <SizableText fontSize={10} color="$color10">
              {isExpanded ? '▲' : '▼'}
            </SizableText>
          </XStack>
        </Pressable>
      </XStack>
    )
  },
)
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
bun run --cwd apps/web build 2>&1 | head -20
```

Expected: No errors.

---

### Task 6: Modify MessageInput for Mode Switching

**Files:**
- Modify: `apps/web/src/features/chat/ui/MessageInput.tsx`

- [ ] **Step 1: Add rich menu mode props**

Add new props to the `Props` type:

```ts
type Props = {
  onSend: (text: string) => void
  disabled?: boolean
  hasRichMenu?: boolean
  onSwitchToRichMenu?: () => void
}
```

- [ ] **Step 2: Replace + icon conditionally**

In the `MessageInput` component, replace the `+` button section:

```tsx
{/* + button or Rich Menu toggle */}
{hasRichMenu && onSwitchToRichMenu ? (
  <Pressable onPress={onSwitchToRichMenu}>
    <XStack
      style={{ width: 30, height: 30, borderRadius: 999, flexShrink: 0 }}
      bg="$gray3"
      items="center"
      justify="center"
    >
      <SizableText fontSize={14}>📋</SizableText>
    </XStack>
  </Pressable>
) : (
  <XStack
    style={{ width: 30, height: 30, borderRadius: 999, flexShrink: 0 }}
    bg="$gray3"
    items="center"
    justify="center"
  >
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth={2}>
      <Path d="M12 4.5v15m7.5-7.5h-15" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  </XStack>
)}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
bun run --cwd apps/web build 2>&1 | head -20
```

Expected: No errors.

---

### Task 7: Integrate Rich Menu into Chat Room

**Files:**
- Modify: `apps/web/app/(app)/home/(tabs)/talks/[chatId].tsx`

- [ ] **Step 1: Add imports and mode state**

Add imports:
```ts
import { useState } from 'react'
import { useRichMenu } from '~/features/chat/useRichMenu'
import { RichMenu } from '~/features/chat/ui/RichMenu'
import { RichMenuBar } from '~/features/chat/ui/RichMenuBar'
import { showToast } from '~/interface/toast/Toast'
import { Linking } from 'react-native'
```

Add state inside the component (after existing hooks):
```ts
const { richMenu, imageUrl, isLoading: richMenuLoading } = useRichMenu(otherMemberOaId ?? undefined)
const hasRichMenu = !!richMenu && !!imageUrl
const [inputMode, setInputMode] = useState<'normal' | 'richmenu'>(
  hasRichMenu ? 'richmenu' : 'normal',
)
const [richMenuExpanded, setRichMenuExpanded] = useState(richMenu?.selected ?? false)

// Reset mode when rich menu changes
useEffect(() => {
  if (hasRichMenu) {
    setInputMode('richmenu')
    setRichMenuExpanded(richMenu?.selected ?? false)
  } else {
    setInputMode('normal')
  }
}, [hasRichMenu, richMenu?.selected])
```

- [ ] **Step 2: Add action handler**

```ts
const handleRichMenuAreaTap = useCallback(
  (area: { action: { type: string; uri?: string; data?: string; text?: string } }) => {
    const { action } = area
    switch (action.type) {
      case 'uri':
        if (action.uri) {
          Linking.openURL(action.uri)
        }
        break
      case 'message':
        if (action.text) {
          sendMessage(action.text)
        }
        break
      case 'postback':
        // TODO: implement postback handling when backend supports it
        showToast('Postback action', { type: 'info' })
        break
      default:
        showToast(`Action: ${action.type}`, { type: 'info' })
    }
  },
  [sendMessage],
)
```

- [ ] **Step 3: Replace the bottom section of the chat room JSX**

Replace:
```tsx
<YStack shrink={0}>
  <MessageInput onSend={sendMessage} />
</YStack>
```

With:
```tsx
{/* Rich Menu (expanded) */}
{inputMode === 'richmenu' && hasRichMenu && richMenuExpanded && imageUrl && (
  <YStack shrink={0}>
    <RichMenu
      imageUrl={imageUrl}
      sizeWidth={richMenu.sizeWidth}
      sizeHeight={richMenu.sizeHeight}
      areas={richMenu.areas}
      onAreaTap={handleRichMenuAreaTap}
    />
  </YStack>
)}

{/* Input area */}
<YStack shrink={0}>
  {inputMode === 'richmenu' && hasRichMenu ? (
    <RichMenuBar
      chatBarText={richMenu.chatBarText}
      isExpanded={richMenuExpanded}
      onToggleExpand={() => setRichMenuExpanded((prev) => !prev)}
      onSwitchToKeyboard={() => {
        setInputMode('normal')
        setRichMenuExpanded(false)
      }}
    />
  ) : (
    <MessageInput
      onSend={sendMessage}
      hasRichMenu={hasRichMenu}
      onSwitchToRichMenu={() => {
        setInputMode('richmenu')
        setRichMenuExpanded(false)
      }}
    />
  )}
</YStack>
```

- [ ] **Step 4: Run full typecheck and lint**

```bash
bun run check:all
```

Expected: No errors.

- [ ] **Step 5: Test manually**

1. Start the dev server: `bun run dev`
2. Navigate to an OA chat that has a rich menu set
3. Verify:
   - Rich menu mode is active (chat bar shows instead of text input)
   - If `selected: true`, rich menu image is expanded
   - Tap chat bar → toggle expand/collapse
   - Tap ⌨️ → switch to normal text input (📋 icon appears)
   - Tap 📋 → switch back to rich menu mode
   - Tap a rich menu area → action fires (URI opens, message sends)
   - Navigate to an OA chat without rich menu → normal text input, no 📋 icon

- [ ] **Step 6: Commit**

```bash
git add packages/proto/proto/oa/v1/oa.proto apps/server/src/connect/oa.ts apps/web/src/features/chat/useRichMenu.ts apps/web/src/features/chat/ui/RichMenu.tsx apps/web/src/features/chat/ui/RichMenuBar.tsx apps/web/src/features/chat/ui/MessageInput.tsx apps/web/app/\(app\)/home/\(tabs\)/talks/\[chatId\].tsx
git commit -m "feat: display rich menu in OA chat room"
```
