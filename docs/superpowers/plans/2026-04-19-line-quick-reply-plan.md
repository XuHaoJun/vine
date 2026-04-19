# LINE Quick Reply Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add LINE-compatible Quick Reply (v1, web-only, C1 actions: `message` / `uri` / `postback` / `datetimepicker` / `clipboard`) to Vine. An OA can attach a `quickReply` field with up to 13 buttons to any outbound message; the user sees pill buttons above the input and tapping one fires per-action behavior.

**Architecture:** Schema in `@vine/flex-schema` (re-uses existing action vocabulary). Server `validateMessage` extracts `attachQuickReply` and applies it to all message types (storing the parsed `quickReply` inside the existing `message.metadata` JSON — **no DB or Zero schema migration**). Postback is dispatched via a new `POST /api/oa/internal/dispatch-postback` endpoint that mirrors the existing `/dispatch` (registers a reply token, builds a `type=postback` webhook event, signs it, and delivers it to the OA's webhook URL). Client adds three small modules — `QuickReplyBar` (renderer), `dispatchPostback` (server-call helper), `openDateTimePicker` (web-native HTML date picker) — and wires them into the existing chat room page.

**Tech Stack:** valibot (schemas), Fastify (server), Vitest (server + schema tests), Tamagui + react-native (web client), `react-native` `Linking`, browser `navigator.clipboard`, browser `<input type="date|time|datetime-local">`.

**Important — `apps/web` is cross-platform:** The `apps/web` source is bundled by One/vxrn for both web **and** native. Web-only globals (`document`, `navigator.clipboard`, `<input>`) must be gated. Tasks 7 (`openDateTimePicker`) and the clipboard branch in Task 9 sit behind `isWeb` from `tamagui` and have `.native.ts` no-op stubs where needed. Postback / message / uri actions are cross-platform-safe.

**Spec:** `docs/superpowers/specs/2026-04-19-line-quick-reply-design.md`

---

### Task 1: `QuickReplySchema` in `@vine/flex-schema`

**Why:** Re-uses the existing `FlexAction*Schema` definitions so we don't duplicate action types. Server validation (Task 2), client renderer (Task 8), and any future template renderer will all import from here.

**Files:**
- Create: `packages/flex-schema/src/quickReply.ts`
- Modify: `packages/flex-schema/src/index.ts` (add re-exports)
- Create: `packages/flex-schema/src/quickReply.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/flex-schema/src/quickReply.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import * as v from 'valibot'
import { QuickReplySchema } from './quickReply'

describe('QuickReplySchema', () => {
  it('accepts a message-action item', () => {
    const result = v.safeParse(QuickReplySchema, {
      items: [
        {
          type: 'action',
          action: { type: 'message', label: 'Sushi', text: 'Sushi' },
        },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('accepts a uri-action item with imageUrl', () => {
    const result = v.safeParse(QuickReplySchema, {
      items: [
        {
          type: 'action',
          imageUrl: 'https://example.com/icon.png',
          action: { type: 'uri', label: 'Open', uri: 'https://example.com' },
        },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('accepts a postback-action item', () => {
    const result = v.safeParse(QuickReplySchema, {
      items: [
        {
          type: 'action',
          action: {
            type: 'postback',
            label: 'Buy',
            data: 'action=buy&id=1',
            displayText: 'Buying #1',
          },
        },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('accepts a datetimepicker-action item', () => {
    const result = v.safeParse(QuickReplySchema, {
      items: [
        {
          type: 'action',
          action: {
            type: 'datetimepicker',
            label: 'Pick',
            data: 'action=pick',
            mode: 'datetime',
          },
        },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('accepts a clipboard-action item', () => {
    const result = v.safeParse(QuickReplySchema, {
      items: [
        {
          type: 'action',
          action: { type: 'clipboard', label: 'Copy', clipboardText: 'hello' },
        },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('rejects camera action (out of v1 scope)', () => {
    const result = v.safeParse(QuickReplySchema, {
      items: [{ type: 'action', action: { type: 'camera', label: 'Camera' } }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects cameraRoll action (out of v1 scope)', () => {
    const result = v.safeParse(QuickReplySchema, {
      items: [{ type: 'action', action: { type: 'cameraRoll', label: 'Roll' } }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects location action (out of v1 scope)', () => {
    const result = v.safeParse(QuickReplySchema, {
      items: [{ type: 'action', action: { type: 'location', label: 'Loc' } }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects richmenuswitch action (LINE-forbidden on quick reply)', () => {
    const result = v.safeParse(QuickReplySchema, {
      items: [
        {
          type: 'action',
          action: {
            type: 'richmenuswitch',
            label: 'Switch',
            richMenuAliasId: 'alias-1',
          },
        },
      ],
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty items array', () => {
    const result = v.safeParse(QuickReplySchema, { items: [] })
    expect(result.success).toBe(false)
  })

  it('rejects more than 13 items', () => {
    const items = Array.from({ length: 14 }, (_, i) => ({
      type: 'action' as const,
      action: { type: 'message' as const, label: `B${i}`, text: `b${i}` },
    }))
    const result = v.safeParse(QuickReplySchema, { items })
    expect(result.success).toBe(false)
  })

  it('accepts exactly 13 items', () => {
    const items = Array.from({ length: 13 }, (_, i) => ({
      type: 'action' as const,
      action: { type: 'message' as const, label: `B${i}`, text: `b${i}` },
    }))
    const result = v.safeParse(QuickReplySchema, { items })
    expect(result.success).toBe(true)
  })

  it('rejects non-action item type', () => {
    const result = v.safeParse(QuickReplySchema, {
      items: [
        {
          type: 'button',
          action: { type: 'message', label: 'X', text: 'x' },
        },
      ],
    })
    expect(result.success).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun --cwd packages/flex-schema test:unit src/quickReply.test.ts`
Expected: FAIL with "Cannot find module './quickReply'" (or equivalent module-not-found error).

- [ ] **Step 3: Implement `QuickReplySchema`**

Create `packages/flex-schema/src/quickReply.ts`:

```ts
import * as v from 'valibot'
import {
  FlexClipboardActionSchema,
  FlexDatetimePickerActionSchema,
  FlexMessageActionSchema,
  FlexPostbackActionSchema,
  FlexURIActionSchema,
} from './action'

// v1 (C1) action subset. camera / cameraRoll / location / richmenuswitch
// are intentionally excluded — see docs/superpowers/specs/2026-04-19-line-quick-reply-design.md.
export const QuickReplyActionSchema = v.union([
  FlexMessageActionSchema,
  FlexURIActionSchema,
  FlexPostbackActionSchema,
  FlexDatetimePickerActionSchema,
  FlexClipboardActionSchema,
])

export const QuickReplyItemSchema = v.object({
  type: v.literal('action'),
  imageUrl: v.optional(v.pipe(v.string(), v.url())),
  action: QuickReplyActionSchema,
})

export const QuickReplySchema = v.object({
  items: v.pipe(
    v.array(QuickReplyItemSchema),
    v.minLength(1),
    v.maxLength(13), // LINE spec
  ),
})

export type QuickReply = v.InferInput<typeof QuickReplySchema>
export type QuickReplyItem = v.InferInput<typeof QuickReplyItemSchema>
export type QuickReplyAction = v.InferInput<typeof QuickReplyActionSchema>
```

- [ ] **Step 4: Re-export from index**

Modify `packages/flex-schema/src/index.ts` — add a new export block right after the existing `// Actions` block (after line 58):

```ts
// Quick Reply
export {
  QuickReplyActionSchema,
  QuickReplyItemSchema,
  QuickReplySchema,
} from './quickReply'
export type { QuickReply, QuickReplyItem, QuickReplyAction } from './quickReply'
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `bun --cwd packages/flex-schema test:unit`
Expected: PASS — all 13 new `QuickReplySchema` cases plus existing flex-schema tests.

- [ ] **Step 6: Typecheck the package**

Run: `bun --cwd packages/flex-schema typecheck`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add packages/flex-schema/src/quickReply.ts packages/flex-schema/src/quickReply.test.ts packages/flex-schema/src/index.ts
git commit -m "feat(flex-schema): add QuickReplySchema for LINE quick reply v1 actions"
```

---

### Task 2: Server-side `validateMessage` accepts `quickReply`

**Why:** Quick reply is a top-level field on every LINE message type. Server must validate it and persist it inside the existing `message.metadata` JSON (no DB schema change).

**Files:**
- Modify: `apps/server/src/plugins/oa-messaging.ts` (add `attachQuickReply` helper, thread it through every switch arm)
- Modify: `apps/server/src/plugins/oa-messaging.validate.test.ts` (new `describe('quickReply', ...)` block)

- [ ] **Step 1: Write the failing tests**

Append a new `describe` block to `apps/server/src/plugins/oa-messaging.validate.test.ts` (after the existing `describe('invalid inputs', ...)` block, before the closing `})` of the outer `describe('validateMessage', ...)`):

```ts
  describe('quickReply', () => {
    const messageItem = {
      type: 'action' as const,
      action: { type: 'message' as const, label: 'Yes', text: 'Yes' },
    }

    it('accepts text message with quickReply and stores it in metadata', () => {
      const result = validateMessage({
        type: 'text',
        text: 'pick one',
        quickReply: { items: [messageItem] },
      })
      expect(result.valid).toBe(true)
      if (result.valid) {
        expect(result.text).toBe('pick one')
        expect(result.metadata).not.toBeNull()
        const parsed = JSON.parse(result.metadata!)
        expect(parsed.quickReply.items[0].action.text).toBe('Yes')
      }
    })

    it('keeps text metadata null when quickReply is absent', () => {
      const result = validateMessage({ type: 'text', text: 'plain' })
      expect(result.valid).toBe(true)
      if (result.valid) expect(result.metadata).toBeNull()
    })

    it('merges quickReply into flex metadata alongside contents', () => {
      const result = validateMessage({
        type: 'flex',
        altText: 'alt',
        contents: {
          type: 'bubble',
          body: { type: 'box', layout: 'vertical', contents: [] },
        },
        quickReply: { items: [messageItem] },
      })
      expect(result.valid).toBe(true)
      if (result.valid) {
        const parsed = JSON.parse(result.metadata!)
        expect(parsed.type).toBe('flex')
        expect(parsed.contents.type).toBe('bubble')
        expect(parsed.quickReply.items).toHaveLength(1)
      }
    })

    it('merges quickReply into image metadata alongside originalContentUrl', () => {
      const result = validateMessage({
        type: 'image',
        originalContentUrl: 'https://example.com/i.png',
        previewImageUrl: 'https://example.com/p.png',
        quickReply: { items: [messageItem] },
      })
      expect(result.valid).toBe(true)
      if (result.valid) {
        const parsed = JSON.parse(result.metadata!)
        expect(parsed.originalContentUrl).toBe('https://example.com/i.png')
        expect(parsed.quickReply.items).toHaveLength(1)
      }
    })

    it('rejects text with invalid quickReply (camera action)', () => {
      const result = validateMessage({
        type: 'text',
        text: 'x',
        quickReply: {
          items: [{ type: 'action', action: { type: 'camera', label: 'C' } }],
        },
      })
      expect(result.valid).toBe(false)
      if (!result.valid) expect(result.error).toContain('quickReply')
    })

    it('rejects text with quickReply exceeding 13 items', () => {
      const items = Array.from({ length: 14 }, (_, i) => ({
        type: 'action' as const,
        action: { type: 'message' as const, label: `B${i}`, text: `b${i}` },
      }))
      const result = validateMessage({ type: 'text', text: 'x', quickReply: { items } })
      expect(result.valid).toBe(false)
    })
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun --cwd apps/server test:unit src/plugins/oa-messaging.validate.test.ts`
Expected: 6 new failures — text message returns `metadata: null` (ignoring quickReply), invalid quickReply still returns `valid: true` (currently quickReply silently ends up in `rest` for image, dropped for text/flex).

- [ ] **Step 3: Add `attachQuickReply` helper and import**

Modify `apps/server/src/plugins/oa-messaging.ts`. At the top of the file, change the existing `flex-schema` import (line 7) to also import `QuickReplySchema`:

```ts
import { FlexMessageSchema, QuickReplySchema } from '@vine/flex-schema'
```

Then add `attachQuickReply` immediately above the `validateMessage` function (above the `// ============ Message Validation ============` comment is fine, or below the `ValidationFailure` type alias):

```ts
function attachQuickReply(
  baseMetadata: Record<string, unknown> | null,
  rawQuickReply: unknown,
): { ok: true; metadata: string | null } | { ok: false; error: string } {
  if (rawQuickReply === undefined) {
    return {
      ok: true,
      metadata: baseMetadata !== null ? JSON.stringify(baseMetadata) : null,
    }
  }
  const result = v.safeParse(QuickReplySchema, rawQuickReply)
  if (!result.success) {
    const flat = v.flatten<typeof QuickReplySchema>(result.issues)
    return {
      ok: false,
      error: `Invalid quickReply: ${JSON.stringify(flat.nested)}`,
    }
  }
  return {
    ok: true,
    metadata: JSON.stringify({ ...(baseMetadata ?? {}), quickReply: result.output }),
  }
}
```

- [ ] **Step 4: Thread `attachQuickReply` through every switch arm**

Replace the body of `validateMessage`'s `switch (type)` block in `apps/server/src/plugins/oa-messaging.ts`. The new body:

```ts
  // Pull quickReply out of the rest bag so each arm can decide where it goes.
  const { quickReply, ...restWithoutQuickReply } = rest as Record<string, unknown>

  switch (type) {
    case 'text': {
      if (typeof text !== 'string') {
        return { valid: false, error: 'Text message must have a "text" field' }
      }
      if (text.length > 5000) {
        return { valid: false, error: 'Text message must not exceed 5000 characters' }
      }
      const qr = attachQuickReply(null, quickReply)
      if (!qr.ok) return { valid: false, error: qr.error }
      return { valid: true, type, text, metadata: qr.metadata }
    }

    case 'flex': {
      const result = v.safeParse(FlexMessageSchema, msg)
      if (!result.success) {
        const flatResult = v.flatten<typeof FlexMessageSchema>(result.issues)
        return {
          valid: false,
          error: `Invalid flex message: ${JSON.stringify(flatResult.nested)}`,
        }
      }
      const qr = attachQuickReply(
        result.output as Record<string, unknown>,
        quickReply,
      )
      if (!qr.ok) return { valid: false, error: qr.error }
      return { valid: true, type, text: null, metadata: qr.metadata }
    }

    case 'image':
    case 'video': {
      const { originalContentUrl, previewImageUrl } = restWithoutQuickReply as Record<
        string,
        unknown
      >
      if (typeof originalContentUrl !== 'string') {
        return {
          valid: false,
          error: `${type} message must have "originalContentUrl" field`,
        }
      }
      if (!originalContentUrl.startsWith('https://')) {
        return { valid: false, error: `"originalContentUrl" must be an HTTPS URL` }
      }
      if (typeof previewImageUrl !== 'string') {
        return {
          valid: false,
          error: `${type} message must have "previewImageUrl" field`,
        }
      }
      if (!previewImageUrl.startsWith('https://')) {
        return { valid: false, error: `"previewImageUrl" must be an HTTPS URL` }
      }
      const qr = attachQuickReply(restWithoutQuickReply, quickReply)
      if (!qr.ok) return { valid: false, error: qr.error }
      return { valid: true, type, text: null, metadata: qr.metadata }
    }

    case 'audio': {
      const { originalContentUrl, duration } = restWithoutQuickReply as Record<
        string,
        unknown
      >
      if (typeof originalContentUrl !== 'string') {
        return {
          valid: false,
          error: 'audio message must have "originalContentUrl" field',
        }
      }
      if (!originalContentUrl.startsWith('https://')) {
        return { valid: false, error: `"originalContentUrl" must be an HTTPS URL` }
      }
      if (duration !== undefined && typeof duration !== 'number') {
        return { valid: false, error: '"duration" must be a number (milliseconds)' }
      }
      const qr = attachQuickReply(restWithoutQuickReply, quickReply)
      if (!qr.ok) return { valid: false, error: qr.error }
      return { valid: true, type, text: null, metadata: qr.metadata }
    }

    case 'sticker':
    case 'location':
    case 'template': {
      const qr = attachQuickReply(restWithoutQuickReply, quickReply)
      if (!qr.ok) return { valid: false, error: qr.error }
      return { valid: true, type, text: null, metadata: qr.metadata }
    }

    default:
      return { valid: false, error: `Unsupported message type: "${type}"` }
  }
```

The two key behavior changes vs the current code:
1. `quickReply` is destructured out of `rest` so it never accidentally lands in `metadata` un-validated.
2. Every arm calls `attachQuickReply` so `text` (which previously had `metadata: null`) now correctly stores `quickReply` when present.

- [ ] **Step 5: Map `INVALID_QUICK_REPLY` error code in the route handlers**

Modify `apps/server/src/plugins/oa-messaging.ts` reply / push handlers. Both currently emit `code: 'INVALID_MESSAGE_TYPE'` for any `validated.find((r) => !r.valid)`. Switch the `code` based on whether the error message starts with `'Invalid quickReply'`:

In **both** the `/api/oa/v2/bot/message/reply` and `/api/oa/v2/bot/message/push` handlers, replace:

```ts
        const failed = validated.find((r) => !r.valid)
        if (failed && !failed.valid) {
          return await reply.code(400).send({
            message: failed.error,
            code: 'INVALID_MESSAGE_TYPE',
          })
        }
```

with:

```ts
        const failed = validated.find((r) => !r.valid)
        if (failed && !failed.valid) {
          const code = failed.error.startsWith('Invalid quickReply')
            ? 'INVALID_QUICK_REPLY'
            : 'INVALID_MESSAGE_TYPE'
          return await reply.code(400).send({ message: failed.error, code })
        }
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `bun --cwd apps/server test:unit src/plugins/oa-messaging.validate.test.ts`
Expected: PASS — all original tests + 6 new `quickReply` tests.

Run: `bun --cwd apps/server test:unit src/plugins/oa-messaging.test.ts`
Expected: PASS — pre-existing reply/push integration tests still green (the destructure + helper change is behavior-preserving for messages without `quickReply`).

- [ ] **Step 7: Typecheck**

Run: `bun --cwd apps/server typecheck`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add apps/server/src/plugins/oa-messaging.ts apps/server/src/plugins/oa-messaging.validate.test.ts
git commit -m "feat(server): validate and persist quickReply on every message type"
```

---

### Task 3: `registerReplyToken` accepts nullable `messageId`

**Why:** Postback events are not associated with a stored message, so the dispatch endpoint (Task 5) needs to register a reply token without a message ID. The DB column (`oaReplyToken.messageId`) is **already nullable** (`packages/db/src/schema-oa.ts:180`); only the function signature needs to relax.

**Files:**
- Modify: `apps/server/src/services/oa.ts:934-955` (`registerReplyToken` function)

- [ ] **Step 1: Relax the input type**

Modify `registerReplyToken` in `apps/server/src/services/oa.ts` (around line 934):

```ts
  async function registerReplyToken(input: {
    oaId: string
    userId: string
    chatId: string
    messageId: string | null
  }) {
    const token = generateReplyToken()
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString()

    const [record] = await db
      .insert(oaReplyToken)
      .values({
        oaId: input.oaId,
        token,
        userId: input.userId,
        chatId: input.chatId,
        messageId: input.messageId,
        expiresAt,
      })
      .returning()
    return record
  }
```

(Only `messageId: string` → `messageId: string | null` changes.)

- [ ] **Step 2: Verify all callers still compile**

Run: `bun --cwd apps/server typecheck`
Expected: no errors. Existing callers in `apps/server/src/plugins/oa-webhook.ts` and tests pass real strings, which are still assignable to `string | null`.

- [ ] **Step 3: Re-run server tests**

Run: `bun --cwd apps/server test:unit`
Expected: PASS — no behavior change for existing callers.

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/services/oa.ts
git commit -m "refactor(oa): allow registerReplyToken to accept null messageId"
```

---

### Task 4: `buildPostbackEvent` in `oa.ts`

**Why:** Sibling to the existing `buildMessageEvent` / `buildFollowEvent`. The dispatch endpoint (Task 5) and any future postback emitter call this.

**Files:**
- Modify: `apps/server/src/services/oa.ts` (add function + export it from the service factory return)
- Create: `apps/server/src/services/oa.test.ts` add new describe block (file already exists)

- [ ] **Step 1: Write the failing test**

Append to `apps/server/src/services/oa.test.ts` (inside the outer `describe`, after any existing blocks):

```ts
import { createOAService } from './oa'
// ...existing imports...

describe('buildPostbackEvent', () => {
  // The build* functions don't touch the DB, so a stub `db` is fine.
  const oa = createOAService({ db: {} as any, database: {} as any })

  it('produces a LINE-shaped postback webhook event without params', () => {
    const evt = oa.buildPostbackEvent({
      oaId: 'oa-1',
      userId: 'user-1',
      replyToken: 'token-abc',
      data: 'action=buy&id=42',
    })
    expect(evt.destination).toBe('oa-1')
    expect(evt.events).toHaveLength(1)
    const e = evt.events[0]!
    expect(e.type).toBe('postback')
    expect(e.replyToken).toBe('token-abc')
    expect(e.source).toEqual({ type: 'user', userId: 'user-1' })
    expect(e.postback).toEqual({ data: 'action=buy&id=42' })
    expect(typeof e.timestamp).toBe('number')
    expect(typeof e.webhookEventId).toBe('string')
  })

  it('includes params for datetimepicker postback', () => {
    const evt = oa.buildPostbackEvent({
      oaId: 'oa-1',
      userId: 'user-1',
      replyToken: 'token-abc',
      data: 'action=pick',
      params: { datetime: '2026-04-19T14:30' },
    })
    expect(evt.events[0]!.postback).toEqual({
      data: 'action=pick',
      params: { datetime: '2026-04-19T14:30' },
    })
  })
})
```

If `oa.test.ts` does not import `describe`/`it`/`expect` already, add `import { describe, expect, it } from 'vitest'` at the top.

- [ ] **Step 2: Run test to verify it fails**

Run: `bun --cwd apps/server test:unit src/services/oa.test.ts -t "buildPostbackEvent"`
Expected: FAIL — `oa.buildPostbackEvent is not a function`.

- [ ] **Step 3: Implement `buildPostbackEvent`**

Add the function in `apps/server/src/services/oa.ts` immediately after `buildUnfollowEvent` (around line 333):

```ts
  function buildPostbackEvent(input: {
    oaId: string
    userId: string
    replyToken: string
    data: string
    params?: { date?: string; time?: string; datetime?: string }
  }) {
    return {
      destination: input.oaId,
      events: [
        {
          type: 'postback' as const,
          mode: 'active' as const,
          timestamp: Date.now(),
          source: { type: 'user' as const, userId: input.userId },
          webhookEventId: randomUUID(),
          deliveryContext: { isRedelivery: false },
          replyToken: input.replyToken,
          postback: {
            data: input.data,
            ...(input.params ? { params: input.params } : {}),
          },
        },
      ],
    }
  }
```

- [ ] **Step 4: Export `buildPostbackEvent` from the service factory**

In the same file, modify the `return { ... }` block at the bottom of `createOAService` (around lines 988-1036). Add `buildPostbackEvent,` to the returned object — alphabetically/contextually next to `buildMessageEvent`, `buildFollowEvent`, `buildUnfollowEvent`:

```ts
    buildMessageEvent,
    buildFollowEvent,
    buildUnfollowEvent,
    buildPostbackEvent,
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `bun --cwd apps/server test:unit src/services/oa.test.ts -t "buildPostbackEvent"`
Expected: PASS — both new cases.

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/services/oa.ts apps/server/src/services/oa.test.ts
git commit -m "feat(oa): add buildPostbackEvent for quick reply postback dispatch"
```

---

### Task 5: `POST /api/oa/internal/dispatch-postback` endpoint

**Why:** Receives postback taps from the web client, registers a reply token, builds a `type=postback` webhook event, signs it, and delivers to the OA's webhook URL. Mirrors the existing `/api/oa/internal/dispatch` (message events).

**Files:**
- Modify: `apps/server/src/plugins/oa-webhook.ts` (add the new route)
- Create: `apps/server/src/plugins/oa-webhook.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/server/src/plugins/oa-webhook.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import Fastify from 'fastify'
import { oaWebhookPlugin } from './oa-webhook'

const oaId = 'oa-1'
const userId = 'user-1'
const chatId = 'chat-1'
const channelSecret = 'secret'

function createTestApp(opts: {
  account?: unknown
  webhook?: unknown
  fetchImpl?: typeof fetch
}) {
  const oa = {
    getOfficialAccount: vi.fn().mockResolvedValue(opts.account ?? null),
    getWebhook: vi.fn().mockResolvedValue(opts.webhook ?? null),
    registerReplyToken: vi.fn().mockResolvedValue({
      id: 'token-1',
      oaId,
      token: 'reply-token-xyz',
      userId,
      chatId,
      messageId: null,
      used: false,
      expiresAt: new Date(Date.now() + 1800_000).toISOString(),
    }),
    buildMessageEvent: vi.fn(),
    buildPostbackEvent: vi.fn().mockImplementation((input) => ({
      destination: input.oaId,
      events: [
        {
          type: 'postback',
          replyToken: input.replyToken,
          source: { type: 'user', userId: input.userId },
          postback: input.params
            ? { data: input.data, params: input.params }
            : { data: input.data },
        },
      ],
    })),
    generateWebhookSignature: vi.fn().mockReturnValue('sig-fake'),
  }
  const db = {
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(undefined),
    }),
  }
  if (opts.fetchImpl) {
    vi.stubGlobal('fetch', opts.fetchImpl)
  }
  const app = Fastify()
  app.register(oaWebhookPlugin, { oa: oa as any, db: db as any })
  return { app, oa }
}

describe('POST /api/oa/internal/dispatch-postback', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('dispatches a postback event to the OA webhook with x-line-signature', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 }),
    )
    const { app, oa } = createTestApp({
      account: { id: oaId, channelSecret },
      webhook: { oaId, url: 'https://hook.example/bot', status: 'verified' },
      fetchImpl: fetchSpy as any,
    })
    await app.ready()

    const res = await app.inject({
      method: 'POST',
      url: '/api/oa/internal/dispatch-postback',
      payload: { oaId, userId, chatId, data: 'action=buy&id=1' },
    })

    await app.close()
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toEqual({ success: true })

    expect(oa.registerReplyToken).toHaveBeenCalledWith({
      oaId,
      userId,
      chatId,
      messageId: null,
    })
    expect(oa.buildPostbackEvent).toHaveBeenCalledWith({
      oaId,
      userId,
      replyToken: 'reply-token-xyz',
      data: 'action=buy&id=1',
      params: undefined,
    })
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [url, init] = fetchSpy.mock.calls[0]!
    expect(url).toBe('https://hook.example/bot')
    expect((init as RequestInit).headers).toMatchObject({
      'Content-Type': 'application/json; charset=utf-8',
      'x-line-signature': 'sig-fake',
    })
  })

  it('forwards datetimepicker params', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
    const { app, oa } = createTestApp({
      account: { id: oaId, channelSecret },
      webhook: { oaId, url: 'https://hook.example/bot', status: 'verified' },
      fetchImpl: fetchSpy as any,
    })
    await app.ready()

    await app.inject({
      method: 'POST',
      url: '/api/oa/internal/dispatch-postback',
      payload: {
        oaId,
        userId,
        chatId,
        data: 'action=pick',
        params: { datetime: '2026-04-19T14:30' },
      },
    })
    await app.close()

    expect(oa.buildPostbackEvent).toHaveBeenCalledWith({
      oaId,
      userId,
      replyToken: 'reply-token-xyz',
      data: 'action=pick',
      params: { datetime: '2026-04-19T14:30' },
    })
  })

  it('returns 404 when OA does not exist', async () => {
    const { app } = createTestApp({ account: null })
    await app.ready()

    const res = await app.inject({
      method: 'POST',
      url: '/api/oa/internal/dispatch-postback',
      payload: { oaId, userId, chatId, data: 'x' },
    })
    await app.close()
    expect(res.statusCode).toBe(404)
  })

  it('returns 400 when webhook is not configured', async () => {
    const { app } = createTestApp({
      account: { id: oaId, channelSecret },
      webhook: null,
    })
    await app.ready()

    const res = await app.inject({
      method: 'POST',
      url: '/api/oa/internal/dispatch-postback',
      payload: { oaId, userId, chatId, data: 'x' },
    })
    await app.close()
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 when webhook is not verified', async () => {
    const { app } = createTestApp({
      account: { id: oaId, channelSecret },
      webhook: { oaId, url: 'https://hook.example', status: 'failed' },
    })
    await app.ready()

    const res = await app.inject({
      method: 'POST',
      url: '/api/oa/internal/dispatch-postback',
      payload: { oaId, userId, chatId, data: 'x' },
    })
    await app.close()
    expect(res.statusCode).toBe(400)
  })

  it('returns 502 when webhook delivery fails (non-2xx)', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response('nope', { status: 500 }))
    const { app } = createTestApp({
      account: { id: oaId, channelSecret },
      webhook: { oaId, url: 'https://hook.example/bot', status: 'verified' },
      fetchImpl: fetchSpy as any,
    })
    await app.ready()

    const res = await app.inject({
      method: 'POST',
      url: '/api/oa/internal/dispatch-postback',
      payload: { oaId, userId, chatId, data: 'x' },
    })
    await app.close()
    expect(res.statusCode).toBe(502)
  })

  it('returns 504 when webhook fetch throws / times out', async () => {
    const fetchSpy = vi.fn().mockRejectedValue(new Error('aborted'))
    const { app } = createTestApp({
      account: { id: oaId, channelSecret },
      webhook: { oaId, url: 'https://hook.example/bot', status: 'verified' },
      fetchImpl: fetchSpy as any,
    })
    await app.ready()

    const res = await app.inject({
      method: 'POST',
      url: '/api/oa/internal/dispatch-postback',
      payload: { oaId, userId, chatId, data: 'x' },
    })
    await app.close()
    expect(res.statusCode).toBe(504)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun --cwd apps/server test:unit src/plugins/oa-webhook.test.ts`
Expected: FAIL — endpoint returns 404 (no route registered).

- [ ] **Step 3: Add the new route**

Modify `apps/server/src/plugins/oa-webhook.ts`. Append a second `fastify.post(...)` block inside `oaWebhookPlugin`, after the existing `/api/oa/internal/dispatch` route (after line 80, before the closing `}` of the function body):

```ts
  // Internal dispatch endpoint for postback events (quick reply, future template/flex buttons)
  fastify.post(
    '/api/oa/internal/dispatch-postback',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as {
        oaId: string
        userId: string
        chatId: string
        data: string
        params?: { date?: string; time?: string; datetime?: string }
      }

      const account = await oa.getOfficialAccount(body.oaId)
      if (!account) return reply.code(404).send({ message: 'OA not found' })

      const webhook = await oa.getWebhook(body.oaId)
      if (!webhook || webhook.status !== 'verified') {
        return reply.code(400).send({ message: 'Webhook not configured or not verified' })
      }

      const replyTokenRecord = await oa.registerReplyToken({
        oaId: body.oaId,
        userId: body.userId,
        chatId: body.chatId,
        messageId: null,
      })

      const payload = oa.buildPostbackEvent({
        oaId: body.oaId,
        userId: body.userId,
        replyToken: replyTokenRecord.token,
        data: body.data,
        params: body.params,
      })
      const payloadBody = JSON.stringify(payload)
      const signature = oa.generateWebhookSignature(payloadBody, account.channelSecret)

      try {
        const response = await fetch(webhook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'x-line-signature': signature,
          },
          body: payloadBody,
          signal: AbortSignal.timeout(10000),
        })

        if (!response.ok) {
          await db
            .update(oaWebhook)
            .set({ status: 'failed' })
            .where(eq(oaWebhook.oaId, body.oaId))
          return await reply
            .code(502)
            .send({ message: 'Webhook delivery failed', status: response.status })
        }

        return await reply.send({ success: true })
      } catch {
        return reply.code(504).send({ message: 'Webhook delivery timeout' })
      }
    },
  )
```

(All imports — `oaWebhook`, `eq` — are already at the top of the file from the existing `/dispatch` route.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun --cwd apps/server test:unit src/plugins/oa-webhook.test.ts`
Expected: PASS — all 7 cases.

- [ ] **Step 5: Typecheck and full server test pass**

Run: `bun --cwd apps/server typecheck && bun --cwd apps/server test:unit`
Expected: no type errors; all tests green.

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/plugins/oa-webhook.ts apps/server/src/plugins/oa-webhook.test.ts
git commit -m "feat(server): add /api/oa/internal/dispatch-postback for quick reply"
```

---

### Task 6: Client helper — `dispatchPostback`

**Why:** Thin `fetch` wrapper that the chat room calls when the user taps a postback / datetimepicker quick-reply button. Cross-platform-safe (`fetch` works on RN + web).

**Files:**
- Create: `apps/web/src/features/oa/dispatchPostback.ts`

- [ ] **Step 1: Implement the helper**

Create `apps/web/src/features/oa/dispatchPostback.ts`:

```ts
type DispatchPostbackInput = {
  oaId: string
  chatId: string
  userId: string
  data: string
  params?: { date?: string; time?: string; datetime?: string }
}

type DispatchPostbackResult = { success: boolean; reason?: string }

const ENDPOINT = '/api/oa/internal/dispatch-postback'

export async function dispatchPostback(
  input: DispatchPostbackInput,
): Promise<DispatchPostbackResult> {
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(input),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return { success: false, reason: `HTTP ${res.status}${text ? `: ${text}` : ''}` }
    }
    return { success: true }
  } catch (err) {
    return { success: false, reason: err instanceof Error ? err.message : String(err) }
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `bun --cwd apps/web check`
Expected: no errors. (No tests for this file — it is a 15-line `fetch` wrapper with no branching beyond happy/sad paths; behavior is exercised end-to-end by the manual test plan in Task 10.)

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/oa/dispatchPostback.ts
git commit -m "feat(web): add dispatchPostback helper for quick reply"
```

---

### Task 7: Client helper — `openDateTimePicker` (web + native stub)

**Why:** Quick reply's `datetimepicker` action opens a native date/time picker. On web we use a hidden `<input type="date|time|datetime-local">`. On native we stub it out (datetime picker is out of v1 native support; the user simply sees a no-op).

**Files:**
- Create: `apps/web/src/features/oa/openDateTimePicker.ts` (web)
- Create: `apps/web/src/features/oa/openDateTimePicker.native.ts` (native no-op)

- [ ] **Step 1: Implement the web version**

Create `apps/web/src/features/oa/openDateTimePicker.ts`:

```ts
import { showToast } from '~/interface/toast/Toast'

export type DateTimePickerAction = {
  mode: 'date' | 'time' | 'datetime'
  initial?: string
  min?: string
  max?: string
}

export type DateTimePickerResult =
  | { date: string }
  | { time: string }
  | { datetime: string }
  | null

const MODE_TO_INPUT: Record<DateTimePickerAction['mode'], string> = {
  date: 'date',
  time: 'time',
  datetime: 'datetime-local',
}

export function openDateTimePicker(
  action: DateTimePickerAction,
): Promise<DateTimePickerResult> {
  if (typeof document === 'undefined') {
    if (process.env['NODE_ENV'] !== 'production') {
      console.warn('[openDateTimePicker] no document — datetime picker unavailable')
    }
    return Promise.resolve(null)
  }

  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = MODE_TO_INPUT[action.mode]
    input.style.position = 'fixed'
    input.style.left = '-9999px'
    if (action.initial) input.value = action.initial
    if (action.min) input.min = action.min
    if (action.max) input.max = action.max
    document.body.appendChild(input)

    let settled = false
    const cleanup = () => {
      if (input.parentNode) input.parentNode.removeChild(input)
    }
    const finish = (value: DateTimePickerResult) => {
      if (settled) return
      settled = true
      cleanup()
      resolve(value)
    }

    input.addEventListener('change', () => {
      const v = input.value
      if (!v) return finish(null)
      switch (action.mode) {
        case 'date':
          return finish({ date: v })
        case 'time':
          return finish({ time: v })
        case 'datetime':
          return finish({ datetime: v })
      }
    })
    // 'cancel' fires on Chromium/Firefox; on Safari we rely on blur as a fallback.
    input.addEventListener('cancel', () => finish(null))
    input.addEventListener('blur', () => {
      // Defer a tick so 'change' wins if both fired.
      setTimeout(() => finish(null), 0)
    })

    try {
      if (typeof (input as HTMLInputElement).showPicker === 'function') {
        ;(input as HTMLInputElement).showPicker()
      } else {
        input.click()
      }
    } catch (err) {
      if (process.env['NODE_ENV'] !== 'production') {
        console.warn('[openDateTimePicker] showPicker failed', err)
      }
      showToast('無法開啟日期選擇器', { type: 'error' })
      finish(null)
    }
  })
}
```

- [ ] **Step 2: Implement the native no-op**

Create `apps/web/src/features/oa/openDateTimePicker.native.ts`:

```ts
import { showToast } from '~/interface/toast/Toast'

export type DateTimePickerAction = {
  mode: 'date' | 'time' | 'datetime'
  initial?: string
  min?: string
  max?: string
}

export type DateTimePickerResult =
  | { date: string }
  | { time: string }
  | { datetime: string }
  | null

export function openDateTimePicker(): Promise<DateTimePickerResult> {
  showToast('原生平台暫不支援日期選擇器', { type: 'info' })
  if (__DEV__) {
    console.warn('[openDateTimePicker] not implemented on native (v1 web-only)')
  }
  return Promise.resolve(null)
}
```

- [ ] **Step 3: Typecheck**

Run: `bun --cwd apps/web check`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/features/oa/openDateTimePicker.ts apps/web/src/features/oa/openDateTimePicker.native.ts
git commit -m "feat(web): add openDateTimePicker helper (web + native stub)"
```

---

### Task 8: `QuickReplyBar` component

**Why:** Renders the horizontal pill buttons above `MessageInput`. Pure presentational; the parent owns the action dispatch logic.

**Files:**
- Create: `apps/web/src/interface/message/QuickReplyBar.tsx`

- [ ] **Step 1: Implement the component**

Create `apps/web/src/interface/message/QuickReplyBar.tsx`:

```tsx
import { memo } from 'react'
import { ScrollView } from 'react-native'
import { Image, SizableText, XStack, YStack } from 'tamagui'
import type { QuickReplyAction, QuickReplyItem } from '@vine/flex-schema'

type Props = {
  items: QuickReplyItem[]
  onAction: (action: QuickReplyAction) => void
}

export const QuickReplyBar = memo(({ items, onAction }: Props) => {
  return (
    <YStack
      shrink={0}
      bg="rgba(255,255,255,0.08)"
      borderTopWidth={1}
      borderTopColor="rgba(255,255,255,0.12)"
      py="$2"
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}
      >
        {items.map((item, idx) => {
          const label = item.action.label ?? ''
          return (
            <XStack
              key={`${idx}-${label}`}
              items="center"
              gap="$1.5"
              px="$3"
              py="$2"
              bg="white"
              cursor="pointer"
              onPress={() => onAction(item.action)}
              style={{ borderRadius: 999 }}
              hoverStyle={{ bg: '$gray3' }}
              pressStyle={{ bg: '$gray4' }}
            >
              {item.imageUrl ? (
                <Image
                  source={{ uri: item.imageUrl }}
                  width={16}
                  height={16}
                  style={{ borderRadius: 4 }}
                />
              ) : null}
              <SizableText fontSize={13} color="$color12">
                {label}
              </SizableText>
            </XStack>
          )
        })}
      </ScrollView>
    </YStack>
  )
})
```

- [ ] **Step 2: Typecheck**

Run: `bun --cwd apps/web check`
Expected: no errors. The `QuickReplyAction` / `QuickReplyItem` types come from `@vine/flex-schema` (Task 1).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/interface/message/QuickReplyBar.tsx
git commit -m "feat(web): add QuickReplyBar component"
```

---

### Task 9: Wire `QuickReplyBar` into the chat room

**Why:** Detect a `quickReply` on the latest OA message, render the bar above `MessageInput`, and route taps to the right handler per action type. This is the integration step.

**Files:**
- Modify: `apps/web/app/(app)/home/(tabs)/talks/[chatId].tsx`

- [ ] **Step 1: Add imports at the top of `[chatId].tsx`**

After the existing `import { Linking, Platform } from 'react-native'` (around line 3), add:

```tsx
import type { QuickReply, QuickReplyAction, QuickReplyItem } from '@vine/flex-schema'
import { QuickReplyBar } from '~/interface/message/QuickReplyBar'
import { dispatchPostback } from '~/features/oa/dispatchPostback'
import { openDateTimePicker } from '~/features/oa/openDateTimePicker'
```

- [ ] **Step 2: Add a local `parseMetadata` helper**

Right before the `const route = createRoute<...>` line (around line 26), insert:

```tsx
function parseMetadata(metadata?: string | null): Record<string, unknown> | null {
  if (!metadata) return null
  try {
    return JSON.parse(metadata) as Record<string, unknown>
  } catch {
    return null
  }
}
```

- [ ] **Step 3: Add derived state + dismissal handling inside `ChatRoomPage`**

Inside `ChatRoomPage`, after the existing `useState`s (around line 71, after `const [requireApproval, setRequireApproval] = useState(false)`), add:

```tsx
  const [dismissedFor, setDismissedFor] = useState<string | null>(null)

  const activeQuickReply = useMemo<QuickReply | null>(() => {
    const latest = messages?.[messages.length - 1]
    if (!latest) return null
    if (latest.id === dismissedFor) return null
    if (latest.senderType !== 'oa') return null
    const meta = parseMetadata(latest.metadata)
    const qr = meta?.['quickReply']
    if (!qr || typeof qr !== 'object') return null
    const items = (qr as { items?: unknown }).items
    if (!Array.isArray(items) || items.length === 0) return null
    return qr as QuickReply
  }, [messages, dismissedFor])

  // Reset dismissal when the message list changes — the next bar can render
  // for the new latest message.
  useEffect(() => {
    setDismissedFor(null)
  }, [messages?.length])
```

- [ ] **Step 4: Add the action handler**

After the existing `handleRichMenuAreaTap` `useCallback` (around line 161), add:

```tsx
  const handleQuickReplyAction = useCallback(
    (action: QuickReplyAction) => {
      const latestId = messages?.[messages.length - 1]?.id
      // Disappear rule: datetimepicker / clipboard keep the bar visible,
      // everything else dismisses immediately on tap.
      const keepBar = action.type === 'datetimepicker' || action.type === 'clipboard'
      if (!keepBar && latestId) setDismissedFor(latestId)

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
          dispatchPostback({
            oaId: otherMemberOaId,
            chatId: chatId!,
            userId,
            data: action.data,
          }).then((res) => {
            if (!res.success) {
              showToast(`Postback 失敗：${res.reason ?? 'unknown'}`, { type: 'error' })
            }
          })
          return
        }
        case 'datetimepicker': {
          if (!otherMemberOaId) return
          openDateTimePicker(action).then((params) => {
            if (!params) return
            dispatchPostback({
              oaId: otherMemberOaId,
              chatId: chatId!,
              userId,
              data: action.data,
              params,
            }).then((res) => {
              if (!res.success) {
                showToast(`Postback 失敗：${res.reason ?? 'unknown'}`, { type: 'error' })
              }
            })
          })
          return
        }
        case 'clipboard': {
          if (Platform.OS !== 'web' || typeof navigator === 'undefined') {
            showToast('複製功能尚未支援', { type: 'info' })
            return
          }
          navigator.clipboard
            .writeText(action.clipboardText)
            .then(() => showToast('已複製', { type: 'info' }))
            .catch(() => showToast('複製失敗', { type: 'error' }))
          return
        }
      }
    },
    [messages, sendMessage, otherMemberOaId, chatId, userId],
  )
```

- [ ] **Step 5: Render `QuickReplyBar` above `MessageInput`**

Find the existing `<YStack shrink={0}>` block that contains `<MessageInput .../>` (around line 305). Insert a sibling `QuickReplyBar` **above** it, gated on `activeQuickReply && inputMode !== 'richmenu'`:

```tsx
      {activeQuickReply && inputMode !== 'richmenu' && (
        <QuickReplyBar
          items={activeQuickReply.items as QuickReplyItem[]}
          onAction={handleQuickReplyAction}
        />
      )}

      <YStack shrink={0}>
        {/* existing MessageInput / RichMenuBar block stays unchanged */}
```

- [ ] **Step 6: Typecheck and lint**

Run: `bun --cwd apps/web check`
Expected: no errors.

Run: `bun --cwd apps/web lint src/interface/message/QuickReplyBar.tsx src/features/oa/dispatchPostback.ts src/features/oa/openDateTimePicker.ts 'app/(app)/home/(tabs)/talks/[chatId].tsx'`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add 'apps/web/app/(app)/home/(tabs)/talks/[chatId].tsx'
git commit -m "feat(web): wire QuickReplyBar into chat room"
```

---

### Task 10: Manual verification + final repo health check

**Why:** v1 has no e2e (per spec). This task is the manual smoke test that the feature works end-to-end against a real local stack.

**Files:** none modified.

- [ ] **Step 1: Bring up the local stack**

Run: `bun run dev`
Wait until web (`http://localhost:3000`), server (`:3001`), and zero (`:4948`) are all up. (See `.claude/skills/vine-dev-stack/SKILL.md`.)

- [ ] **Step 2: Push a text message with quickReply via the OA push API**

In a separate terminal — first issue an access token for a seeded OA, then push a message. Replace `<OA_ID>` and `<CHANNEL_SECRET>` from the dev seed (visible in the OA developer console), and `<USER_ID>` with your logged-in user ID:

```bash
TOKEN=$(curl -s -X POST http://localhost:3001/api/oa/v2/oauth/accessToken \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials&client_id=<OA_ID>&client_secret=<CHANNEL_SECRET>" \
  | jq -r .access_token)

curl -X POST http://localhost:3001/api/oa/v2/bot/message/push \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "<USER_ID>",
    "messages": [{
      "type": "text",
      "text": "Choose your favorite",
      "quickReply": {
        "items": [
          { "type": "action", "action": { "type": "message", "label": "Sushi", "text": "Sushi" } },
          { "type": "action", "action": { "type": "uri",     "label": "LINE",  "uri":  "https://line.me" } },
          { "type": "action", "action": { "type": "postback","label": "Buy",   "data": "action=buy", "displayText": "I want to buy" } },
          { "type": "action", "action": { "type": "datetimepicker", "label": "When?", "data": "action=when", "mode": "datetime" } },
          { "type": "action", "action": { "type": "clipboard","label": "Copy",  "clipboardText": "hello" } }
        ]
      }
    }]
  }'
```

Expected: HTTP 200 `{}`.

- [ ] **Step 3: Verify rendering in the browser**

Open the chat with the OA in `http://localhost:3000`. Expected:
- The text bubble "Choose your favorite" appears.
- A horizontal bar of 5 pill buttons appears above the input.

- [ ] **Step 4: Verify each action type**

| Tap | Expected |
|---|---|
| **Sushi** (message) | Sends "Sushi" as a user message; bar disappears. |
| Re-trigger Step 2 to bring the bar back, then **LINE** (uri) | Opens `https://line.me` in a new tab; bar disappears. |
| Re-trigger, then **Buy** (postback) | "I want to buy" appears as a user message; the OA's webhook receives a `type=postback` event with `data=action=buy` (verify in OA-side webhook logs or `docker compose logs server | grep dispatch-postback`); bar disappears. |
| Re-trigger, then **When?** (datetimepicker) | Native date-time picker opens; pick a value; the OA's webhook receives `type=postback` with `postback.params.datetime`; bar **stays visible**. |
| Re-trigger, then **Copy** (clipboard) | Toast "已複製"; clipboard contains "hello"; bar **stays visible**. |

- [ ] **Step 5: Verify dismissal-on-new-message**

While the bar is visible (after a Step 2 push), send any user message in the chat. Expected: bar disappears immediately. Push a fresh OA message with `quickReply`: bar reappears.

- [ ] **Step 6: Verify rejection of unsupported actions**

Re-run Step 2 with a `camera` action in the items array. Expected: HTTP 400, body `{ "code": "INVALID_QUICK_REPLY", "message": "Invalid quickReply: ..." }`.

```bash
curl -i -X POST http://localhost:3001/api/oa/v2/bot/message/push \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "<USER_ID>",
    "messages": [{
      "type": "text",
      "text": "x",
      "quickReply": {
        "items": [{ "type": "action", "action": { "type": "camera", "label": "Cam" } }]
      }
    }]
  }'
```

- [ ] **Step 7: Final repo-wide health check**

Run: `bun run test:unit`
Expected: all packages green.

Run: `bun run check:all`
Expected: typecheck clean across the repo.

- [ ] **Step 8: Final commit (only if Steps 1-6 surfaced any fixups)**

If any small fixes were needed during manual verification, commit them:

```bash
git add -p
git commit -m "fix(quick-reply): <describe fix>"
```

If everything passed cleanly, no commit needed.
