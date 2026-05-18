# Manager OA Rich Message Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Phase 4B: a shared OA manager Rich Message Editor for rich `MessageDraft[]` authoring, with OA chat and campaign send integration.

**Architecture:** Implement a lightweight Tiptap-inspired editor core: normalized message extensions, starter-kit configuration, commands, validation, serialization, and preview renderers. Persist rich campaign payloads in `oaCampaign.messagePayloadJson`/`messageSummary`, keep `messageText` deprecated and nullable, and add a rich OA chat Zero mutation for multi-message sends.

**Tech Stack:** Bun, TypeScript, React 19, Tamagui, One, Zero/on-zero, ConnectRPC, Drizzle/PostgreSQL, Valibot, Vitest, Playwright.

---

## Pre-Flight

Current approved spec:

- `docs/superpowers/specs/2026-05-18-manager-oa-rich-message-editor-design.md`

Important constraints:

- Do not modify `learn-projects/`.
- Do not modify the untracked local `tiptap/` checkout; read it only if architecture details are needed.
- If implementing from `main`, create a feature branch first.
- Do not introduce `@tiptap/*` dependencies.
- Do not add template message authoring.
- Do not make `maxMessages` default to a hard limit. Leave it undefined unless a caller explicitly passes a value.

Branch gate:

```bash
rtk git branch --show-current
rtk git status --short
```

If the current branch is `main`, run:

```bash
rtk git checkout -b feat/oa-rich-message-editor
```

## File Structure

Create these new frontend files:

- `apps/web/src/features/rich-message/core/types.ts`  
  Shared `MessageDraft`, `RichMessageExtension`, validation, and normalized message types.
- `apps/web/src/features/rich-message/core/extensionManager.ts`  
  Resolve starter kits and extensions, sort by priority, reject duplicate enabled types.
- `apps/web/src/features/rich-message/core/editor.ts`  
  Headless editor instance and commands over controlled `MessageDraft[]`.
- `apps/web/src/features/rich-message/core/serialization.ts`  
  Draft validation, `toMessagingApiMessages`, `fromMessagingApiMessages`, and `summarizeMessagingMessages`.
- `apps/web/src/features/rich-message/extensions/basic.tsx`  
  Text extension.
- `apps/web/src/features/rich-message/extensions/mediaUrl.tsx`  
  Image/video/audio URL extensions.
- `apps/web/src/features/rich-message/extensions/flex.tsx`  
  Flex extension and dialog adapter.
- `apps/web/src/features/rich-message/extensions/imagemap.tsx`  
  Imagemap extension and dialog adapter.
- `apps/web/src/features/rich-message/extensions/disabled.tsx`  
  Disabled sticker/location toolbar extensions.
- `apps/web/src/features/rich-message/RichMessageStarterKit.ts`  
  Default extension kit with `.configure(...)`.
- `apps/web/src/features/rich-message/RichMessageEditor.tsx`  
  Slim composer UI with live preview and bottom toolbar.
- `apps/web/src/features/rich-message/RichMessagePreview.tsx`  
  Preview wrapper using chat bubble rendering style.
- `apps/web/src/features/rich-message/RichMessageToolbar.tsx`  
  Bottom toolbar generated from extensions, plus pure toolbar item projection.
- `apps/web/src/features/rich-message/dialogs/MediaUrlDialog.tsx`  
  Image/video/audio URL dialog.
- `apps/web/src/features/rich-message/dialogs/FlexMessageDialog.tsx`  
  Flex dialog using shared editor.
- `apps/web/src/features/rich-message/dialogs/ImagemapDialog.tsx`  
  Imagemap structured dialog.
- `apps/web/src/features/rich-message/dialogs/draftFactories.ts`  
  Pure draft builders used by dialogs and unit tests.
- `apps/web/src/features/rich-message/flex/defaultFlexMessage.ts`  
  Shared default Flex JSON.
- `apps/web/src/features/rich-message/flex/flexMessageJson.ts`  
  Pure JSON parse/format helpers for Flex editor tests and UI.
- `apps/web/src/features/rich-message/flex/FlexMessageJsonEditor.tsx`  
  Shared Flex JSON editor + preview.

Modify these frontend files:

- `apps/web/app/(app)/developers/flex-simulator/index.tsx`  
  Use `FlexMessageJsonEditor`.
- `apps/web/app/(app)/developers/flex-simulator/FlexSimulatorPreview.tsx`  
  Either keep as a wrapper or replace usages with shared preview.
- `apps/web/src/features/oa-manager/chat/useManagerOAMessages.ts`  
  Add `sendRichMessages`.
- `apps/web/src/features/oa-manager/chat/ManagerOAChatRoom.tsx`  
  Replace text-only input with Rich Message Editor send affordance.
- `apps/web/src/features/oa-manager/campaign/useManagerOACampaigns.ts`  
  Add `sendRichCampaign`, campaign summary fields, rich payload fields.
- `apps/web/src/features/oa-manager/campaign/ManagerOACampaignsPage.tsx`  
  Replace text area with Rich Message Editor and show rich campaign summaries.

Create/modify backend files:

- Create `apps/server/src/services/oa-message-payload.ts`  
  Pure server normalization/validation/summarization for Messaging API-compatible message arrays.
- Modify `apps/server/src/plugins/oa-messaging.ts`  
  Reuse `oa-message-payload.ts` for `validateMessage`.
- Modify `apps/server/src/services/oa-campaign.ts`  
  Add `sendRichCampaign`, keep `sendTextCampaign` as compatibility wrapper.
- Modify `apps/server/src/connect/oa.ts`  
  Add `sendRichCampaign` Connect handler.

Modify DB/Zero/proto files:

- Modify `packages/db/src/schema-oa.ts`  
  Add `messagePayloadJson`, `messageSummary`, make `messageText` nullable.
- Create `packages/db/src/migrations/20260518000000_oa_campaign_rich_messages.ts`  
  Add/backfill campaign payload columns.
- Modify `packages/zero-schema/src/models/oaCampaign.ts`  
  Add new synced fields, make `messageText` optional.
- Modify generated Zero files by running `rtk bun --cwd packages/zero-schema zero:generate`.
- Modify `packages/proto/proto/oa/v1/oa.proto`  
  Add `SendRichCampaignRequest`/`Response` and service RPC.
- Modify generated proto by running `rtk bun turbo proto:generate`.

Test files:

- Create `apps/web/src/test/unit/features/rich-message/richMessageCore.test.ts`
- Create `apps/web/src/test/unit/features/rich-message/richMessageSerialization.test.ts`
- Create `apps/web/src/test/unit/features/rich-message/flexMessageJson.test.ts`
- Create `apps/web/src/test/unit/features/rich-message/richMessageToolbar.test.ts`
- Create `apps/web/src/test/unit/features/rich-message/richMessageDialogDrafts.test.ts`
- Modify `packages/zero-schema/src/__tests__/manager-oa-chat.test.ts`
- Modify `packages/zero-schema/src/__tests__/manager-oa-campaigns.test.ts`
- Create or modify `apps/server/src/services/oa-message-payload.test.ts`
- Modify `apps/server/src/services/oa-campaign.test.ts`
- Modify `apps/server/src/connect/oa-campaign.test.ts`
- Modify `apps/web/src/test/integration/manager-oa-chat.test.ts`
- Modify `apps/web/src/test/integration/manager-oa-campaigns.test.ts`
- Keep existing `apps/web/src/test/integration/flex-simulator.test.ts` passing.

---

### Task 1: Campaign DB, Zero, And Proto Shape

**Files:**

- Modify: `packages/db/src/schema-oa.ts`
- Create: `packages/db/src/migrations/20260518000000_oa_campaign_rich_messages.ts`
- Modify: `packages/zero-schema/src/models/oaCampaign.ts`
- Modify generated: `packages/zero-schema/src/generated/*`
- Modify: `packages/proto/proto/oa/v1/oa.proto`
- Modify generated: `packages/proto/gen/oa/v1/oa_pb.ts`
- Test: `packages/zero-schema/src/__tests__/manager-oa-campaigns.test.ts`

- [ ] **Step 1: Write failing Zero schema test**

Add this test to `packages/zero-schema/src/__tests__/manager-oa-campaigns.test.ts`:

```ts
it('models rich campaign payload fields and deprecated messageText', () => {
  const columns = (campaignModel.schema as any).columns

  expect(columns.messagePayloadJson).toBeTruthy()
  expect(columns.messageSummary).toBeTruthy()
  expect(columns.messageText).toBeTruthy()
})
```

- [ ] **Step 2: Run the test to verify RED**

Run:

```bash
rtk bun --cwd packages/zero-schema test src/__tests__/manager-oa-campaigns.test.ts
```

Expected: FAIL because `messagePayloadJson` and `messageSummary` do not exist.

- [ ] **Step 3: Update Drizzle schema**

In `packages/db/src/schema-oa.ts`, change the `oaCampaign` columns:

```ts
messageType: text('messageType').notNull().default('text'),
messageText: text('messageText'),
messagePayloadJson: jsonb('messagePayloadJson').notNull().default([]),
messageSummary: text('messageSummary').notNull().default(''),
```

Keep all existing indexes.

- [ ] **Step 4: Add migration**

Create `packages/db/src/migrations/20260518000000_oa_campaign_rich_messages.ts`:

```ts
import type { PoolClient } from 'pg'

export async function up(client: PoolClient): Promise<void> {
  await client.query(`
    ALTER TABLE "oaCampaign"
      ADD COLUMN "messagePayloadJson" jsonb,
      ADD COLUMN "messageSummary" text NOT NULL DEFAULT '';

    UPDATE "oaCampaign"
    SET
      "messagePayloadJson" = jsonb_build_array(
        jsonb_build_object('type', 'text', 'text', "messageText")
      ),
      "messageSummary" = "messageText"
    WHERE "messagePayloadJson" IS NULL;

    ALTER TABLE "oaCampaign"
      ALTER COLUMN "messagePayloadJson" SET NOT NULL,
      ALTER COLUMN "messagePayloadJson" SET DEFAULT '[]'::jsonb,
      ALTER COLUMN "messageText" DROP NOT NULL;
  `)
}

export async function down(client: PoolClient): Promise<void> {
  await client.query(`
    ALTER TABLE "oaCampaign"
      ALTER COLUMN "messageText" SET NOT NULL,
      DROP COLUMN IF EXISTS "messagePayloadJson",
      DROP COLUMN IF EXISTS "messageSummary";
  `)
}
```

- [ ] **Step 5: Update Zero model**

In `packages/zero-schema/src/models/oaCampaign.ts`, update columns:

```ts
messageType: string(),
messageText: string().optional(),
messagePayloadJson: json<Array<Record<string, any>>>(),
messageSummary: string(),
```

- [ ] **Step 6: Update proto**

In `packages/proto/proto/oa/v1/oa.proto`, add:

```protobuf
message SendRichCampaignRequest {
  string official_account_id = 1;
  string campaign_id = 2;
  string name = 3;
  string message_payload_json = 4;
  optional string audience_filter_id = 5;
  optional string inline_audience_query_json = 6;
}

message SendRichCampaignResponse {
  string campaign_id = 1;
}
```

Add to `service OAService`:

```protobuf
rpc SendRichCampaign(SendRichCampaignRequest) returns (SendRichCampaignResponse);
```

Do not remove `SendTextCampaign` yet; it remains a compatibility RPC.

- [ ] **Step 7: Generate Zero and proto outputs**

Run:

```bash
rtk bun --cwd packages/zero-schema zero:generate
rtk bun turbo proto:generate
```

Expected: generated Zero and proto files update successfully.

- [ ] **Step 8: Verify GREEN**

Run:

```bash
rtk bun --cwd packages/zero-schema test src/__tests__/manager-oa-campaigns.test.ts
rtk bun --cwd packages/zero-schema typecheck
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
rtk git add packages/db/src/schema-oa.ts packages/db/src/migrations/20260518000000_oa_campaign_rich_messages.ts packages/zero-schema/src/models/oaCampaign.ts packages/zero-schema/src/generated packages/proto/proto/oa/v1/oa.proto packages/proto/gen/oa/v1/oa_pb.ts packages/zero-schema/src/__tests__/manager-oa-campaigns.test.ts
rtk git commit -m "feat: add rich campaign payload schema"
```

---

### Task 2: Server Message Payload Utility

**Files:**

- Create: `apps/server/src/services/oa-message-payload.ts`
- Test: `apps/server/src/services/oa-message-payload.test.ts`
- Modify: `apps/server/src/plugins/oa-messaging.ts`

- [ ] **Step 1: Write failing server utility tests**

Create `apps/server/src/services/oa-message-payload.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  normalizeMessagingApiMessages,
  summarizeMessagingMessages,
} from './oa-message-payload'

const flex = {
  type: 'flex',
  altText: 'Promo card',
  contents: {
    type: 'bubble',
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [{ type: 'text', text: 'Sale' }],
    },
  },
}

describe('oa message payload utility', () => {
  it('normalizes text, media, flex, imagemap, and quick reply payloads', () => {
    const messages = normalizeMessagingApiMessages([
      { type: 'text', text: 'hello' },
      {
        type: 'image',
        originalContentUrl: 'https://cdn.example.com/a.jpg',
        previewImageUrl: 'https://cdn.example.com/p.jpg',
      },
      flex,
    ])

    expect(messages).toHaveLength(3)
    expect(messages[0]).toEqual({ type: 'text', text: 'hello', metadata: null })
    expect(messages[1].type).toBe('image')
    expect(messages[1].metadata).toContain('originalContentUrl')
    expect(messages[2].type).toBe('flex')
    expect(messages[2].metadata).toContain('Promo card')
  })

  it('rejects unsupported template messages', () => {
    expect(() =>
      normalizeMessagingApiMessages([{ type: 'template', altText: 'No' }]),
    ).toThrow('Unsupported message type: "template"')
  })

  it('summarizes multi-message rich payloads', () => {
    expect(
      summarizeMessagingMessages([
        { type: 'text', text: 'hello world' },
        flex,
        {
          type: 'audio',
          originalContentUrl: 'https://cdn.example.com/a.m4a',
          duration: 1200,
        },
      ]),
    ).toBe('3 messages: hello world')
  })
})
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```bash
rtk bun --cwd apps/server test:unit src/services/oa-message-payload.test.ts
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Create payload utility**

Create `apps/server/src/services/oa-message-payload.ts`:

```ts
import { FlexMessageSchema, QuickReplySchema } from '@vine/flex-schema'
import { ImagemapMessageSchema } from '@vine/imagemap-schema'
import * as v from 'valibot'

export type NormalizedOAMessage = {
  type: string
  text: string | null
  metadata: string | null
}

type ValidationSuccess = NormalizedOAMessage

function stringifyMetadata(value: Record<string, unknown> | null): string | null {
  return value ? JSON.stringify(value) : null
}

function attachQuickReply(
  baseMetadata: Record<string, unknown> | null,
  rawQuickReply: unknown,
): string | null {
  if (rawQuickReply === undefined) return stringifyMetadata(baseMetadata)
  const result = v.safeParse(QuickReplySchema, rawQuickReply)
  if (!result.success) {
    const flat = v.flatten<typeof QuickReplySchema>(result.issues)
    throw new Error(`Invalid quickReply: ${JSON.stringify(flat.nested)}`)
  }
  return stringifyMetadata({ ...(baseMetadata ?? {}), quickReply: result.output })
}

export function normalizeMessagingApiMessage(msg: unknown): ValidationSuccess {
  if (typeof msg !== 'object' || msg === null) {
    throw new Error('Message must be an object')
  }

  const { type, text, ...rest } = msg as Record<string, unknown>
  if (!type || typeof type !== 'string') {
    throw new Error('Message must have a "type" field')
  }

  const { quickReply, ...restWithoutQuickReply } = rest as Record<string, unknown>

  switch (type) {
    case 'text': {
      if (typeof text !== 'string') throw new Error('Text message must have a "text" field')
      const trimmed = text.trim()
      if (!trimmed) throw new Error('Text message must have a non-empty "text" field')
      if (trimmed.length > 5000) throw new Error('Text message must not exceed 5000 characters')
      return { type, text: trimmed, metadata: attachQuickReply(null, quickReply) }
    }
    case 'image':
    case 'video': {
      const originalContentUrl = restWithoutQuickReply.originalContentUrl
      const previewImageUrl = restWithoutQuickReply.previewImageUrl
      if (typeof originalContentUrl !== 'string' || !originalContentUrl.startsWith('https://')) {
        throw new Error(`Invalid ${type} originalContentUrl`)
      }
      if (typeof previewImageUrl !== 'string' || !previewImageUrl.startsWith('https://')) {
        throw new Error(`Invalid ${type} previewImageUrl`)
      }
      return { type, text: null, metadata: attachQuickReply(restWithoutQuickReply, quickReply) }
    }
    case 'audio': {
      const originalContentUrl = restWithoutQuickReply.originalContentUrl
      const duration = restWithoutQuickReply.duration
      if (typeof originalContentUrl !== 'string' || !originalContentUrl.startsWith('https://')) {
        throw new Error('Invalid audio originalContentUrl')
      }
      if (duration !== undefined && typeof duration !== 'number') {
        throw new Error('Audio duration must be a number')
      }
      return { type, text: null, metadata: attachQuickReply(restWithoutQuickReply, quickReply) }
    }
    case 'flex': {
      const result = v.safeParse(FlexMessageSchema, msg)
      if (!result.success) {
        const flat = v.flatten<typeof FlexMessageSchema>(result.issues)
        throw new Error(`Invalid flex message: ${JSON.stringify(flat.nested)}`)
      }
      return { type, text: null, metadata: attachQuickReply(result.output as Record<string, unknown>, quickReply) }
    }
    case 'imagemap': {
      const result = v.safeParse(ImagemapMessageSchema, msg)
      if (!result.success) {
        const flat = v.flatten<typeof ImagemapMessageSchema>(result.issues)
        throw new Error(`Invalid imagemap message: ${JSON.stringify(flat.nested)}`)
      }
      return { type, text: null, metadata: attachQuickReply(result.output as Record<string, unknown>, quickReply) }
    }
    default:
      throw new Error(`Unsupported message type: "${type}"`)
  }
}

export function normalizeMessagingApiMessages(messages: unknown[]): NormalizedOAMessage[] {
  if (!Array.isArray(messages)) throw new Error('messages must be an array')
  if (messages.length === 0) throw new Error('messages must not be empty')
  return messages.map(normalizeMessagingApiMessage)
}

export function summarizeMessagingMessages(messages: unknown[]): string {
  const first = messages[0] as Record<string, unknown> | undefined
  if (!first) return ''
  const firstSummary =
    first.type === 'text' && typeof first.text === 'string'
      ? first.text.trim().slice(0, 80)
      : first.type === 'flex' && typeof first.altText === 'string'
        ? `Flex: ${first.altText}`
        : first.type === 'imagemap' && typeof first.altText === 'string'
          ? `Imagemap: ${first.altText}`
          : `${String(first.type ?? 'Message')} message`
  return messages.length > 1 ? `${messages.length} messages: ${firstSummary}` : firstSummary
}
```

- [ ] **Step 4: Reuse utility in Messaging API plugin**

In `apps/server/src/plugins/oa-messaging.ts`, import:

```ts
import { normalizeMessagingApiMessage } from '../services/oa-message-payload'
```

Then change `validateMessage(msg)` to delegate:

```ts
export function validateMessage(msg: unknown): ValidationSuccess | ValidationFailure {
  try {
    const normalized = normalizeMessagingApiMessage(msg)
    return {
      valid: true,
      type: normalized.type,
      text: normalized.text,
      metadata: normalized.metadata,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid message'
    return {
      valid: false,
      error: message,
      code: message.startsWith('Invalid quickReply') ? 'INVALID_QUICK_REPLY' : undefined,
    }
  }
}
```

Remove now-unused direct imports of `FlexMessageSchema`, `QuickReplySchema`,
`ImagemapMessageSchema`, and `valibot` from `oa-messaging.ts`.

- [ ] **Step 5: Verify GREEN and existing validation tests**

Run:

```bash
rtk bun --cwd apps/server test:unit src/services/oa-message-payload.test.ts src/plugins/oa-messaging.validate.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
rtk git add apps/server/src/services/oa-message-payload.ts apps/server/src/services/oa-message-payload.test.ts apps/server/src/plugins/oa-messaging.ts
rtk git commit -m "feat: add oa message payload normalization"
```

---

### Task 3: Rich Campaign Backend Service And ConnectRPC

**Files:**

- Modify: `apps/server/src/services/oa-campaign.ts`
- Modify: `apps/server/src/services/oa-campaign.test.ts`
- Modify: `apps/server/src/connect/oa.ts`
- Modify: `apps/server/src/connect/oa-campaign.test.ts`

- [ ] **Step 1: Write failing campaign service tests**

Add to `apps/server/src/services/oa-campaign.test.ts`:

```ts
it('persists rich message campaigns with payload summary and null deprecated text', async () => {
  const inserted: unknown[] = []
  const tx = { insert: vi.fn(() => ({ values: vi.fn(async (row) => inserted.push(row)) })) }
  const audience = {
    resolveRecipients: vi.fn(async () => ({ ok: true as const, userIds: ['user-1'] })),
  }
  const messaging = {
    acceptMessagingExecution: vi.fn(async (input) => {
      await input.onAccepted({
        tx,
        request: { id: 'request-1' },
        recipientCount: 1,
        nowIso: '2026-05-18T00:00:00.000Z',
      })
      return { ok: true, accepted: { request: { id: 'request-1' } }, recipientCount: 1 }
    }),
  }
  const service = createOACampaignService({
    db: {} as any,
    audience: audience as any,
    messaging: messaging as any,
    now: () => new Date('2026-05-18T00:00:00.000Z'),
  })

  const messages = [{ type: 'text', text: 'Rich hello' }]
  await service.sendRichCampaign({
    campaignId: 'campaign-1',
    oaId: 'oa-1',
    managerId: 'manager-1',
    name: 'Rich',
    messages,
    audienceFilterId: undefined,
    inlineAudienceQuery: { 'friendship.status': 'friend' },
  })

  expect(messaging.acceptMessagingExecution).toHaveBeenCalledWith(
    expect.objectContaining({
      messages: [{ type: 'text', text: 'Rich hello', metadata: null }],
    }),
  )
  expect(inserted).toEqual([
    expect.objectContaining({
      messageType: 'rich',
      messageText: null,
      messagePayloadJson: messages,
      messageSummary: 'Rich hello',
    }),
  ])
})
```

- [ ] **Step 2: Run service test to verify RED**

Run:

```bash
rtk bun --cwd apps/server test:unit src/services/oa-campaign.test.ts
```

Expected: FAIL because `sendRichCampaign` does not exist.

- [ ] **Step 3: Implement rich campaign service**

In `apps/server/src/services/oa-campaign.ts`, import:

```ts
import {
  normalizeMessagingApiMessages,
  summarizeMessagingMessages,
} from './oa-message-payload'
```

Add types:

```ts
type SendRichCampaignInput = {
  campaignId: string
  oaId: string
  managerId: string
  name: string
  messages: unknown[]
  audienceFilterId: string | undefined
  inlineAudienceQuery: AudienceQueryJson | undefined
}
```

Refactor acceptance into a helper:

```ts
async function acceptRichCampaign(input: SendRichCampaignInput & { retryKey?: string }) {
  const name = cleanCampaignName(input.name)
  const normalizedMessages = normalizeMessagingApiMessages(input.messages)
  const messageSummary = summarizeMessagingMessages(input.messages)
  const query = await loadAudienceQuery(input)
  const recipients = await deps.audience.resolveRecipients({ oaId: input.oaId, query })
  if (!recipients.ok) throw new Error(recipients.message)

  let acceptedRequestId = ''
  let acceptedRecipientCount = 0
  const accepted = await deps.messaging.acceptMessagingExecution({
    oaId: input.oaId,
    requestType: 'campaign',
    retryKey: input.retryKey,
    target: {
      campaignId: input.campaignId,
      audienceFilterId: input.audienceFilterId,
      audience: query,
    },
    messages: normalizedMessages,
    resolveRecipients: async () => recipients.userIds,
    onAccepted: async ({ tx, request, recipientCount, nowIso }) => {
      acceptedRequestId = request.id
      acceptedRecipientCount = recipientCount
      await tx.insert(oaCampaign).values({
        id: input.campaignId,
        oaId: input.oaId,
        name,
        messageType: 'rich',
        messageText: null,
        messagePayloadJson: input.messages,
        messageSummary,
        audienceFilterId: input.audienceFilterId,
        inlineAudienceQueryJson: input.inlineAudienceQuery ?? null,
        messageRequestId: request.id,
        status: recipientCount === 0 ? 'sent' : 'queued',
        recipientSnapshotCount: recipientCount,
        successCount: 0,
        failedCount: 0,
        quotaUsed: recipientCount,
        createdByManagerId: input.managerId,
        createdAt: nowIso,
        updatedAt: nowIso,
        queuedAt: nowIso,
        sentAt: recipientCount === 0 ? nowIso : null,
      })
    },
  })
  return { accepted, acceptedRequestId, acceptedRecipientCount }
}
```

Add public method:

```ts
async function sendRichCampaign(input: SendRichCampaignInput) {
  const { accepted, acceptedRequestId, acceptedRecipientCount } =
    await acceptRichCampaign(input)
  if (!accepted.ok) throw new Error(accepted.code)
  return {
    ok: true as const,
    campaignId: input.campaignId,
    messageRequestId: acceptedRequestId,
    recipientCount: acceptedRecipientCount,
  }
}
```

Update `sendTextCampaign` to call `sendRichCampaign` with a text message, then
keep old external facade behavior unchanged unless it becomes easier to route it
through `acceptRichCampaign`.

Return:

```ts
return { previewAudience, sendTextCampaign, sendRichCampaign, sendExternalTextCampaign }
```

- [ ] **Step 4: Add failing Connect test**

In `apps/server/src/connect/oa-campaign.test.ts`, add:

```ts
it('passes rich campaign payloads to the campaign service', async () => {
  const { capturedImpl, oaCampaign } = makeDeps('manager-1')
  oaCampaign.sendRichCampaign = vi.fn(async () => ({ ok: true, campaignId: 'campaign-1' }))
  mockedGetAuthDataFromRequest.mockResolvedValue({ id: 'manager-1' } as any)

  await expect(
    capturedImpl.sendRichCampaign(
      {
        officialAccountId: 'oa-1',
        campaignId: 'campaign-1',
        name: 'Rich',
        messagePayloadJson: JSON.stringify([{ type: 'text', text: 'hello' }]),
        inlineAudienceQueryJson: JSON.stringify({ 'friendship.status': 'friend' }),
      },
      makeAuthCtx('manager-1'),
    ),
  ).resolves.toEqual({ campaignId: 'campaign-1' })

  expect(oaCampaign.sendRichCampaign).toHaveBeenCalledWith({
    campaignId: 'campaign-1',
    oaId: 'oa-1',
    managerId: 'manager-1',
    name: 'Rich',
    messages: [{ type: 'text', text: 'hello' }],
    audienceFilterId: undefined,
    inlineAudienceQuery: { 'friendship.status': 'friend' },
  })
})
```

- [ ] **Step 5: Implement Connect handler**

In `apps/server/src/connect/oa.ts`, add a helper:

```ts
function parseMessagePayloadJson(value: string) {
  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) {
      throw new ConnectError('Message payload must be an array', Code.InvalidArgument)
    }
    return parsed
  } catch (err) {
    if (err instanceof ConnectError) throw err
    throw new ConnectError('Invalid message payload JSON', Code.InvalidArgument)
  }
}
```

Add handler near `sendTextCampaign`:

```ts
async sendRichCampaign(req, ctx) {
  const auth = requireAuthData(ctx)
  await assertOfficialAccountOwnedByUser(deps, req.officialAccountId, auth.id)
  const inlineAudienceQuery = req.inlineAudienceQueryJson
    ? parseAudienceQueryJson(req.inlineAudienceQueryJson)
    : undefined
  const messages = parseMessagePayloadJson(req.messagePayloadJson)

  try {
    const result = await deps.oaCampaign.sendRichCampaign({
      campaignId: req.campaignId,
      oaId: req.officialAccountId,
      managerId: auth.id,
      name: req.name,
      messages,
      audienceFilterId: req.audienceFilterId,
      inlineAudienceQuery,
    })
    return { campaignId: result.campaignId }
  } catch (err) {
    if (!(err instanceof Error)) throw err
    if (
      err.message.startsWith('Campaign name') ||
      err.message.startsWith('Invalid') ||
      err.message.startsWith('Unsupported message type')
    ) {
      throw new ConnectError(err.message, Code.InvalidArgument)
    }
    if (err.message === 'Audience filter not found') throw new ConnectError(err.message, Code.NotFound)
    if (err.message === 'QUOTA_EXCEEDED') throw new ConnectError(err.message, Code.ResourceExhausted)
    throw err
  }
}
```

- [ ] **Step 6: Verify GREEN**

Run:

```bash
rtk bun --cwd apps/server test:unit src/services/oa-campaign.test.ts src/connect/oa-campaign.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
rtk git add apps/server/src/services/oa-campaign.ts apps/server/src/services/oa-campaign.test.ts apps/server/src/connect/oa.ts apps/server/src/connect/oa-campaign.test.ts
rtk git commit -m "feat: send rich oa campaigns"
```

---

### Task 4: Rich OA Chat Zero Mutation

**Files:**

- Modify: `packages/zero-schema/src/models/message.ts`
- Modify generated: `packages/zero-schema/src/generated/*`
- Test: `packages/zero-schema/src/__tests__/manager-oa-chat.test.ts`

- [ ] **Step 1: Write failing mutation tests**

Add to `packages/zero-schema/src/__tests__/manager-oa-chat.test.ts` in the
`message.sendAsOA` describe block:

```ts
it('inserts multiple OA rich messages and points chat metadata to the last row', async () => {
  const { tx, inserted, chatUpdates } = makeTx()

  await (messageMutate as any).sendRichAsOA(
    { authData: { id: 'manager-1' }, tx },
    {
      chatId: 'chat-1',
      oaId: 'oa-1',
      createdAt: 1000,
      messages: [
        { id: 'msg-1', type: 'text', text: 'hello', metadata: null },
        {
          id: 'msg-2',
          type: 'image',
          text: null,
          metadata: JSON.stringify({
            originalContentUrl: 'https://cdn.example.com/a.jpg',
            previewImageUrl: 'https://cdn.example.com/p.jpg',
          }),
        },
      ],
    },
  )

  expect(inserted).toEqual([
    expect.objectContaining({ id: 'msg-1', type: 'text', text: 'hello', createdAt: 1000 }),
    expect.objectContaining({ id: 'msg-2', type: 'image', text: null, createdAt: 1001 }),
  ])
  expect(chatUpdates).toEqual([{ id: 'chat-1', lastMessageId: 'msg-2', lastMessageAt: 1001 }])
})

it('rejects empty OA rich sends', async () => {
  const { tx } = makeTx()

  await expect(
    (messageMutate as any).sendRichAsOA(
      { authData: { id: 'manager-1' }, tx },
      { chatId: 'chat-1', oaId: 'oa-1', createdAt: 1000, messages: [] },
    ),
  ).rejects.toThrow('At least one message is required')
})
```

- [ ] **Step 2: Run test to verify RED**

Run:

```bash
rtk bun --cwd packages/zero-schema test src/__tests__/manager-oa-chat.test.ts
```

Expected: FAIL because `sendRichAsOA` does not exist.

- [ ] **Step 3: Implement mutation**

In `packages/zero-schema/src/models/message.ts`, add:

```ts
type OARichMessageInput = {
  id: string
  type: Message['type']
  text?: string | null
  metadata?: string | null
}
```

Add custom mutation:

```ts
sendRichAsOA: async (
  { authData, tx },
  args: {
    chatId: string
    oaId: string
    createdAt: number
    messages: OARichMessageInput[]
  },
) => {
  if (!authData) throw new Error('Unauthorized')
  if (args.messages.length === 0) throw new Error('At least one message is required')

  await assertOaOwner(tx as { query?: Record<string, any> }, args.oaId, authData.id)
  await assertOaChat(tx as { query?: Record<string, any> }, args.chatId, args.oaId)

  for (let index = 0; index < args.messages.length; index++) {
    const item = args.messages[index]
    if (!item.id) throw new Error('Message id is required')
    if (item.type === 'template') throw new Error('Template messages are not supported')
    if (item.type === 'text' && !item.text?.trim()) {
      throw new Error('Message text is required')
    }
    await tx.mutate.message.insert({
      id: item.id,
      chatId: args.chatId,
      senderType: 'oa',
      oaId: args.oaId,
      type: item.type,
      text: item.type === 'text' ? item.text.trim() : (item.text ?? null),
      metadata: item.metadata ?? null,
      createdAt: args.createdAt + index,
    })
  }

  const last = args.messages[args.messages.length - 1]
  const lastCreatedAt = args.createdAt + args.messages.length - 1
  await tx.mutate.chat.update({
    id: args.chatId,
    lastMessageId: last.id,
    lastMessageAt: lastCreatedAt,
  })
},
```

- [ ] **Step 4: Regenerate Zero**

Run:

```bash
rtk bun --cwd packages/zero-schema zero:generate
```

- [ ] **Step 5: Verify GREEN**

Run:

```bash
rtk bun --cwd packages/zero-schema test src/__tests__/manager-oa-chat.test.ts
rtk bun --cwd packages/zero-schema typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
rtk git add packages/zero-schema/src/models/message.ts packages/zero-schema/src/generated packages/zero-schema/src/__tests__/manager-oa-chat.test.ts
rtk git commit -m "feat: send rich oa chat messages"
```

---

### Task 5: Frontend Rich Message Core

**Files:**

- Create: `apps/web/src/features/rich-message/core/types.ts`
- Create: `apps/web/src/features/rich-message/core/extensionManager.ts`
- Create: `apps/web/src/features/rich-message/core/editor.ts`
- Create: `apps/web/src/features/rich-message/core/serialization.ts`
- Create: `apps/web/src/features/rich-message/RichMessageStarterKit.ts`
- Create: `apps/web/src/features/rich-message/extensions/basic.tsx`
- Create: `apps/web/src/features/rich-message/extensions/mediaUrl.tsx`
- Create: `apps/web/src/features/rich-message/extensions/flex.tsx`
- Create: `apps/web/src/features/rich-message/extensions/imagemap.tsx`
- Create: `apps/web/src/features/rich-message/extensions/disabled.tsx`
- Test: `apps/web/src/test/unit/features/rich-message/richMessageCore.test.ts`
- Test: `apps/web/src/test/unit/features/rich-message/richMessageSerialization.test.ts`

- [ ] **Step 1: Write failing core tests**

Create `apps/web/src/test/unit/features/rich-message/richMessageCore.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { createRichMessageEditor } from '~/features/rich-message/core/editor'
import { RichMessageStarterKit } from '~/features/rich-message/RichMessageStarterKit'

describe('rich message editor core', () => {
  it('inserts drafts through extension commands without a default maxMessages limit', () => {
    const onChange = vi.fn()
    const editor = createRichMessageEditor({
      value: [],
      onChange,
      extensions: RichMessageStarterKit.configure({ text: true, mediaUrl: true }),
    })

    expect(editor.can().insertMessage('text')).toBe(true)
    expect(editor.commands.insertMessage('text')).toBe(true)
    expect(onChange.mock.calls[0][0][0]).toMatchObject({ type: 'text' })
  })

  it('enforces maxMessages only when provided', () => {
    const editor = createRichMessageEditor({
      value: [{ id: 'msg-1', type: 'text', text: 'one' }],
      onChange: vi.fn(),
      maxMessages: 1,
      extensions: RichMessageStarterKit.configure({ text: true }),
    })

    expect(editor.can().insertMessage('text')).toBe(false)
    expect(editor.commands.insertMessage('text')).toBe(false)
  })

  it('rejects duplicate extension types', () => {
    const ext = RichMessageStarterKit.configure({ text: true })[0]

    expect(() =>
      createRichMessageEditor({
        value: [],
        onChange: vi.fn(),
        extensions: [ext, ext],
      }),
    ).toThrow('Duplicate rich message extension type: text')
  })
})
```

Create `apps/web/src/test/unit/features/rich-message/richMessageSerialization.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  toMessagingApiMessages,
  summarizeMessagingMessages,
} from '~/features/rich-message/core/serialization'
import { RichMessageStarterKit } from '~/features/rich-message/RichMessageStarterKit'

const extensions = RichMessageStarterKit.configure({
  text: true,
  mediaUrl: true,
  flex: true,
})

describe('rich message serialization', () => {
  it('serializes text and image drafts', () => {
    const messages = toMessagingApiMessages(
      [
        { id: '1', type: 'text', text: 'hello' },
        {
          id: '2',
          type: 'image',
          originalContentUrl: 'https://cdn.example.com/a.jpg',
          previewImageUrl: 'https://cdn.example.com/p.jpg',
        },
      ],
      extensions,
    )

    expect(messages).toEqual([
      { type: 'text', text: 'hello' },
      {
        type: 'image',
        originalContentUrl: 'https://cdn.example.com/a.jpg',
        previewImageUrl: 'https://cdn.example.com/p.jpg',
      },
    ])
  })

  it('summarizes multi-message payloads', () => {
    expect(summarizeMessagingMessages([{ type: 'text', text: 'hello' }, { type: 'image' }])).toBe(
      '2 messages: hello',
    )
  })
})
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```bash
rtk bun --cwd apps/web test:unit src/test/unit/features/rich-message/richMessageCore.test.ts src/test/unit/features/rich-message/richMessageSerialization.test.ts
```

Expected: FAIL because modules do not exist.

- [ ] **Step 3: Implement core types**

Create `apps/web/src/features/rich-message/core/types.ts`:

```ts
import type { ComponentType, ReactNode } from 'react'

export type QuickReplyDraft = {
  items: Array<{ type: 'action'; action: Record<string, unknown> }>
}

export type BaseMessageDraft = {
  id: string
  quickReply?: QuickReplyDraft
}

export type TextMessageDraft = BaseMessageDraft & { type: 'text'; text: string }
export type ImageMessageDraft = BaseMessageDraft & {
  type: 'image'
  originalContentUrl: string
  previewImageUrl: string
}
export type VideoMessageDraft = BaseMessageDraft & {
  type: 'video'
  originalContentUrl: string
  previewImageUrl: string
}
export type AudioMessageDraft = BaseMessageDraft & {
  type: 'audio'
  originalContentUrl: string
  duration?: number
}
export type FlexMessageDraft = BaseMessageDraft & {
  type: 'flex'
  altText: string
  contents: unknown
}
export type ImagemapMessageDraft = BaseMessageDraft & {
  type: 'imagemap'
  altText: string
  baseUrl: string
  baseSize: { width: number; height: number }
  actions: unknown[]
}
export type UnknownMessageDraft = BaseMessageDraft & { type: string; raw: unknown }

export type MessageDraft =
  | TextMessageDraft
  | ImageMessageDraft
  | VideoMessageDraft
  | AudioMessageDraft
  | FlexMessageDraft
  | ImagemapMessageDraft
  | UnknownMessageDraft

export type ValidationResult = { ok: true } | { ok: false; message: string }

export type DraftEditorProps<TDraft extends MessageDraft> = {
  draft: TDraft
  update(next: TDraft): void
}

export type DraftPreviewProps<TDraft extends MessageDraft> = {
  draft: TDraft
  selected: boolean
  onSelect(): void
}

export type RichMessageExtension<TDraft extends MessageDraft = MessageDraft> = {
  type: TDraft['type']
  label: string
  icon: ComponentType<{ size?: number; color?: string }>
  group: 'basic' | 'media' | 'interactive' | 'disabled'
  status: 'enabled' | 'disabled'
  priority?: number
  createDraft(): TDraft
  validate(draft: TDraft): ValidationResult
  toMessagingApi(draft: TDraft): unknown
  fromMessagingApi(message: unknown): TDraft | null
  renderEditor(props: DraftEditorProps<TDraft>): ReactNode
  renderPreview(props: DraftPreviewProps<TDraft>): ReactNode
}
```

- [ ] **Step 4: Implement extension manager and editor**

Create `extensionManager.ts`:

```ts
import type { RichMessageExtension } from './types'

export function resolveRichMessageExtensions(
  extensions: RichMessageExtension[],
): RichMessageExtension[] {
  const sorted = [...extensions].sort((a, b) => (b.priority ?? 100) - (a.priority ?? 100))
  const seen = new Set<string>()
  for (const extension of sorted) {
    if (seen.has(extension.type)) {
      throw new Error(`Duplicate rich message extension type: ${extension.type}`)
    }
    seen.add(extension.type)
  }
  return sorted
}
```

Create `editor.ts`:

```ts
import { resolveRichMessageExtensions } from './extensionManager'
import type { MessageDraft, QuickReplyDraft, RichMessageExtension } from './types'

export type RichMessageEditorOptions = {
  value: MessageDraft[]
  onChange(next: MessageDraft[]): void
  extensions: RichMessageExtension[]
  maxMessages?: number
  disabledTypes?: string[]
}

export function createRichMessageEditor(options: RichMessageEditorOptions) {
  const extensions = resolveRichMessageExtensions(options.extensions)
  const byType = new Map(extensions.map((extension) => [extension.type, extension]))
  const disabled = new Set(options.disabledTypes ?? [])
  const canInsert = (type: string) => {
    const extension = byType.get(type)
    if (!extension || extension.status === 'disabled' || disabled.has(type)) return false
    if (options.maxMessages !== undefined && options.value.length >= options.maxMessages) {
      return false
    }
    return true
  }
  const emit = (next: MessageDraft[]) => options.onChange(next)

  const commands = {
    insertMessage(type: string) {
      if (!canInsert(type)) return false
      emit([...options.value, byType.get(type)!.createDraft()])
      return true
    },
    updateMessage(id: string, patch: Partial<MessageDraft>) {
      emit(options.value.map((draft) => (draft.id === id ? ({ ...draft, ...patch } as MessageDraft) : draft)))
      return true
    },
    replaceMessage(id: string, nextDraft: MessageDraft) {
      emit(options.value.map((draft) => (draft.id === id ? nextDraft : draft)))
      return true
    },
    removeMessage(id: string) {
      emit(options.value.filter((draft) => draft.id !== id))
      return true
    },
    duplicateMessage(id: string) {
      const source = options.value.find((draft) => draft.id === id)
      if (!source || (options.maxMessages !== undefined && options.value.length >= options.maxMessages)) return false
      const clone = { ...source, id: crypto.randomUUID() } as MessageDraft
      const index = options.value.findIndex((draft) => draft.id === id)
      emit([...options.value.slice(0, index + 1), clone, ...options.value.slice(index + 1)])
      return true
    },
    moveMessage(id: string, direction: 'up' | 'down') {
      const index = options.value.findIndex((draft) => draft.id === id)
      const target = direction === 'up' ? index - 1 : index + 1
      if (index < 0 || target < 0 || target >= options.value.length) return false
      const next = [...options.value]
      ;[next[index], next[target]] = [next[target], next[index]]
      emit(next)
      return true
    },
    attachQuickReply(id: string, quickReply: QuickReplyDraft) {
      return commands.updateMessage(id, { quickReply } as Partial<MessageDraft>)
    },
    clearQuickReply(id: string) {
      emit(options.value.map((draft) => {
        if (draft.id !== id) return draft
        const { quickReply, ...rest } = draft
        return rest as MessageDraft
      }))
      return true
    },
  }

  return {
    value: options.value,
    extensions,
    commands,
    can: () => ({ insertMessage: canInsert }),
  }
}
```

- [ ] **Step 5: Implement starter kit and initial extensions**

Create `RichMessageStarterKit.ts`:

```ts
import { createTextExtension } from './extensions/basic'
import { createDisabledMessageExtension } from './extensions/disabled'
import { createAudioUrlExtension, createImageUrlExtension, createVideoUrlExtension } from './extensions/mediaUrl'
import { createFlexExtension } from './extensions/flex'
import { createImagemapExtension } from './extensions/imagemap'
import type { RichMessageExtension } from './core/types'

type StarterKitOptions = {
  text?: boolean
  mediaUrl?: boolean
  flex?: boolean
  imagemap?: boolean
  sticker?: false | { status: 'disabled' }
  location?: false | { status: 'disabled' }
}

export const RichMessageStarterKit = {
  configure(options: StarterKitOptions = {}): RichMessageExtension[] {
    const extensions: RichMessageExtension[] = []
    if (options.text !== false) extensions.push(createTextExtension())
    if (options.mediaUrl !== false) {
      extensions.push(createImageUrlExtension(), createVideoUrlExtension(), createAudioUrlExtension())
    }
    if (options.flex !== false) extensions.push(createFlexExtension())
    if (options.imagemap !== false) extensions.push(createImagemapExtension())
    if (options.sticker !== false) extensions.push(createDisabledMessageExtension('sticker', 'Sticker'))
    if (options.location !== false) extensions.push(createDisabledMessageExtension('location', 'Location'))
    return extensions
  },
}
```

Create `extensions/basic.tsx`:

```tsx
import { SizableText } from 'tamagui'
import type { RichMessageExtension, TextMessageDraft } from '../core/types'

function TextIcon() {
  return <SizableText size="$2">T</SizableText>
}

export function createTextExtension(): RichMessageExtension<TextMessageDraft> {
  return {
    type: 'text',
    label: 'Text',
    icon: TextIcon,
    group: 'basic',
    status: 'enabled',
    priority: 1000,
    createDraft: () => ({ id: crypto.randomUUID(), type: 'text', text: '' }),
    validate: (draft) =>
      draft.text.trim() ? { ok: true } : { ok: false, message: 'Text message cannot be empty.' },
    toMessagingApi: (draft) => ({
      type: 'text',
      text: draft.text,
      ...(draft.quickReply ? { quickReply: draft.quickReply } : {}),
    }),
    fromMessagingApi: (message) => {
      const raw = message as Record<string, unknown>
      return raw.type === 'text' && typeof raw.text === 'string'
        ? { id: crypto.randomUUID(), type: 'text', text: raw.text }
        : null
    },
    renderEditor: () => null,
    renderPreview: () => null,
  }
}
```

Create `extensions/disabled.tsx`:

```tsx
import { SizableText } from 'tamagui'
import type { MessageDraft, RichMessageExtension } from '../core/types'

function DisabledIcon() {
  return <SizableText size="$2">-</SizableText>
}

export function createDisabledMessageExtension(
  type: 'sticker' | 'location',
  label: string,
): RichMessageExtension<MessageDraft> {
  return {
    type,
    label,
    icon: DisabledIcon,
    group: 'disabled',
    status: 'disabled',
    priority: 0,
    createDraft: () => ({ id: crypto.randomUUID(), type, raw: null }),
    validate: () => ({ ok: false, message: `${label} messages are not enabled yet.` }),
    toMessagingApi: () => {
      throw new Error(`${label} messages are not enabled yet.`)
    },
    fromMessagingApi: () => null,
    renderEditor: () => null,
    renderPreview: () => null,
  }
}
```

Create `extensions/mediaUrl.tsx`:

```tsx
import { SizableText } from 'tamagui'
import type {
  AudioMessageDraft,
  ImageMessageDraft,
  RichMessageExtension,
  VideoMessageDraft,
} from '../core/types'

function MediaIcon() {
  return <SizableText size="$2">M</SizableText>
}

function isHttpsUrl(value: string) {
  return value.startsWith('https://')
}

export function createImageUrlExtension(): RichMessageExtension<ImageMessageDraft> {
  return {
    type: 'image',
    label: 'Image',
    icon: MediaIcon,
    group: 'media',
    status: 'enabled',
    priority: 900,
    createDraft: () => ({ id: crypto.randomUUID(), type: 'image', originalContentUrl: '', previewImageUrl: '' }),
    validate: (draft) =>
      isHttpsUrl(draft.originalContentUrl) && isHttpsUrl(draft.previewImageUrl)
        ? { ok: true }
        : { ok: false, message: 'Image message requires HTTPS original and preview URLs.' },
    toMessagingApi: (draft) => ({
      type: 'image',
      originalContentUrl: draft.originalContentUrl,
      previewImageUrl: draft.previewImageUrl,
      ...(draft.quickReply ? { quickReply: draft.quickReply } : {}),
    }),
    fromMessagingApi: () => null,
    renderEditor: () => null,
    renderPreview: () => null,
  }
}

export function createVideoUrlExtension(): RichMessageExtension<VideoMessageDraft> {
  return {
    ...createImageUrlExtension(),
    type: 'video',
    label: 'Video',
    createDraft: () => ({ id: crypto.randomUUID(), type: 'video', originalContentUrl: '', previewImageUrl: '' }),
    validate: (draft) =>
      isHttpsUrl(draft.originalContentUrl) && isHttpsUrl(draft.previewImageUrl)
        ? { ok: true }
        : { ok: false, message: 'Video message requires HTTPS original and preview URLs.' },
    toMessagingApi: (draft) => ({
      type: 'video',
      originalContentUrl: draft.originalContentUrl,
      previewImageUrl: draft.previewImageUrl,
      ...(draft.quickReply ? { quickReply: draft.quickReply } : {}),
    }),
  }
}

export function createAudioUrlExtension(): RichMessageExtension<AudioMessageDraft> {
  return {
    type: 'audio',
    label: 'Audio',
    icon: MediaIcon,
    group: 'media',
    status: 'enabled',
    priority: 880,
    createDraft: () => ({ id: crypto.randomUUID(), type: 'audio', originalContentUrl: '' }),
    validate: (draft) =>
      isHttpsUrl(draft.originalContentUrl)
        ? { ok: true }
        : { ok: false, message: 'Audio message requires an HTTPS original URL.' },
    toMessagingApi: (draft) => ({
      type: 'audio',
      originalContentUrl: draft.originalContentUrl,
      ...(draft.duration ? { duration: draft.duration } : {}),
      ...(draft.quickReply ? { quickReply: draft.quickReply } : {}),
    }),
    fromMessagingApi: () => null,
    renderEditor: () => null,
    renderPreview: () => null,
  }
}
```

Create `extensions/flex.tsx`:

```tsx
import { SizableText } from 'tamagui'
import type { FlexMessageDraft, RichMessageExtension } from '../core/types'

function FlexIcon() {
  return <SizableText size="$2">F</SizableText>
}

export function createFlexExtension(): RichMessageExtension<FlexMessageDraft> {
  return {
    type: 'flex',
    label: 'Flex',
    icon: FlexIcon,
    group: 'interactive',
    status: 'enabled',
    priority: 800,
    createDraft: () => ({
      id: crypto.randomUUID(),
      type: 'flex',
      altText: 'Flex Message',
      contents: { type: 'bubble', body: { type: 'box', layout: 'vertical', contents: [] } },
    }),
    validate: (draft) =>
      draft.altText.trim() && draft.contents
        ? { ok: true }
        : { ok: false, message: 'Flex message requires altText and contents.' },
    toMessagingApi: (draft) => ({
      type: 'flex',
      altText: draft.altText,
      contents: draft.contents,
      ...(draft.quickReply ? { quickReply: draft.quickReply } : {}),
    }),
    fromMessagingApi: () => null,
    renderEditor: () => null,
    renderPreview: () => null,
  }
}
```

Create `extensions/imagemap.tsx`:

```tsx
import { SizableText } from 'tamagui'
import type { ImagemapMessageDraft, RichMessageExtension } from '../core/types'

function ImagemapIcon() {
  return <SizableText size="$2">I</SizableText>
}

export function createImagemapExtension(): RichMessageExtension<ImagemapMessageDraft> {
  return {
    type: 'imagemap',
    label: 'Imagemap',
    icon: ImagemapIcon,
    group: 'interactive',
    status: 'enabled',
    priority: 700,
    createDraft: () => ({
      id: crypto.randomUUID(),
      type: 'imagemap',
      altText: '',
      baseUrl: '',
      baseSize: { width: 1040, height: 1040 },
      actions: [],
    }),
    validate: (draft) =>
      draft.altText.trim() && draft.baseUrl.startsWith('https://')
        ? { ok: true }
        : { ok: false, message: 'Imagemap message requires altText and an HTTPS baseUrl.' },
    toMessagingApi: (draft) => ({
      type: 'imagemap',
      altText: draft.altText,
      baseUrl: draft.baseUrl,
      baseSize: draft.baseSize,
      actions: draft.actions,
      ...(draft.quickReply ? { quickReply: draft.quickReply } : {}),
    }),
    fromMessagingApi: () => null,
    renderEditor: () => null,
    renderPreview: () => null,
  }
}
```

- [ ] **Step 6: Implement serialization**

Create `serialization.ts`:

```ts
import type { MessageDraft, RichMessageExtension, ValidationResult } from './types'

function extensionByType(extensions: RichMessageExtension[]) {
  return new Map(extensions.map((extension) => [extension.type, extension]))
}

export function validateMessageDrafts(
  drafts: MessageDraft[],
  extensions: RichMessageExtension[],
): ValidationResult {
  const byType = extensionByType(extensions)
  for (const draft of drafts) {
    const extension = byType.get(draft.type)
    if (!extension || extension.status === 'disabled') {
      return { ok: false, message: `Unsupported message type: ${draft.type}` }
    }
    const result = extension.validate(draft as never)
    if (!result.ok) return result
  }
  return { ok: true }
}

export function toMessagingApiMessages(
  drafts: MessageDraft[],
  extensions: RichMessageExtension[],
): unknown[] {
  const validation = validateMessageDrafts(drafts, extensions)
  if (!validation.ok) throw new Error(validation.message)
  const byType = extensionByType(extensions)
  return drafts.map((draft) => byType.get(draft.type)!.toMessagingApi(draft as never))
}

export function summarizeMessagingMessages(messages: unknown[]): string {
  const first = messages[0] as Record<string, unknown> | undefined
  if (!first) return ''
  const firstSummary =
    first.type === 'text' && typeof first.text === 'string'
      ? first.text.trim().slice(0, 80)
      : first.type === 'flex' && typeof first.altText === 'string'
        ? `Flex: ${first.altText}`
        : first.type === 'imagemap' && typeof first.altText === 'string'
          ? `Imagemap: ${first.altText}`
          : `${String(first.type ?? 'Message')} message`
  return messages.length > 1 ? `${messages.length} messages: ${firstSummary}` : firstSummary
}
```

- [ ] **Step 7: Verify GREEN**

Run:

```bash
rtk bun --cwd apps/web test:unit src/test/unit/features/rich-message/richMessageCore.test.ts src/test/unit/features/rich-message/richMessageSerialization.test.ts
rtk bun --cwd apps/web typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
rtk git add apps/web/src/features/rich-message apps/web/src/test/unit/features/rich-message
rtk git commit -m "feat: add rich message editor core"
```

---

### Task 6: Shared Flex Message JSON Editor

**Files:**

- Create: `apps/web/src/features/rich-message/flex/defaultFlexMessage.ts`
- Create: `apps/web/src/features/rich-message/flex/flexMessageJson.ts`
- Create: `apps/web/src/features/rich-message/flex/FlexMessageJsonEditor.tsx`
- Modify: `apps/web/app/(app)/developers/flex-simulator/index.tsx`
- Modify: `apps/web/app/(app)/developers/flex-simulator/FlexSimulatorPreview.tsx`
- Test: `apps/web/src/test/unit/features/rich-message/flexMessageJson.test.ts`
- Existing integration: `apps/web/src/test/integration/flex-simulator.test.ts`

- [ ] **Step 1: Write failing Flex JSON helper unit test**

Create `apps/web/src/test/unit/features/rich-message/flexMessageJson.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { defaultFlexMessageJson } from '~/features/rich-message/flex/defaultFlexMessage'
import { parseFlexMessageJson } from '~/features/rich-message/flex/flexMessageJson'

describe('flexMessageJson', () => {
  it('parses valid flex json', () => {
    const result = parseFlexMessageJson(defaultFlexMessageJson)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.message.type).toBe('flex')
      expect(result.message.altText).toBe('Sample Flex Message')
    }
  })

  it('returns a readable error for invalid json', () => {
    const result = parseFlexMessageJson('{')

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message.length).toBeGreaterThan(0)
    }
  })
})
```

- [ ] **Step 2: Run test to verify RED**

Run:

```bash
rtk bun --cwd apps/web test:unit src/test/unit/features/rich-message/flexMessageJson.test.ts
```

Expected: FAIL because the helper module does not exist.

- [ ] **Step 3: Extract default JSON**

Create `defaultFlexMessage.ts`:

```ts
export const defaultFlexMessage = {
  type: 'flex',
  altText: 'Sample Flex Message',
  contents: {
    type: 'bubble',
    size: 'mega',
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        { type: 'text', text: 'Hello World', size: 'lg', weight: 'bold', align: 'center' },
        { type: 'text', text: 'This is a sample Flex Message.', size: 'md', color: '#666666' },
      ],
    },
  },
} as const

export const defaultFlexMessageJson = JSON.stringify(defaultFlexMessage, null, 2)
```

- [ ] **Step 4: Add Flex JSON parse helper**

Create `flexMessageJson.ts`:

```ts
export type ParsedFlexMessage = {
  type: 'flex'
  altText: string
  contents: unknown
}

export type ParseFlexMessageJsonResult =
  | { ok: true; message: ParsedFlexMessage }
  | { ok: false; message: string }

export function parseFlexMessageJson(value: string): ParseFlexMessageJsonResult {
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>
    if (parsed.type !== 'flex') {
      return { ok: false, message: 'Flex message JSON must have type "flex".' }
    }
    if (typeof parsed.altText !== 'string' || !parsed.altText.trim()) {
      return { ok: false, message: 'Flex message JSON must include altText.' }
    }
    if (!parsed.contents) {
      return { ok: false, message: 'Flex message JSON must include contents.' }
    }
    return {
      ok: true,
      message: {
        type: 'flex',
        altText: parsed.altText,
        contents: parsed.contents,
      },
    }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Invalid JSON' }
  }
}
```

- [ ] **Step 5: Extract shared Flex preview and editor component**

Move `apps/web/app/(app)/developers/flex-simulator/FlexSimulatorPreview.tsx`
to `apps/web/src/features/rich-message/flex/FlexMessagePreview.tsx` and export
the same component body under the same `FlexSimulatorPreview` name. Then leave
`apps/web/app/(app)/developers/flex-simulator/FlexSimulatorPreview.tsx` as:

```ts
export { FlexSimulatorPreview } from '~/features/rich-message/flex/FlexMessagePreview'
```

Create `FlexMessageJsonEditor.tsx` by moving JSON input + preview layout from
`apps/web/app/(app)/developers/flex-simulator/index.tsx`:

```tsx
import { memo, useMemo } from 'react'
import { ScrollView, Text, XStack, YStack } from 'tamagui'
import { TextArea } from '~/interface/forms/TextArea'
import { FlexSimulatorPreview } from './FlexMessagePreview'
import { parseFlexMessageJson } from './flexMessageJson'

type FlexMessageJsonEditorProps = {
  value: string
  onChange(value: string): void
}

export const FlexMessageJsonEditor = memo(({ value, onChange }: FlexMessageJsonEditorProps) => {
  const parseResult = useMemo(() => parseFlexMessageJson(value), [value])
  const errorMsg = parseResult.ok ? '' : parseResult.message

  return (
    <XStack flex={1} gap="$4" style={{ minHeight: 0 }}>
      <YStack flex={1} gap="$2">
        <Text fontSize="$3" fontWeight="600" color="$color11">
          JSON Input
        </Text>
        {errorMsg ? (
          <Text fontSize="$2" color="$red10">
            {errorMsg}
          </Text>
        ) : null}
        <TextArea flex={1} value={value} onChangeText={onChange} p="$3" hasError={Boolean(errorMsg)} />
      </YStack>
      <YStack flex={1} gap="$2" style={{ minHeight: 0 }}>
        <Text fontSize="$3" fontWeight="600" color="$color11">
          Preview
        </Text>
        <YStack flex={1} data-testid="flex-simulator-preview-frame" style={{ minHeight: 800, overflow: 'hidden', borderRadius: 8 }}>
          <ScrollView>
            <FlexSimulatorPreview json={value} />
          </ScrollView>
        </YStack>
      </YStack>
    </XStack>
  )
})
```

- [ ] **Step 6: Update simulator page**

In `apps/web/app/(app)/developers/flex-simulator/index.tsx`, replace the
inline JSON/preview layout with:

```tsx
<FlexMessageJsonEditor value={json} onChange={handleJsonChange} />
```

Keep `FlexSimulatorSendDialog` and reset/send header behavior unchanged.

- [ ] **Step 7: Verify GREEN and simulator integration**

Run:

```bash
rtk bun --cwd apps/web test:unit src/test/unit/features/rich-message/flexMessageJson.test.ts
rtk bun scripts/integration.ts --web-only integration/flex-simulator.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
rtk git add apps/web/src/features/rich-message/flex apps/web/app/'(app)'/developers/flex-simulator/index.tsx apps/web/app/'(app)'/developers/flex-simulator/FlexSimulatorPreview.tsx apps/web/src/test/unit/features/rich-message/flexMessageJson.test.ts
rtk git commit -m "feat: share flex message json editor"
```

---

### Task 7: Rich Message Composer UI

**Files:**

- Create: `apps/web/src/features/rich-message/RichMessageEditor.tsx`
- Create: `apps/web/src/features/rich-message/RichMessagePreview.tsx`
- Create: `apps/web/src/features/rich-message/RichMessageToolbar.tsx`
- Test: `apps/web/src/test/unit/features/rich-message/richMessageToolbar.test.ts`

- [ ] **Step 1: Write failing toolbar model unit test**

Create `apps/web/src/test/unit/features/rich-message/richMessageToolbar.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { getRichMessageToolbarItems } from '~/features/rich-message/RichMessageToolbar'
import { RichMessageStarterKit } from '~/features/rich-message/RichMessageStarterKit'

describe('getRichMessageToolbarItems', () => {
  it('projects enabled extension buttons and count label without default limit', () => {
    const items = getRichMessageToolbarItems({
      extensions: RichMessageStarterKit.configure(),
      canInsert: (type) => type !== 'sticker' && type !== 'location',
      count: 2,
      maxMessages: undefined,
    })

    expect(items.countLabel).toBe('2 messages')
    expect(items.buttons.find((button) => button.type === 'text')).toMatchObject({
      ariaLabel: 'Add text message',
      disabled: false,
    })
    expect(items.buttons.find((button) => button.type === 'sticker')).toMatchObject({
      ariaLabel: 'Add sticker message',
      disabled: true,
    })
  })

  it('uses bounded count labels only when maxMessages is provided', () => {
    const items = getRichMessageToolbarItems({
      extensions: RichMessageStarterKit.configure({ text: true, mediaUrl: false, flex: false, imagemap: false }),
      canInsert: () => false,
      count: 1,
      maxMessages: 1,
    })

    expect(items.countLabel).toBe('1 / 1')
    expect(items.buttons[0]).toMatchObject({ type: 'text', disabled: true })
  })
})
```

- [ ] **Step 2: Run test to verify RED**

Run:

```bash
rtk bun --cwd apps/web test:unit src/test/unit/features/rich-message/richMessageToolbar.test.ts
```

Expected: FAIL because the toolbar module does not exist.

- [ ] **Step 3: Implement preview wrapper**

Create `RichMessagePreview.tsx`:

```tsx
import { memo } from 'react'
import { SizableText, YStack } from 'tamagui'
import { MessageBubbleFactory } from '~/interface/message/MessageBubbleFactory'
import type { MessageDraft } from './core/types'

function draftToBubble(draft: MessageDraft) {
  if (draft.type === 'text') return { type: 'text', text: draft.text, metadata: undefined }
  if (draft.type === 'flex') return { type: 'flex', text: '', metadata: JSON.stringify({ type: 'flex', altText: draft.altText, contents: draft.contents }) }
  if (draft.type === 'image' || draft.type === 'video') return { type: draft.type, text: '', metadata: JSON.stringify({ originalContentUrl: draft.originalContentUrl, previewImageUrl: draft.previewImageUrl }) }
  if (draft.type === 'audio') return { type: 'audio', text: '', metadata: JSON.stringify({ originalContentUrl: draft.originalContentUrl, duration: draft.duration }) }
  if (draft.type === 'imagemap') return { type: 'imagemap', text: '', metadata: JSON.stringify(draft) }
  return { type: draft.type, text: '', metadata: undefined }
}

type RichMessagePreviewProps = {
  drafts: MessageDraft[]
  onSelectDraft(id: string): void
}

export const RichMessagePreview = memo(({ drafts, onSelectDraft }: RichMessagePreviewProps) => (
  <YStack flex={1} bg="$color1" p="$3" gap="$2" minH={240}>
    <SizableText size="$2" color="$color10" fontWeight="700">
      Live preview
    </SizableText>
    {drafts.length === 0 ? (
      <YStack flex={1} items="center" justify="center">
        <SizableText size="$2" color="$color10">
          Add a message from the toolbar
        </SizableText>
      </YStack>
    ) : (
      drafts.map((draft) => {
        const bubble = draftToBubble(draft)
        return (
          <YStack key={draft.id} onPress={() => onSelectDraft(draft.id)} cursor="pointer">
            <MessageBubbleFactory
              type={bubble.type}
              text={bubble.text}
              metadata={bubble.metadata}
              isMine={false}
              chatId="preview"
              otherMemberOaId={null}
              sendMessage={() => undefined}
            />
          </YStack>
        )
      })
    )}
  </YStack>
))
```

- [ ] **Step 4: Implement toolbar and editor shell**

Create `RichMessageToolbar.tsx`:

```tsx
import { XStack, SizableText } from 'tamagui'
import { Button } from '~/interface/buttons/Button'
import type { RichMessageExtension } from './core/types'

type Props = {
  extensions: RichMessageExtension[]
  canInsert(type: string): boolean
  insert(type: string): void
  count: number
  maxMessages?: number
}

export function getRichMessageToolbarItems({
  extensions,
  canInsert,
  count,
  maxMessages,
}: {
  extensions: RichMessageExtension[]
  canInsert(type: string): boolean
  count: number
  maxMessages?: number
}) {
  return {
    buttons: extensions.map((extension) => ({
      type: extension.type,
      label: extension.label,
      ariaLabel: `Add ${extension.type} message`,
      disabled: !canInsert(extension.type),
    })),
    countLabel: maxMessages === undefined ? `${count} messages` : `${count} / ${maxMessages}`,
  }
}

export function RichMessageToolbar({ extensions, canInsert, insert, count, maxMessages }: Props) {
  const items = getRichMessageToolbarItems({ extensions, canInsert, count, maxMessages })

  return (
    <XStack p="$2" gap="$2" items="center" borderTopWidth={1} borderColor="$borderColor">
      {items.buttons.map((button) => (
        <Button
          key={button.type}
          size="$2"
          variant="transparent"
          aria-label={button.ariaLabel}
          disabled={button.disabled}
          onPress={() => insert(button.type)}
        >
          {button.label}
        </Button>
      ))}
      <SizableText size="$1" color="$color10" ml="auto">
        {items.countLabel}
      </SizableText>
    </XStack>
  )
}
```

Create `RichMessageEditor.tsx`:

```tsx
import { useMemo, useState } from 'react'
import { YStack } from 'tamagui'
import { createRichMessageEditor } from './core/editor'
import type { MessageDraft, RichMessageExtension } from './core/types'
import { RichMessageStarterKit } from './RichMessageStarterKit'
import { RichMessagePreview } from './RichMessagePreview'
import { RichMessageToolbar } from './RichMessageToolbar'

type Props = {
  value: MessageDraft[]
  onChange(next: MessageDraft[]): void
  extensions?: RichMessageExtension[]
  maxMessages?: number
  disabledTypes?: string[]
}

export function RichMessageEditor(props: Props) {
  const extensions = useMemo(
    () => props.extensions ?? RichMessageStarterKit.configure(),
    [props.extensions],
  )
  const [, setSelectedDraftId] = useState<string | null>(null)
  const editor = createRichMessageEditor({
    value: props.value,
    onChange: props.onChange,
    extensions,
    maxMessages: props.maxMessages,
    disabledTypes: props.disabledTypes,
  })

  return (
    <YStack borderWidth={1} borderColor="$borderColor" rounded="$3" overflow="hidden">
      <RichMessagePreview drafts={props.value} onSelectDraft={setSelectedDraftId} />
      <RichMessageToolbar
        extensions={editor.extensions}
        canInsert={editor.can().insertMessage}
        insert={editor.commands.insertMessage}
        count={props.value.length}
        maxMessages={props.maxMessages}
      />
    </YStack>
  )
}
```

Dialogs are connected in Task 8. The shell must compile and the toolbar state
projection must be tested first.

- [ ] **Step 5: Verify GREEN**

Run:

```bash
rtk bun --cwd apps/web test:unit src/test/unit/features/rich-message/richMessageToolbar.test.ts
rtk bun --cwd apps/web typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
rtk git add apps/web/src/features/rich-message apps/web/src/test/unit/features/rich-message/richMessageToolbar.test.ts
rtk git commit -m "feat: add rich message composer ui"
```

---

### Task 8: Message Type Dialogs

**Files:**

- Create: `apps/web/src/features/rich-message/dialogs/MediaUrlDialog.tsx`
- Create: `apps/web/src/features/rich-message/dialogs/FlexMessageDialog.tsx`
- Create: `apps/web/src/features/rich-message/dialogs/ImagemapDialog.tsx`
- Create: `apps/web/src/features/rich-message/dialogs/draftFactories.ts`
- Modify: `apps/web/src/features/rich-message/RichMessageEditor.tsx`
- Modify: `apps/web/src/features/rich-message/RichMessageToolbar.tsx`
- Test: `apps/web/src/test/unit/features/rich-message/richMessageDialogDrafts.test.ts`

- [ ] **Step 1: Write failing dialog draft factory tests**

Create `apps/web/src/test/unit/features/rich-message/richMessageDialogDrafts.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  buildFlexDraftFromJson,
  buildImagemapDraft,
  buildMediaUrlDraft,
} from '~/features/rich-message/dialogs/draftFactories'

describe('rich message dialog draft factories', () => {
  it('builds image drafts from URL form values', () => {
    const result = buildMediaUrlDraft({
      id: 'img-1',
      type: 'image',
      originalContentUrl: 'https://cdn.example.com/image.jpg',
      previewImageUrl: 'https://cdn.example.com/preview.jpg',
    })

    expect(result).toMatchObject({
      id: 'img-1',
      type: 'image',
      originalContentUrl: 'https://cdn.example.com/image.jpg',
      previewImageUrl: 'https://cdn.example.com/preview.jpg',
    })
  })

  it('builds flex drafts from valid Flex JSON', () => {
    const result = buildFlexDraftFromJson({
      id: 'flex-1',
      json: JSON.stringify({
        type: 'flex',
        altText: 'Promo',
        contents: { type: 'bubble' },
      }),
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.draft).toMatchObject({
        id: 'flex-1',
        type: 'flex',
        altText: 'Promo',
        contents: { type: 'bubble' },
      })
    }
  })

  it('builds imagemap drafts from structured fields', () => {
    const result = buildImagemapDraft({
      id: 'map-1',
      altText: 'Promo image',
      baseUrl: 'https://cdn.example.com/imagemap',
      height: 1040,
    })

    expect(result).toMatchObject({
      id: 'map-1',
      type: 'imagemap',
      altText: 'Promo image',
      baseSize: { width: 1040, height: 1040 },
      actions: [],
    })
  })
})
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```bash
rtk bun --cwd apps/web test:unit src/test/unit/features/rich-message/richMessageDialogDrafts.test.ts
```

Expected: FAIL because the draft factory module does not exist.

- [ ] **Step 3: Implement draft factories**

Create `draftFactories.ts`:

```ts
import { parseFlexMessageJson } from '../flex/flexMessageJson'
import type {
  AudioMessageDraft,
  FlexMessageDraft,
  ImageMessageDraft,
  ImagemapMessageDraft,
  VideoMessageDraft,
} from '../core/types'

type MediaInput =
  | { id: string; type: 'image'; originalContentUrl: string; previewImageUrl: string }
  | { id: string; type: 'video'; originalContentUrl: string; previewImageUrl: string }
  | { id: string; type: 'audio'; originalContentUrl: string; duration?: number }

export function buildMediaUrlDraft(input: MediaInput): ImageMessageDraft | VideoMessageDraft | AudioMessageDraft {
  if (input.type === 'audio') {
    return {
      id: input.id,
      type: 'audio',
      originalContentUrl: input.originalContentUrl,
      duration: input.duration,
    }
  }
  return {
    id: input.id,
    type: input.type,
    originalContentUrl: input.originalContentUrl,
    previewImageUrl: input.previewImageUrl,
  }
}

export function buildFlexDraftFromJson({
  id,
  json,
}: {
  id: string
  json: string
}): { ok: true; draft: FlexMessageDraft } | { ok: false; message: string } {
  const result = parseFlexMessageJson(json)
  if (!result.ok) return result
  return {
    ok: true,
    draft: {
      id,
      type: 'flex',
      altText: result.message.altText,
      contents: result.message.contents,
    },
  }
}

export function buildImagemapDraft({
  id,
  altText,
  baseUrl,
  height,
}: {
  id: string
  altText: string
  baseUrl: string
  height: number
}): ImagemapMessageDraft {
  return {
    id,
    type: 'imagemap',
    altText: altText.trim(),
    baseUrl,
    baseSize: { width: 1040, height },
    actions: [],
  }
}
```

- [ ] **Step 4: Implement media URL dialog**

Create `MediaUrlDialog.tsx`:

```tsx
import { useState } from 'react'
import { SizableText, XStack, YStack } from 'tamagui'
import { Button } from '~/interface/buttons/Button'
import { Input } from '~/interface/forms/Input'
import type { AudioMessageDraft, ImageMessageDraft, VideoMessageDraft } from '../core/types'
import { buildMediaUrlDraft } from './draftFactories'

type MediaType = 'image' | 'video' | 'audio'
type MediaDraft = ImageMessageDraft | VideoMessageDraft | AudioMessageDraft

type Props = {
  type: MediaType
  onCancel(): void
  onSave(draft: MediaDraft): void
}

export function MediaUrlDialog({ type, onCancel, onSave }: Props) {
  const [originalContentUrl, setOriginalContentUrl] = useState('')
  const [previewImageUrl, setPreviewImageUrl] = useState('')
  const [duration, setDuration] = useState('')
  const isAudio = type === 'audio'
  const canSave =
    originalContentUrl.startsWith('https://') &&
    (isAudio || previewImageUrl.startsWith('https://'))

  return (
    <YStack p="$4" gap="$3" borderWidth={1} borderColor="$borderColor" rounded="$3">
      <SizableText size="$5" fontWeight="700">
        {type} message
      </SizableText>
      <Input
        value={originalContentUrl}
        onChangeText={setOriginalContentUrl}
        placeholder={`https://example.com/${isAudio ? 'audio.m4a' : `${type}.jpg`}`}
      />
      {!isAudio ? (
        <Input
          value={previewImageUrl}
          onChangeText={setPreviewImageUrl}
          placeholder="https://example.com/preview.jpg"
        />
      ) : (
        <Input value={duration} onChangeText={setDuration} placeholder="Duration in milliseconds" />
      )}
      <XStack justify="flex-end" gap="$2">
        <Button size="$2" variant="outlined" onPress={onCancel}>Cancel</Button>
        <Button
          size="$2"
          disabled={!canSave}
          onPress={() => {
            const base = { id: crypto.randomUUID(), type, originalContentUrl }
            onSave(
              isAudio
                ? (buildMediaUrlDraft({ ...base, type: 'audio', duration: duration ? Number(duration) : undefined }) as AudioMessageDraft)
                : type === 'image'
                  ? (buildMediaUrlDraft({ ...base, type: 'image', previewImageUrl }) as ImageMessageDraft)
                  : (buildMediaUrlDraft({ ...base, type: 'video', previewImageUrl }) as VideoMessageDraft),
            )
          }}
        >
          Save {type} message
        </Button>
      </XStack>
    </YStack>
  )
}
```

- [ ] **Step 5: Implement Flex dialog**

Create `FlexMessageDialog.tsx`:

```tsx
import { useState } from 'react'
import { XStack, YStack, SizableText } from 'tamagui'
import { Button } from '~/interface/buttons/Button'
import { defaultFlexMessageJson } from '../flex/defaultFlexMessage'
import { FlexMessageJsonEditor } from '../flex/FlexMessageJsonEditor'
import type { FlexMessageDraft } from '../core/types'
import { buildFlexDraftFromJson } from './draftFactories'

type Props = {
  onCancel(): void
  onSave(draft: FlexMessageDraft): void
}

export function FlexMessageDialog({ onCancel, onSave }: Props) {
  const [json, setJson] = useState(defaultFlexMessageJson)
  let canSave = true
  try {
    JSON.parse(json)
  } catch {
    canSave = false
  }

  return (
    <YStack p="$4" gap="$3" borderWidth={1} borderColor="$borderColor" rounded="$3">
      <SizableText size="$5" fontWeight="700">Flex message</SizableText>
      <YStack height={520}>
        <FlexMessageJsonEditor value={json} onChange={setJson} />
      </YStack>
      <XStack justify="flex-end" gap="$2">
        <Button size="$2" variant="outlined" onPress={onCancel}>Cancel</Button>
        <Button
          size="$2"
          disabled={!canSave}
          onPress={() => {
            const result = buildFlexDraftFromJson({ id: crypto.randomUUID(), json })
            if (result.ok) onSave(result.draft)
          }}
        >
          Save flex message
        </Button>
      </XStack>
    </YStack>
  )
}
```

- [ ] **Step 6: Implement imagemap dialog**

Create `ImagemapDialog.tsx`:

```tsx
import { useState } from 'react'
import { XStack, YStack, SizableText } from 'tamagui'
import { Button } from '~/interface/buttons/Button'
import { Input } from '~/interface/forms/Input'
import type { ImagemapMessageDraft } from '../core/types'
import { buildImagemapDraft } from './draftFactories'

type Props = {
  onCancel(): void
  onSave(draft: ImagemapMessageDraft): void
}

export function ImagemapDialog({ onCancel, onSave }: Props) {
  const [altText, setAltText] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [height, setHeight] = useState('1040')
  const canSave = altText.trim().length > 0 && baseUrl.startsWith('https://') && Number(height) > 0

  return (
    <YStack p="$4" gap="$3" borderWidth={1} borderColor="$borderColor" rounded="$3">
      <SizableText size="$5" fontWeight="700">Imagemap message</SizableText>
      <Input value={altText} onChangeText={setAltText} placeholder="Alt text" />
      <Input value={baseUrl} onChangeText={setBaseUrl} placeholder="https://cdn.example.com/imagemap" />
      <Input value={height} onChangeText={setHeight} placeholder="Base height" />
      <XStack justify="flex-end" gap="$2">
        <Button size="$2" variant="outlined" onPress={onCancel}>Cancel</Button>
        <Button
          size="$2"
          disabled={!canSave}
          onPress={() =>
            onSave(
              buildImagemapDraft({
                id: crypto.randomUUID(),
                altText,
                baseUrl,
                height: Number(height),
              }),
            )
          }
        >
          Save imagemap message
        </Button>
      </XStack>
    </YStack>
  )
}
```

- [ ] **Step 7: Wire dialogs into editor**

In `RichMessageEditor.tsx`, add:

```tsx
const [dialogType, setDialogType] = useState<string | null>(null)
const appendDraft = (draft: MessageDraft) => props.onChange([...props.value, draft])
```

Change toolbar insert behavior:

```tsx
const insertFromToolbar = (type: string) => {
  if (type === 'image' || type === 'video' || type === 'audio' || type === 'flex' || type === 'imagemap') {
    setDialogType(type)
    return
  }
  editor.commands.insertMessage(type)
}
```

Render below the toolbar:

```tsx
{dialogType === 'image' || dialogType === 'video' || dialogType === 'audio' ? (
  <MediaUrlDialog
    type={dialogType}
    onCancel={() => setDialogType(null)}
    onSave={(draft) => {
      appendDraft(draft)
      setDialogType(null)
    }}
  />
) : null}
{dialogType === 'flex' ? (
  <FlexMessageDialog
    onCancel={() => setDialogType(null)}
    onSave={(draft) => {
      appendDraft(draft)
      setDialogType(null)
    }}
  />
) : null}
{dialogType === 'imagemap' ? (
  <ImagemapDialog
    onCancel={() => setDialogType(null)}
    onSave={(draft) => {
      appendDraft(draft)
      setDialogType(null)
    }}
  />
) : null}
```

- [ ] **Step 8: Verify GREEN**

Run:

```bash
rtk bun --cwd apps/web test:unit src/test/unit/features/rich-message/richMessageDialogDrafts.test.ts
rtk bun --cwd apps/web typecheck
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
rtk git add apps/web/src/features/rich-message apps/web/src/test/unit/features/rich-message/richMessageDialogDrafts.test.ts
rtk git commit -m "feat: add rich message type dialogs"
```

---

### Task 9: OA Manager Chat Integration

**Files:**

- Modify: `apps/web/src/features/oa-manager/chat/useManagerOAMessages.ts`
- Modify: `apps/web/src/features/oa-manager/chat/ManagerOAChatRoom.tsx`
- Test: `apps/web/src/test/integration/manager-oa-chat.test.ts`

- [ ] **Step 1: Write failing integration assertion**

In `apps/web/src/test/integration/manager-oa-chat.test.ts`, after the existing
text reply send assertion, add a rich editor path:

```ts
await page.getByRole('button', { name: 'Open rich message editor' }).click()
await page.getByLabel('Add text message').click()
await page.getByPlaceholder('Message text').fill('Rich hello from manager')
await page.getByRole('button', { name: 'Send rich message' }).click()
await expect(page.getByText('Rich hello from manager').last()).toBeVisible({
  timeout: 10000,
})
```

- [ ] **Step 2: Run targeted integration to verify RED**

Run:

```bash
rtk bun scripts/integration.ts --web-only integration/manager-oa-chat.test.ts
```

Expected: FAIL because the rich editor button does not exist.

- [ ] **Step 3: Add hook send function**

In `apps/web/src/features/oa-manager/chat/useManagerOAMessages.ts`, import:

```ts
import {
  toMessagingApiMessages,
} from '~/features/rich-message/core/serialization'
import { RichMessageStarterKit } from '~/features/rich-message/RichMessageStarterKit'
import type { MessageDraft } from '~/features/rich-message/core/types'
```

Add:

```ts
const sendRichMessages = useCallback(
  async (drafts: MessageDraft[]) => {
    if (!oaId || !chatId || drafts.length === 0) return
    const extensions = RichMessageStarterKit.configure()
    const apiMessages = toMessagingApiMessages(drafts, extensions)
    await zero.mutate.message.sendRichAsOA({
      chatId,
      oaId,
      createdAt: Date.now(),
      messages: apiMessages.map((message) => {
        const raw = message as Record<string, unknown>
        const { type, text, ...metadata } = raw
        return {
          id: crypto.randomUUID(),
          type: type as any,
          text: typeof text === 'string' ? text : null,
          metadata: Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : null,
        }
      }),
    })
  },
  [chatId, oaId],
)
```

Return `sendRichMessages`.

- [ ] **Step 4: Add editor to chat room**

In `ManagerOAChatRoom.tsx`, keep the existing text input for fast replies and
add a collapsible rich editor:

```tsx
const [richOpen, setRichOpen] = useState(false)
const [richDrafts, setRichDrafts] = useState<MessageDraft[]>([])
```

Render above the text input:

```tsx
{richOpen ? (
  <YStack p="$3" borderTopWidth={1} borderColor="$borderColor" gap="$2">
    <RichMessageEditor value={richDrafts} onChange={setRichDrafts} />
    <XStack justify="flex-end" gap="$2">
      <Button size="$2" variant="outlined" onPress={() => setRichOpen(false)}>
        Cancel
      </Button>
      <Button
        size="$2"
        onPress={async () => {
          await sendRichMessages(richDrafts)
          setRichDrafts([])
          setRichOpen(false)
        }}
        disabled={richDrafts.length === 0 || isSending}
      >
        Send rich message
      </Button>
    </XStack>
  </YStack>
) : (
  <XStack px="$3" pt="$3">
    <Button size="$2" variant="outlined" onPress={() => setRichOpen(true)}>
      Open rich message editor
    </Button>
  </XStack>
)}
```

Use imports from `~/features/rich-message/...`. Do not remove the text quick
reply input.

- [ ] **Step 5: Verify**

Run:

```bash
rtk bun --cwd apps/web typecheck
rtk bun scripts/integration.ts --web-only integration/manager-oa-chat.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
rtk git add apps/web/src/features/oa-manager/chat/useManagerOAMessages.ts apps/web/src/features/oa-manager/chat/ManagerOAChatRoom.tsx apps/web/src/test/integration/manager-oa-chat.test.ts
rtk git commit -m "feat: add rich editor to oa chat"
```

---

### Task 10: OA Manager Campaign Integration

**Files:**

- Modify: `apps/web/src/features/oa-manager/campaign/useManagerOACampaigns.ts`
- Modify: `apps/web/src/features/oa-manager/campaign/ManagerOACampaignsPage.tsx`
- Test: `apps/web/src/test/integration/manager-oa-campaigns.test.ts`

- [ ] **Step 1: Write failing integration update**

In `apps/web/src/test/integration/manager-oa-campaigns.test.ts`, replace the
text-area fill with rich editor operations:

```ts
await page.getByLabel('Add text message').click()
await page.getByPlaceholder('Message text').fill(`Hello from ${campaignName}`)
```

Keep the rest of the send flow. After the campaign appears, assert summary:

```ts
await expect(page.getByText(`Hello from ${campaignName}`)).toBeVisible({
  timeout: 15000,
})
```

- [ ] **Step 2: Run targeted integration to verify RED**

Run:

```bash
rtk bun scripts/integration.ts --web-only integration/manager-oa-campaigns.test.ts
```

Expected: FAIL because campaign form still has text area and no rich editor.

- [ ] **Step 3: Update campaign hook**

In `useManagerOACampaigns.ts`, extend `CampaignItem`:

```ts
messageText: string | null | undefined
messagePayloadJson: Array<Record<string, any>>
messageSummary: string
```

Add input:

```ts
export type SendRichCampaignInput = {
  name: string
  messagePayload: unknown[]
  audienceFilterId?: string | undefined
  inlineAudienceQueryJson?: AudienceQueryJson | undefined
}
```

Add mutation:

```ts
const sendRichCampaign = useTanMutation({
  mutationFn: async (input: SendRichCampaignInput) => {
    if (!oaId) throw new Error('Missing official account id')
    const campaignId = crypto.randomUUID()
    return oaClient.sendRichCampaign({
      officialAccountId: oaId,
      campaignId,
      name: input.name,
      messagePayloadJson: JSON.stringify(input.messagePayload),
      audienceFilterId: input.audienceFilterId,
      inlineAudienceQueryJson: input.inlineAudienceQueryJson
        ? JSON.stringify(input.inlineAudienceQueryJson)
        : undefined,
    })
  },
})
```

Return `{ campaigns, sendTextCampaign, sendRichCampaign }` during compatibility.

- [ ] **Step 4: Replace campaign text area**

In `ManagerOACampaignsPage.tsx`:

Change schema to remove `messageText`:

```ts
const campaignSchema = v.object({
  name: v.pipe(v.string(), v.nonEmpty('Campaign name is required'), v.maxLength(100, 'Campaign name must be 100 characters or less')),
  audienceFilterId: v.string(),
})
```

Add state:

```ts
const [messageDrafts, setMessageDrafts] = useState<MessageDraft[]>([])
```

Render:

```tsx
<YStack gap="$2">
  <SizableText size="$2" fontWeight="600">
    Message
  </SizableText>
  <RichMessageEditor value={messageDrafts} onChange={setMessageDrafts} />
</YStack>
```

In `sendCampaign`, serialize:

```ts
const extensions = RichMessageStarterKit.configure()
const messagePayload = toMessagingApiMessages(messageDrafts, extensions)
if (messagePayload.length === 0) {
  showToast('Add at least one message', { type: 'error' })
  return
}
await sendRichCampaign.mutateAsync({
  name: data.name,
  messagePayload,
  audienceFilterId: data.audienceFilterId === defaultAudienceValue ? undefined : data.audienceFilterId,
})
```

Reset `messageDrafts` to `[]` after success.

Show summary in history:

```tsx
<SizableText size="$2" color="$color10" numberOfLines={2}>
  {campaign.messageSummary || campaign.messageText || 'Rich message campaign'}
</SizableText>
```

- [ ] **Step 5: Verify**

Run:

```bash
rtk bun --cwd apps/web typecheck
rtk bun scripts/integration.ts --web-only integration/manager-oa-campaigns.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
rtk git add apps/web/src/features/oa-manager/campaign/useManagerOACampaigns.ts apps/web/src/features/oa-manager/campaign/ManagerOACampaignsPage.tsx apps/web/src/test/integration/manager-oa-campaigns.test.ts
rtk git commit -m "feat: add rich editor to oa campaigns"
```

---

### Task 11: Full Verification And Cleanup

**Files:**

- No new files unless a verification failure requires a focused fix.

- [ ] **Step 1: Run focused unit suites**

Run:

```bash
rtk bun --cwd apps/web test:unit src/test/unit/features/rich-message
rtk bun --cwd apps/server test:unit src/services/oa-message-payload.test.ts src/services/oa-campaign.test.ts src/connect/oa-campaign.test.ts
rtk bun --cwd packages/zero-schema test src/__tests__/manager-oa-chat.test.ts src/__tests__/manager-oa-campaigns.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run typechecks**

Run:

```bash
rtk bun --cwd apps/web typecheck
rtk bun --cwd apps/server typecheck
rtk bun --cwd packages/zero-schema typecheck
```

Expected: PASS.

- [ ] **Step 3: Run integration preflight**

Run:

```bash
rtk docker compose version
rtk docker compose config --quiet
rtk docker compose ps
rtk ss -ltnp
```

Expected: Docker Compose is available and Vine ports are not blocked by non-Compose processes.

- [ ] **Step 4: Run targeted integration**

Run:

```bash
rtk bun scripts/integration.ts --web-only integration/flex-simulator.test.ts
rtk bun scripts/integration.ts --web-only integration/manager-oa-chat.test.ts
rtk bun scripts/integration.ts --web-only integration/manager-oa-campaigns.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run full check if targeted suites pass**

Run:

```bash
rtk bun run check:all
```

Expected: PASS.

- [ ] **Step 6: Commit final cleanup if needed**

Only if verification fixes changed files:

```bash
rtk git add apps/web apps/server packages/zero-schema packages/db packages/proto
rtk git commit -m "fix: stabilize oa rich message editor"
```

---

## Plan Self-Review Notes

Spec coverage:

- Shared controlled `MessageDraft[]` editor: Tasks 5, 7.
- Tiptap-like extension/starter-kit/commands architecture: Task 5.
- Slim composer with bottom toolbar and preview: Task 7.
- Preview uses talks bubble rendering style: Task 7.
- Flex Simulator extraction: Task 6.
- Message type dialogs: Task 8.
- Quick reply payload attachment support: Tasks 2, 5.
- Chat integration: Tasks 4, 9.
- Campaign integration and `messageText` deprecation: Tasks 1, 3, 10.
- No default `maxMessages` hard limit: Tasks 5, 7, 9, 10.
- Disabled sticker/location and no template messages: Tasks 2, 5, 7.

Residual risk:

- The plan intentionally keeps existing `SendTextCampaign` for compatibility.
- The first imagemap UI is structured form-first, not a visual area editor.
