# OA QR Code Scanner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement QR code scanning that resolves an OA and displays its detail via Sheet (internal) or Page (external deep link).

**Architecture:** Two paths — internal scanner opens OADetailSheet, external deep link navigates to `/oa/[oaId]` page. Shared `OADetailContent` component renders OA detail in both contexts. QR content format: `https://vine.app/oa/{unique_id}`.

**Tech Stack:** React, Tamagui, One (vxrn), ConnectRPC, `@yudiel/react-qr-scanner` (web), `expo-camera` (native)

---

## File Structure

| File | Responsibility |
|------|----------------|
| `apps/web/src/features/oa/parse-qr.ts` | Parse QR content → unique_id |
| `apps/web/src/features/oa/parse-qr.test.ts` | Unit tests for parser |
| `apps/web/src/interface/oa/OADetailContent.tsx` | Shared OA detail visual content |
| `apps/web/src/interface/dialogs/OADetailSheet.tsx` | Refactored to use OADetailContent |
| `apps/web/src/interface/dialogs/OAScannerSheet.tsx` | QR scanner sheet (web) |
| `apps/web/src/interface/dialogs/OAScannerSheet.native.tsx` | QR scanner sheet (native) |
| `apps/web/app/(app)/oa/[oaId].tsx` | Deep link route page |

---

### Task 1: Install QR scanning dependencies

**Files:**
- Modify: `apps/web/package.json`

- [ ] **Step 1: Install web QR scanner**

```bash
bun add @yudiel/react-qr-scanner --cwd apps/web
```

- [ ] **Step 2: Install expo-camera for native**

```bash
bun add expo-camera --cwd apps/web
```

- [ ] **Step 3: Verify install**

```bash
grep "react-qr-scanner\|expo-camera" apps/web/package.json
```

Expected: Both packages listed in dependencies

---

### Task 2: Create `parse-qr.ts` utility with tests

**Files:**
- Create: `apps/web/src/features/oa/parse-qr.ts`
- Create: `apps/web/src/features/oa/parse-qr.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// apps/web/src/features/oa/parse-qr.test.ts
import { describe, expect, it } from 'vitest'
import { parseOAScanResult } from './parse-qr'

describe('parseOAScanResult', () => {
  it('extracts unique_id from Vine URL', () => {
    expect(parseOAScanResult('https://vine.app/oa/@my-oa')).toBe('@my-oa')
  })

  it('handles URL-encoded unique_id', () => {
    expect(parseOAScanResult('https://vine.app/oa/%40my-oa')).toBe('@my-oa')
  })

  it('returns raw unique_id when not a URL', () => {
    expect(parseOAScanResult('@my-oa')).toBe('@my-oa')
  })

  it('returns raw unique_id without @ prefix', () => {
    expect(parseOAScanResult('my-oa')).toBe('my-oa')
  })

  it('handles URL with trailing slash', () => {
    expect(parseOAScanResult('https://vine.app/oa/@my-oa/')).toBe('@my-oa/')
  })

  it('returns non-Vine URLs as-is', () => {
    expect(parseOAScanResult('https://example.com/foo')).toBe('https://example.com/foo')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
bun run --cwd apps/web test:unit -- src/features/oa/parse-qr.test.ts
```

Expected: FAIL — module not found

- [ ] **Step 3: Write implementation**

```ts
// apps/web/src/features/oa/parse-qr.ts
export function parseOAScanResult(content: string): string {
  const urlMatch = content.match(/vine\.app\/oa\/(.+)/)
  if (urlMatch) return decodeURIComponent(urlMatch[1])
  return content
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
bun run --cwd apps/web test:unit -- src/features/oa/parse-qr.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/oa/parse-qr.ts apps/web/src/features/oa/parse-qr.test.ts
git commit -m "feat(oa): add QR content parser utility"
```

---

### Task 3: Extract `OADetailContent` shared component

**Files:**
- Create: `apps/web/src/interface/oa/OADetailContent.tsx`

- [ ] **Step 1: Create shared content component**

Extract the visual content (everything inside `Sheet.Frame` except the Sheet wrapper) from `OADetailSheet.tsx` into a standalone component.

```tsx
// apps/web/src/interface/oa/OADetailContent.tsx
import { router } from 'one'
import { ScrollView, Text, XStack, YStack } from 'tamagui'

import { Avatar } from '~/interface/avatars/Avatar'
import { Button } from '~/interface/buttons/Button'
import { Image } from '~/interface/image/Image'
import { ChatCircleIcon } from '~/interface/icons/phosphor/ChatCircleIcon'
import { showToast } from '~/interface/toast/Toast'
import { useTanMutation, useTanQuery, useTanQueryClient } from '~/query'
import { oaClient } from '~/features/oa/client'
import { useAuth } from '~/features/auth/client/authClient'
import { useChats } from '~/features/chat/useChats'
import { zero } from '~/zero/client'

const MOCK_COVER_URL =
  'https://images.unsplash.com/photo-1557683316-973673baf926?w=800&q=80'
const MOCK_FRIEND_COUNT = 12847
const MOCK_POST_COUNT = 42
const MOCK_LOCATION = '台灣'
const MOCK_DESCRIPTION =
  'Vine 是新一代的即時通訊平台，提供安全、快速、有趣的聊天體驗。加入我們，探索無限可能！'

export type OADetailContentData = {
  id: string
  name: string
  oaId: string
  imageUrl?: string
}

type OADetailContentProps = OADetailContentData & {
  onClose?: () => void
  showCloseButton?: boolean
}

export function OADetailContent({
  id,
  name,
  oaId,
  imageUrl,
  onClose,
  showCloseButton = true,
}: OADetailContentProps) {
  const queryClient = useTanQueryClient()
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const { chats } = useChats()

  const { data: isFriendData } = useTanQuery({
    queryKey: ['oa', 'isFriend', oaId],
    queryFn: () => oaClient.isOAFriend({ officialAccountId: id }),
  })

  const addFriend = useTanMutation({
    mutationFn: () => oaClient.addOAFriend({ officialAccountId: id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['oa', 'isFriend', oaId] })
      queryClient.invalidateQueries({ queryKey: ['oa', 'myFriends'] })
      showToast('已加入好友', { type: 'success' })
    },
    onError: () => {
      showToast('加入好友失敗', { type: 'error' })
    },
  })

  const removeFriend = useTanMutation({
    mutationFn: () => oaClient.removeOAFriend({ officialAccountId: id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['oa', 'isFriend', oaId] })
      queryClient.invalidateQueries({ queryKey: ['oa', 'myFriends'] })
      showToast('已移除好友', { type: 'success' })
    },
    onError: () => {
      showToast('移除好友失敗', { type: 'error' })
    },
  })

  const isFriend = isFriendData?.isFriend ?? false

  const handleStartChat = () => {
    if (!userId || !id) return
    const existingChat = chats.find(
      (c) => c.type === 'oa' && c.members?.some((m) => m.oaId === id),
    )
    if (existingChat?.id) {
      onClose?.()
      router.push(`/home/talks/${existingChat.id}`)
      return
    }
    const chatId = crypto.randomUUID()
    const now = Date.now()
    zero.mutate.chat.insertOAChat({
      chatId,
      userId,
      oaId: id,
      member1Id: crypto.randomUUID(),
      member2Id: crypto.randomUUID(),
      createdAt: now,
    })
    onClose?.()
    router.push(`/home/talks/${chatId}`)
  }

  const handleAddFriend = () => {
    if (isFriend) {
      handleStartChat()
    } else {
      addFriend.mutate()
    }
  }

  return (
    <>
      {/* Fixed bottom button */}
      <YStack
        position="absolute"
        b={0}
        l={0}
        r={0}
        z={10}
        p="$4"
        bg="$background"
        borderTopWidth={1}
        borderColor="$borderColor"
      >
        <Button
          size="$5"
          onPress={isFriend ? handleStartChat : handleAddFriend}
          disabled={addFriend.isPending || removeFriend.isPending}
        >
          {isFriend ? '開始聊天' : '加入好友'}
        </Button>
      </YStack>

      <ScrollView flex={1} pb="$20">
        {/* Top-right buttons */}
        {showCloseButton && onClose && (
          <XStack position="absolute" t="$3" r="$3" z={10} gap="$2">
            <YStack
              width={36}
              height={36}
              rounded={9999}
              bg="$color4"
              items="center"
              justify="center"
              cursor="pointer"
              onPress={() => showToast('功能選單即將上線', { type: 'info' })}
              hoverStyle={{ bg: '$color5' }}
            >
              <XStack gap="$0.5">
                <YStack width={4} height={4} rounded={9999} bg="$color11" />
                <YStack width={4} height={4} rounded={9999} bg="$color11" />
                <YStack width={4} height={4} rounded={9999} bg="$color11" />
              </XStack>
            </YStack>
            <YStack
              width={36}
              height={36}
              rounded={9999}
              bg="$color4"
              items="center"
              justify="center"
              cursor="pointer"
              onPress={onClose}
              hoverStyle={{ bg: '$color5' }}
            >
              <Text fontSize={20} color="$color11" fontWeight="300" mt={-2}>
                ×
              </Text>
            </YStack>
          </XStack>
        )}

        {/* Cover Image */}
        <YStack height={180} bg="$color5" position="relative">
          <Image
            src={MOCK_COVER_URL}
            alt="Cover"
            width="100%"
            height={180}
            objectFit="cover"
          />
        </YStack>

        {/* Main Content */}
        <YStack px="$4" mt={-40} position="relative" z={5}>
          {/* Logo */}
          <XStack items="flex-end" gap="$3" mb="$2">
            <YStack rounded={9999} borderWidth={4} borderColor="$background" overflow="hidden">
              <Avatar size={72} image={imageUrl || null} name={name} />
            </YStack>
          </XStack>

          {/* Brand Name + Verified Badge */}
          <XStack items="center" gap="$2" mb="$1" flexWrap="wrap">
            <Text fontSize={20} fontWeight="700" color="$color12">{name}</Text>
            <XStack bg="$blue10" px="$2" py="$0.5" rounded={9999} items="center" gap="$1">
              <Text fontSize={10} fontWeight="700" color="$white">✓</Text>
              <Text fontSize={10} fontWeight="700" color="$white">官方帳號</Text>
            </XStack>
          </XStack>

          {/* Friend Count */}
          <Text fontSize={12} color="$color10" mt="$1" mb="$3">
            好友人數 {MOCK_FRIEND_COUNT.toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </Text>

          {/* Description */}
          <YStack p="$3" bg="$color2" rounded="$4" borderWidth={1} borderColor="$borderColor" mb="$4">
            <Text fontSize={14} color="$color11" lineHeight={20}>{MOCK_DESCRIPTION}</Text>
          </YStack>

          {/* Action Buttons */}
          <XStack gap="$3" mb="$5">
            {/* Add Friend / Start Chat */}
            <YStack
              flex={1} p="$3"
              bg={isFriend ? '$green3' : '$color2'}
              rounded="$4" borderWidth={1}
              borderColor={isFriend ? '$green6' : '$borderColor'}
              items="center" gap="$1" cursor="pointer"
              onPress={handleAddFriend}
              hoverStyle={{ bg: isFriend ? '$green4' : '$color3' }}
            >
              <YStack width={24} height={24} rounded={9999} bg="$green9" items="center" justify="center">
                {isFriend ? (
                  <ChatCircleIcon size={14} color="white" />
                ) : (
                  <Text fontSize={14} color="$white" fontWeight="700">+</Text>
                )}
              </YStack>
              <Text fontSize={12} fontWeight="600" color="$color12">
                {isFriend ? '開始聊天' : '加入好友'}
              </Text>
            </YStack>

            {/* Posts */}
            <YStack
              flex={1} p="$3" bg="$color2" rounded="$4" borderWidth={1} borderColor="$borderColor"
              items="center" gap="$1" cursor="pointer"
              onPress={() => showToast('貼文功能即將上線', { type: 'info' })}
              hoverStyle={{ bg: '$color3' }}
            >
              <XStack flexWrap="wrap" gap={3} width={24} height={24} items="center" justify="center">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <YStack key={i} width={10} height={10} rounded={3} bg="$color10" />
                ))}
              </XStack>
              <Text fontSize={12} fontWeight="600" color="$color12">{MOCK_POST_COUNT} 貼文</Text>
            </YStack>

            {/* Call */}
            <YStack
              flex={1} p="$3" bg="$color2" rounded="$4" borderWidth={1} borderColor="$borderColor"
              items="center" gap="$1" cursor="pointer"
              onPress={() => showToast('通話功能即將上線', { type: 'info' })}
              hoverStyle={{ bg: '$color3' }}
            >
              <YStack width={24} height={24} rounded={9999} bg="$color10" items="center" justify="center">
                <Text fontSize={10} color="$white" fontWeight="700">📞</Text>
              </YStack>
              <Text fontSize={12} fontWeight="600" color="$color12">通話</Text>
            </YStack>
          </XStack>

          {/* Social Platforms */}
          <YStack gap="$2" mb="$4">
            <Text fontSize={12} fontWeight="600" color="$color10" textTransform="uppercase">社群平台</Text>
            <YStack p="$3" bg="$color2" rounded="$4" borderWidth={1} borderColor="$borderColor">
              <Text fontSize={13} color="$color10" mb="$2">您也可透過其他社群平台確認資訊。</Text>
              <XStack gap="$3">
                <YStack width={32} height={32} rounded="$2" bg="$color5" items="center" justify="center">
                  <Text fontSize={14} fontWeight="700" color="$color11">f</Text>
                </YStack>
                <YStack width={32} height={32} rounded="$2" bg="$color5" items="center" justify="center">
                  <Text fontSize={14} fontWeight="700" color="$color11">ig</Text>
                </YStack>
              </XStack>
            </YStack>
          </YStack>

          {/* Account ID */}
          <YStack items="center" py="$4">
            <Text fontSize={14} color="$color10">@{oaId}</Text>
          </YStack>

          {/* Location */}
          <YStack items="flex-end" pb="$4">
            <Text fontSize={12} color="$color10">所在國家或地區：{MOCK_LOCATION}</Text>
          </YStack>
        </YStack>
      </ScrollView>
    </>
  )
}
```

- [ ] **Step 2: Run type check**

```bash
bun run check:all
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/interface/oa/OADetailContent.tsx
git commit -m "refactor(oa): extract shared OADetailContent component"
```

---

### Task 4: Refactor `OADetailSheet` to use `OADetailContent`

**Files:**
- Modify: `apps/web/src/interface/dialogs/OADetailSheet.tsx`

- [ ] **Step 1: Replace content with OADetailContent import**

Replace the entire file body (imports through component) to use the shared component. Keep `OADetailData` type, `OADetailSheet` wrapper, and `useOADetailSheet` hook.

```tsx
// apps/web/src/interface/dialogs/OADetailSheet.tsx
import { useState } from 'react'
import { Sheet } from 'tamagui'

import { OADetailContent, type OADetailContentData } from '~/interface/oa/OADetailContent'

export type OADetailData = OADetailContentData

type OADetailSheetProps = OADetailData & {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function OADetailSheet({
  id,
  name,
  oaId,
  imageUrl,
  open,
  onOpenChange,
}: OADetailSheetProps) {
  return (
    <Sheet modal open={open} onOpenChange={onOpenChange} snapPoints={[100]}>
      <Sheet.Overlay
        opacity={0.5}
        enterStyle={{ opacity: 0 }}
        exitStyle={{ opacity: 0 }}
      />
      <Sheet.Frame flex={1} bg="$background">
        <OADetailContent
          id={id}
          name={name}
          oaId={oaId}
          imageUrl={imageUrl}
          onClose={() => onOpenChange(false)}
          showCloseButton
        />
      </Sheet.Frame>
    </Sheet>
  )
}

export function useOADetailSheet() {
  const [selectedOA, setSelectedOA] = useState<OADetailData | null>(null)

  const openDetail = (oa: OADetailData) => {
    setSelectedOA(oa)
  }

  const DetailSheetComponent = selectedOA ? (
    <OADetailSheet
      id={selectedOA.id}
      name={selectedOA.name}
      oaId={selectedOA.oaId}
      imageUrl={selectedOA.imageUrl}
      open={true}
      onOpenChange={(open) => {
        if (!open) setSelectedOA(null)
      }}
    />
  ) : null

  return { openDetail, DetailSheetComponent }
}
```

- [ ] **Step 2: Verify existing consumers still work**

Check that imports in `main/index.tsx`, `FlexSimulatorSendDialog.tsx`, and `flex-simulator/index.tsx` are compatible. The `OADetailData` type and `useOADetailSheet` API are unchanged.

- [ ] **Step 3: Run type check**

```bash
bun run check:all
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/interface/dialogs/OADetailSheet.tsx
git commit -m "refactor(oa): OADetailSheet uses shared OADetailContent"
```

---

### Task 5: Create `OAScannerSheet` (web)

**Files:**
- Create: `apps/web/src/interface/dialogs/OAScannerSheet.tsx`

- [ ] **Step 1: Create scanner sheet component**

```tsx
// apps/web/src/interface/dialogs/OAScannerSheet.tsx
import { useState } from 'react'
import { Sheet, Text, XStack, YStack } from 'tamagui'
import { Scanner } from '@yudiel/react-qr-scanner'

import { oaClient } from '~/features/oa/client'
import { parseOAScanResult } from '~/features/oa/parse-qr'
import { showToast } from '~/interface/toast/Toast'
import { Button } from '~/interface/buttons/Button'
import { Input } from '~/interface/forms/Input'

import type { OADetailData } from '~/interface/dialogs/OADetailSheet'

type OAScannerSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onScanResult: (oa: OADetailData) => void
}

export function OAScannerSheet({ open, onOpenChange, onScanResult }: OAScannerSheetProps) {
  const [manualInput, setManualInput] = useState('')
  const [resolving, setResolving] = useState(false)

  const resolveOA = async (uniqueId: string) => {
    if (!uniqueId) return
    setResolving(true)
    try {
      const result = await oaClient.resolveOfficialAccount({ uniqueId })
      if (result.account) {
        onOpenChange(false)
        onScanResult({
          id: result.account.id,
          name: result.account.name,
          oaId: result.account.uniqueId,
          imageUrl: result.account.imageUrl || undefined,
        })
      }
    } catch {
      showToast('找不到此官方帳號', { type: 'error' })
    } finally {
      setResolving(false)
    }
  }

  const handleScan = (detectedCodes: Array<{ rawValue: string }>) => {
    if (detectedCodes.length === 0) return
    const content = detectedCodes[0].rawValue
    const uniqueId = parseOAScanResult(content)
    resolveOA(uniqueId)
  }

  const handleManualSubmit = () => {
    const uniqueId = parseOAScanResult(manualInput.trim())
    resolveOA(uniqueId)
  }

  return (
    <Sheet modal open={open} onOpenChange={onOpenChange} snapPoints={[80]}>
      <Sheet.Overlay
        opacity={0.5}
        enterStyle={{ opacity: 0 }}
        exitStyle={{ opacity: 0 }}
      />
      <Sheet.Frame flex={1} bg="$background" p="$4">
        <YStack gap="$4" flex={1}>
          <Text fontSize={18} fontWeight="700" color="$color12">
            掃描官方帳號
          </Text>

          {/* Camera Scanner */}
          <YStack height={280} rounded="$4" overflow="hidden" bg="$color3">
            <Scanner
              onScan={handleScan}
              onError={() => showToast('相機存取失敗', { type: 'error' })}
              styles={{ container: { width: '100%', height: '100%' } }}
            />
          </YStack>

          {/* Manual Input Fallback */}
          <YStack gap="$2">
            <Text fontSize={13} color="$color10">或輸入官方帳號 ID</Text>
            <XStack gap="$2">
              <Input
                flex={1}
                placeholder="@official-account"
                value={manualInput}
                onChangeText={setManualInput}
                onSubmitEditing={handleManualSubmit}
              />
              <Button onPress={handleManualSubmit} disabled={resolving || !manualInput.trim()}>
                {resolving ? '查詢中...' : '查詢'}
              </Button>
            </XStack>
          </YStack>
        </YStack>
      </Sheet.Frame>
    </Sheet>
  )
}

export function useOAScannerSheet() {
  const [open, setOpen] = useState(false)
  const [onResult, setOnResult] = useState<((oa: OADetailData) => void) | null>(null)

  const openScanner = (callback: (oa: OADetailData) => void) => {
    setOnResult(() => callback)
    setOpen(true)
  }

  const ScannerSheetComponent = (
    <OAScannerSheet
      open={open}
      onOpenChange={setOpen}
      onScanResult={(oa) => {
        onResult?.(oa)
        setOpen(false)
      }}
    />
  )

  return { openScanner, ScannerSheetComponent }
}
```

- [ ] **Step 2: Run type check**

```bash
bun run check:all
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/interface/dialogs/OAScannerSheet.tsx
git commit -m "feat(oa): add QR scanner sheet with manual input fallback"
```

---

### Task 6: Create `/oa/[oaId]` deep link route page

**Files:**
- Create: `apps/web/app/(app)/oa/[oaId].tsx`

- [ ] **Step 1: Create the route page**

```tsx
// apps/web/app/(app)/oa/[oaId].tsx
import { useActiveParams } from 'one'
import { memo } from 'react'
import { YStack, Text, Spinner } from 'tamagui'

import { oaClient } from '~/features/oa/client'
import { useTanQuery } from '~/query'
import { OADetailContent } from '~/interface/oa/OADetailContent'
import { useAuth } from '~/features/auth/client/authClient'

export const OADetailPage = memo(() => {
  const { oaId } = useActiveParams<{ oaId: string }>()
  const { state } = useAuth()

  const { data, isLoading, error } = useTanQuery({
    queryKey: ['oa', 'resolve', oaId],
    queryFn: () => oaClient.resolveOfficialAccount({ uniqueId: oaId! }),
    enabled: !!oaId,
  })

  if (isLoading) {
    return (
      <YStack flex={1} items="center" justify="center" bg="$background">
        <Spinner size="large" />
      </YStack>
    )
  }

  if (error || !data?.account) {
    return (
      <YStack flex={1} items="center" justify="center" bg="$background" gap="$3">
        <Text fontSize={16} fontWeight="600" color="$color12">
          找不到此官方帳號
        </Text>
        <Text fontSize={13} color="$color10">
          請確認 QR Code 或連結是否正確
        </Text>
      </YStack>
    )
  }

  const oa = data.account

  return (
    <YStack flex={1} bg="$background">
      <OADetailContent
        id={oa.id}
        name={oa.name}
        oaId={oa.uniqueId}
        imageUrl={oa.imageUrl || undefined}
        showCloseButton={false}
      />
    </YStack>
  )
})

export default OADetailPage
```

- [ ] **Step 2: Update auth guard to allow `/oa/` routes for logged-out users**

The current `_layout.tsx` auth guard only redirects logged-out users from `/home` and `/developers`. `/oa/` routes are already accessible to logged-out users — no change needed.

- [ ] **Step 3: Run type check**

```bash
bun run check:all
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/\(app\)/oa/\[oaId\].tsx
git commit -m "feat(oa): add /oa/[oaId] deep link route page"
```

---

### Task 7: Wire main page QR icon to scanner

**Files:**
- Modify: `apps/web/app/(app)/home/(tabs)/main/index.tsx`

- [ ] **Step 1: Add scanner hook and wire QR icon**

Add import and hook usage:

```tsx
// Add to imports (after existing useOADetailSheet import):
import { useOAScannerSheet } from '~/interface/dialogs/OAScannerSheet'
```

Add hook call (next to existing `useOADetailSheet`):

```tsx
const { openScanner, ScannerSheetComponent } = useOAScannerSheet()
```

Replace QR icon press handler (line 125):

```tsx
// Before:
onPress={() => showToast('QR Code scanner', { type: 'info' })}

// After:
onPress={() => openScanner((oa) => openDetail(oa))}
```

Add ScannerSheetComponent to render (before closing `</YStack>`):

```tsx
{ScannerSheetComponent}
{DetailSheetComponent}
```

- [ ] **Step 2: Remove unused showToast import if no other usages remain in file**

- [ ] **Step 3: Run type check**

```bash
bun run check:all
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/\(app\)/home/\(tabs\)/main/index.tsx
git commit -m "feat(oa): wire QR icon to scanner sheet on main page"
```

---

### Task 8: Final verification

- [ ] **Step 1: Run full type check + lint**

```bash
bun run check:all
```

- [ ] **Step 2: Run unit tests**

```bash
bun run --cwd apps/web test:unit
```

- [ ] **Step 3: Run formatter**

```bash
bun run format
```

- [ ] **Step 4: Final commit (if formatter changed anything)**

```bash
git add -A
git commit -m "chore(oa): format files"
```
