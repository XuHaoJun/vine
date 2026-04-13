# OA Manager — Rich Menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the OA admin manager rich menu feature: a `updateRichMenu` service method, 8 ConnectRPC admin handlers, and the web UI at `/manager/[oaId]/richmenu` with a list page and canvas editor.

**Architecture:** Server adds one new service method (`updateRichMenu`) and 8 RPC handlers to the existing `oaHandler`. Frontend adds a dedicated manager shell (`/(app)/manager/[oaId]/_layout.tsx`) with sidebar, a list page, and a canvas editor (`RichMenuEditor`) built with react-native-gesture-handler + reanimated for cross-platform drag/resize. All data access uses `useTanQuery`/`useTanMutation` calling `oaClient.*`.

**Tech Stack:** ConnectRPC (`@connectrpc/connect`), Protobuf codegen (`bun run --cwd packages/proto proto:generate`), Tamagui v2, react-native-gesture-handler v2.30, react-native-reanimated v4.3, react-hook-form + valibot, `@vine/richmenu-schema` (already exists), `useTanQuery`/`useTanMutation` from `~/query`.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `apps/server/src/services/oa.ts` | Modify | Add `updateRichMenu` method and expose in return |
| `apps/server/src/services/oa.test.ts` | Modify | Add test for `updateRichMenu` |
| `packages/proto/proto/oa/v1/oa.proto` | Modify | Add 10 admin messages + 8 RPCs |
| `apps/server/src/connect/oa.ts` | Modify | Add `toRichMenuItem`, `areaToDb` helpers + 8 handlers |
| `apps/web/app/(app)/manager/[oaId]/_layout.tsx` | Create | Sidebar shell; verifies OA ownership; renders `<Slot />` |
| `apps/web/app/(app)/manager/[oaId]/richmenu/index.tsx` | Create | List page: default + other menus, set-default/edit/delete |
| `apps/web/src/features/oa-manager/richmenu/types.ts` | Create | `Area`, `AreaBounds`, `MenuSize`, `EditorState` types |
| `apps/web/src/features/oa-manager/richmenu/templates.ts` | Create | Preset area layouts ported from Angular reference |
| `apps/web/src/features/oa-manager/richmenu/AreaOverlay.tsx` | Create | RNGH-powered draggable/resizable area on canvas |
| `apps/web/src/features/oa-manager/richmenu/RichMenuEditor.tsx` | Create | Full editor: settings bar, canvas, right panel, save flow |
| `apps/web/app/(app)/manager/[oaId]/richmenu/create.tsx` | Create | Thin wrapper: renders `<RichMenuEditor />` in create mode |
| `apps/web/app/(app)/manager/[oaId]/richmenu/[richMenuId].tsx` | Create | Fetches menu, renders `<RichMenuEditor />` in edit mode |
| `apps/web/app/(app)/developers/console/channel/[channelId]/index.tsx` | Modify | Add "Manage →" button linking to manager |
| `apps/web/app/routes.d.ts` | Modify | Register new manager routes for type safety |

---

## Task 1: Add `updateRichMenu` to OA service (TDD)

**Files:**
- Modify: `apps/server/src/services/oa.ts` (around line 638, after `createRichMenu`)
- Modify: `apps/server/src/services/oa.test.ts`

- [ ] **Step 1: Write the failing test**

Add this describe block at the end of `apps/server/src/services/oa.test.ts`:

```ts
describe('createOAService — updateRichMenu', () => {
  it('calls db.update with the right values', async () => {
    const mockDb = createMockDb()
    const oa = createOAService({ db: mockDb as any, database: {} as any })

    await oa.updateRichMenu('oa-123', 'richmenu-456', {
      name: 'Updated',
      chatBarText: 'Tap',
      selected: true,
      sizeWidth: 2500,
      sizeHeight: 1686,
      areas: [
        {
          bounds: { x: 0, y: 0, width: 2500, height: 1686 },
          action: { type: 'message', text: 'Hello' },
        },
      ],
    })

    expect(mockDb.update).toHaveBeenCalled()
    const setCall = mockDb.update.mock.results[0].value.set.mock.calls[0][0]
    expect(setCall.name).toBe('Updated')
    expect(setCall.selected).toBe('true')
    expect(setCall.sizeWidth).toBe('2500')
    expect(setCall.areas).toBe(
      JSON.stringify([
        {
          bounds: { x: 0, y: 0, width: 2500, height: 1686 },
          action: { type: 'message', text: 'Hello' },
        },
      ]),
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun run --cwd apps/server test -- --reporter=verbose src/services/oa.test.ts
```

Expected: FAIL with `oa.updateRichMenu is not a function`

- [ ] **Step 3: Implement `updateRichMenu`**

In `apps/server/src/services/oa.ts`, add this function after `createRichMenu` (around line 638):

```ts
  async function updateRichMenu(
    oaId: string,
    richMenuId: string,
    input: {
      name: string
      chatBarText: string
      selected: boolean
      sizeWidth: number
      sizeHeight: number
      areas: unknown[]
    },
  ) {
    await db
      .update(oaRichMenu)
      .set({
        name: input.name,
        chatBarText: input.chatBarText,
        selected: input.selected ? 'true' : 'false',
        sizeWidth: String(input.sizeWidth),
        sizeHeight: String(input.sizeHeight),
        areas: JSON.stringify(input.areas),
        updatedAt: new Date().toISOString(),
      })
      .where(and(eq(oaRichMenu.oaId, oaId), eq(oaRichMenu.richMenuId, richMenuId)))
  }
```

Then in the `return { ... }` block at the bottom of `createOAService` (after `createRichMenu,`), add:

```ts
    updateRichMenu,
```

- [ ] **Step 4: Run test to verify it passes**

```bash
bun run --cwd apps/server test -- --reporter=verbose src/services/oa.test.ts
```

Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/services/oa.ts apps/server/src/services/oa.test.ts
git commit -m "feat(oa): add updateRichMenu service method"
```

---

## Task 2: Add admin rich menu proto messages + RPCs

**Files:**
- Modify: `packages/proto/proto/oa/v1/oa.proto`

- [ ] **Step 1: Add admin rich menu messages to the proto**

In `oa.proto`, insert the following block after line 364 (after `GetActiveRichMenuResponse { ... }`) and before `// ── Service ──`:

```protobuf
// ── Rich Menu (admin) ──

message RichMenuItem {
  string rich_menu_id = 1;
  string name = 2;
  string chat_bar_text = 3;
  bool selected = 4;
  int32 size_width = 5;
  int32 size_height = 6;
  repeated RichMenuArea areas = 7;
  bool has_image = 8;
}

message ListRichMenusRequest {
  string official_account_id = 1;
}

message ListRichMenusResponse {
  repeated RichMenuItem menus = 1;
  optional string default_rich_menu_id = 2;
}

message GetRichMenuRequest {
  string official_account_id = 1;
  string rich_menu_id = 2;
}

message GetRichMenuResponse {
  RichMenuItem menu = 1;
  optional bytes image = 2;
  optional string image_content_type = 3;
}

message CreateRichMenuRequest {
  string official_account_id = 1;
  string name = 2;
  string chat_bar_text = 3;
  bool selected = 4;
  int32 size_width = 5;
  int32 size_height = 6;
  repeated RichMenuArea areas = 7;
}

message CreateRichMenuResponse {
  string rich_menu_id = 1;
}

message UpdateRichMenuRequest {
  string official_account_id = 1;
  string rich_menu_id = 2;
  string name = 3;
  string chat_bar_text = 4;
  bool selected = 5;
  int32 size_width = 6;
  int32 size_height = 7;
  repeated RichMenuArea areas = 8;
}

message UpdateRichMenuResponse {}

message DeleteRichMenuRequest {
  string official_account_id = 1;
  string rich_menu_id = 2;
}

message DeleteRichMenuResponse {}

message SetDefaultRichMenuRequest {
  string official_account_id = 1;
  string rich_menu_id = 2;
}

message SetDefaultRichMenuResponse {}

message ClearDefaultRichMenuRequest {
  string official_account_id = 1;
}

message ClearDefaultRichMenuResponse {}

message UploadRichMenuImageRequest {
  string official_account_id = 1;
  string rich_menu_id = 2;
  bytes image = 3;
  string content_type = 4;
}

message UploadRichMenuImageResponse {}
```

- [ ] **Step 2: Add 8 RPCs to OAService**

At the end of `service OAService { ... }` in `oa.proto`, before the closing `}`, add:

```protobuf
  rpc ListRichMenus(ListRichMenusRequest) returns (ListRichMenusResponse);
  rpc GetRichMenu(GetRichMenuRequest) returns (GetRichMenuResponse);
  rpc CreateRichMenu(CreateRichMenuRequest) returns (CreateRichMenuResponse);
  rpc UpdateRichMenu(UpdateRichMenuRequest) returns (UpdateRichMenuResponse);
  rpc DeleteRichMenu(DeleteRichMenuRequest) returns (DeleteRichMenuResponse);
  rpc SetDefaultRichMenu(SetDefaultRichMenuRequest) returns (SetDefaultRichMenuResponse);
  rpc ClearDefaultRichMenu(ClearDefaultRichMenuRequest) returns (ClearDefaultRichMenuResponse);
  rpc UploadRichMenuImage(UploadRichMenuImageRequest) returns (UploadRichMenuImageResponse);
```

- [ ] **Step 3: Run codegen**

```bash
bun run --cwd packages/proto proto:generate
```

Expected: Exits 0. Updated files in `packages/proto/gen/oa/v1/`.

- [ ] **Step 4: Commit**

```bash
git add packages/proto/proto/oa/v1/oa.proto packages/proto/gen/
git commit -m "feat(proto): add admin rich menu RPCs to OAService"
```

---

## Task 3: Add ConnectRPC handlers

**Files:**
- Modify: `apps/server/src/connect/oa.ts`

- [ ] **Step 1: Add helper functions**

In `apps/server/src/connect/oa.ts`, add these two helper functions after the existing `toProtoWebhook` function (around line 123):

```ts
type DbRichMenuRow = {
  richMenuId: string
  name: string
  chatBarText: string
  selected: string
  sizeWidth: string
  sizeHeight: string
  areas: string
  hasImage: string
}

function toRichMenuItem(m: DbRichMenuRow) {
  const areas = (
    JSON.parse(m.areas) as Array<{
      bounds: { x: number; y: number; width: number; height: number }
      action: Record<string, string | undefined>
    }>
  ).map((a) => ({
    bounds: {
      x: a.bounds.x,
      y: a.bounds.y,
      width: a.bounds.width,
      height: a.bounds.height,
    },
    action: {
      type: a.action['type'] ?? '',
      label: a.action['label'],
      uri: a.action['uri'],
      data: a.action['data'],
      text: a.action['text'],
      richMenuAliasId: a.action['richMenuAliasId'],
      inputOption: a.action['inputOption'],
      displayText: a.action['displayText'],
    },
  }))
  return {
    richMenuId: m.richMenuId,
    name: m.name,
    chatBarText: m.chatBarText,
    selected: m.selected === 'true',
    sizeWidth: Number(m.sizeWidth),
    sizeHeight: Number(m.sizeHeight),
    areas,
    hasImage: m.hasImage === 'true',
  }
}

function areaToDb(area: {
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
}) {
  const action: Record<string, string> = { type: area.action.type }
  if (area.action.label) action['label'] = area.action.label
  if (area.action.uri) action['uri'] = area.action.uri
  if (area.action.data) action['data'] = area.action.data
  if (area.action.text) action['text'] = area.action.text
  if (area.action.richMenuAliasId) action['richMenuAliasId'] = area.action.richMenuAliasId
  if (area.action.inputOption) action['inputOption'] = area.action.inputOption
  if (area.action.displayText) action['displayText'] = area.action.displayText
  return { bounds: area.bounds, action }
}
```

- [ ] **Step 2: Add the 8 RPC handlers to `oaServiceImpl`**

In `apps/server/src/connect/oa.ts`, inside the `oaServiceImpl` object (after the closing `}` of `getActiveRichMenu`), add:

```ts
      async listRichMenus(req, ctx) {
        const auth = requireAuthData(ctx)
        await assertOfficialAccountOwnedByUser(deps, req.officialAccountId, auth.id)
        const menus = await deps.oa.getRichMenuList(req.officialAccountId)
        const defaultMenu = await deps.oa.getDefaultRichMenu(req.officialAccountId)
        return {
          menus: menus.map(toRichMenuItem),
          defaultRichMenuId: defaultMenu?.richMenuId,
        }
      },
      async getRichMenu(req, ctx) {
        const auth = requireAuthData(ctx)
        await assertOfficialAccountOwnedByUser(deps, req.officialAccountId, auth.id)
        const menu = await deps.oa.getRichMenu(req.officialAccountId, req.richMenuId)
        if (!menu) throw new ConnectError('Rich menu not found', Code.NotFound)
        let imageBytes: Uint8Array | undefined
        let imageContentType: string | undefined
        if (menu.hasImage === 'true') {
          const key = `richmenu/${req.officialAccountId}/${req.richMenuId}.jpg`
          const exists = await deps.drive.exists(key)
          if (exists) {
            const file = await deps.drive.get(key)
            imageBytes = new Uint8Array(file.content)
            imageContentType = file.mimeType ?? 'image/jpeg'
          }
        }
        return { menu: toRichMenuItem(menu), image: imageBytes, imageContentType }
      },
      async createRichMenu(req, ctx) {
        const auth = requireAuthData(ctx)
        await assertOfficialAccountOwnedByUser(deps, req.officialAccountId, auth.id)
        const menu = await deps.oa.createRichMenu({
          oaId: req.officialAccountId,
          name: req.name,
          chatBarText: req.chatBarText,
          selected: req.selected,
          sizeWidth: req.sizeWidth,
          sizeHeight: req.sizeHeight,
          areas: req.areas.map(areaToDb),
        })
        return { richMenuId: menu.richMenuId }
      },
      async updateRichMenu(req, ctx) {
        const auth = requireAuthData(ctx)
        await assertOfficialAccountOwnedByUser(deps, req.officialAccountId, auth.id)
        await deps.oa.updateRichMenu(req.officialAccountId, req.richMenuId, {
          name: req.name,
          chatBarText: req.chatBarText,
          selected: req.selected,
          sizeWidth: req.sizeWidth,
          sizeHeight: req.sizeHeight,
          areas: req.areas.map(areaToDb),
        })
        return {}
      },
      async deleteRichMenu(req, ctx) {
        const auth = requireAuthData(ctx)
        await assertOfficialAccountOwnedByUser(deps, req.officialAccountId, auth.id)
        await deps.oa.deleteRichMenu(req.officialAccountId, req.richMenuId)
        const key = `richmenu/${req.officialAccountId}/${req.richMenuId}.jpg`
        const exists = await deps.drive.exists(key)
        if (exists) await deps.drive.delete(key)
        return {}
      },
      async setDefaultRichMenu(req, ctx) {
        const auth = requireAuthData(ctx)
        await assertOfficialAccountOwnedByUser(deps, req.officialAccountId, auth.id)
        await deps.oa.setDefaultRichMenu(req.officialAccountId, req.richMenuId)
        return {}
      },
      async clearDefaultRichMenu(req, ctx) {
        const auth = requireAuthData(ctx)
        await assertOfficialAccountOwnedByUser(deps, req.officialAccountId, auth.id)
        await deps.oa.clearDefaultRichMenu(req.officialAccountId)
        return {}
      },
      async uploadRichMenuImage(req, ctx) {
        const auth = requireAuthData(ctx)
        await assertOfficialAccountOwnedByUser(deps, req.officialAccountId, auth.id)
        const key = `richmenu/${req.officialAccountId}/${req.richMenuId}.jpg`
        const buffer = Buffer.from(req.image)
        await deps.drive.put(key, buffer, req.contentType)
        await deps.oa.setRichMenuImage(req.officialAccountId, req.richMenuId, true)
        return {}
      },
```

- [ ] **Step 3: Run type check**

```bash
bun run --cwd apps/server check
```

Expected: no type errors

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/connect/oa.ts
git commit -m "feat(connect): add admin rich menu RPC handlers"
```

---

## Task 4: Manager layout + routes

**Files:**
- Create: `apps/web/app/(app)/manager/[oaId]/_layout.tsx`
- Modify: `apps/web/app/routes.d.ts`

- [ ] **Step 1: Create `apps/web/app/(app)/manager/[oaId]/_layout.tsx`**

```tsx
import { Slot, usePathname, useRouter, Link, useActiveParams } from 'one'
import { useEffect } from 'react'
import { SizableText, Spinner, XStack, YStack } from 'tamagui'

import { showError } from '~/interface/dialogs/actions'
import { Pressable } from '~/interface/buttons/Pressable'
import { useTanQuery } from '~/query'
import { oaClient } from '~/features/oa/client'

function normalizePath(path: string) {
  return path.replace(/\/$/, '') || '/'
}

export default function ManagerLayout() {
  const params = useActiveParams<{ oaId: string }>()
  const oaId = params.oaId
  const router = useRouter()
  const pathname = usePathname()
  const path = normalizePath(pathname)

  const { data: accountData, isLoading, isError } = useTanQuery({
    queryKey: ['oa', 'account', oaId],
    queryFn: () => oaClient.getOfficialAccount({ id: oaId! }),
    enabled: !!oaId,
  })

  useEffect(() => {
    if (isError) {
      showError(new Error('Account not found or access denied'))
      router.navigate('/developers/console')
    }
  }, [isError, router])

  if (isLoading) {
    return (
      <YStack flex={1} items="center" justify="center">
        <Spinner size="large" />
      </YStack>
    )
  }

  const oa = accountData?.account
  const isRichMenuActive = path.includes('/richmenu')

  return (
    <YStack flex={1} bg="$background" $platform-web={{ height: '100vh', minHeight: '100vh' }}>
      {/* Header */}
      <XStack
        height="$6"
        px="$5"
        shrink={0}
        items="center"
        bg="$background"
        borderBottomWidth={1}
        borderColor="$borderColor"
      >
        <SizableText size="$4" fontWeight="700" color="$color12">
          LINE Official Account Manager
          {oa ? ` · ${oa.name}` : ''}
        </SizableText>
      </XStack>

      <XStack flex={1} style={{ minHeight: 0 }} $platform-web={{ overflow: 'hidden' }}>
        {/* Sidebar */}
        <YStack
          width={200}
          shrink={0}
          bg="$background"
          borderRightWidth={1}
          borderColor="$borderColor"
          $platform-web={{ overflowY: 'auto' }}
          p="$3"
          gap="$4"
        >
          <YStack gap="$1">
            <SizableText
              size="$1"
              fontWeight="700"
              color="$color9"
              textTransform="uppercase"
              mb="$2"
            >
              Chat screen
            </SizableText>
            <Link href={`/manager/${oaId}/richmenu` as any}>
              <Pressable
                role="link"
                py="$2"
                px="$3"
                rounded="$3"
                bg={isRichMenuActive ? '$color3' : 'transparent'}
                hoverStyle={{ bg: isRichMenuActive ? '$color3' : '$color2' }}
              >
                <SizableText
                  size="$2"
                  fontWeight={isRichMenuActive ? '700' : '500'}
                  color={isRichMenuActive ? '$color12' : '$color11'}
                >
                  Rich menus
                </SizableText>
              </Pressable>
            </Link>
          </YStack>
        </YStack>

        {/* Main content */}
        <YStack flex={1} style={{ minHeight: 0 }} $platform-web={{ overflowY: 'auto' }}>
          <YStack p="$6" maxW={1120} width="100%" mx="auto">
            <Slot />
          </YStack>
        </YStack>
      </XStack>
    </YStack>
  )
}
```

- [ ] **Step 2: Update `apps/web/app/routes.d.ts`**

Add new dynamic routes in each of the three sections. In the `DynamicRoutes` union, add after the last existing entry:

```ts
        | `/(app)/manager/${OneRouter.SingleRoutePart<T>}/richmenu`
        | `/(app)/manager/${OneRouter.SingleRoutePart<T>}/richmenu/create`
        | `/(app)/manager/${OneRouter.SingleRoutePart<T>}/richmenu/${OneRouter.SingleRoutePart<T>}`
        | `/manager/${OneRouter.SingleRoutePart<T>}/richmenu`
        | `/manager/${OneRouter.SingleRoutePart<T>}/richmenu/create`
        | `/manager/${OneRouter.SingleRoutePart<T>}/richmenu/${OneRouter.SingleRoutePart<T>}`
```

In the `DynamicRouteTemplate` union, add:

```ts
        | `/(app)/manager/[oaId]/richmenu`
        | `/(app)/manager/[oaId]/richmenu/create`
        | `/(app)/manager/[oaId]/richmenu/[richMenuId]`
        | `/manager/[oaId]/richmenu`
        | `/manager/[oaId]/richmenu/create`
        | `/manager/[oaId]/richmenu/[richMenuId]`
```

In the `RouteTypes` object, add:

```ts
        '/(app)/manager/[oaId]/richmenu': RouteInfo<{ oaId: string }>
        '/(app)/manager/[oaId]/richmenu/create': RouteInfo<{ oaId: string }>
        '/(app)/manager/[oaId]/richmenu/[richMenuId]': RouteInfo<{ oaId: string; richMenuId: string }>
        '/manager/[oaId]/richmenu': RouteInfo<{ oaId: string }>
        '/manager/[oaId]/richmenu/create': RouteInfo<{ oaId: string }>
        '/manager/[oaId]/richmenu/[richMenuId]': RouteInfo<{ oaId: string; richMenuId: string }>
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/'(app)'/manager/ apps/web/app/routes.d.ts
git commit -m "feat(manager): add OA manager layout and route types"
```

---

## Task 5: Rich menu list page

**Files:**
- Create: `apps/web/app/(app)/manager/[oaId]/richmenu/index.tsx`

- [ ] **Step 1: Create the list page**

```tsx
import { useActiveParams, useRouter, createRoute } from 'one'
import { memo } from 'react'
import { Image } from 'react-native'
import { SizableText, Spinner, XStack, YStack } from 'tamagui'

import { dialogConfirm, showError } from '~/interface/dialogs/actions'
import { showToast } from '~/interface/toast/Toast'
import { Button } from '~/interface/buttons/Button'
import { useTanMutation, useTanQuery, useTanQueryClient } from '~/query'
import { oaClient } from '~/features/oa/client'

const route = createRoute<'/(app)/manager/[oaId]/richmenu'>()

// Shows the image thumbnail if hasImage is true, otherwise a "No image" box
const RichMenuThumbnail = memo(
  ({
    oaId,
    richMenuId,
    hasImage,
  }: {
    oaId: string
    richMenuId: string
    hasImage: boolean
  }) => {
    const { data } = useTanQuery({
      queryKey: ['oa', 'richmenu', oaId, richMenuId],
      queryFn: () => oaClient.getRichMenu({ officialAccountId: oaId, richMenuId }),
      enabled: hasImage,
    })

    if (!hasImage || !data?.image?.length) {
      return (
        <YStack
          width={80}
          height={46}
          bg="$color3"
          rounded="$2"
          items="center"
          justify="center"
          shrink={0}
        >
          <SizableText size="$1" color="$color9">
            No image
          </SizableText>
        </YStack>
      )
    }

    const base64 = btoa(Array.from(data.image).map((b) => String.fromCharCode(b)).join(''))
    const mimeType = data.imageContentType || 'image/jpeg'
    const uri = `data:${mimeType};base64,${base64}`

    return (
      <YStack width={80} height={46} rounded="$2" overflow="hidden" bg="$color3" shrink={0}>
        <Image source={{ uri }} style={{ width: 80, height: 46 }} resizeMode="cover" />
      </YStack>
    )
  },
)

export const RichMenuListPage = memo(() => {
  const params = useActiveParams<{ oaId: string }>()
  const oaId = params.oaId!
  const router = useRouter()
  const qc = useTanQueryClient()

  const { data, isLoading } = useTanQuery({
    queryKey: ['oa', 'richmenu-list', oaId],
    queryFn: () => oaClient.listRichMenus({ officialAccountId: oaId }),
    enabled: !!oaId,
  })

  const setDefaultMutation = useTanMutation({
    mutationFn: (richMenuId: string) =>
      oaClient.setDefaultRichMenu({ officialAccountId: oaId, richMenuId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['oa', 'richmenu-list', oaId] })
      showToast('Default menu updated', { type: 'success' })
    },
    onError: (e) => showError(e, 'Failed to set default'),
  })

  const deleteMutation = useTanMutation({
    mutationFn: (richMenuId: string) =>
      oaClient.deleteRichMenu({ officialAccountId: oaId, richMenuId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['oa', 'richmenu-list', oaId] })
      showToast('Menu deleted', { type: 'success' })
    },
    onError: (e) => showError(e, 'Failed to delete menu'),
  })

  const handleDelete = async (richMenuId: string, name: string) => {
    const confirmed = await dialogConfirm({
      title: `Delete "${name}"?`,
      description: 'This cannot be undone.',
    })
    if (confirmed) deleteMutation.mutate(richMenuId)
  }

  if (isLoading) {
    return (
      <YStack flex={1} items="center" py="$10">
        <Spinner size="large" />
      </YStack>
    )
  }

  const menus = data?.menus ?? []
  const defaultId = data?.defaultRichMenuId
  const defaultMenu = defaultId ? menus.find((m) => m.richMenuId === defaultId) : undefined
  const otherMenus = menus.filter((m) => m.richMenuId !== defaultId)

  return (
    <YStack gap="$6">
      {/* Page header */}
      <XStack justify="space-between" items="center">
        <YStack gap="$1">
          <SizableText size="$7" fontWeight="700" color="$color12">
            Rich menus
          </SizableText>
          <SizableText size="$2" color="$color10">
            Create custom menus shown in the chat screen
          </SizableText>
        </YStack>
        <Button onPress={() => router.navigate(`/manager/${oaId}/richmenu/create` as any)}>
          + Create
        </Button>
      </XStack>

      {/* Empty state */}
      {menus.length === 0 && (
        <YStack
          py="$10"
          items="center"
          gap="$3"
          borderWidth={1}
          borderColor="$borderColor"
          rounded="$4"
        >
          <SizableText size="$4" color="$color11" fontWeight="600">
            No rich menus yet
          </SizableText>
          <SizableText size="$2" color="$color10">
            Create a menu and set it as default to show it to all users automatically.
          </SizableText>
        </YStack>
      )}

      {/* Default menu */}
      {defaultMenu && (
        <YStack gap="$2">
          <SizableText size="$1" fontWeight="700" color="$color9" textTransform="uppercase">
            Default menu
          </SizableText>
          <MenuCard
            menu={defaultMenu}
            oaId={oaId}
            isDefault
            onEdit={() =>
              router.navigate(`/manager/${oaId}/richmenu/${defaultMenu.richMenuId}` as any)
            }
            onDelete={() => handleDelete(defaultMenu.richMenuId, defaultMenu.name)}
          />
        </YStack>
      )}

      {/* Other menus */}
      {otherMenus.length > 0 && (
        <YStack gap="$2">
          <SizableText size="$1" fontWeight="700" color="$color9" textTransform="uppercase">
            Other menus
          </SizableText>
          {otherMenus.map((menu) => (
            <MenuCard
              key={menu.richMenuId}
              menu={menu}
              oaId={oaId}
              isDefault={false}
              onSetDefault={() => setDefaultMutation.mutate(menu.richMenuId)}
              onEdit={() =>
                router.navigate(`/manager/${oaId}/richmenu/${menu.richMenuId}` as any)
              }
              onDelete={() => handleDelete(menu.richMenuId, menu.name)}
            />
          ))}
        </YStack>
      )}
    </YStack>
  )
})

type MenuCardProps = {
  menu: { richMenuId: string; name: string; areas: unknown[]; sizeWidth: number; sizeHeight: number; chatBarText: string; hasImage: boolean }
  oaId: string
  isDefault: boolean
  onSetDefault?: () => void
  onEdit: () => void
  onDelete: () => void
}

const MenuCard = memo(
  ({ menu, oaId, isDefault, onSetDefault, onEdit, onDelete }: MenuCardProps) => (
    <XStack
      borderWidth={1}
      borderColor="$borderColor"
      rounded="$3"
      p="$3"
      gap="$3"
      items="center"
      bg={isDefault ? '$green1' : '$background'}
    >
      <RichMenuThumbnail oaId={oaId} richMenuId={menu.richMenuId} hasImage={menu.hasImage} />

      <YStack flex={1} gap="$1">
        <SizableText size="$3" fontWeight="600" color="$color12">
          {menu.name}
        </SizableText>
        <SizableText size="$1" color="$color10">
          {menu.areas.length} areas · {menu.sizeWidth}×{menu.sizeHeight} · "{menu.chatBarText}"
        </SizableText>
      </YStack>

      <XStack gap="$2" items="center">
        {isDefault && (
          <YStack
            px="$2"
            py="$1"
            rounded="$2"
            bg="$green3"
          >
            <SizableText size="$1" fontWeight="700" color="$green10">
              DEFAULT
            </SizableText>
          </YStack>
        )}
        {!isDefault && onSetDefault && (
          <Button size="$2" variant="outlined" onPress={onSetDefault}>
            Set default
          </Button>
        )}
        <Button size="$2" onPress={onEdit}>
          Edit
        </Button>
        <Button size="$2" variant="outlined" theme="red" onPress={onDelete}>
          Delete
        </Button>
      </XStack>
    </XStack>
  ),
)

export default RichMenuListPage
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/'(app)'/manager/
git commit -m "feat(manager): add rich menu list page"
```

---

## Task 6: Types and template data

**Files:**
- Create: `apps/web/src/features/oa-manager/richmenu/types.ts`
- Create: `apps/web/src/features/oa-manager/richmenu/templates.ts`

- [ ] **Step 1: Create `types.ts`**

```ts
import type { RichMenuAction } from '@vine/richmenu-schema'

export type { RichMenuAction }

export type AreaBounds = {
  x: number
  y: number
  w: number
  h: number
}

export type Area = {
  id: string // client-side UUID for React keys
  bounds: AreaBounds
  action: RichMenuAction
}

export type MenuSize = '2500x1686' | '2500x843'

export type EditorState = {
  name: string
  size: MenuSize
  chatBarText: string
  selected: boolean
  areas: Area[]
  selectedAreaId: string | null
  imageDataUrl: string | null // base64, for display + upload
  imageChanged: boolean // true if user picked a new image this session
}

/** Convert internal w/h bounds to the protobuf/DB {width,height} format */
export function boundsToProto(b: AreaBounds) {
  return { x: b.x, y: b.y, width: b.w, height: b.h }
}

/** Convert protobuf {width,height} bounds to internal {w,h} format */
export function boundsFromProto(b: { x: number; y: number; width: number; height: number }): AreaBounds {
  return { x: b.x, y: b.y, w: b.width, h: b.height }
}
```

- [ ] **Step 2: Create `templates.ts`**

Port from `learn-projects/richmenu-editor/default-areas.ts`, removing `$localize` and image paths:

```ts
import type { AreaBounds } from './types'

export type Template = {
  label: string
  bounds: AreaBounds[]
}

export const TEMPLATES: Record<string, Template[]> = {
  '2500x1686': [
    {
      label: '1 area',
      bounds: [{ x: 0, y: 0, w: 2500, h: 1686 }],
    },
    {
      label: '2 areas (wide + narrow)',
      bounds: [
        { x: 0, y: 0, w: 1666, h: 1686 },
        { x: 1667, y: 0, w: 833, h: 1686 },
      ],
    },
    {
      label: '2 areas (top + bottom)',
      bounds: [
        { x: 0, y: 0, w: 2500, h: 843 },
        { x: 0, y: 843, w: 2500, h: 843 },
      ],
    },
    {
      label: '2 areas (equal halves)',
      bounds: [
        { x: 0, y: 0, w: 1250, h: 1686 },
        { x: 1250, y: 0, w: 1250, h: 1686 },
      ],
    },
    {
      label: '3 areas (left + 2 right)',
      bounds: [
        { x: 0, y: 0, w: 1666, h: 1686 },
        { x: 1667, y: 0, w: 833, h: 843 },
        { x: 1667, y: 844, w: 833, h: 843 },
      ],
    },
    {
      label: '3 areas (left + 2 right, equal)',
      bounds: [
        { x: 0, y: 0, w: 1250, h: 1686 },
        { x: 1250, y: 0, w: 1250, h: 843 },
        { x: 1250, y: 844, w: 1250, h: 843 },
      ],
    },
    {
      label: '3 areas (equal thirds)',
      bounds: [
        { x: 0, y: 0, w: 833, h: 1686 },
        { x: 833, y: 0, w: 833, h: 1686 },
        { x: 1666, y: 0, w: 833, h: 1686 },
      ],
    },
    {
      label: '4 areas (1 top + 3 bottom)',
      bounds: [
        { x: 0, y: 0, w: 2500, h: 843 },
        { x: 0, y: 843, w: 833, h: 843 },
        { x: 833, y: 843, w: 833, h: 843 },
        { x: 1666, y: 843, w: 833, h: 843 },
      ],
    },
    {
      label: '4 areas (2×2 grid)',
      bounds: [
        { x: 0, y: 0, w: 1250, h: 843 },
        { x: 1250, y: 0, w: 1250, h: 843 },
        { x: 0, y: 843, w: 1250, h: 843 },
        { x: 1250, y: 843, w: 1250, h: 843 },
      ],
    },
    {
      label: '6 areas (2×3 grid)',
      bounds: [
        { x: 0, y: 0, w: 833, h: 843 },
        { x: 833, y: 0, w: 833, h: 843 },
        { x: 1666, y: 0, w: 833, h: 843 },
        { x: 0, y: 843, w: 833, h: 843 },
        { x: 833, y: 843, w: 833, h: 843 },
        { x: 1666, y: 843, w: 833, h: 843 },
      ],
    },
  ],
  '2500x843': [
    {
      label: '1 area',
      bounds: [{ x: 0, y: 0, w: 2500, h: 843 }],
    },
    {
      label: '2 areas (equal halves)',
      bounds: [
        { x: 0, y: 0, w: 1250, h: 843 },
        { x: 1250, y: 0, w: 1250, h: 843 },
      ],
    },
    {
      label: '2 areas (narrow + wide)',
      bounds: [
        { x: 0, y: 0, w: 833, h: 843 },
        { x: 833, y: 0, w: 1666, h: 843 },
      ],
    },
    {
      label: '2 areas (wide + narrow)',
      bounds: [
        { x: 0, y: 0, w: 1666, h: 843 },
        { x: 1666, y: 0, w: 833, h: 843 },
      ],
    },
    {
      label: '3 areas (equal thirds)',
      bounds: [
        { x: 0, y: 0, w: 833, h: 843 },
        { x: 833, y: 0, w: 833, h: 843 },
        { x: 1666, y: 0, w: 833, h: 843 },
      ],
    },
  ],
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/oa-manager/
git commit -m "feat(oa-manager): add richmenu types and template data"
```

---

## Task 7: AreaOverlay component

**Files:**
- Create: `apps/web/src/features/oa-manager/richmenu/AreaOverlay.tsx`

- [ ] **Step 1: Create `AreaOverlay.tsx`**

```tsx
import { memo, useEffect } from 'react'
import { GestureDetector, Gesture } from 'react-native-gesture-handler'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  runOnJS,
} from 'react-native-reanimated'
import { SizableText, YStack } from 'tamagui'

import type { Area, AreaBounds } from './types'

type Props = {
  area: Area
  label: string // e.g. "A", "B"
  scaleFactor: number
  isSelected: boolean
  canvasHeightPx: number // actual pixel height (1686 or 843)
  onSelect: (id: string) => void
  onUpdate: (id: string, bounds: AreaBounds) => void
  onDelete: (id: string) => void
}

export const AreaOverlay = memo(
  ({
    area,
    label,
    scaleFactor,
    isSelected,
    canvasHeightPx,
    onSelect,
    onUpdate,
    onDelete,
  }: Props) => {
    const { bounds } = area

    // Shared values in display pixels
    const tx = useSharedValue(bounds.x * scaleFactor)
    const ty = useSharedValue(bounds.y * scaleFactor)
    const tw = useSharedValue(bounds.w * scaleFactor)
    const th = useSharedValue(bounds.h * scaleFactor)

    // Keep shared values in sync when bounds change from outside (e.g. number inputs)
    useEffect(() => {
      tx.value = bounds.x * scaleFactor
      ty.value = bounds.y * scaleFactor
      tw.value = bounds.w * scaleFactor
      th.value = bounds.h * scaleFactor
    }, [bounds.x, bounds.y, bounds.w, bounds.h, scaleFactor])

    const canvasW = 2500 * scaleFactor
    const canvasH = canvasHeightPx * scaleFactor

    const startX = useSharedValue(0)
    const startY = useSharedValue(0)
    const startW = useSharedValue(0)
    const startH = useSharedValue(0)

    function commitUpdate(nx: number, ny: number, nw: number, nh: number) {
      const cw = Math.max(20, Math.min(nw / scaleFactor, 2500))
      const ch = Math.max(20, Math.min(nh / scaleFactor, canvasHeightPx))
      const cx = Math.max(0, Math.min(nx / scaleFactor, 2500 - cw))
      const cy = Math.max(0, Math.min(ny / scaleFactor, canvasHeightPx - ch))
      onUpdate(area.id, {
        x: Math.round(cx),
        y: Math.round(cy),
        w: Math.round(cw),
        h: Math.round(ch),
      })
    }

    const tapGesture = Gesture.Tap().onEnd(() => {
      runOnJS(onSelect)(area.id)
    })

    const panGesture = Gesture.Pan()
      .minDistance(5)
      .onStart(() => {
        startX.value = tx.value
        startY.value = ty.value
      })
      .onUpdate((e) => {
        tx.value = Math.max(0, Math.min(startX.value + e.translationX, canvasW - tw.value))
        ty.value = Math.max(0, Math.min(startY.value + e.translationY, canvasH - th.value))
      })
      .onEnd(() => {
        runOnJS(commitUpdate)(tx.value, ty.value, tw.value, th.value)
      })

    const resizeGesture = Gesture.Pan()
      .onStart(() => {
        startW.value = tw.value
        startH.value = th.value
      })
      .onUpdate((e) => {
        tw.value = Math.max(20, Math.min(startW.value + e.translationX, canvasW - tx.value))
        th.value = Math.max(20, Math.min(startH.value + e.translationY, canvasH - ty.value))
      })
      .onEnd(() => {
        runOnJS(commitUpdate)(tx.value, ty.value, tw.value, th.value)
      })

    const bodyGesture = Gesture.Simultaneous(tapGesture, panGesture)

    const animStyle = useAnimatedStyle(() => ({
      position: 'absolute' as const,
      left: tx.value,
      top: ty.value,
      width: tw.value,
      height: th.value,
    }))

    const borderColor = isSelected ? '#ef4444' : '#3b82f6'
    const bg = isSelected ? 'rgba(239,68,68,0.12)' : 'rgba(59,130,246,0.1)'

    return (
      <GestureDetector gesture={bodyGesture}>
        <Animated.View
          style={[animStyle, { borderWidth: 2, borderColor, backgroundColor: bg }]}
        >
          {/* Delete button */}
          <YStack
            position="absolute"
            top={2}
            right={2}
            width={16}
            height={16}
            rounded="$10"
            bg={borderColor}
            items="center"
            justify="center"
            onPress={() => onDelete(area.id)}
            cursor="pointer"
            zIndex={10}
          >
            <SizableText size="$1" color="white" lineHeight={16}>
              ×
            </SizableText>
          </YStack>

          {/* Area label */}
          <YStack flex={1} items="center" justify="center">
            <SizableText size="$4" fontWeight="700" color={borderColor}>
              {label}
            </SizableText>
          </YStack>

          {/* Resize handle */}
          <GestureDetector gesture={resizeGesture}>
            <YStack
              position="absolute"
              bottom={0}
              right={0}
              width={12}
              height={12}
              bg={borderColor}
              cursor="se-resize"
            />
          </GestureDetector>
        </Animated.View>
      </GestureDetector>
    )
  },
)
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/features/oa-manager/richmenu/AreaOverlay.tsx
git commit -m "feat(oa-manager): add AreaOverlay canvas component"
```

---

## Task 8: RichMenuEditor component

**Files:**
- Create: `apps/web/src/features/oa-manager/richmenu/RichMenuEditor.tsx`

- [ ] **Step 1: Create `RichMenuEditor.tsx`**

```tsx
import { memo, useCallback, useRef, useState } from 'react'
import { Platform } from 'react-native'
import { Controller, useForm } from 'react-hook-form'
import { valibotResolver } from '@hookform/resolvers/valibot'
import * as v from 'valibot'
import { randomUUID } from 'expo-crypto'
import { SizableText, XStack, YStack } from 'tamagui'
import { Image } from 'react-native'

import { validateRichMenu, type RichMenuAction } from '@vine/richmenu-schema'
import { Button } from '~/interface/buttons/Button'
import { Input } from '~/interface/forms/Input'
import { showError } from '~/interface/dialogs/actions'
import { showToast } from '~/interface/toast/Toast'
import { oaClient } from '~/features/oa/client'

import { AreaOverlay } from './AreaOverlay'
import { TEMPLATES } from './templates'
import type { Area, AreaBounds, EditorState, MenuSize } from './types'
import { boundsToProto } from './types'

// Settings bar schema
const SettingsSchema = v.object({
  name: v.pipe(v.string(), v.minLength(1, 'Required'), v.maxLength(30, 'Max 30 chars')),
  chatBarText: v.pipe(v.string(), v.maxLength(14, 'Max 14 chars')),
  size: v.picklist(['2500x1686', '2500x843'] as const),
  selected: v.boolean(),
})
type SettingsForm = v.InferInput<typeof SettingsSchema>

const DEFAULT_ACTION: RichMenuAction = { type: 'message', text: '' }

type EditorMode =
  | { mode: 'create'; oaId: string; onSaved: (richMenuId: string) => void }
  | {
      mode: 'edit'
      oaId: string
      richMenuId: string
      initial: EditorState
      onSaved: () => void
    }

type Props = EditorMode

export const RichMenuEditor = memo((props: Props) => {
  const initialState: EditorState =
    props.mode === 'edit'
      ? props.initial
      : {
          name: '',
          size: '2500x1686',
          chatBarText: '',
          selected: false,
          areas: [],
          selectedAreaId: null,
          imageDataUrl: null,
          imageChanged: false,
        }

  const { control, handleSubmit, watch, setValue } = useForm<SettingsForm>({
    resolver: valibotResolver(SettingsSchema),
    defaultValues: {
      name: initialState.name,
      chatBarText: initialState.chatBarText,
      size: initialState.size,
      selected: initialState.selected,
    },
  })

  const size = watch('size') as MenuSize
  const canvasHeightPx = size === '2500x1686' ? 1686 : 843

  const [areas, setAreas] = useState<Area[]>(initialState.areas)
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null)
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(initialState.imageDataUrl)
  const [imageChanged, setImageChanged] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Container width for scaleFactor
  const [containerWidth, setContainerWidth] = useState(500)
  const scaleFactor = containerWidth / 2500
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const selectedArea = areas.find((a) => a.id === selectedAreaId) ?? null

  // Action form state for selected area (simple state, not RHF)
  const [actionType, setActionType] = useState<'message' | 'uri' | 'postback'>('message')
  const [actionText, setActionText] = useState('')
  const [actionUri, setActionUri] = useState('')
  const [actionData, setActionData] = useState('')
  const [actionDisplayText, setActionDisplayText] = useState('')

  // When a different area is selected, populate the action fields
  const handleSelectArea = useCallback(
    (id: string) => {
      setSelectedAreaId(id)
      const area = areas.find((a) => a.id === id)
      if (!area) return
      const act = area.action
      setActionType(act.type as 'message' | 'uri' | 'postback')
      setActionText(act.type === 'message' ? act.text : '')
      setActionUri(act.type === 'uri' ? act.uri : '')
      setActionData(act.type === 'postback' ? act.data : '')
      setActionDisplayText(act.type === 'postback' ? (act.displayText ?? '') : '')
    },
    [areas],
  )

  const commitAction = useCallback(() => {
    if (!selectedAreaId) return
    let action: RichMenuAction
    if (actionType === 'message') {
      action = { type: 'message', text: actionText }
    } else if (actionType === 'uri') {
      action = { type: 'uri', uri: actionUri }
    } else {
      action = {
        type: 'postback',
        data: actionData,
        displayText: actionDisplayText || undefined,
      }
    }
    setAreas((prev) =>
      prev.map((a) => (a.id === selectedAreaId ? { ...a, action } : a)),
    )
  }, [selectedAreaId, actionType, actionText, actionUri, actionData, actionDisplayText])

  const handleUpdateBounds = useCallback((id: string, bounds: AreaBounds) => {
    setAreas((prev) => prev.map((a) => (a.id === id ? { ...a, bounds } : a)))
  }, [])

  const handleDeleteArea = useCallback(
    (id: string) => {
      setAreas((prev) => prev.filter((a) => a.id !== id))
      if (selectedAreaId === id) setSelectedAreaId(null)
    },
    [selectedAreaId],
  )

  const handleAddArea = () => {
    const newArea: Area = {
      id: randomUUID(),
      bounds: { x: 0, y: 0, w: Math.round(2500 / 3), h: canvasHeightPx },
      action: DEFAULT_ACTION,
    }
    setAreas((prev) => [...prev, newArea])
    setSelectedAreaId(newArea.id)
    handleSelectArea(newArea.id)
  }

  const handleApplyTemplate = (templateBounds: AreaBounds[]) => {
    const newAreas: Area[] = templateBounds.map((bounds, i) => ({
      id: areas[i]?.id ?? randomUUID(),
      bounds,
      action: areas[i]?.action ?? DEFAULT_ACTION,
    }))
    setAreas(newAreas)
    setSelectedAreaId(null)
    setShowTemplates(false)
  }

  const handleImagePick = () => {
    if (Platform.OS === 'web') {
      fileInputRef.current?.click()
    }
    // Native: resolve during build with expo-image-picker or react-native-document-picker
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const result = ev.target?.result
      if (typeof result === 'string') {
        setImageDataUrl(result)
        setImageChanged(true)
      }
    }
    reader.readAsDataURL(file)
  }

  const onSubmit = handleSubmit(async (settings) => {
    // Validate all areas with richmenu-schema
    const validation = validateRichMenu({
      size: { width: 2500, height: canvasHeightPx },
      selected: settings.selected,
      name: settings.name,
      chatBarText: settings.chatBarText,
      areas: areas.map((a) => ({
        bounds: boundsToProto(a.bounds),
        action: a.action,
      })),
    })
    if (!validation.success) {
      showError(new Error(validation.errors.map((e) => e.message).join(', ')), 'Validation failed')
      return
    }

    setIsSaving(true)
    try {
      const areaPayload = areas.map((a) => ({
        bounds: boundsToProto(a.bounds),
        action: {
          type: a.action.type,
          label: ('label' in a.action ? a.action.label : undefined),
          uri: ('uri' in a.action ? a.action.uri : undefined),
          data: ('data' in a.action ? a.action.data : undefined),
          text: ('text' in a.action ? a.action.text : undefined),
          displayText: ('displayText' in a.action ? (a.action as any).displayText : undefined),
        },
      }))

      let richMenuId: string

      if (props.mode === 'create') {
        const res = await oaClient.createRichMenu({
          officialAccountId: props.oaId,
          name: settings.name,
          chatBarText: settings.chatBarText,
          selected: settings.selected,
          sizeWidth: 2500,
          sizeHeight: canvasHeightPx,
          areas: areaPayload,
        })
        richMenuId = res.richMenuId
      } else {
        await oaClient.updateRichMenu({
          officialAccountId: props.oaId,
          richMenuId: props.richMenuId,
          name: settings.name,
          chatBarText: settings.chatBarText,
          selected: settings.selected,
          sizeWidth: 2500,
          sizeHeight: canvasHeightPx,
          areas: areaPayload,
        })
        richMenuId = props.richMenuId
      }

      if (imageChanged && imageDataUrl) {
        try {
          // Strip data URL prefix: "data:image/jpeg;base64,..."
          const [header, b64] = imageDataUrl.split(',')
          const mimeMatch = header.match(/data:(image\/[a-z]+);base64/)
          const contentType = mimeMatch?.[1] ?? 'image/jpeg'
          const binary = atob(b64)
          const bytes = new Uint8Array(binary.length)
          for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i)
          }
          await oaClient.uploadRichMenuImage({
            officialAccountId: props.oaId,
            richMenuId,
            image: bytes,
            contentType,
          })
        } catch {
          showToast('Image upload failed — re-upload to activate', { type: 'warn' })
        }
      }

      if (props.mode === 'create') {
        props.onSaved(richMenuId)
      } else {
        props.onSaved()
      }
    } catch (e) {
      showError(e, 'Failed to save menu')
    } finally {
      setIsSaving(false)
    }
  })

  const AREA_LABELS = 'ABCDEFGHIJKLMNOPQRST'

  return (
    <YStack gap="$4">
      {/* Settings bar */}
      <XStack gap="$4" flexWrap="wrap" items="flex-end">
        <YStack gap="$1" minWidth={160}>
          <SizableText size="$1" color="$color10">
            Title (management only)
          </SizableText>
          <Controller
            control={control}
            name="name"
            render={({ field: { onChange, value }, fieldState: { error } }) => (
              <Input
                value={value}
                onChangeText={onChange}
                placeholder="My Menu"
                error={error?.message}
              />
            )}
          />
        </YStack>

        <YStack gap="$1">
          <SizableText size="$1" color="$color10">
            Size
          </SizableText>
          <Controller
            control={control}
            name="size"
            render={({ field: { onChange, value } }) => (
              <XStack gap="$2">
                {(['2500x1686', '2500x843'] as MenuSize[]).map((s) => (
                  <Button
                    key={s}
                    size="$2"
                    variant={value === s ? undefined : 'outlined'}
                    onPress={() => onChange(s)}
                  >
                    {s === '2500x1686' ? 'Large' : 'Small'}
                  </Button>
                ))}
              </XStack>
            )}
          />
        </YStack>

        <YStack gap="$1" minWidth={120}>
          <SizableText size="$1" color="$color10">
            Chat bar text
          </SizableText>
          <Controller
            control={control}
            name="chatBarText"
            render={({ field: { onChange, value }, fieldState: { error } }) => (
              <Input
                value={value}
                onChangeText={onChange}
                placeholder="Menu"
                error={error?.message}
              />
            )}
          />
        </YStack>

        <Controller
          control={control}
          name="selected"
          render={({ field: { onChange, value } }) => (
            <XStack gap="$2" items="center" pb="$2">
              <Button
                size="$2"
                variant={value ? undefined : 'outlined'}
                onPress={() => onChange(!value)}
              >
                {value ? 'Default expanded ✓' : 'Default expanded'}
              </Button>
            </XStack>
          )}
        />
      </XStack>

      <XStack gap="$4" items="flex-start">
        {/* Left: canvas */}
        <YStack flex={1} gap="$2" minWidth={0}>
          {/* Toolbar */}
          <XStack gap="$2" flexWrap="wrap">
            <Button size="$2" onPress={handleImagePick}>
              Upload image
            </Button>
            <Button size="$2" variant="outlined" onPress={() => setShowTemplates((v) => !v)}>
              Template
            </Button>
            <Button size="$2" variant="outlined" onPress={handleAddArea}>
              + Add area
            </Button>
          </XStack>

          {/* Template picker */}
          {showTemplates && (
            <YStack
              borderWidth={1}
              borderColor="$borderColor"
              rounded="$3"
              p="$3"
              gap="$2"
            >
              <SizableText size="$2" fontWeight="600" color="$color11">
                Templates for {size}
              </SizableText>
              <XStack flexWrap="wrap" gap="$2">
                {(TEMPLATES[size] ?? []).map((tpl) => (
                  <Button
                    key={tpl.label}
                    size="$2"
                    variant="outlined"
                    onPress={() => handleApplyTemplate(tpl.bounds)}
                  >
                    {tpl.label}
                  </Button>
                ))}
              </XStack>
            </YStack>
          )}

          {/* Canvas */}
          <YStack
            position="relative"
            width="100%"
            bg="$color3"
            rounded="$2"
            overflow="hidden"
            borderWidth={1}
            borderColor="$borderColor"
            style={{ aspectRatio: 2500 / canvasHeightPx }}
            onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
          >
            {/* Image preview */}
            {imageDataUrl ? (
              <Image
                source={{ uri: imageDataUrl }}
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
                resizeMode="cover"
              />
            ) : (
              <YStack
                position="absolute"
                top={0}
                left={0}
                right={0}
                bottom={0}
                items="center"
                justify="center"
              >
                <SizableText size="$1" color="$color9">
                  [ Rich menu image {size} ]
                </SizableText>
              </YStack>
            )}

            {/* Area overlays */}
            {areas.map((area, i) => (
              <AreaOverlay
                key={area.id}
                area={area}
                label={AREA_LABELS[i] ?? String(i + 1)}
                scaleFactor={scaleFactor}
                isSelected={selectedAreaId === area.id}
                canvasHeightPx={canvasHeightPx}
                onSelect={handleSelectArea}
                onUpdate={handleUpdateBounds}
                onDelete={handleDeleteArea}
              />
            ))}
          </YStack>

          <SizableText size="$1" color="$color9">
            Click to select · Drag to move · Drag corner to resize · × to delete
          </SizableText>
        </YStack>

        {/* Right: action panel */}
        {selectedArea && (
          <YStack
            width={200}
            shrink={0}
            gap="$3"
            borderWidth={1}
            borderColor="$borderColor"
            rounded="$3"
            p="$3"
          >
            <SizableText size="$3" fontWeight="700" color="$color12">
              Area {AREA_LABELS[areas.findIndex((a) => a.id === selectedAreaId)] ?? '?'} (selected)
            </SizableText>

            {/* Action type */}
            <YStack gap="$1">
              <SizableText size="$1" color="$color10">
                Action type
              </SizableText>
              <XStack gap="$1" flexWrap="wrap">
                {(['message', 'uri', 'postback'] as const).map((t) => (
                  <Button
                    key={t}
                    size="$2"
                    variant={actionType === t ? undefined : 'outlined'}
                    onPress={() => setActionType(t)}
                  >
                    {t === 'message' ? 'Message' : t === 'uri' ? 'URI' : 'Postback'}
                  </Button>
                ))}
              </XStack>
            </YStack>

            {/* Conditional action fields */}
            {actionType === 'message' && (
              <YStack gap="$1">
                <SizableText size="$1" color="$color10">
                  Text
                </SizableText>
                <Input value={actionText} onChangeText={setActionText} placeholder="Hello!" />
              </YStack>
            )}

            {actionType === 'uri' && (
              <YStack gap="$1">
                <SizableText size="$1" color="$color10">
                  URL
                </SizableText>
                <Input
                  value={actionUri}
                  onChangeText={setActionUri}
                  placeholder="https://example.com"
                />
              </YStack>
            )}

            {actionType === 'postback' && (
              <>
                <YStack gap="$1">
                  <SizableText size="$1" color="$color10">
                    Data
                  </SizableText>
                  <Input value={actionData} onChangeText={setActionData} placeholder="action=buy" />
                </YStack>
                <YStack gap="$1">
                  <SizableText size="$1" color="$color10">
                    Display text (optional)
                  </SizableText>
                  <Input
                    value={actionDisplayText}
                    onChangeText={setActionDisplayText}
                    placeholder="Buy"
                  />
                </YStack>
              </>
            )}

            {/* Position inputs */}
            <YStack gap="$1">
              <SizableText size="$1" color="$color10">
                Position (px)
              </SizableText>
              <XStack gap="$1" flexWrap="wrap">
                {(['x', 'y', 'w', 'h'] as const).map((key) => (
                  <YStack key={key} width={44}>
                    <SizableText size="$1" color="$color9">
                      {key.toUpperCase()}
                    </SizableText>
                    <Input
                      value={String(selectedArea.bounds[key])}
                      onChangeText={(v) => {
                        const n = parseInt(v, 10)
                        if (!isNaN(n)) {
                          setAreas((prev) =>
                            prev.map((a) =>
                              a.id === selectedArea.id
                                ? { ...a, bounds: { ...a.bounds, [key]: n } }
                                : a,
                            ),
                          )
                        }
                      }}
                    />
                  </YStack>
                ))}
              </XStack>
            </YStack>

            <Button onPress={commitAction}>Apply action</Button>
          </YStack>
        )}
      </XStack>

      {/* Save / Cancel */}
      <XStack gap="$3" justify="flex-end">
        <Button variant="outlined" onPress={() => history.back()}>
          Cancel
        </Button>
        <Button onPress={onSubmit} disabled={isSaving}>
          {isSaving ? 'Saving…' : 'Save'}
        </Button>
      </XStack>

      {/* Hidden file input (web only) */}
      {Platform.OS === 'web' && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
      )}
    </YStack>
  )
})
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/features/oa-manager/richmenu/RichMenuEditor.tsx
git commit -m "feat(oa-manager): add RichMenuEditor canvas editor component"
```

---

## Task 9: Create page

**Files:**
- Create: `apps/web/app/(app)/manager/[oaId]/richmenu/create.tsx`

- [ ] **Step 1: Create `create.tsx`**

```tsx
import { useActiveParams, useRouter, createRoute } from 'one'
import { memo } from 'react'
import { SizableText, YStack } from 'tamagui'
import { useTanQueryClient } from '~/query'

import { RichMenuEditor } from '~/features/oa-manager/richmenu/RichMenuEditor'

const route = createRoute<'/(app)/manager/[oaId]/richmenu/create'>()

export const CreateRichMenuPage = memo(() => {
  const params = useActiveParams<{ oaId: string }>()
  const oaId = params.oaId!
  const router = useRouter()
  const qc = useTanQueryClient()

  const handleSaved = (richMenuId: string) => {
    qc.invalidateQueries({ queryKey: ['oa', 'richmenu-list', oaId] })
    router.navigate(`/manager/${oaId}/richmenu` as any)
  }

  return (
    <YStack gap="$4">
      <SizableText size="$7" fontWeight="700" color="$color12">
        Create Rich Menu
      </SizableText>
      <RichMenuEditor mode="create" oaId={oaId} onSaved={handleSaved} />
    </YStack>
  )
})

export default CreateRichMenuPage
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/'(app)'/manager/
git commit -m "feat(manager): add rich menu create page"
```

---

## Task 10: Edit page

**Files:**
- Create: `apps/web/app/(app)/manager/[oaId]/richmenu/[richMenuId].tsx`

- [ ] **Step 1: Create `[richMenuId].tsx`**

```tsx
import { useActiveParams, useRouter, createRoute } from 'one'
import { memo } from 'react'
import { SizableText, Spinner, YStack } from 'tamagui'
import { useTanQuery, useTanQueryClient } from '~/query'

import { oaClient } from '~/features/oa/client'
import { RichMenuEditor } from '~/features/oa-manager/richmenu/RichMenuEditor'
import { boundsFromProto } from '~/features/oa-manager/richmenu/types'
import type { Area, EditorState, MenuSize } from '~/features/oa-manager/richmenu/types'

const route = createRoute<'/(app)/manager/[oaId]/richmenu/[richMenuId]'>()

export const EditRichMenuPage = memo(() => {
  const params = useActiveParams<{ oaId: string; richMenuId: string }>()
  const oaId = params.oaId!
  const richMenuId = params.richMenuId!
  const router = useRouter()
  const qc = useTanQueryClient()

  const { data, isLoading } = useTanQuery({
    queryKey: ['oa', 'richmenu', oaId, richMenuId],
    queryFn: () => oaClient.getRichMenu({ officialAccountId: oaId, richMenuId }),
    enabled: !!oaId && !!richMenuId,
  })

  const handleSaved = () => {
    qc.invalidateQueries({ queryKey: ['oa', 'richmenu-list', oaId] })
    qc.invalidateQueries({ queryKey: ['oa', 'richmenu', oaId, richMenuId] })
    router.navigate(`/manager/${oaId}/richmenu` as any)
  }

  if (isLoading || !data?.menu) {
    return (
      <YStack flex={1} items="center" py="$10">
        <Spinner size="large" />
      </YStack>
    )
  }

  const menu = data.menu
  const size: MenuSize =
    menu.sizeWidth === 2500 && menu.sizeHeight === 843 ? '2500x843' : '2500x1686'

  // Convert server image bytes to base64 data URL if present
  let imageDataUrl: string | null = null
  if (data.image?.length) {
    const base64 = btoa(Array.from(data.image).map((b) => String.fromCharCode(b)).join(''))
    const mime = data.imageContentType || 'image/jpeg'
    imageDataUrl = `data:${mime};base64,${base64}`
  }

  const areas: Area[] = menu.areas.map((a, i) => ({
    id: `area-${i}`,
    bounds: boundsFromProto(a.bounds!),
    action: {
      type: (a.action?.type ?? 'message') as any,
      text: a.action?.text,
      uri: a.action?.uri,
      data: a.action?.data,
      displayText: a.action?.displayText,
      label: a.action?.label,
    } as any,
  }))

  const initial: EditorState = {
    name: menu.name,
    size,
    chatBarText: menu.chatBarText,
    selected: menu.selected,
    areas,
    selectedAreaId: null,
    imageDataUrl,
    imageChanged: false,
  }

  return (
    <YStack gap="$4">
      <SizableText size="$7" fontWeight="700" color="$color12">
        Edit Rich Menu
      </SizableText>
      <RichMenuEditor
        mode="edit"
        oaId={oaId}
        richMenuId={richMenuId}
        initial={initial}
        onSaved={handleSaved}
      />
    </YStack>
  )
})

export default EditRichMenuPage
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/'(app)'/manager/
git commit -m "feat(manager): add rich menu edit page"
```

---

## Task 11: Add "Manage →" entry point

**Files:**
- Modify: `apps/web/app/(app)/developers/console/channel/[channelId]/index.tsx`

- [ ] **Step 1: Add "Manage →" button**

In `apps/web/app/(app)/developers/console/channel/[channelId]/index.tsx`, after the existing `<XStack justify="flex-end">` block that contains the Edit button (around line 287), add a new section before or after it:

Replace the existing trailing button section:

```tsx
        {/* Edit + Manage buttons */}
        {isEditing ? (
          <XStack gap="$3" justify="flex-end">
            <Button variant="outlined" onPress={handleCancel}>
              Cancel
            </Button>
            <Button onPress={handleSave} disabled={updateAccount.isPending}>
              Save
            </Button>
          </XStack>
        ) : (
          <XStack gap="$3" justify="flex-end">
            <Button variant="outlined" onPress={() => router.navigate(`/manager/${oa.id}/richmenu` as any)}>
              Manage →
            </Button>
            <Button onPress={handleEdit}>Edit</Button>
          </XStack>
        )}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/'(app)'/developers/console/channel/
git commit -m "feat(console): add Manage → link to OA manager from channel detail"
```

---

## Task 12: Final type check

- [ ] **Step 1: Run full type check and lint**

```bash
bun run check:all
```

Expected: Exits 0 with no type errors or lint errors.

If there are type errors, fix them before moving on. Common fixes:
- Import `randomUUID` from `expo-crypto` if not already installed — check with `bun list | grep expo-crypto`. If missing, replace with `crypto.randomUUID()` (available in web workers and modern environments) or inline a UUID generator.
- `btoa` is available in web but not in React Native — if native type errors appear, wrap with `Platform.OS === 'web' ? btoa(...) : Buffer.from(...).toString('base64')`.
- `history.back()` is web-only — if type errors, use `router.back()` from `one` instead. Replace all `history.back()` in the editor with `router.back()`. This requires passing `router` as a prop or accessing it via `useRouter()` inside the component.

- [ ] **Step 2: Verify `expo-crypto` is available**

```bash
bun run --cwd apps/web check 2>&1 | grep -i crypto
```

If `expo-crypto` is not available, replace `randomUUID()` in `RichMenuEditor.tsx` with:

```ts
function genId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}
```

And replace `import { randomUUID } from 'expo-crypto'` with the inline function.

- [ ] **Step 3: Fix `history.back()` if needed**

In `RichMenuEditor.tsx`, `history.back()` is web-only. The editor receives an `onSaved` callback but not a cancel callback. Add a `onCancel` prop or use `useRouter`:

At the top of `RichMenuEditor.tsx`, add:
```ts
import { useRouter } from 'one'
```

Inside the component:
```ts
const router = useRouter()
```

Replace `history.back()` with `router.back()`.

- [ ] **Step 4: Final commit if any fixes were needed**

```bash
git add -p
git commit -m "fix(oa-manager): type check fixes"
```
