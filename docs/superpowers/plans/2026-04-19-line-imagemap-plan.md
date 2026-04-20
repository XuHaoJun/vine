# LINE Imagemap Message Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add LINE-aligned `imagemap` message support to Vine: server validates the message, client renders it with tappable region overlays (+ optional video overlay) and dispatches `uri` / `message` / `clipboard` actions on tap. Vine does not host imagemap assets — OAs provide an external HTTPS `baseUrl` serving 5 widths at `baseUrl/{240|300|460|700|1040}` (no extension), matching official LINE Messaging API behavior.

**Architecture:** (1) Refactor: extract the 9 LINE action schemas and HTTPS URL primitives from `@vine/flex-schema` into a new `@vine/line-schema-primitives` package; `@vine/flex-schema` re-exports the moved symbols so its public API is unchanged. (2) New `@vine/imagemap-schema` package with `ImagemapMessageSchema` (strict valibot including cross-field area-bounds check). (3) Server: one new `case 'imagemap'` branch inside `validateMessage` — no new routes, no DB table, no drive changes. (4) Frontend: extract `useActionDispatcher` hook from `handleQuickReplyAction` for reuse between `QuickReplyBar` and `ImagemapBubble`; new `ImagemapBubble.tsx` + `.native.tsx` with DPR-aware width selection, absolute-positioned `Pressable` overlays, and expo-video (native) / HTML5 `<video>` (web) for video overlay.

**Tech Stack:** valibot (schemas), Fastify + Vitest (server), Drizzle (DB — TS type-only change, no migration), Tamagui + react-native (client), `react-native` `Linking`, `navigator.clipboard` (web only), `expo-video` (native), HTML5 `<video>` (web).

**Spec:** `docs/superpowers/specs/2026-04-19-line-imagemap-design.md`

---

## File Structure

**New files (create):**
- `packages/line-schema-primitives/package.json`
- `packages/line-schema-primitives/tsconfig.json`
- `packages/line-schema-primitives/src/index.ts`
- `packages/line-schema-primitives/src/primitives.ts`
- `packages/line-schema-primitives/src/action.ts`
- `packages/line-schema-primitives/src/primitives.test.ts`
- `packages/line-schema-primitives/src/action.test.ts`
- `packages/imagemap-schema/package.json`
- `packages/imagemap-schema/tsconfig.json`
- `packages/imagemap-schema/src/index.ts`
- `packages/imagemap-schema/src/area.ts`
- `packages/imagemap-schema/src/action.ts`
- `packages/imagemap-schema/src/video.ts`
- `packages/imagemap-schema/src/imagemap.ts`
- `packages/imagemap-schema/src/area.test.ts`
- `packages/imagemap-schema/src/action.test.ts`
- `packages/imagemap-schema/src/video.test.ts`
- `packages/imagemap-schema/src/imagemap.test.ts`
- `apps/web/src/features/chat/useActionDispatcher.ts`
- `apps/web/src/features/chat/useActionDispatcher.test.ts`
- `apps/web/src/interface/message/ImagemapBubble.tsx`
- `apps/web/src/interface/message/ImagemapBubble.native.tsx`

**Modified files:**
- `packages/flex-schema/package.json` (add `@vine/line-schema-primitives` dep)
- `packages/flex-schema/src/primitives.ts` (re-export moved URL schemas from `@vine/line-schema-primitives`)
- `packages/flex-schema/src/action.ts` (replace content with re-exports from `@vine/line-schema-primitives`)
- `packages/db/src/schema-public.ts` (add `'imagemap'` literal to `message.type` `$type` union)
- `apps/server/src/plugins/oa-messaging.ts` (add `case 'imagemap'` in `validateMessage` + import `ImagemapMessageSchema`)
- `apps/server/src/plugins/oa-messaging.validate.test.ts` (append imagemap describe block)
- `apps/server/package.json` (add `@vine/imagemap-schema` dep)
- `apps/web/package.json` (add `@vine/imagemap-schema` dep)
- `apps/web/src/interface/message/MessageBubbleFactory.tsx` (add `imagemap` branch + import)
- `apps/web/app/(app)/home/(tabs)/talks/[chatId].tsx` (replace inline `handleQuickReplyAction` switch with `useActionDispatcher`; keep dismiss-bar side-effect at call site)

---

## Task 1: Scaffold `@vine/line-schema-primitives` package

**Why:** Create the empty package skeleton so subsequent tasks can add symbols incrementally. Keeping this step alone verifies workspace linking works before any code moves.

**Files:**
- Create: `packages/line-schema-primitives/package.json`
- Create: `packages/line-schema-primitives/tsconfig.json`
- Create: `packages/line-schema-primitives/src/index.ts`
- Create: `packages/line-schema-primitives/src/primitives.ts`
- Create: `packages/line-schema-primitives/src/action.ts`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "@vine/line-schema-primitives",
  "version": "0.0.1",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "test": "vitest run",
    "test:unit": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "valibot": "^1.1.0"
  },
  "devDependencies": {
    "vitest": "^4.1.4"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`** (copy of flex-schema's tsconfig)

```json
{
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "target": "ES2022",
    "module": "Preserve",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "noEmit": true,
    "skipLibCheck": true,
    "skipDefaultLibCheck": true,
    "types": ["node"],
    "lib": ["esnext"]
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Create placeholder sources**

`packages/line-schema-primitives/src/primitives.ts`:
```ts
export {}
```

`packages/line-schema-primitives/src/action.ts`:
```ts
export {}
```

`packages/line-schema-primitives/src/index.ts`:
```ts
export * from './primitives'
export * from './action'
```

- [ ] **Step 4: Install workspace links**

Run: `bun install`
Expected: exits 0; `node_modules/@vine/line-schema-primitives` symlinks to `packages/line-schema-primitives`.

- [ ] **Step 5: Commit**

```bash
git add packages/line-schema-primitives
git commit -m "chore: scaffold @vine/line-schema-primitives package"
```

---

## Task 2: Move URL primitives into `@vine/line-schema-primitives`

**Why:** `FlexHttpsUrlSchema` and `FlexUrlSchema` are used by flex actions, quick-reply items, imagemap baseUrl/video URLs, and future template messages. They don't belong conceptually to flex. Moving them first lets Task 3 (action schemas) import them from the new location.

**Files:**
- Modify: `packages/line-schema-primitives/src/primitives.ts`
- Create: `packages/line-schema-primitives/src/primitives.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/line-schema-primitives/src/primitives.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import * as v from 'valibot'
import { FlexHttpsUrlSchema, FlexUrlSchema } from './primitives'

describe('FlexHttpsUrlSchema', () => {
  it('accepts https URL', () => {
    expect(v.safeParse(FlexHttpsUrlSchema, 'https://example.com/a').success).toBe(true)
  })
  it('rejects http URL', () => {
    expect(v.safeParse(FlexHttpsUrlSchema, 'http://example.com/a').success).toBe(false)
  })
  it('rejects non-URL string', () => {
    expect(v.safeParse(FlexHttpsUrlSchema, 'not-a-url').success).toBe(false)
  })
})

describe('FlexUrlSchema', () => {
  it('accepts https URL', () => {
    expect(v.safeParse(FlexUrlSchema, 'https://example.com').success).toBe(true)
  })
  it('accepts http URL', () => {
    expect(v.safeParse(FlexUrlSchema, 'http://example.com').success).toBe(true)
  })
  it('rejects empty string', () => {
    expect(v.safeParse(FlexUrlSchema, '').success).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/line-schema-primitives && bun run test`
Expected: FAIL — `FlexHttpsUrlSchema` / `FlexUrlSchema` not exported.

- [ ] **Step 3: Implement**

Replace `packages/line-schema-primitives/src/primitives.ts` with:

```ts
import * as v from 'valibot'

export const FlexHttpsUrlSchema = v.pipe(
  v.string(),
  v.url(),
  v.startsWith('https://', 'Must use HTTPS'),
)

export const FlexUrlSchema = v.pipe(v.string(), v.url())
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/line-schema-primitives && bun run test`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/line-schema-primitives/src
git commit -m "feat(line-schema-primitives): add HTTPS/URL validators"
```

---

## Task 3: Move the 9 action schemas into `@vine/line-schema-primitives`

**Why:** Action schemas (`uri`, `message`, `postback`, etc.) are the shared action vocabulary of LINE Messaging API — used by flex actions, quick reply, imagemap actions, template button actions, rich menu area actions. They have no flex-specific behavior. Moving them unblocks imagemap-schema in Task 6.

**Files:**
- Modify: `packages/line-schema-primitives/src/action.ts`
- Modify: `packages/line-schema-primitives/src/index.ts` (already re-exports `./action`, no change needed)
- Create: `packages/line-schema-primitives/src/action.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/line-schema-primitives/src/action.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import * as v from 'valibot'
import {
  FlexActionSchema,
  FlexURIActionSchema,
  FlexMessageActionSchema,
  FlexPostbackActionSchema,
  FlexDatetimePickerActionSchema,
  FlexClipboardActionSchema,
  FlexCameraActionSchema,
  FlexCameraRollActionSchema,
  FlexLocationActionSchema,
  FlexRichMenuSwitchActionSchema,
} from './action'

describe('Individual action schemas', () => {
  it('uri', () => {
    expect(
      v.safeParse(FlexURIActionSchema, {
        type: 'uri',
        uri: 'https://example.com',
      }).success,
    ).toBe(true)
  })

  it('message', () => {
    expect(
      v.safeParse(FlexMessageActionSchema, { type: 'message', text: 'hi' }).success,
    ).toBe(true)
  })

  it('postback', () => {
    expect(
      v.safeParse(FlexPostbackActionSchema, { type: 'postback', data: 'x=1' }).success,
    ).toBe(true)
  })

  it('datetimepicker', () => {
    expect(
      v.safeParse(FlexDatetimePickerActionSchema, {
        type: 'datetimepicker',
        data: 'x=1',
        mode: 'date',
      }).success,
    ).toBe(true)
  })

  it('clipboard', () => {
    expect(
      v.safeParse(FlexClipboardActionSchema, { type: 'clipboard', clipboardText: 'a' })
        .success,
    ).toBe(true)
  })

  it('camera / cameraRoll / location / richmenuswitch', () => {
    expect(v.safeParse(FlexCameraActionSchema, { type: 'camera' }).success).toBe(true)
    expect(v.safeParse(FlexCameraRollActionSchema, { type: 'cameraRoll' }).success).toBe(
      true,
    )
    expect(v.safeParse(FlexLocationActionSchema, { type: 'location' }).success).toBe(true)
    expect(
      v.safeParse(FlexRichMenuSwitchActionSchema, {
        type: 'richmenuswitch',
        richMenuAliasId: 'alias-1',
      }).success,
    ).toBe(true)
  })
})

describe('FlexActionSchema (union)', () => {
  it('accepts uri action', () => {
    expect(
      v.safeParse(FlexActionSchema, { type: 'uri', uri: 'https://x' }).success,
    ).toBe(true)
  })
  it('rejects unknown action type', () => {
    expect(v.safeParse(FlexActionSchema, { type: 'nonsense' }).success).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/line-schema-primitives && bun run test`
Expected: FAIL — action schemas not exported from `./action`.

- [ ] **Step 3: Implement**

Replace `packages/line-schema-primitives/src/action.ts` with (copied from `packages/flex-schema/src/action.ts` but using local `FlexUrlSchema`):

```ts
import * as v from 'valibot'
import { FlexUrlSchema } from './primitives'

export const FlexURIActionSchema = v.object({
  type: v.literal('uri'),
  label: v.optional(v.string()),
  uri: FlexUrlSchema,
  altUri: v.optional(
    v.object({
      desktop: v.optional(v.string()),
    }),
  ),
})

export const FlexMessageActionSchema = v.object({
  type: v.literal('message'),
  label: v.optional(v.string()),
  text: v.string(),
})

export const FlexPostbackActionSchema = v.object({
  type: v.literal('postback'),
  label: v.optional(v.string()),
  data: v.string(),
  displayText: v.optional(v.string()),
  inputOption: v.optional(v.picklist(['openKeyboard', 'closeRichMenu'])),
  fillInText: v.optional(v.string()),
})

export const FlexDatetimePickerActionSchema = v.object({
  type: v.literal('datetimepicker'),
  label: v.optional(v.string()),
  data: v.string(),
  mode: v.picklist(['date', 'time', 'datetime']),
  initial: v.optional(v.string()),
  max: v.optional(v.string()),
  min: v.optional(v.string()),
})

export const FlexClipboardActionSchema = v.object({
  type: v.literal('clipboard'),
  label: v.optional(v.string()),
  clipboardText: v.string(),
})

export const FlexCameraActionSchema = v.object({
  type: v.literal('camera'),
  label: v.optional(v.string()),
})

export const FlexCameraRollActionSchema = v.object({
  type: v.literal('cameraRoll'),
  label: v.optional(v.string()),
})

export const FlexLocationActionSchema = v.object({
  type: v.literal('location'),
  label: v.optional(v.string()),
})

export const FlexRichMenuSwitchActionSchema = v.object({
  type: v.literal('richmenuswitch'),
  label: v.optional(v.string()),
  richMenuAliasId: v.string(),
  data: v.optional(v.string()),
})

export const FlexActionSchema = v.union([
  FlexURIActionSchema,
  FlexMessageActionSchema,
  FlexPostbackActionSchema,
  FlexDatetimePickerActionSchema,
  FlexClipboardActionSchema,
  FlexCameraActionSchema,
  FlexCameraRollActionSchema,
  FlexLocationActionSchema,
  FlexRichMenuSwitchActionSchema,
])

export type FlexAction = v.InferInput<typeof FlexActionSchema>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/line-schema-primitives && bun run test`
Expected: PASS (13 tests including the ones from Task 2).

- [ ] **Step 5: Commit**

```bash
git add packages/line-schema-primitives/src
git commit -m "feat(line-schema-primitives): add 9 LINE action schemas + union"
```

---

## Task 4: Point `@vine/flex-schema` at the new primitives (zero-break re-exports)

**Why:** We want `@vine/flex-schema`'s public API unchanged so every existing `import { FlexHttpsUrlSchema, FlexURIActionSchema, ... } from '@vine/flex-schema'` (server plugins, line-flex, tests) keeps working without touching those consumers. Flex-schema becomes a façade that re-exports the moved symbols plus its own flex-only primitives (`FlexPixelSchema`, `FlexColorSchema`, etc.).

**Files:**
- Modify: `packages/flex-schema/package.json` (add dep)
- Modify: `packages/flex-schema/src/primitives.ts` (drop 2 URL schemas, re-export from primitives pkg)
- Modify: `packages/flex-schema/src/action.ts` (replace entirely with re-exports)

- [ ] **Step 1: Add dependency**

Edit `packages/flex-schema/package.json` — add to `dependencies`:

```json
  "dependencies": {
    "@vine/line-schema-primitives": "workspace:*",
    "valibot": "^1.1.0"
  },
```

Run: `bun install`
Expected: exits 0; `packages/flex-schema/node_modules/@vine/line-schema-primitives` symlinks correctly.

- [ ] **Step 2: Update `packages/flex-schema/src/primitives.ts`**

Locate the existing definitions (around lines 128-134):

```ts
export const FlexHttpsUrlSchema = v.pipe(
  v.string(),
  v.url(),
  v.startsWith('https://', 'Must use HTTPS'),
)

export const FlexUrlSchema = v.pipe(v.string(), v.url())
```

Replace those two `export const` blocks with a single re-export line (keep everything else in the file untouched):

```ts
export { FlexHttpsUrlSchema, FlexUrlSchema } from '@vine/line-schema-primitives'
```

- [ ] **Step 3: Update `packages/flex-schema/src/action.ts`**

Replace the entire file with:

```ts
export {
  FlexURIActionSchema,
  FlexMessageActionSchema,
  FlexPostbackActionSchema,
  FlexDatetimePickerActionSchema,
  FlexClipboardActionSchema,
  FlexCameraActionSchema,
  FlexCameraRollActionSchema,
  FlexLocationActionSchema,
  FlexRichMenuSwitchActionSchema,
  FlexActionSchema,
} from '@vine/line-schema-primitives'
export type { FlexAction } from '@vine/line-schema-primitives'
```

- [ ] **Step 4: Run flex-schema test suite to verify zero regression**

Run: `cd packages/flex-schema && bun run test`
Expected: PASS for all existing tests (`quickReply.test.ts`, `validation.test.ts`). No behavioral change.

- [ ] **Step 5: Run downstream consumer tests**

Run: `cd apps/server && bun run test:unit`
Expected: PASS for `oa-messaging.validate.test.ts`, `oa-messaging.test.ts` — server-side flex validation still works via re-exports.

- [ ] **Step 6: Commit**

```bash
git add packages/flex-schema
git commit -m "refactor(flex-schema): re-export URL/action primitives from @vine/line-schema-primitives"
```

---

## Task 5: Scaffold `@vine/imagemap-schema` package

**Why:** Create the empty package so Tasks 6–9 can add schemas incrementally, each with its own failing-test-first step.

**Files:**
- Create: `packages/imagemap-schema/package.json`
- Create: `packages/imagemap-schema/tsconfig.json`
- Create: `packages/imagemap-schema/src/index.ts`
- Create: `packages/imagemap-schema/src/area.ts`
- Create: `packages/imagemap-schema/src/action.ts`
- Create: `packages/imagemap-schema/src/video.ts`
- Create: `packages/imagemap-schema/src/imagemap.ts`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "@vine/imagemap-schema",
  "version": "0.0.1",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "test": "vitest run",
    "test:unit": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@vine/line-schema-primitives": "workspace:*",
    "valibot": "^1.1.0"
  },
  "devDependencies": {
    "vitest": "^4.1.4"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "target": "ES2022",
    "module": "Preserve",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "noEmit": true,
    "skipLibCheck": true,
    "skipDefaultLibCheck": true,
    "types": ["node"],
    "lib": ["esnext"]
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Create placeholder source files** (each exports nothing yet)

`packages/imagemap-schema/src/area.ts`:
```ts
export {}
```

`packages/imagemap-schema/src/action.ts`:
```ts
export {}
```

`packages/imagemap-schema/src/video.ts`:
```ts
export {}
```

`packages/imagemap-schema/src/imagemap.ts`:
```ts
export {}
```

`packages/imagemap-schema/src/index.ts`:
```ts
export * from './area'
export * from './action'
export * from './video'
export * from './imagemap'
```

- [ ] **Step 4: Install workspace links**

Run: `bun install`
Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
git add packages/imagemap-schema
git commit -m "chore: scaffold @vine/imagemap-schema package"
```

---

## Task 6: `ImagemapAreaSchema`

**Why:** The basic tappable-area shape `{x, y, width, height}` is used by both `ImagemapActionSchema` (every action has one) and `ImagemapVideoSchema.area`. Non-negative integers per LINE spec.

**Files:**
- Modify: `packages/imagemap-schema/src/area.ts`
- Create: `packages/imagemap-schema/src/area.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/imagemap-schema/src/area.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import * as v from 'valibot'
import { ImagemapAreaSchema } from './area'

describe('ImagemapAreaSchema', () => {
  it('accepts a valid area', () => {
    const r = v.safeParse(ImagemapAreaSchema, { x: 0, y: 0, width: 100, height: 50 })
    expect(r.success).toBe(true)
  })

  it('accepts zero-origin area', () => {
    const r = v.safeParse(ImagemapAreaSchema, { x: 0, y: 0, width: 1, height: 1 })
    expect(r.success).toBe(true)
  })

  it('rejects negative x', () => {
    expect(
      v.safeParse(ImagemapAreaSchema, { x: -1, y: 0, width: 1, height: 1 }).success,
    ).toBe(false)
  })

  it('rejects negative y', () => {
    expect(
      v.safeParse(ImagemapAreaSchema, { x: 0, y: -1, width: 1, height: 1 }).success,
    ).toBe(false)
  })

  it('rejects non-integer width', () => {
    expect(
      v.safeParse(ImagemapAreaSchema, { x: 0, y: 0, width: 10.5, height: 1 }).success,
    ).toBe(false)
  })

  it('rejects zero width', () => {
    expect(
      v.safeParse(ImagemapAreaSchema, { x: 0, y: 0, width: 0, height: 1 }).success,
    ).toBe(false)
  })

  it('rejects missing field', () => {
    expect(v.safeParse(ImagemapAreaSchema, { x: 0, y: 0, width: 10 }).success).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/imagemap-schema && bun run test`
Expected: FAIL — `ImagemapAreaSchema` not exported.

- [ ] **Step 3: Implement**

Replace `packages/imagemap-schema/src/area.ts` with:

```ts
import * as v from 'valibot'

const NonNegativeInteger = v.pipe(v.number(), v.integer(), v.minValue(0))
const PositiveInteger = v.pipe(v.number(), v.integer(), v.minValue(1))

export const ImagemapAreaSchema = v.object({
  x: NonNegativeInteger,
  y: NonNegativeInteger,
  width: PositiveInteger,
  height: PositiveInteger,
})

export type ImagemapArea = v.InferInput<typeof ImagemapAreaSchema>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/imagemap-schema && bun run test`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/imagemap-schema/src
git commit -m "feat(imagemap-schema): add ImagemapAreaSchema"
```

---

## Task 7: `ImagemapActionSchema`

**Why:** Imagemap actions are a strict 3-type subset of LINE actions (uri / message / clipboard), each with a required `area`. Postback / datetimepicker / camera / cameraRoll / location / richmenuswitch are forbidden per LINE spec.

**Files:**
- Modify: `packages/imagemap-schema/src/action.ts`
- Create: `packages/imagemap-schema/src/action.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/imagemap-schema/src/action.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import * as v from 'valibot'
import { ImagemapActionSchema } from './action'

const area = { x: 0, y: 0, width: 100, height: 100 }

describe('ImagemapActionSchema', () => {
  it('accepts uri action with HTTPS linkUri', () => {
    expect(
      v.safeParse(ImagemapActionSchema, {
        type: 'uri',
        linkUri: 'https://example.com',
        area,
      }).success,
    ).toBe(true)
  })

  it('accepts uri action with http scheme (LINE allows http/https/line/tel)', () => {
    expect(
      v.safeParse(ImagemapActionSchema, {
        type: 'uri',
        linkUri: 'http://example.com',
        area,
      }).success,
    ).toBe(true)
  })

  it('accepts message action', () => {
    expect(
      v.safeParse(ImagemapActionSchema, { type: 'message', text: 'hi', area }).success,
    ).toBe(true)
  })

  it('rejects message action with text > 400 chars', () => {
    expect(
      v.safeParse(ImagemapActionSchema, {
        type: 'message',
        text: 'x'.repeat(401),
        area,
      }).success,
    ).toBe(false)
  })

  it('accepts clipboard action', () => {
    expect(
      v.safeParse(ImagemapActionSchema, {
        type: 'clipboard',
        clipboardText: 'copy me',
        area,
      }).success,
    ).toBe(true)
  })

  it('rejects clipboard with text > 1000 chars', () => {
    expect(
      v.safeParse(ImagemapActionSchema, {
        type: 'clipboard',
        clipboardText: 'x'.repeat(1001),
        area,
      }).success,
    ).toBe(false)
  })

  it('rejects postback action (not allowed on imagemap)', () => {
    expect(
      v.safeParse(ImagemapActionSchema, { type: 'postback', data: 'x=1', area }).success,
    ).toBe(false)
  })

  it('rejects datetimepicker action', () => {
    expect(
      v.safeParse(ImagemapActionSchema, {
        type: 'datetimepicker',
        data: 'x=1',
        mode: 'date',
        area,
      }).success,
    ).toBe(false)
  })

  it('rejects action without area', () => {
    expect(
      v.safeParse(ImagemapActionSchema, { type: 'uri', linkUri: 'https://x' }).success,
    ).toBe(false)
  })

  it('accepts optional label', () => {
    expect(
      v.safeParse(ImagemapActionSchema, {
        type: 'uri',
        label: 'Open',
        linkUri: 'https://x',
        area,
      }).success,
    ).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/imagemap-schema && bun run test`
Expected: FAIL — `ImagemapActionSchema` not exported.

- [ ] **Step 3: Implement**

Replace `packages/imagemap-schema/src/action.ts` with:

```ts
import * as v from 'valibot'
import { FlexUrlSchema } from '@vine/line-schema-primitives'
import { ImagemapAreaSchema } from './area'

export const ImagemapUriActionSchema = v.object({
  type: v.literal('uri'),
  label: v.optional(v.pipe(v.string(), v.maxLength(100))),
  linkUri: FlexUrlSchema,
  area: ImagemapAreaSchema,
})

export const ImagemapMessageActionSchema = v.object({
  type: v.literal('message'),
  label: v.optional(v.pipe(v.string(), v.maxLength(100))),
  text: v.pipe(v.string(), v.minLength(1), v.maxLength(400)),
  area: ImagemapAreaSchema,
})

export const ImagemapClipboardActionSchema = v.object({
  type: v.literal('clipboard'),
  label: v.optional(v.pipe(v.string(), v.maxLength(100))),
  clipboardText: v.pipe(v.string(), v.minLength(1), v.maxLength(1000)),
  area: ImagemapAreaSchema,
})

export const ImagemapActionSchema = v.union([
  ImagemapUriActionSchema,
  ImagemapMessageActionSchema,
  ImagemapClipboardActionSchema,
])

export type ImagemapAction = v.InferInput<typeof ImagemapActionSchema>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/imagemap-schema && bun run test`
Expected: PASS (17 tests total across area + action).

- [ ] **Step 5: Commit**

```bash
git add packages/imagemap-schema/src
git commit -m "feat(imagemap-schema): add ImagemapActionSchema (uri/message/clipboard subset)"
```

---

## Task 8: `ImagemapVideoSchema`

**Why:** Optional video overlay. Both URLs must be HTTPS. `externalLink` is optional but if present requires both `linkUri` + `label`. LINE spec fixes `area` shape (same as action area).

**Files:**
- Modify: `packages/imagemap-schema/src/video.ts`
- Create: `packages/imagemap-schema/src/video.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/imagemap-schema/src/video.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import * as v from 'valibot'
import { ImagemapVideoSchema } from './video'

const area = { x: 0, y: 0, width: 100, height: 100 }

describe('ImagemapVideoSchema', () => {
  it('accepts minimal video (no externalLink)', () => {
    expect(
      v.safeParse(ImagemapVideoSchema, {
        originalContentUrl: 'https://example.com/v.mp4',
        previewImageUrl: 'https://example.com/p.jpg',
        area,
      }).success,
    ).toBe(true)
  })

  it('accepts video with externalLink', () => {
    expect(
      v.safeParse(ImagemapVideoSchema, {
        originalContentUrl: 'https://example.com/v.mp4',
        previewImageUrl: 'https://example.com/p.jpg',
        area,
        externalLink: { linkUri: 'https://example.com/more', label: 'See More' },
      }).success,
    ).toBe(true)
  })

  it('rejects non-HTTPS originalContentUrl', () => {
    expect(
      v.safeParse(ImagemapVideoSchema, {
        originalContentUrl: 'http://example.com/v.mp4',
        previewImageUrl: 'https://example.com/p.jpg',
        area,
      }).success,
    ).toBe(false)
  })

  it('rejects non-HTTPS previewImageUrl', () => {
    expect(
      v.safeParse(ImagemapVideoSchema, {
        originalContentUrl: 'https://example.com/v.mp4',
        previewImageUrl: 'http://example.com/p.jpg',
        area,
      }).success,
    ).toBe(false)
  })

  it('rejects externalLink with label longer than 30 chars', () => {
    expect(
      v.safeParse(ImagemapVideoSchema, {
        originalContentUrl: 'https://example.com/v.mp4',
        previewImageUrl: 'https://example.com/p.jpg',
        area,
        externalLink: { linkUri: 'https://x', label: 'x'.repeat(31) },
      }).success,
    ).toBe(false)
  })

  it('rejects externalLink missing linkUri', () => {
    expect(
      v.safeParse(ImagemapVideoSchema, {
        originalContentUrl: 'https://example.com/v.mp4',
        previewImageUrl: 'https://example.com/p.jpg',
        area,
        externalLink: { label: 'See More' },
      }).success,
    ).toBe(false)
  })

  it('rejects missing area', () => {
    expect(
      v.safeParse(ImagemapVideoSchema, {
        originalContentUrl: 'https://example.com/v.mp4',
        previewImageUrl: 'https://example.com/p.jpg',
      }).success,
    ).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/imagemap-schema && bun run test`
Expected: FAIL — `ImagemapVideoSchema` not exported.

- [ ] **Step 3: Implement**

Replace `packages/imagemap-schema/src/video.ts` with:

```ts
import * as v from 'valibot'
import { FlexHttpsUrlSchema, FlexUrlSchema } from '@vine/line-schema-primitives'
import { ImagemapAreaSchema } from './area'

const ExternalLinkSchema = v.object({
  linkUri: FlexUrlSchema,
  label: v.pipe(v.string(), v.minLength(1), v.maxLength(30)),
})

export const ImagemapVideoSchema = v.object({
  originalContentUrl: FlexHttpsUrlSchema,
  previewImageUrl: FlexHttpsUrlSchema,
  area: ImagemapAreaSchema,
  externalLink: v.optional(ExternalLinkSchema),
})

export type ImagemapVideo = v.InferInput<typeof ImagemapVideoSchema>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/imagemap-schema && bun run test`
Expected: PASS (24 total tests across area + action + video).

- [ ] **Step 5: Commit**

```bash
git add packages/imagemap-schema/src
git commit -m "feat(imagemap-schema): add ImagemapVideoSchema"
```

---

## Task 9: `ImagemapMessageSchema` (top-level, with cross-field area-bounds check)

**Why:** Full imagemap message object. `baseSize.width` is always 1040 per LINE spec. `baseUrl` must be HTTPS and must not end with a known image extension (LINE serves images at `baseUrl/{width}` with no extension). The cross-field `v.check` ensures every action area and the video area fit within `baseSize`.

**Files:**
- Modify: `packages/imagemap-schema/src/imagemap.ts`
- Create: `packages/imagemap-schema/src/imagemap.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/imagemap-schema/src/imagemap.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import * as v from 'valibot'
import { ImagemapMessageSchema } from './imagemap'

const validBase = {
  type: 'imagemap' as const,
  baseUrl: 'https://example.com/bot/images/rm001',
  altText: 'alt',
  baseSize: { width: 1040, height: 1040 },
  actions: [
    {
      type: 'uri' as const,
      linkUri: 'https://x',
      area: { x: 0, y: 0, width: 100, height: 100 },
    },
  ],
}

describe('ImagemapMessageSchema', () => {
  it('accepts minimal valid imagemap', () => {
    expect(v.safeParse(ImagemapMessageSchema, validBase).success).toBe(true)
  })

  it('accepts imagemap with video overlay', () => {
    const msg = {
      ...validBase,
      video: {
        originalContentUrl: 'https://example.com/v.mp4',
        previewImageUrl: 'https://example.com/p.jpg',
        area: { x: 0, y: 0, width: 1040, height: 585 },
        externalLink: { linkUri: 'https://more', label: 'See More' },
      },
    }
    expect(v.safeParse(ImagemapMessageSchema, msg).success).toBe(true)
  })

  it('rejects type other than "imagemap"', () => {
    expect(v.safeParse(ImagemapMessageSchema, { ...validBase, type: 'text' }).success).toBe(
      false,
    )
  })

  it('rejects baseUrl with .jpg extension', () => {
    expect(
      v.safeParse(ImagemapMessageSchema, {
        ...validBase,
        baseUrl: 'https://example.com/a/b.jpg',
      }).success,
    ).toBe(false)
  })

  it('rejects baseUrl with .png extension', () => {
    expect(
      v.safeParse(ImagemapMessageSchema, {
        ...validBase,
        baseUrl: 'https://example.com/a/b.png',
      }).success,
    ).toBe(false)
  })

  it('rejects non-HTTPS baseUrl', () => {
    expect(
      v.safeParse(ImagemapMessageSchema, {
        ...validBase,
        baseUrl: 'http://example.com/a',
      }).success,
    ).toBe(false)
  })

  it('rejects baseSize.width != 1040', () => {
    expect(
      v.safeParse(ImagemapMessageSchema, {
        ...validBase,
        baseSize: { width: 1000, height: 1040 },
      }).success,
    ).toBe(false)
  })

  it('rejects empty actions array', () => {
    expect(
      v.safeParse(ImagemapMessageSchema, { ...validBase, actions: [] }).success,
    ).toBe(false)
  })

  it('rejects more than 50 actions', () => {
    const actions = Array.from({ length: 51 }, (_, i) => ({
      type: 'uri' as const,
      linkUri: 'https://x',
      area: { x: i, y: 0, width: 1, height: 1 },
    }))
    expect(
      v.safeParse(ImagemapMessageSchema, { ...validBase, actions }).success,
    ).toBe(false)
  })

  it('rejects altText > 1500 chars', () => {
    expect(
      v.safeParse(ImagemapMessageSchema, { ...validBase, altText: 'x'.repeat(1501) })
        .success,
    ).toBe(false)
  })

  it('rejects empty altText', () => {
    expect(
      v.safeParse(ImagemapMessageSchema, { ...validBase, altText: '' }).success,
    ).toBe(false)
  })

  it('rejects action area that overflows baseSize width', () => {
    expect(
      v.safeParse(ImagemapMessageSchema, {
        ...validBase,
        actions: [
          {
            type: 'uri',
            linkUri: 'https://x',
            area: { x: 500, y: 0, width: 600, height: 10 }, // 500+600=1100 > 1040
          },
        ],
      }).success,
    ).toBe(false)
  })

  it('rejects action area that overflows baseSize height', () => {
    expect(
      v.safeParse(ImagemapMessageSchema, {
        ...validBase,
        baseSize: { width: 1040, height: 500 },
        actions: [
          {
            type: 'uri',
            linkUri: 'https://x',
            area: { x: 0, y: 100, width: 10, height: 500 }, // 100+500=600 > 500
          },
        ],
      }).success,
    ).toBe(false)
  })

  it('rejects video area that overflows baseSize', () => {
    expect(
      v.safeParse(ImagemapMessageSchema, {
        ...validBase,
        video: {
          originalContentUrl: 'https://x/v.mp4',
          previewImageUrl: 'https://x/p.jpg',
          area: { x: 0, y: 0, width: 2000, height: 100 },
        },
      }).success,
    ).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/imagemap-schema && bun run test`
Expected: FAIL — `ImagemapMessageSchema` not exported.

- [ ] **Step 3: Implement**

Replace `packages/imagemap-schema/src/imagemap.ts` with:

```ts
import * as v from 'valibot'
import { FlexHttpsUrlSchema } from '@vine/line-schema-primitives'
import { ImagemapActionSchema, type ImagemapAction } from './action'
import { ImagemapVideoSchema, type ImagemapVideo } from './video'

// LINE spec: baseUrl must not include image extension (images are served
// at baseUrl/{width} with no extension).
const NoImageExtension = v.check<string>((url) => {
  const lower = url.toLowerCase()
  return !(
    lower.endsWith('.jpg') ||
    lower.endsWith('.jpeg') ||
    lower.endsWith('.png') ||
    lower.endsWith('.gif') ||
    lower.endsWith('.webp')
  )
}, 'baseUrl must not include a file extension')

const BaseUrlSchema = v.pipe(
  v.string(),
  v.url(),
  v.startsWith('https://', 'Must use HTTPS'),
  NoImageExtension,
)

// LINE spec: width is fixed at 1040; only height varies.
const ImagemapBaseSizeSchema = v.object({
  width: v.literal(1040),
  height: v.pipe(v.number(), v.integer(), v.minValue(1)),
})

type ImagemapBaseSize = v.InferInput<typeof ImagemapBaseSizeSchema>

function areaFits(
  area: { x: number; y: number; width: number; height: number },
  baseSize: ImagemapBaseSize,
): boolean {
  return (
    area.x + area.width <= baseSize.width && area.y + area.height <= baseSize.height
  )
}

const ImagemapMessageShape = v.object({
  type: v.literal('imagemap'),
  baseUrl: BaseUrlSchema,
  altText: v.pipe(v.string(), v.minLength(1), v.maxLength(1500)),
  baseSize: ImagemapBaseSizeSchema,
  video: v.optional(ImagemapVideoSchema),
  actions: v.pipe(v.array(ImagemapActionSchema), v.minLength(1), v.maxLength(50)),
})

export const ImagemapMessageSchema = v.pipe(
  ImagemapMessageShape,
  v.check((msg) => {
    for (const a of msg.actions) {
      if (!areaFits(a.area, msg.baseSize)) return false
    }
    if (msg.video && !areaFits(msg.video.area, msg.baseSize)) return false
    return true
  }, 'action.area or video.area exceeds baseSize bounds'),
)

export type ImagemapMessage = v.InferInput<typeof ImagemapMessageSchema>
export type { ImagemapAction, ImagemapVideo }
```

Notes:
- `v.check` on `ImagemapMessageShape` runs AFTER field-level validation, so `msg.actions[i].area` is already typed correctly when the predicate runs.
- Cross-field check returns `false` to reject, producing a validation issue with the given message.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/imagemap-schema && bun run test`
Expected: PASS (38 total tests across area + action + video + imagemap).

- [ ] **Step 5: Commit**

```bash
git add packages/imagemap-schema/src
git commit -m "feat(imagemap-schema): add ImagemapMessageSchema with cross-field area-bounds check"
```

---

## Task 10: Extend `validateMessage` with imagemap case

**Why:** Hook the new schema into the server's existing per-type validation switch. Reuses `attachQuickReply` so imagemap + quickReply composes for free.

**Files:**
- Modify: `apps/server/package.json` (add dep)
- Modify: `apps/server/src/plugins/oa-messaging.ts` (add imagemap case)
- Modify: `apps/server/src/plugins/oa-messaging.validate.test.ts` (append imagemap describe block)

- [ ] **Step 1: Add dependency**

Edit `apps/server/package.json` — append to `dependencies` (alphabetical position is fine):

```json
    "@vine/imagemap-schema": "workspace:*",
```

Run: `bun install`
Expected: exits 0.

- [ ] **Step 2: Write the failing test**

Append to `apps/server/src/plugins/oa-messaging.validate.test.ts` (at the end of the top-level `describe('validateMessage', () => { ... })` block, before its closing `})`):

```ts
  describe('imagemap messages', () => {
    const validImagemap = {
      type: 'imagemap',
      baseUrl: 'https://example.com/bot/images/rm001',
      altText: 'alt',
      baseSize: { width: 1040, height: 1040 },
      actions: [
        {
          type: 'uri',
          linkUri: 'https://example.com',
          area: { x: 0, y: 0, width: 100, height: 100 },
        },
      ],
    }

    it('accepts valid imagemap', () => {
      const result = validateMessage(validImagemap)
      expect(result.valid).toBe(true)
      if (result.valid) {
        expect(result.type).toBe('imagemap')
        expect(result.text).toBeNull()
        expect(result.metadata).toBeTruthy()
        const meta = JSON.parse(result.metadata!)
        expect(meta.baseUrl).toBe('https://example.com/bot/images/rm001')
        expect(meta.actions).toHaveLength(1)
      }
    })

    it('rejects imagemap with baseUrl ending in .jpg', () => {
      const result = validateMessage({
        ...validImagemap,
        baseUrl: 'https://example.com/a/b.jpg',
      })
      expect(result.valid).toBe(false)
    })

    it('rejects imagemap with baseSize.width != 1040', () => {
      const result = validateMessage({
        ...validImagemap,
        baseSize: { width: 800, height: 1040 },
      })
      expect(result.valid).toBe(false)
    })

    it('rejects imagemap with empty actions', () => {
      const result = validateMessage({ ...validImagemap, actions: [] })
      expect(result.valid).toBe(false)
    })

    it('rejects imagemap with area overflowing baseSize', () => {
      const result = validateMessage({
        ...validImagemap,
        actions: [
          {
            type: 'uri',
            linkUri: 'https://x',
            area: { x: 500, y: 0, width: 600, height: 10 },
          },
        ],
      })
      expect(result.valid).toBe(false)
    })

    it('rejects postback as imagemap action', () => {
      const result = validateMessage({
        ...validImagemap,
        actions: [
          {
            type: 'postback',
            data: 'x=1',
            area: { x: 0, y: 0, width: 10, height: 10 },
          },
        ],
      })
      expect(result.valid).toBe(false)
    })

    it('accepts imagemap with quickReply', () => {
      const result = validateMessage({
        ...validImagemap,
        quickReply: {
          items: [
            {
              type: 'action',
              action: { type: 'message', label: 'Hi', text: 'Hi' },
            },
          ],
        },
      })
      expect(result.valid).toBe(true)
      if (result.valid) {
        const meta = JSON.parse(result.metadata!)
        expect(meta.quickReply).toBeDefined()
        expect(meta.quickReply.items).toHaveLength(1)
      }
    })

    it('rejects imagemap with invalid quickReply', () => {
      const result = validateMessage({
        ...validImagemap,
        quickReply: {
          items: [{ type: 'action', action: { type: 'camera', label: 'Cam' } }],
        },
      })
      expect(result.valid).toBe(false)
      if (!result.valid) {
        expect(result.code).toBe('INVALID_QUICK_REPLY')
      }
    })
  })
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd apps/server && bun run test:unit -- oa-messaging.validate.test.ts`
Expected: FAIL — the imagemap cases hit the `default:` branch (`Unsupported message type: "imagemap"`).

- [ ] **Step 4: Implement**

Edit `apps/server/src/plugins/oa-messaging.ts`:

(a) Update the import line (currently line 7):

```ts
import { FlexMessageSchema, QuickReplySchema } from '@vine/flex-schema'
```

to:

```ts
import { FlexMessageSchema, QuickReplySchema } from '@vine/flex-schema'
import { ImagemapMessageSchema } from '@vine/imagemap-schema'
```

(b) Inside the `switch (type)` in `validateMessage` (around lines 86–173), insert a new case BEFORE the `case 'sticker':` / `case 'location':` / `case 'template':` block. The complete new case:

```ts
    case 'imagemap': {
      const result = v.safeParse(ImagemapMessageSchema, msg)
      if (!result.success) {
        const flat = v.flatten<typeof ImagemapMessageSchema>(result.issues)
        return {
          valid: false,
          error: `Invalid imagemap message: ${JSON.stringify(flat.nested)}`,
        }
      }
      const qr = attachQuickReply(result.output as Record<string, unknown>, quickReply)
      if (!qr.ok) return { valid: false, error: qr.error, code: qr.code }
      return { valid: true, type, text: null, metadata: qr.metadata }
    }

```

(c) No other changes to the file.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/server && bun run test:unit -- oa-messaging.validate.test.ts`
Expected: PASS for all imagemap cases plus all pre-existing cases.

- [ ] **Step 6: Commit**

```bash
git add apps/server/package.json apps/server/src/plugins/oa-messaging.ts apps/server/src/plugins/oa-messaging.validate.test.ts
git commit -m "feat(server): accept imagemap messages in validateMessage"
```

---

## Task 11: Add `'imagemap'` to `message.type` TS union

**Why:** `message.type` is a plain text column in Postgres — the union on `$type<...>()` is a drizzle-TypeScript-only narrowing. Adding the literal unlocks `sendOAMessage` to persist imagemap rows without a cast escape hatch. **No SQL migration is needed.**

**Files:**
- Modify: `packages/db/src/schema-public.ts:119-130`

- [ ] **Step 1: Modify the union**

In `packages/db/src/schema-public.ts`, lines 119–130, update the `$type<...>()` call to add `'imagemap'`:

```ts
    type: text('type')
      .notNull()
      .$type<
        | 'text'
        | 'image'
        | 'video'
        | 'audio'
        | 'sticker'
        | 'location'
        | 'flex'
        | 'template'
        | 'imagemap'
      >(),
```

- [ ] **Step 2: Verify typecheck passes**

Run: `bun run check:all`
Expected: zero type errors across the whole monorepo. `oa.ts`'s existing `msg.type as typeof message.$inferInsert.type` cast now trivially accepts `'imagemap'`.

- [ ] **Step 3: Run server tests**

Run: `cd apps/server && bun run test:unit`
Expected: PASS — all validate and plugin tests still green.

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/schema-public.ts
git commit -m "feat(db): add 'imagemap' to message.type TS union"
```

---

## Task 12: Extract `useActionDispatcher` hook (pure function + thin hook wrapper)

**Why:** The action dispatch switch currently lives inline inside `handleQuickReplyAction` (`talks/[chatId].tsx` L195-255). Extracting it lets `ImagemapBubble` reuse the exact same uri / message / clipboard branches without copy-paste.

**Design for testability:** `apps/web` tests follow the `richMenuLayout.test.ts` style — pure functions, no `@testing-library/react` (not a dep). So we split the module into a pure `dispatchAction(ctx, action)` helper (fully unit-testable) and a thin `useActionDispatcher(ctx)` hook that just wraps it in `useCallback`. The test file exercises the pure helper.

**Files:**
- Create: `apps/web/src/features/chat/useActionDispatcher.ts`
- Create: `apps/web/src/test/unit/features/chat/actionDispatcher.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/test/unit/features/chat/actionDispatcher.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('react-native', () => ({
  Linking: { openURL: vi.fn() },
  Platform: { OS: 'web' },
}))
vi.mock('~/features/oa/dispatchPostback', () => ({
  dispatchPostback: vi.fn().mockResolvedValue({ success: true }),
}))
vi.mock('~/features/oa/openDateTimePicker', () => ({
  openDateTimePicker: vi.fn().mockResolvedValue(null),
}))
vi.mock('~/interface/toast/Toast', () => ({ showToast: vi.fn() }))

import { Linking } from 'react-native'
import { dispatchPostback } from '~/features/oa/dispatchPostback'
import { openDateTimePicker } from '~/features/oa/openDateTimePicker'
import { showToast } from '~/interface/toast/Toast'
import { dispatchAction } from '~/features/chat/useActionDispatcher'

const sendMessage = vi.fn()
const baseCtx = { chatId: 'c1', otherMemberOaId: 'oa1', sendMessage }

beforeEach(() => {
  vi.clearAllMocks()
})

describe('dispatchAction', () => {
  it('message → sendMessage', () => {
    dispatchAction(baseCtx, { type: 'message', text: 'hi' })
    expect(sendMessage).toHaveBeenCalledWith('hi')
  })

  it('uri → Linking.openURL', () => {
    dispatchAction(baseCtx, { type: 'uri', uri: 'https://x' })
    expect(Linking.openURL).toHaveBeenCalledWith('https://x')
  })

  it('postback → dispatchPostback + sendMessage for displayText', async () => {
    await dispatchAction(baseCtx, {
      type: 'postback',
      data: 'x=1',
      displayText: 'Buying',
    })
    expect(sendMessage).toHaveBeenCalledWith('Buying')
    expect(dispatchPostback).toHaveBeenCalledWith({
      oaId: 'oa1',
      chatId: 'c1',
      data: 'x=1',
    })
  })

  it('postback → toast on failure', async () => {
    ;(dispatchPostback as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      success: false,
      reason: 'HTTP 500',
    })
    await dispatchAction(baseCtx, { type: 'postback', data: 'x=1' })
    expect(showToast).toHaveBeenCalledWith('Postback 失敗：HTTP 500', { type: 'error' })
  })

  it('datetimepicker → opens picker then dispatches postback with params', async () => {
    ;(openDateTimePicker as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      datetime: '2026-04-19T12:00',
    })
    await dispatchAction(baseCtx, {
      type: 'datetimepicker',
      data: 'x=1',
      mode: 'datetime',
    })
    expect(dispatchPostback).toHaveBeenCalledWith({
      oaId: 'oa1',
      chatId: 'c1',
      data: 'x=1',
      params: { datetime: '2026-04-19T12:00' },
    })
  })

  it('datetimepicker → noops when user cancels (returns null)', async () => {
    ;(openDateTimePicker as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      null,
    )
    await dispatchAction(baseCtx, {
      type: 'datetimepicker',
      data: 'x=1',
      mode: 'date',
    })
    expect(dispatchPostback).not.toHaveBeenCalled()
  })

  it('clipboard → navigator.clipboard.writeText + toast', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(globalThis, 'navigator', {
      value: { clipboard: { writeText } },
      writable: true,
      configurable: true,
    })
    await dispatchAction(baseCtx, { type: 'clipboard', clipboardText: 'abc' })
    expect(writeText).toHaveBeenCalledWith('abc')
    expect(showToast).toHaveBeenCalledWith('已複製', { type: 'info' })
  })

  it('postback → noops when otherMemberOaId is null', async () => {
    await dispatchAction(
      { ...baseCtx, otherMemberOaId: null },
      { type: 'postback', data: 'x=1' },
    )
    expect(dispatchPostback).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && bun run test:unit -- actionDispatcher`
Expected: FAIL — `dispatchAction` / module does not exist.

- [ ] **Step 3: Implement**

Create `apps/web/src/features/chat/useActionDispatcher.ts`:

```ts
import { useCallback } from 'react'
import { Linking, Platform } from 'react-native'
import { dispatchPostback } from '~/features/oa/dispatchPostback'
import { openDateTimePicker } from '~/features/oa/openDateTimePicker'
import { showToast } from '~/interface/toast/Toast'

export type DispatchableAction =
  | { type: 'message'; label?: string; text: string }
  | { type: 'uri'; label?: string; uri: string }
  | {
      type: 'postback'
      label?: string
      data: string
      displayText?: string
    }
  | {
      type: 'datetimepicker'
      label?: string
      data: string
      mode: 'date' | 'time' | 'datetime'
      initial?: string
      max?: string
      min?: string
    }
  | { type: 'clipboard'; label?: string; clipboardText: string }

export type ActionDispatcherContext = {
  chatId: string
  otherMemberOaId: string | null
  sendMessage: (text: string) => void
}

export function dispatchAction(
  ctx: ActionDispatcherContext,
  action: DispatchableAction,
): void | Promise<void> {
  const { chatId, otherMemberOaId, sendMessage } = ctx
  switch (action.type) {
    case 'message':
      sendMessage(action.text)
      return
    case 'uri':
      Linking.openURL(action.uri)
      return
    case 'postback': {
      if (!otherMemberOaId) return
      if (action.displayText) sendMessage(action.displayText)
      return dispatchPostback({
        oaId: otherMemberOaId,
        chatId,
        data: action.data,
      }).then((res) => {
        if (!res.success) {
          showToast(`Postback 失敗：${res.reason ?? 'unknown'}`, { type: 'error' })
        }
      })
    }
    case 'datetimepicker': {
      if (!otherMemberOaId) return
      return openDateTimePicker(action).then((params) => {
        if (!params) return
        return dispatchPostback({
          oaId: otherMemberOaId,
          chatId,
          data: action.data,
          params,
        }).then((res) => {
          if (!res.success) {
            showToast(`Postback 失敗：${res.reason ?? 'unknown'}`, { type: 'error' })
          }
        })
      })
    }
    case 'clipboard': {
      if (Platform.OS !== 'web' || typeof navigator === 'undefined') {
        showToast('複製功能尚未支援', { type: 'info' })
        return
      }
      return navigator.clipboard
        .writeText(action.clipboardText)
        .then(() => showToast('已複製', { type: 'info' }))
        .catch(() => showToast('複製失敗', { type: 'error' }))
    }
  }
}

export function useActionDispatcher(ctx: ActionDispatcherContext) {
  const { chatId, otherMemberOaId, sendMessage } = ctx
  return useCallback(
    (action: DispatchableAction) => dispatchAction(ctx, action),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chatId, otherMemberOaId, sendMessage],
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && bun run test:unit -- actionDispatcher`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/chat/useActionDispatcher.ts apps/web/src/test/unit/features/chat/actionDispatcher.test.ts
git commit -m "feat(web): extract dispatchAction + useActionDispatcher"
```

---

## Task 13: Rewire `handleQuickReplyAction` in `talks/[chatId].tsx` to use `useActionDispatcher`

**Why:** Remove the duplicated dispatch switch now that `useActionDispatcher` exists. The one remaining local behavior is the "dismiss quick-reply bar on non-persistent actions" side-effect — that stays at the call site.

**Files:**
- Modify: `apps/web/app/(app)/home/(tabs)/talks/[chatId].tsx:195-255` (handleQuickReplyAction body)
- Modify: same file imports at top

- [ ] **Step 1: Update imports**

In `apps/web/app/(app)/home/(tabs)/talks/[chatId].tsx`, remove unused imports after the refactor and add the hook. Specifically:

- Remove the now-unused named imports `Linking` and `Platform` from `'react-native'` IF no other use remains in the file. **Check first:** grep the file for remaining `Linking.` and `Platform.`. There is another use of `Platform.OS` in the web-overflow `useEffect` (L158), so `Platform` must stay. `Linking` only appears in the quick-reply handler — safe to remove after this task.
- Remove `dispatchPostback` and `openDateTimePicker` imports (the hook now owns these).
- Add `import { useActionDispatcher } from '~/features/chat/useActionDispatcher'`.

Specifically remove these lines near the top:

```ts
import { dispatchPostback } from '~/features/oa/dispatchPostback'
import { openDateTimePicker } from '~/features/oa/openDateTimePicker'
```

Change `import { Linking, Platform } from 'react-native'` to `import { Platform } from 'react-native'`.

Add after the existing `QuickReplyBar` import:

```ts
import { useActionDispatcher } from '~/features/chat/useActionDispatcher'
```

- [ ] **Step 2: Replace the handler body**

Replace the existing `handleQuickReplyAction` (lines 195–255) with:

```tsx
  const dispatchAction = useActionDispatcher({
    chatId: chatId ?? '',
    otherMemberOaId: otherMemberOaId ?? null,
    sendMessage,
  })

  const handleQuickReplyAction = useCallback(
    (action: QuickReplyAction) => {
      const latestId = messages?.[messages.length - 1]?.id
      // Disappear rule: datetimepicker / clipboard keep the bar visible,
      // everything else dismisses immediately on tap.
      const keepBar = action.type === 'datetimepicker' || action.type === 'clipboard'
      if (!keepBar && latestId) setDismissedFor(latestId)
      dispatchAction(action)
    },
    [messages, dispatchAction],
  )
```

(Note: `QuickReplyAction` and `DispatchableAction` have the same shape for the 5 supported action types — valibot union inference aligns. If TS complains, add a narrow cast: `dispatchAction(action as DispatchableAction)` and import the type from the hook module.)

- [ ] **Step 3: Typecheck**

Run: `bun run check:all`
Expected: zero errors. If a type mismatch surfaces on the `dispatchAction(action)` line, add `import type { DispatchableAction } from '~/features/chat/useActionDispatcher'` and cast.

- [ ] **Step 4: Run web test suite**

Run: `cd apps/web && bun run test:unit`
Expected: PASS — including the existing `useActionDispatcher.test.ts` from Task 12.

- [ ] **Step 5: Manual smoke**

Run the dev stack (`bun run dev`), open a chat with an OA that has an active quick reply, tap each pill type (message / uri / postback / datetimepicker / clipboard). All must behave exactly as before (dismissal rule, toast behavior, postback fan-out).

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/(app)/home/(tabs)/talks/[chatId].tsx
git commit -m "refactor(web): use useActionDispatcher in quick reply handler"
```

---

## Task 14: Create `ImagemapBubble.tsx` (web) — image + action overlays, no video yet

**Why:** Start with the cross-platform foundation (image + tappable overlays) before layering video. Web and native share the same props contract but differ on image loading semantics; we implement web first as the authoritative shape, then mirror to native in Task 15.

**Files:**
- Modify: `apps/web/package.json` (add `@vine/imagemap-schema` dep)
- Create: `apps/web/src/interface/message/ImagemapBubble.tsx`

- [ ] **Step 1: Add dependency**

Append to the `dependencies` block of `apps/web/package.json`:

```json
    "@vine/imagemap-schema": "workspace:*",
```

Run: `bun install`
Expected: exits 0; workspace symlink created.

- [ ] **Step 2: Write the file**

Create `apps/web/src/interface/message/ImagemapBubble.tsx`:

```tsx
import { memo, useCallback, useMemo, useState } from 'react'
import type { LayoutChangeEvent } from 'react-native'
import { Pressable } from 'react-native'
import { SizableText, YStack } from 'tamagui'
import type {
  ImagemapAction,
  ImagemapVideo,
} from '@vine/imagemap-schema'
import { useActionDispatcher } from '~/features/chat/useActionDispatcher'
import type { DispatchableAction } from '~/features/chat/useActionDispatcher'

const WIDTHS = [240, 300, 460, 700, 1040] as const

type Props = {
  baseUrl: string
  baseSize: { width: number; height: number }
  altText: string
  actions: ImagemapAction[]
  video?: ImagemapVideo
  chatId: string
  otherMemberOaId: string | null
  sendMessage: (text: string) => void
  isMine: boolean
}

function pickWidth(cssWidth: number): number {
  const dpr =
    typeof window !== 'undefined' && window.devicePixelRatio
      ? window.devicePixelRatio
      : 1
  const target = cssWidth * dpr
  for (const w of WIDTHS) if (w >= target) return w
  return 1040
}

export const ImagemapBubble = memo(
  ({
    baseUrl,
    baseSize,
    altText,
    actions,
    chatId,
    otherMemberOaId,
    sendMessage,
  }: Props) => {
    const [containerW, setContainerW] = useState(280)
    const [imageError, setImageError] = useState(false)

    const onLayout = useCallback((e: LayoutChangeEvent) => {
      const w = e.nativeEvent.layout.width
      if (w > 0) setContainerW(w)
    }, [])

    const dispatch = useActionDispatcher({ chatId, otherMemberOaId, sendMessage })
    const chosenWidth = useMemo(() => pickWidth(containerW), [containerW])
    const scale = containerW / baseSize.width
    const height = containerW * (baseSize.height / baseSize.width)
    const imageUrl = `${baseUrl}/${chosenWidth}`

    return (
      <YStack
        onLayout={onLayout}
        maxW={280}
        width="100%"
        style={{
          position: 'relative',
          borderRadius: 18,
          overflow: 'hidden',
          backgroundColor: '#eceff3',
        }}
        height={height}
      >
        {imageError ? (
          <YStack
            position="absolute"
            t={0}
            l={0}
            r={0}
            b={0}
            items="center"
            justify="center"
            bg="$color3"
          >
            <SizableText fontSize={13} color="$gray10">
              {altText || '圖片載入失敗'}
            </SizableText>
          </YStack>
        ) : (
          <img
            src={imageUrl}
            alt={altText}
            onError={() => setImageError(true)}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              display: 'block',
              objectFit: 'cover',
            }}
          />
        )}

        {actions.map((action, i) => (
          <Pressable
            key={i}
            accessibilityLabel={action.label ?? action.type}
            onPress={() => dispatch(action as unknown as DispatchableAction)}
            style={{
              position: 'absolute',
              left: action.area.x * scale,
              top: action.area.y * scale,
              width: action.area.width * scale,
              height: action.area.height * scale,
            }}
          />
        ))}
      </YStack>
    )
  },
)
```

Notes:
- `baseSize.width` is always 1040 (LINE spec) but we divide by it (not 1040 literal) for future-proofing.
- Action overlays are invisible; the parent image handles visual affordance.
- `chatId` / `otherMemberOaId` / `sendMessage` are passed as props (not read from chat context) because `MessageBubbleFactory` is the isolated rendering boundary — avoiding context leak keeps the bubble testable in isolation.
- The `as unknown as DispatchableAction` cast is safe because `ImagemapAction` is a strict subset of `DispatchableAction`.

- [ ] **Step 3: Typecheck**

Run: `cd apps/web && bunx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/package.json apps/web/src/interface/message/ImagemapBubble.tsx
git commit -m "feat(web): add ImagemapBubble (web) with image + action overlays"
```

---

## Task 15: Create `ImagemapBubble.native.tsx` — image + action overlays

**Why:** Native counterpart. Uses React Native's `<Image>` instead of `<img>`. Same overlay math, same hook.

**Files:**
- Create: `apps/web/src/interface/message/ImagemapBubble.native.tsx`

- [ ] **Step 1: Write the file**

Create `apps/web/src/interface/message/ImagemapBubble.native.tsx`:

```tsx
import { memo, useCallback, useMemo, useState } from 'react'
import type { LayoutChangeEvent } from 'react-native'
import { Image, PixelRatio, Pressable } from 'react-native'
import { SizableText, YStack } from 'tamagui'
import type {
  ImagemapAction,
  ImagemapVideo,
} from '@vine/imagemap-schema'
import { useActionDispatcher } from '~/features/chat/useActionDispatcher'
import type { DispatchableAction } from '~/features/chat/useActionDispatcher'

const WIDTHS = [240, 300, 460, 700, 1040] as const

type Props = {
  baseUrl: string
  baseSize: { width: number; height: number }
  altText: string
  actions: ImagemapAction[]
  video?: ImagemapVideo
  chatId: string
  otherMemberOaId: string | null
  sendMessage: (text: string) => void
  isMine: boolean
}

function pickWidth(cssWidth: number): number {
  const target = cssWidth * PixelRatio.get()
  for (const w of WIDTHS) if (w >= target) return w
  return 1040
}

export const ImagemapBubble = memo(
  ({
    baseUrl,
    baseSize,
    altText,
    actions,
    chatId,
    otherMemberOaId,
    sendMessage,
  }: Props) => {
    const [containerW, setContainerW] = useState(280)
    const [imageError, setImageError] = useState(false)

    const onLayout = useCallback((e: LayoutChangeEvent) => {
      const w = e.nativeEvent.layout.width
      if (w > 0) setContainerW(w)
    }, [])

    const dispatch = useActionDispatcher({ chatId, otherMemberOaId, sendMessage })
    const chosenWidth = useMemo(() => pickWidth(containerW), [containerW])
    const scale = containerW / baseSize.width
    const height = containerW * (baseSize.height / baseSize.width)
    const imageUrl = `${baseUrl}/${chosenWidth}`

    return (
      <YStack
        onLayout={onLayout}
        maxW={280}
        width="100%"
        height={height}
        style={{
          position: 'relative',
          borderRadius: 18,
          overflow: 'hidden',
          backgroundColor: '#eceff3',
        }}
      >
        {imageError ? (
          <YStack
            position="absolute"
            t={0}
            l={0}
            r={0}
            b={0}
            items="center"
            justify="center"
            bg="$color3"
          >
            <SizableText fontSize={13} color="$gray10">
              {altText || '圖片載入失敗'}
            </SizableText>
          </YStack>
        ) : (
          <Image
            source={{ uri: imageUrl }}
            onError={() => setImageError(true)}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
            }}
            resizeMode="cover"
            accessibilityLabel={altText}
          />
        )}

        {actions.map((action, i) => (
          <Pressable
            key={i}
            accessibilityLabel={action.label ?? action.type}
            onPress={() => dispatch(action as unknown as DispatchableAction)}
            style={{
              position: 'absolute',
              left: action.area.x * scale,
              top: action.area.y * scale,
              width: action.area.width * scale,
              height: action.area.height * scale,
            }}
          />
        ))}
      </YStack>
    )
  },
)
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/web && bunx tsc --noEmit`
Expected: zero errors (both `.tsx` and `.native.tsx` sharing the same prop contract).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/interface/message/ImagemapBubble.native.tsx
git commit -m "feat(web): add ImagemapBubble (native) counterpart"
```

---

## Task 16: Add video overlay to both ImagemapBubble variants

**Why:** Layer the optional video overlay on top of the image. On `ended`, show the `externalLink.label` as a Pressable that dispatches a synthetic `uri` action.

**Files:**
- Modify: `apps/web/src/interface/message/ImagemapBubble.tsx`
- Modify: `apps/web/src/interface/message/ImagemapBubble.native.tsx`

- [ ] **Step 1: Update web variant**

In `apps/web/src/interface/message/ImagemapBubble.tsx`, inside the returned `<YStack>` (between the action overlays map and the closing `</YStack>`), insert:

```tsx
        {video && (
          <VideoOverlay
            video={video}
            scale={scale}
            onExternalLinkTap={(uri) =>
              dispatch({ type: 'uri', uri, label: undefined } as DispatchableAction)
            }
          />
        )}
```

Add the `video` prop to the destructured props (already on the type but currently unused — the TS "unused" warning from Task 14 is resolved here).

Add a new component at the bottom of the same file (still inside the module):

```tsx
type VideoOverlayProps = {
  video: ImagemapVideo
  scale: number
  onExternalLinkTap: (linkUri: string) => void
}

const VideoOverlay = memo(
  ({ video, scale, onExternalLinkTap }: VideoOverlayProps) => {
    const [ended, setEnded] = useState(false)

    const style = {
      position: 'absolute' as const,
      left: video.area.x * scale,
      top: video.area.y * scale,
      width: video.area.width * scale,
      height: video.area.height * scale,
    }

    if (ended && video.externalLink) {
      return (
        <Pressable
          accessibilityLabel={video.externalLink.label}
          onPress={() => onExternalLinkTap(video.externalLink!.linkUri)}
          style={{
            ...style,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.55)',
          }}
        >
          <SizableText color="white" fontSize={14} fontWeight="600">
            {video.externalLink.label}
          </SizableText>
        </Pressable>
      )
    }

    return (
      <YStack style={style}>
        <video
          src={video.originalContentUrl}
          poster={video.previewImageUrl}
          controls
          playsInline
          onEnded={() => setEnded(true)}
          style={{ width: '100%', height: '100%', display: 'block' }}
        />
      </YStack>
    )
  },
)
```

- [ ] **Step 2: Update native variant**

In `apps/web/src/interface/message/ImagemapBubble.native.tsx`:

(a) Extend the React import at the top to include `useEffect` and `useState`:

```tsx
import { memo, useCallback, useEffect, useMemo, useState } from 'react'
```

(b) Add the expo-video import near the existing tamagui / react-native imports:

```tsx
import { useVideoPlayer, VideoView } from 'expo-video'
```

(c) Inside the `<YStack>` return, after the action overlays `.map(...)` and before the closing `</YStack>`, insert:

```tsx
        {video && (
          <VideoOverlay
            video={video}
            scale={scale}
            onExternalLinkTap={(uri) =>
              dispatch({ type: 'uri', uri, label: undefined } as DispatchableAction)
            }
          />
        )}
```

(d) Append the native `VideoOverlay` component at the bottom of the file. It uses `useEffect` + `player.addListener('playToEnd', ...)` to track video completion — this matches the expo-video event emitter API and avoids depending on `useEventListener` (which moved between expo releases):

```tsx
type VideoOverlayProps = {
  video: ImagemapVideo
  scale: number
  onExternalLinkTap: (linkUri: string) => void
}

const VideoOverlay = memo(
  ({ video, scale, onExternalLinkTap }: VideoOverlayProps) => {
    const [ended, setEnded] = useState(false)
    const player = useVideoPlayer(video.originalContentUrl, (p) => {
      p.loop = false
    })

    useEffect(() => {
      const sub = player.addListener('playToEnd', () => setEnded(true))
      return () => sub.remove()
    }, [player])

    const style = {
      position: 'absolute' as const,
      left: video.area.x * scale,
      top: video.area.y * scale,
      width: video.area.width * scale,
      height: video.area.height * scale,
    }

    if (ended && video.externalLink) {
      return (
        <Pressable
          accessibilityLabel={video.externalLink.label}
          onPress={() => onExternalLinkTap(video.externalLink!.linkUri)}
          style={{
            ...style,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.55)',
          }}
        >
          <SizableText color="white" fontSize={14} fontWeight="600">
            {video.externalLink.label}
          </SizableText>
        </Pressable>
      )
    }

    return (
      <YStack style={style}>
        <VideoView
          player={player}
          style={{ width: '100%', height: '100%' }}
          nativeControls
          contentFit="contain"
        />
      </YStack>
    )
  },
)
```

- [ ] **Step 3: Typecheck**

Run: `cd apps/web && bunx tsc --noEmit`
Expected: zero errors. If `player.addListener('playToEnd', ...)` signature complains in your installed expo-video version (55.x), the fallback is `player.addListener('statusChange', (s) => { if (s.status === 'idle') setEnded(true) })` — both are part of the same `EventEmitter` contract.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/interface/message/ImagemapBubble.tsx apps/web/src/interface/message/ImagemapBubble.native.tsx
git commit -m "feat(web): add video overlay to ImagemapBubble (web + native)"
```

---

## Task 17: Wire `ImagemapBubble` into `MessageBubbleFactory`

**Why:** Make the chat UI actually render imagemap messages. Pulling `chatId` / `otherMemberOaId` / `sendMessage` from the rendering call site keeps the bubble decoupled, but the factory currently only forwards type/metadata/isMine. We extend its prop contract minimally.

**Files:**
- Modify: `apps/web/src/interface/message/MessageBubbleFactory.tsx`
- Modify: `apps/web/app/(app)/home/(tabs)/talks/[chatId].tsx` (pass new props through the `MessageBubbleFactory` call sites)

- [ ] **Step 1: Extend factory prop contract**

Edit `apps/web/src/interface/message/MessageBubbleFactory.tsx`. Add `ImagemapBubble` import at top:

```tsx
import { ImagemapBubble } from './ImagemapBubble'
import type { ImagemapAction, ImagemapVideo } from '@vine/imagemap-schema'
```

Update the props type:

```tsx
type MessageBubbleFactoryProps = {
  type: string
  text?: string
  metadata?: string
  isMine: boolean
  chatId: string
  otherMemberOaId: string | null
  sendMessage: (text: string) => void
}
```

Update the component destructure + add imagemap branch (insert directly before `return <UnsupportedBubble type={type} />`):

```tsx
export const MessageBubbleFactory = memo(
  ({
    type,
    text,
    metadata,
    isMine,
    chatId,
    otherMemberOaId,
    sendMessage,
  }: MessageBubbleFactoryProps) => {
    if (type === 'text') {
      return <TextBubble text={text ?? ''} isMine={isMine} />
    }

    if (type === 'flex') {
      return <FlexBubbleContent metadata={metadata ?? ''} isMine={isMine} />
    }

    if (type === 'image') {
      const meta = parseMetadata(metadata)
      const url =
        typeof meta.originalContentUrl === 'string' ? meta.originalContentUrl : ''
      if (!url) return <UnsupportedBubble type={type} />
      return <ImageBubble url={url} isMine={isMine} />
    }

    if (type === 'video') {
      const meta = parseMetadata(metadata)
      const url =
        typeof meta.originalContentUrl === 'string' ? meta.originalContentUrl : ''
      if (!url) return <UnsupportedBubble type={type} />
      return <VideoBubble url={url} isMine={isMine} />
    }

    if (type === 'audio') {
      const meta = parseMetadata(metadata)
      const url =
        typeof meta.originalContentUrl === 'string' ? meta.originalContentUrl : ''
      const duration = typeof meta.duration === 'number' ? meta.duration : undefined
      if (!url) return <UnsupportedBubble type={type} />
      return <AudioBubble url={url} duration={duration} isMine={isMine} />
    }

    if (type === 'imagemap') {
      const meta = parseMetadata(metadata)
      const baseUrl = typeof meta.baseUrl === 'string' ? meta.baseUrl : ''
      const baseSize = meta.baseSize as
        | { width: number; height: number }
        | undefined
      const actions = Array.isArray(meta.actions)
        ? (meta.actions as ImagemapAction[])
        : null
      const video = meta.video as ImagemapVideo | undefined
      if (!baseUrl || !baseSize || !actions) return <UnsupportedBubble type={type} />
      return (
        <ImagemapBubble
          baseUrl={baseUrl}
          baseSize={baseSize}
          altText={(meta.altText as string) ?? ''}
          actions={actions}
          video={video}
          chatId={chatId}
          otherMemberOaId={otherMemberOaId}
          sendMessage={sendMessage}
          isMine={isMine}
        />
      )
    }

    return <UnsupportedBubble type={type} />
  },
)
```

- [ ] **Step 2: Update call site**

Edit `apps/web/app/(app)/home/(tabs)/talks/[chatId].tsx:371-376`. Replace the existing invocation:

```tsx
                        <MessageBubbleFactory
                          type={msg.type}
                          text={msg.text ?? undefined}
                          metadata={msg.metadata ?? undefined}
                          isMine={isMine}
                        />
```

with:

```tsx
                        <MessageBubbleFactory
                          type={msg.type}
                          text={msg.text ?? undefined}
                          metadata={msg.metadata ?? undefined}
                          isMine={isMine}
                          chatId={chatId ?? ''}
                          otherMemberOaId={otherMemberOaId ?? null}
                          sendMessage={sendMessage}
                        />
```

- [ ] **Step 3: Typecheck**

Run: `bun run check:all`
Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/interface/message/MessageBubbleFactory.tsx apps/web/app/(app)/home/(tabs)/talks/[chatId].tsx
git commit -m "feat(web): render imagemap messages in chat via MessageBubbleFactory"
```

---

## Task 18: Full verification + manual smoke

**Why:** Final gate before handing off. Exercise every layer end-to-end.

- [ ] **Step 1: Full workspace test**

Run: `bun run test`
Expected: PASS across all workspaces (flex-schema, line-schema-primitives, imagemap-schema, apps/server, apps/web).

- [ ] **Step 2: Typecheck**

Run: `bun run check:all`
Expected: zero errors.

- [ ] **Step 3: Lint**

Run: `bun run lint`
Expected: zero errors. Fix any minor formatting issues.

- [ ] **Step 4: Manual smoke — send an imagemap via API**

Prep a 5-width fixture: place 5 PNG files (240x240, 300x300, 460x460, 700x700, 1040x1040) at a local static HTTPS endpoint. Options:
- `ngrok http 8080` on a local static server
- `mkcert` + nginx serving from `/tmp/imagemap-fixture/240`, `/300`, `/460`, `/700`, `/1040` (no extension)

Push a test imagemap (adjust OA_ID / USER_ID / TOKEN / BASE_URL):

```bash
curl -X POST http://localhost:3001/api/oa/v2/bot/message/push \
  -H "Authorization: Bearer $OA_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "'$USER_ID'",
    "messages": [{
      "type": "imagemap",
      "baseUrl": "https://your-fixture-host.example.com/rm001",
      "altText": "test imagemap",
      "baseSize": { "width": 1040, "height": 1040 },
      "actions": [
        { "type": "uri", "linkUri": "https://example.com", "area": { "x": 0, "y": 0, "width": 520, "height": 520 } },
        { "type": "message", "text": "hello from imagemap", "area": { "x": 520, "y": 0, "width": 520, "height": 520 } },
        { "type": "clipboard", "clipboardText": "copied!", "area": { "x": 0, "y": 520, "width": 1040, "height": 520 } }
      ]
    }]
  }'
```

Expected server response: `{}` (200).

- [ ] **Step 5: Manual smoke — verify rendering**

Open the chat in the web dev stack (`bun run dev` → `http://localhost:3000/home/talks/<chatId>`). Confirm:
- Image appears at correct aspect ratio (square here).
- Top-left quadrant tap opens `example.com` in a new tab (uri action).
- Top-right quadrant tap sends the text "hello from imagemap" from your user to the OA (message action) — you should see the user-sent bubble appear immediately.
- Bottom half tap copies "copied!" to clipboard and shows the "已複製" toast.

- [ ] **Step 6: Manual smoke — imagemap + quickReply composition**

Repeat step 4 but add `quickReply` to the payload:

```json
{
  ...,
  "messages": [{
    "type": "imagemap",
    ...,
    "quickReply": {
      "items": [
        { "type": "action", "action": { "type": "message", "label": "Hi", "text": "Hi" } }
      ]
    }
  }]
}
```

Confirm in the UI: the imagemap bubble appears AND the quick-reply pill bar shows above the input. Tapping the pill sends "Hi".

- [ ] **Step 7: Manual smoke — video overlay (stretch)**

Push an imagemap with a `video` field pointing at an HTTPS mp4 and a preview jpg. Confirm on web: video plays inline, and after the video ends the "See More" label overlay appears and opens its linkUri on tap.

- [ ] **Step 8: Commit any leftover formatting fixes**

If lint/format made any changes, commit:

```bash
git add -A
git commit -m "chore: lint/format after imagemap implementation"
```

If nothing changed, skip this step.

---

## Self-Review Checklist (run before handing off)

**Spec coverage — every spec §:**
- §1 Package layering → Tasks 1–5 create line-schema-primitives + imagemap-schema; Task 4 handles zero-break re-exports from flex-schema ✓
- §2 Server plugin (validateMessage imagemap case) → Task 10 ✓
- §3 Data flow (DB union, OA flow, Vine validation, UI render) → Tasks 10, 11, 14, 15, 16, 17 ✓
- §4 Frontend (useActionDispatcher + ImagemapBubble) → Tasks 12, 13, 14, 15, 16, 17 ✓
- §5 Error handling → covered by schema tests (Tasks 6–9) + validate tests (Task 10) + fallback UI in Tasks 14/15 ✓
- §6 Testing (schema / server / hook / smoke) → Tasks 2, 3, 6, 7, 8, 9, 10, 12, 18 ✓
- §7 Out-of-scope → honored (no asset upload routes, no simulator UI) ✓

**Type consistency:**
- `DispatchableAction` shape matches `QuickReplyAction` (5 types) ✓
- `ImagemapAction` / `ImagemapVideo` exported from `@vine/imagemap-schema` used by the bubble ✓
- `useActionDispatcher` context signature identical across hook test (Task 12) and call sites (Tasks 13, 14, 15) ✓
- `MessageBubbleFactoryProps` extension (adding 3 props) is additive and propagated at the single call site in `[chatId].tsx` (Task 17) ✓

**Placeholder scan:** No "TBD", "TODO", "implement later", "add error handling". All code blocks are complete and copy-pasteable.

**Scope check:** Single feature (imagemap) + one supporting refactor (line-schema-primitives extraction + useActionDispatcher hook). Both directly enable the feature. Scope is focused.
