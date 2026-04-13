# OA Manager — Rich Menu Management

**Date:** 2026-04-13  
**Branch:** richmenu  
**Status:** Approved

---

## Overview

Add an OA admin manager section to the web app that lets OA owners manage rich menus for their Official Accounts. The manager lives at `/manager/[oaId]/richmenu` and is a dedicated section separate from the developers console. The MVP scope covers rich menus only.

---

## Routes

New files under `apps/web/app/(app)/manager/`:

```
app/(app)/manager/[oaId]/_layout.tsx
app/(app)/manager/[oaId]/richmenu/index.tsx
app/(app)/manager/[oaId]/richmenu/create.tsx
app/(app)/manager/[oaId]/richmenu/[richMenuId].tsx
```

**Layout (`_layout.tsx`):** Loads the OA via `getOfficialAccount` RPC to verify ownership and populate the header. Shows sidebar navigation with "Rich menus" as the only item for now. Renders `<Slot />` as main content. If the OA is not found or not owned by the logged-in user, redirects back to `/developers/console`.

**Entry point:** A "Manage →" link added to the channel detail page at `/developers/console/channel/[channelId]` that navigates to `/manager/[oaId]/richmenu`.

---

## API Layer — Proto + ConnectRPC

New RPCs added to `OAService` in `packages/proto/proto/oa/v1/oa.proto`:

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

**Key message shapes:**

```protobuf
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

message ListRichMenusRequest { string official_account_id = 1; }
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
message CreateRichMenuResponse { string rich_menu_id = 1; }

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

message ClearDefaultRichMenuRequest { string official_account_id = 1; }
message ClearDefaultRichMenuResponse {}

message UploadRichMenuImageRequest {
  string official_account_id = 1;
  string rich_menu_id = 2;
  bytes image = 3;
  string content_type = 4;
}
message UploadRichMenuImageResponse {}
```

**Server handler (`apps/server/src/connect/oa.ts`):** Each new RPC calls `assertOfficialAccountOwnedByUser` first, then delegates to the existing `oa` service methods. No new service layer needed — all DB operations already exist in `createOAService`. The `UpdateRichMenu` RPC needs a new `oa.updateRichMenu()` service method added (update name/chatBarText/selected/areas/size in DB).

After codegen (`bun run --cwd packages/proto proto:generate`), the generated client in `packages/proto/gen/oa/v1/oa_pb.ts` is used by the frontend via `oaClient`.

---

## Rich Menu List Page

**Data:** `useConnectQuery(listRichMenus, { officialAccountId: oaId })` — polls the full list plus `defaultRichMenuId`.

**Layout:**
- Page header with title + "Create" button
- "Default menu" section (if one exists): card with image thumbnail, name, area count, size, chatBarText; actions: Edit, Delete, (implicit default)
- "Other menus" section: same card format; actions: Set default, Edit, Delete
- Empty state when no menus exist

**Set default:** calls `setDefaultRichMenu` RPC, invalidates list query.  
**Delete:** `dialogConfirm()` → `deleteRichMenu` RPC → also clears the stored image in drive → invalidates list query.  
**Image thumbnail:** rendered from the `image` bytes field in `GetActiveRichMenu` response, or shown as "No image" placeholder if `hasImage` is false.

---

## Canvas Editor Component

Shared between create and edit pages. Located at `apps/web/src/features/oa-manager/richmenu/RichMenuEditor.tsx`.

### State

```ts
type Area = {
  id: string           // client-side uuid for React keys
  bounds: { x: number; y: number; w: number; h: number }  // actual pixels
  action: RichMenuAction
}

type EditorState = {
  name: string
  size: '2500x1686' | '2500x843'
  chatBarText: string
  selected: boolean
  areas: Area[]
  selectedAreaId: string | null
  imageDataUrl: string | null   // base64, for display + upload
  imageChanged: boolean         // true if user picked a new image this session
}
```

### Canvas Rendering

- Container: `YStack` with `position: 'relative'`, aspect ratio forced to `2500 / height` (either 1686 or 843), width fills available space
- Scale factor: `displayWidth / 2500` — all actual coords divided by this to get display coords
- Each area: `YStack` with `position: 'absolute'`, `left/top/width/height` = `bounds * scaleFactor`
- Selected area gets a red border; others get a blue border
- Resize handle: small `YStack` at `position: 'absolute', bottom: 0, right: 0`

### Gestures (react-native-gesture-handler)

Each area is wrapped in `GestureDetector` with `Gesture.Simultaneous(tap, pan)`:

- `Gesture.Tap()` — sets `selectedAreaId`
- `Gesture.Pan()` on the area body:
  - `onStart`: captures starting bounds
  - `onUpdate`: updates a Reanimated `useSharedValue` for smooth visual feedback
  - `onEnd`: commits final clamped position to React state (`setAreas`)
- `Gesture.Pan()` on the resize handle:
  - Same pattern but updates `w` and `h` instead of `x` and `y`
- Tap on canvas background (outside any area) → deselects

Bounds are always clamped: `x ∈ [0, 2500 - w]`, `y ∈ [0, height - h]`, `w ≥ 1`, `h ≥ 1`.

### Right Panel (selected area)

Renders only when `selectedAreaId !== null`. Contains:
- Action type selector: `message` | `uri` | `postback`
- Conditional fields: `text` (message), `uri` (uri), `data` + `displayText` (postback)
- X / Y / W / H number inputs that sync bidirectionally with canvas
- Rendered using `react-hook-form` + `valibotResolver` with `RichMenuActionSchema` from `@vine/richmenu-schema`

### Top Settings Bar

`react-hook-form` fields: `name` (≤ 30 chars), `size` (select), `chatBarText` (≤ 14 chars), `selected` (checkbox). Image upload button opens a file picker. On web: `<input type="file" accept="image/png,image/jpeg">`. On native: cross-platform file/image picker (implementation detail resolved during build).

### Save Flow

1. Validate settings form (react-hook-form) + all areas (`validateRichMenu` from `@vine/richmenu-schema`)
2. **Create:** call `createRichMenu` RPC → get `richMenuId`  
   **Edit:** call `updateRichMenu` RPC
3. If `imageChanged && imageDataUrl`: convert base64 to `Uint8Array`, call `uploadRichMenuImage` RPC
4. On success: navigate back to list, invalidate `listRichMenus` query
5. On RPC failure: `showError()`, stay on editor page

### Edit Pre-fill

Edit page calls `useConnectQuery(getRichMenu, { officialAccountId, richMenuId })` on mount. Populates editor state. `GetRichMenuResponse` includes `optional bytes image` + `optional string image_content_type` — server fills these when `hasImage` is true. The bytes are converted to a base64 data URL for display. `imageChanged` starts as `false` — upload only triggered if user picks a new file.

---

## Template Picker

A modal/popover triggered by the "Template" button. Shows preset area layouts (matching `learn-projects/richmenu-editor/default-areas.ts`): various 1×2, 1×3, 2×2, 2×3 grid configurations for both 2500×1686 and 2500×843 sizes. Selecting a template replaces `areas` in state (preserving existing actions where possible by index).

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| OA not found / not owned | `showError()` + redirect to `/developers/console` |
| RPC failure on save | `showError()` + stay on editor (work preserved) |
| Image upload failure | `showToast('Image upload failed — re-upload to activate', { type: 'warn' })` |
| No image on menu | "No image" badge on list card; Set default button disabled |
| Area out of bounds (drag) | Clamp during gesture, never commit invalid coords |
| Validation failure on save | Inline form errors via react-hook-form + `validateRichMenu` |

---

## Navigation Entry Point

Add a "Manage →" `Button` (or `Link`) to `apps/web/app/(app)/developers/console/channel/[channelId]/index.tsx` that navigates to `/manager/${account.id}/richmenu`.

---

## Out of Scope (MVP)

- Greeting message, Auto-response, Broadcast, and other sidebar items
- Rich menu tab switching (multi-tab menus)
- Per-user rich menu linking from the manager UI
- Rich menu alias management
