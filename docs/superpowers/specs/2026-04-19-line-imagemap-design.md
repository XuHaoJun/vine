# LINE Imagemap Message Design Spec

**Date:** 2026-04-19
**Status:** Draft - awaiting user review
**Scope:** LINE-aligned imagemap message support. Vine validates + renders + dispatches; asset hosting is the OA's responsibility, matching official LINE Messaging API behavior. Cross-platform (`apps/web` on web + native).

## Overview

Add `imagemap` to Vine's supported LINE message types. An imagemap is an image with multiple tappable regions (plus optional embedded video). OAs POST `{type: 'imagemap', baseUrl, baseSize, actions, video?}` to the existing `/api/oa/v2/bot/message/{push,reply}` endpoints; the chat UI fetches the image at a DPR-appropriate resolution from the OA's own CDN, overlays tappable regions at proportional coordinates, and dispatches `uri` / `message` / `clipboard` actions on tap.

This work also (a) extracts the 9 LINE action schemas and HTTPS URL primitives from `@vine/flex-schema` into a new `@vine/line-schema-primitives` package that imagemap, flex, and future template messages all depend on, and (b) extracts the `uri` / `message` / `postback` / `datetimepicker` / `clipboard` dispatch logic from `handleQuickReplyAction` in `talks/[chatId].tsx` into a reusable `useActionDispatcher` hook that `QuickReplyBar` and `ImagemapBubble` share.

## LINE spec alignment

LINE Messaging API does **not** host imagemap assets ([reference](https://developers.line.biz/en/docs/messaging-api/message-types/#imagemap-messages), [schema](https://developers.line.biz/en/reference/messaging-api/#imagemap-message)). Unlike Rich Menu (which has `/v2/bot/richmenu/{id}/content`), imagemap has no upload endpoint — OAs serve five widths (240 / 300 / 460 / 700 / 1040 px) from their own HTTPS CDN as `baseUrl/{width}` with **no file extension**. Vine matches this: we do not introduce asset storage, upload routes, a `imagemapAsset` table, or drive keys.

## Action coverage (v1)

Imagemap supports a strict 3-action subset (distinct from general LINE actions):

| Action type | v1 status | Dispatch behavior |
|---|---|---|
| `uri` | Supported | `Linking.openURL(linkUri)` (reuses `useActionDispatcher`) |
| `message` | Supported | `sendMessage(text)` (reuses existing Zero mutation) |
| `clipboard` | Supported | `navigator.clipboard.writeText` on web, toast fallback otherwise |
| `postback` / `datetimepicker` / `camera` / etc. | **Forbidden** | LINE itself disallows these on imagemap — schema rejects them |

The `useActionDispatcher` hook supports the full quick-reply C1 set (5 types); imagemap just passes a narrower union into it.

## Architecture

### 1. Package extraction — `packages/line-schema-primitives/`

New package. Holds schemas shared by flex, quick reply, imagemap, and future template messages. Extracted from `@vine/flex-schema` to break its implicit ownership of cross-cutting LINE primitives.

```
packages/line-schema-primitives/
  package.json                 (deps: valibot)
  src/
    primitives.ts              // FlexHttpsUrlSchema, FlexUrlSchema (moved from flex-schema)
    action.ts                  // 9 action schemas (moved from flex-schema)
    index.ts
```

`@vine/flex-schema`'s `src/index.ts` continues to re-export the moved symbols verbatim so **all existing imports from `@vine/flex-schema` keep working unchanged**. Internal files in `flex-schema/` that use the primitives are updated to import from `@vine/line-schema-primitives` directly. Flex-only primitives (`FlexPixelSchema`, `FlexColorSchema`, `FlexBubbleSizeSchema`, layout enums, etc.) stay in `flex-schema`.

### 2. New package — `packages/imagemap-schema/`

```
packages/imagemap-schema/
  package.json                 (deps: valibot, @vine/line-schema-primitives)
  src/
    area.ts                    // ImagemapAreaSchema {x, y, width, height} — non-negative integers
    action.ts                  // ImagemapActionSchema = union of uri | message | clipboard, each + area
    video.ts                   // ImagemapVideoSchema {originalContentUrl, previewImageUrl, area, externalLink?}
    imagemap.ts                // ImagemapMessageSchema — top-level message object
    index.ts
```

`ImagemapMessageSchema` validates:

- `type: literal('imagemap')`
- `baseUrl`: HTTPS string (via `FlexHttpsUrlSchema`), **additional check**: does not end with `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp` (LINE spec requires no extension in baseUrl)
- `altText`: string, 1–1500 chars
- `baseSize`: `{ width: literal(1040), height: integer >= 1 }` — LINE spec fixes width to 1040
- `video?`: `ImagemapVideoSchema` — when present, both `originalContentUrl` and `previewImageUrl` must be HTTPS; `area` must fit inside baseSize; `externalLink` is optional but if present requires both `linkUri` (HTTPS or `line://` or `tel:`) and `label` (≤30 chars)
- `actions`: array of `ImagemapActionSchema`, length 1–50
- A cross-field `v.check`: every action's `area` and `video.area` must satisfy `x + width ≤ baseSize.width` and `y + height ≤ baseSize.height`

`ImagemapActionSchema` is three parallel valibot objects unioned:

```ts
const UriAction       = v.object({ type: v.literal('uri'),       label: v.optional(v.string()), linkUri: FlexUrlSchema, area: ImagemapAreaSchema })
const MessageAction   = v.object({ type: v.literal('message'),   label: v.optional(v.string()), text: v.pipe(v.string(), v.maxLength(400)), area: ImagemapAreaSchema })
const ClipboardAction = v.object({ type: v.literal('clipboard'), label: v.optional(v.string()), clipboardText: v.pipe(v.string(), v.maxLength(1000)), area: ImagemapAreaSchema })
export const ImagemapActionSchema = v.union([UriAction, MessageAction, ClipboardAction])
```

### 3. Server — `apps/server/src/plugins/oa-messaging.ts`

Single new `case 'imagemap'` inside `validateMessage`'s existing `switch`. No new routes, no drive changes, no DB table:

```ts
case 'imagemap': {
  const result = v.safeParse(ImagemapMessageSchema, msg)
  if (!result.success) {
    const flat = v.flatten<typeof ImagemapMessageSchema>(result.issues)
    return { valid: false, error: `Invalid imagemap message: ${JSON.stringify(flat.nested)}` }
  }
  const qr = attachQuickReply(result.output as Record<string, unknown>, quickReply)
  if (!qr.ok) return { valid: false, error: qr.error, code: qr.code }
  return { valid: true, type, text: null, metadata: qr.metadata }
}
```

The full validated imagemap payload (minus `quickReply`, which `attachQuickReply` merges back under `metadata.quickReply`) is stringified into `message.metadata`. No top-level `text` is stored (imagemap has no inherent text; `altText` lives inside metadata).

### 4. Database — `packages/db/src/schema-public.ts`

Single-line change to the `message.type` `$type` union: add `'imagemap'`. New drizzle migration auto-generated (no column adds, no new tables).

Zero schema (`packages/zero-schema/src/models/message.ts`) already types `type` as freeform `string()`; no change needed.

### 5. Frontend — action dispatcher refactor

Extract a cross-platform hook at `apps/web/src/features/chat/useActionDispatcher.ts`:

```ts
export type DispatchableAction =
  | { type: 'message'; text: string }
  | { type: 'uri'; uri: string }
  | { type: 'postback'; data: string; displayText?: string }
  | { type: 'datetimepicker'; data: string; mode: 'date'|'time'|'datetime'; initial?: string; max?: string; min?: string }
  | { type: 'clipboard'; clipboardText: string }

export function useActionDispatcher(ctx: {
  chatId: string
  otherMemberOaId: string | null
  sendMessage: (text: string) => void
}) {
  return useCallback((action: DispatchableAction) => { /* moved from handleQuickReplyAction */ }, [...])
}
```

`talks/[chatId].tsx`'s existing `handleQuickReplyAction` (L195-255) becomes a thin wrapper that additionally handles the "dismiss bar" side-effect and forwards to the hook. `QuickReplyBar.onAction` calls the hook.

### 6. Frontend — ImagemapBubble component

New files:

- `apps/web/src/interface/message/ImagemapBubble.tsx` — web implementation
- `apps/web/src/interface/message/ImagemapBubble.native.tsx` — native implementation

Both components share the same props contract:

```ts
type ImagemapBubbleProps = {
  baseUrl: string
  baseSize: { width: number; height: number }  // width always 1040
  altText: string
  actions: ImagemapAction[]                     // from imagemap-schema
  video?: ImagemapVideo
  isMine: boolean
}
```

Rendering algorithm:

1. **Width selection**: Use `onLayout` to measure the bubble's actual rendered width (~240–300px typically). Multiply by `window.devicePixelRatio` (web) or `PixelRatio.get()` (native) to get target physical px. Pick the smallest entry in `[240, 300, 460, 700, 1040]` that is ≥ target px; fall back to 1040 if DPR exceeds all options.
2. **Aspect ratio container**: render a `<YStack>` with `width: actualWidth`, `height: actualWidth * baseSize.height / baseSize.width`. `baseSize.width` is always 1040.
3. **Image**: `<Image source={{uri: `${baseUrl}/${chosenWidth}`}}>` absolutely filling the container. On error, swap to a grey placeholder with `altText` displayed (fallback UI).
4. **Video overlay** (if `video` present): absolute-positioned element at `video.area.x / 1040 * actualWidth` (and similar for y/width/height). On web uses HTML5 `<video controls playsInline>`; on native uses `expo-video`'s `useVideoPlayer` + `VideoView` (already a Vine dep via `VideoBubble.native.tsx`). Subscribe to the `ended` event on web and the `playToEnd` event on expo-video: once fired, hide the video element and render the `externalLink.label` as a Pressable overlaid on the video area that calls `useActionDispatcher()({type:'uri', uri: externalLink.linkUri})` on tap.
5. **Tappable action overlays**: `actions.map((action, i) => <Pressable key={i} onPress={() => dispatch(action)} style={{ position: 'absolute', left: action.area.x / 1040 * actualWidth, top: action.area.y / 1040 * actualWidth, width: action.area.width / 1040 * actualWidth, height: action.area.height / 1040 * actualWidth }} accessibilityLabel={action.label} />)`.

Note: because `baseSize.width` is always 1040 (LINE spec), we divide coords by 1040 (not `baseSize.width`) and scale both x AND y by the same factor; this keeps the aspect ratio consistent with the image.

### 7. Frontend — MessageBubbleFactory integration

`apps/web/src/interface/message/MessageBubbleFactory.tsx` gains one branch:

```tsx
if (type === 'imagemap') {
  const meta = parseMetadata(metadata)
  if (!meta.baseUrl || !meta.baseSize || !Array.isArray(meta.actions)) {
    return <UnsupportedBubble type={type} />
  }
  return (
    <ImagemapBubble
      baseUrl={meta.baseUrl as string}
      baseSize={meta.baseSize as { width: number; height: number }}
      altText={(meta.altText as string) ?? ''}
      actions={meta.actions as ImagemapAction[]}
      video={meta.video as ImagemapVideo | undefined}
      isMine={isMine}
    />
  )
}
```

The pre-parse guard ensures mangled metadata still falls back to `UnsupportedBubble` rather than crashing the render tree.

## Error handling

| Scenario | HTTP status / UI behavior | Code |
|---|---|---|
| Imagemap shape fails `ImagemapMessageSchema` | 400 | `INVALID_IMAGEMAP_SHAPE` |
| `baseUrl` non-HTTPS or contains a known image extension | 400 | `INVALID_BASE_URL` |
| `video.originalContentUrl` or `previewImageUrl` non-HTTPS | 400 | `INVALID_VIDEO_URL` |
| Any `action.area` or `video.area` exceeds `baseSize` bounds | 400 | `AREA_OUT_OF_BOUNDS` |
| `actions.length` outside 1–50 | 400 | `INVALID_ACTIONS_COUNT` |
| `baseSize.width` ≠ 1040 | 400 | `INVALID_BASE_SIZE` |
| `quickReply` attached but invalid | 400 | `INVALID_QUICK_REPLY` (existing) |
| Client image load fails | Grey placeholder + `altText` rendered centered | — |
| Client video fails to play | Video element hidden; `previewImageUrl` + `externalLink.label` (if present) remains tappable | — |
| Metadata JSON malformed on client | `UnsupportedBubble` fallback | — |

All schema validation codes surface via the existing `validateMessage` failure path and reuse `INVALID_MESSAGE_TYPE` as the top-level code; the specific sub-error string goes into `error`.

## Testing

| Layer | File | Framework | Coverage |
|---|---|---|---|
| Primitives unit | `packages/line-schema-primitives/src/action.test.ts` | vitest | All 9 action schemas round-trip valid / reject invalid |
| Primitives unit | `packages/line-schema-primitives/src/primitives.test.ts` | vitest | HTTPS URL enforcement, tel/line scheme acceptance where relevant |
| Imagemap unit | `packages/imagemap-schema/src/imagemap.test.ts` | vitest | Valid imagemap round-trips; rejects: non-1040 width, area OOB, `postback` action, non-HTTPS baseUrl, baseUrl ending in `.jpg`, `.png.webp`, actions empty, actions > 50, video half-specified (originalContentUrl without previewImageUrl), altText > 1500 chars |
| Flex regression | existing `packages/flex-schema/src/*.test.ts` | vitest | Confirm `@vine/flex-schema` exports unchanged after primitives extraction |
| Server unit | `apps/server/src/plugins/oa-messaging.validate.test.ts` (extend) | vitest | `validateMessage({type:'imagemap', ...})` valid / invalid; quickReply attachment under imagemap |
| Server integration | `apps/server/test/integration/oa-messaging-imagemap.test.ts` | vitest | POST `/api/oa/v2/bot/message/push` with imagemap body persists `message.type='imagemap'` and round-trips metadata JSON |
| Hook unit | `apps/web/src/features/chat/useActionDispatcher.test.ts` | vitest + react-hooks testing | Each of 5 action types triggers the expected side-effect (mocked `Linking.openURL`, `navigator.clipboard`, `sendMessage`, `dispatchPostback`) |
| Frontend smoke | Manual | — | Serve 5-width fixture assets (240/300/460/700/1040) from a local static dev server via HTTPS (ngrok or mkcert). Seed chat with an imagemap message whose `baseUrl` points at the fixture. Confirm: image renders at DPR-appropriate width, tap each of uri/message/clipboard action overlays fires the expected side-effect, video overlay plays and externalLink label appears on end. |
| Frontend e2e (optional, stretch) | `apps/web-e2e/imagemap.spec.ts` | playwright | Same fixture as above. Send message via API. Assert chat DOM shows `<img src>` pointing at `/{chosenWidth}` and clicking overlay URI calls `window.open`. |

No Zero-schema migration test is needed — `message.type` stays a freeform `string()` on the Zero side.

## Out of scope / explicit non-goals

- **Vine-hosted imagemap assets.** OAs must provide their own HTTPS CDN. Revisit if a compelling product need appears.
- **Inbound LINE webhook → Vine parsing.** Vine still has no LINE-platform-to-Vine ingress for any message type (including this one); imagemap only enters Vine via the push/reply APIs.
- **Imagemap builder/simulator UI.** No drag-to-draw tool in v1. OAs craft JSON by hand or with external tooling.
- **Real Messaging API fan-out to `api.line.me`.** As with other message types, Vine persists the message in its own Postgres for in-app chat; it does not forward to LINE's real servers.
- **Postback / datetimepicker / camera / cameraRoll / location / richmenuswitch as imagemap actions.** LINE spec forbids them; schema rejects them.

## Migration / breaking change risk

- **`@vine/flex-schema` API**: designed to be **non-breaking**. All moved symbols are re-exported from `flex-schema/src/index.ts` via `export ... from '@vine/line-schema-primitives'`. Downstream consumers (`apps/server`, `apps/web`, `packages/line-flex`) see no change.
- **`message.type` enum**: additive (`'imagemap'` added). Existing rows untouched. Drizzle migration will regenerate trivially.
- **`handleQuickReplyAction` refactor**: pure motion from inline to hook. Same behavior, same call sites, just indirected. The dismiss-bar side-effect stays at the call site in `talks/[chatId].tsx`.
- **Native `expo-video` dep**: already present (used by `VideoBubble.native.tsx`).

## Estimated effort

Roughly **2–2.5 days** of focused work:

1. `line-schema-primitives` extraction + `flex-schema` passthrough re-exports + regression tests — ~4h
2. `imagemap-schema` package + schema tests — ~4h
3. `validateMessage` imagemap case + validate tests + server integration test — ~2h
4. `useActionDispatcher` hook extraction + rewiring `QuickReplyBar` + hook tests — ~3h
5. `ImagemapBubble.tsx` + `.native.tsx` (image + action overlays + video overlay + onLayout scaling + error fallbacks) — ~1 day
6. `MessageBubbleFactory` integration + manual smoke testing — ~2h
7. DB migration for `message.type` union — ~30min

Total: ~18–20 hours.
