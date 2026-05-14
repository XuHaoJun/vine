# Manager OA Broadcast Campaign Phase 3B Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add LINE-shaped external Messaging API campaign endpoints backed by Vine's Phase 3A audience filter and campaign model.

**Architecture:** Keep Vine's public OA API under `oaApiPath('/bot/...')`, which currently resolves to `/api/oa/v2/bot/...`; do not add root `/v2/...` routes. Add a small campaign facade service that validates the supported LINE-shaped subset, compiles external audience payloads into `AudienceQueryJson` or saved `oaAudienceFilter` rows, and sends text campaigns through `createOACampaignService`. Existing reply and push behavior stays on `createOAMessagingService`.

**Tech Stack:** Bun, Fastify, Drizzle, Vitest, Phase 3A `createOACampaignService`, Phase 3A `createOAAudienceService`, `@vine/zero-schema` audience query validation.

---

## Assumptions

- Phase 3B supports one text message per campaign-backed external request because `oaCampaign` stores `messageType: "text"` and `messageText`.
- Existing non-campaign Messaging API routes remain mounted under `/api/oa/v2`; root `/v2/...` continues to return 404.
- `POST /bot/message/reply` and `POST /bot/message/push` stay on the existing direct messaging service because they are not campaign sends.
- External campaign and audience rows use `createdByManagerId: "messaging-api"` until a later auth/audit phase adds first-class API client principals.
- Unsupported LINE-only predicates return `400` with `code: "UNSUPPORTED_AUDIENCE_FILTER"`; Vine must not silently broaden narrowcast requests.
- LINE Developers documents narrowcast `recipient` as optional; when the top-level `recipient` is omitted, Vine targets all friends, matching LINE behavior. Missing or `null` nested operator branches are invalid and must not broaden the audience.
- LINE Developers documents narrowcast operator objects as requiring exactly one of `and`, `or`, or `not`; `and` and `or` arrays must be non-empty.

## File Structure

- Create `apps/server/src/services/oa-messaging-facade.ts`
  - Validates campaign-backed external payloads, compiles LINE-shaped audience selectors, creates uploaded audience filters, sends text campaigns, and reads campaign insight summaries.
- Create `apps/server/src/services/oa-messaging-facade.test.ts`
  - Unit tests for text-only validation, audience upload, broadcast/multicast/narrowcast compilation, retry-key passthrough, and unsupported predicate failures.
- Modify `apps/server/src/services/oa-campaign.ts`
  - Adds an external send method that accepts retry keys and returns Messaging API-shaped accepted/error results instead of throwing on retry-key outcomes.
- Modify `apps/server/src/services/oa-campaign.test.ts`
  - Adds coverage for external retry-key forwarding and duplicate retry-key result mapping.
- Modify `apps/server/src/plugins/oa-messaging.ts`
  - Adds `facade` dependency and routes campaign-backed broadcast, multicast, narrowcast, audience upload, audience metadata, and insight calls through it.
- Modify `apps/server/src/plugins/oa-messaging.test.ts`
  - Adds route-level tests for the Phase 3B endpoints and verifies root `/v2/...` routes are still absent.
- Modify `apps/server/src/index.ts`
  - Constructs `createOAMessagingFacadeService` and passes it into `oaMessagingPlugin`.

No Zero schema or database migration is required for Phase 3B. The plan uses existing `oaAudienceFilter`, `oaCampaign`, `oaMessageRequest`, and `oaMessageDelivery` tables.

## Task 1: Campaign Service External Send Result

**Files:**
- Modify: `apps/server/src/services/oa-campaign.ts`
- Modify: `apps/server/src/services/oa-campaign.test.ts`

- [ ] **Step 1: Add failing service tests for retry-key passthrough**

Add this test block to `apps/server/src/services/oa-campaign.test.ts` near the existing send tests:

```ts
function createExternalCampaignTestDeps(input: {
  accepted: unknown
  userIds?: string[]
}) {
  const messaging = {
    acceptMessagingExecution: vi.fn().mockResolvedValue(input.accepted),
  }
  const audience = {
    resolveRecipients: vi.fn(async () => ({
      ok: true as const,
      userIds: input.userIds ?? ['user-1'],
    })),
  }
  return { messaging, audience }
}

describe('oa campaign external sends', () => {
  it('passes retry keys to campaign messaging execution', async () => {
    const { messaging, audience } = createExternalCampaignTestDeps({
      accepted: {
        ok: true,
        accepted: {
          httpRequestId: 'req_external',
          acceptedRequestId: 'acc_external',
          request: { id: 'request-1' },
        },
        recipientCount: 1,
      },
    })
    const service = createOACampaignService({
      db: {} as any,
      audience: audience as any,
      messaging: messaging as any,
      now: () => new Date('2026-05-14T00:00:00.000Z'),
    })

    const result = await service.sendExternalTextCampaign({
      campaignId: '550e8400-e29b-41d4-a716-446655440001',
      oaId: '550e8400-e29b-41d4-a716-446655440000',
      retryKey: '123e4567-e89b-12d3-a456-426614174000',
      name: 'Messaging API broadcast',
      messageText: 'hello',
      audienceFilterId: undefined,
      inlineAudienceQuery: { 'friendship.status': 'friend' },
    })

    expect(result.ok).toBe(true)
    expect(result.accepted?.httpRequestId).toBe('req_external')
    expect(messaging.acceptMessagingExecution).toHaveBeenCalledWith(
      expect.objectContaining({
        requestType: 'campaign',
        retryKey: '123e4567-e89b-12d3-a456-426614174000',
      }),
    )
  })

  it('returns duplicate retry-key results without throwing', async () => {
    const { messaging, audience } = createExternalCampaignTestDeps({
      accepted: {
        ok: false,
        code: 'RETRY_KEY_ACCEPTED',
        httpRequestId: 'req_retry',
        acceptedRequestId: 'acc_original',
      },
    })
    const service = createOACampaignService({
      db: {} as any,
      audience: audience as any,
      messaging: messaging as any,
    })

    await expect(
      service.sendExternalTextCampaign({
        campaignId: '550e8400-e29b-41d4-a716-446655440001',
        oaId: '550e8400-e29b-41d4-a716-446655440000',
        retryKey: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Messaging API broadcast',
        messageText: 'hello',
        audienceFilterId: undefined,
        inlineAudienceQuery: { 'friendship.status': 'friend' },
      }),
    ).resolves.toEqual({
      ok: false,
      code: 'RETRY_KEY_ACCEPTED',
      httpRequestId: 'req_retry',
      acceptedRequestId: 'acc_original',
    })
  })
})
```

- [ ] **Step 2: Run the focused failing test**

Run:

```bash
rtk bun run --cwd apps/server test -- src/services/oa-campaign.test.ts
```

Expected: FAIL because `sendExternalTextCampaign` does not exist.

- [ ] **Step 3: Add the external send method**

In `apps/server/src/services/oa-campaign.ts`, add `retryKey` to the internal helper input and expose `sendExternalTextCampaign` without changing the existing ConnectRPC `sendTextCampaign` return shape:

```ts
type ExternalTextCampaignInput = Omit<SendTextCampaignInput, 'managerId'> & {
  retryKey: string | undefined
}

async function acceptTextCampaign(input: SendTextCampaignInput & { retryKey?: string }) {
  const name = cleanCampaignName(input.name)
  const messageText = cleanMessageText(input.messageText)
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
    messages: [{ type: 'text', text: messageText, metadata: null }],
    resolveRecipients: async () => recipients.userIds,
    onAccepted: async ({ tx, request, recipientCount, nowIso }) => {
      acceptedRequestId = request.id
      acceptedRecipientCount = recipientCount
      await tx.insert(oaCampaign).values({
        id: input.campaignId,
        oaId: input.oaId,
        name,
        messageType: 'text',
        messageText,
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

async function sendExternalTextCampaign(input: ExternalTextCampaignInput) {
  const { accepted } = await acceptTextCampaign({
    ...input,
    managerId: 'messaging-api',
    retryKey: input.retryKey,
  })
  return accepted
}
```

Then rewrite the existing `sendTextCampaign` body to call `acceptTextCampaign(input)` and preserve its current success return:

```ts
async function sendTextCampaign(input: SendTextCampaignInput) {
  const { accepted, acceptedRequestId, acceptedRecipientCount } =
    await acceptTextCampaign(input)
  if (!accepted.ok) {
    throw new Error(accepted.code)
  }

  return {
    ok: true as const,
    campaignId: input.campaignId,
    messageRequestId: acceptedRequestId,
    recipientCount: acceptedRecipientCount,
  }
}
```

Return the new method:

```ts
return { previewAudience, sendTextCampaign, sendExternalTextCampaign }
```

- [ ] **Step 4: Run the focused service test**

Run:

```bash
rtk bun run --cwd apps/server test -- src/services/oa-campaign.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/services/oa-campaign.ts apps/server/src/services/oa-campaign.test.ts
git commit -m "feat: support external campaign send results"
```

## Task 2: Messaging API Campaign Facade Service

**Files:**
- Create: `apps/server/src/services/oa-messaging-facade.ts`
- Create: `apps/server/src/services/oa-messaging-facade.test.ts`

- [ ] **Step 1: Write failing facade unit tests**

Create `apps/server/src/services/oa-messaging-facade.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { createOAMessagingFacadeService } from './oa-messaging-facade'

function makeService() {
  const campaign = {
    sendExternalTextCampaign: vi.fn().mockResolvedValue({
      ok: true,
      accepted: {
        httpRequestId: 'req_campaign',
        acceptedRequestId: 'acc_campaign',
        request: { id: 'request-1' },
      },
      recipientCount: 2,
    }),
  }
  const db = {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'filter-1' }]),
      }),
    }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([
            {
              id: 'filter-1',
              oaId: 'oa-1',
              name: 'Imported audience',
              queryVersion: 1,
              queryJson: { providerUserId: { $in: ['user-1'] } },
              createdAt: '2026-05-14T00:00:00.000Z',
              updatedAt: '2026-05-14T00:00:00.000Z',
            },
          ]),
        }),
      }),
    }),
  }
  const service = createOAMessagingFacadeService({
    db: db as any,
    campaign: campaign as any,
    now: () => new Date('2026-05-14T00:00:00.000Z'),
    createId: () => '550e8400-e29b-41d4-a716-446655440001',
  })
  return { service, campaign, db }
}

describe('oa messaging campaign facade', () => {
  it('creates a broadcast campaign for all friends', async () => {
    const { service, campaign } = makeService()

    const result = await service.broadcast({
      oaId: 'oa-1',
      retryKey: undefined,
      body: { messages: [{ type: 'text', text: 'hello' }] },
    })

    expect(result.ok).toBe(true)
    expect(campaign.sendExternalTextCampaign).toHaveBeenCalledWith({
      campaignId: '550e8400-e29b-41d4-a716-446655440001',
      oaId: 'oa-1',
      retryKey: undefined,
      name: 'Messaging API broadcast 2026-05-14T00:00:00.000Z',
      messageText: 'hello',
      audienceFilterId: undefined,
      inlineAudienceQuery: { 'friendship.status': 'friend' },
    })
  })

  it('creates a multicast campaign for explicit recipients', async () => {
    const { service, campaign } = makeService()

    await service.multicast({
      oaId: 'oa-1',
      retryKey: '123e4567-e89b-12d3-a456-426614174000',
      body: { to: ['user-1', 'user-2'], messages: [{ type: 'text', text: 'hello' }] },
    })

    expect(campaign.sendExternalTextCampaign).toHaveBeenCalledWith(
      expect.objectContaining({
        retryKey: '123e4567-e89b-12d3-a456-426614174000',
        inlineAudienceQuery: { providerUserId: { $in: ['user-1', 'user-2'] } },
      }),
    )
  })

  it('rejects unsupported non-text campaign messages', async () => {
    const { service } = makeService()

    await expect(
      service.broadcast({
        oaId: 'oa-1',
        retryKey: undefined,
        body: { messages: [{ type: 'image', originalContentUrl: 'https://example.test/a.jpg' }] },
      }),
    ).resolves.toEqual({
      ok: false,
      code: 'UNSUPPORTED_MESSAGE_TYPE',
      message: 'Campaign facade supports exactly one text message',
    })
  })

  it('creates an uploaded audience filter from user IDs', async () => {
    const { service } = makeService()

    await expect(
      service.uploadAudienceGroup({
        oaId: 'oa-1',
        body: {
          description: 'Imported audience',
          audiences: [{ id: 'user-1' }, { id: 'user-2' }],
        },
      }),
    ).resolves.toEqual({
      ok: true,
      audienceGroupId: 'filter-1',
      description: 'Imported audience',
    })
  })

  it('returns a controlled error for duplicate uploaded audience descriptions', async () => {
    const { service, db } = makeService()
    db.insert.mockReturnValueOnce({
      values: vi.fn().mockReturnValue({
        returning: vi
          .fn()
          .mockRejectedValue(new Error('duplicate key value violates oaAudienceFilter_oaId_name_unique')),
      }),
    })

    await expect(
      service.uploadAudienceGroup({
        oaId: 'oa-1',
        body: {
          description: 'Imported audience',
          audiences: [{ id: 'user-1' }],
        },
      }),
    ).resolves.toEqual({
      ok: false,
      code: 'INVALID_REQUEST',
      message: 'audience description already exists',
    })
  })

  it('compiles narrowcast audienceGroupId references', async () => {
    const { service, campaign } = makeService()

    await service.narrowcast({
      oaId: 'oa-1',
      retryKey: undefined,
      body: {
        messages: [{ type: 'text', text: 'hello' }],
        recipient: { type: 'audience', audienceGroupId: 'filter-1' },
      },
    })

    expect(campaign.sendExternalTextCampaign).toHaveBeenCalledWith(
      expect.objectContaining({
        audienceFilterId: 'filter-1',
        inlineAudienceQuery: undefined,
      }),
    )
  })

  it('rejects unsupported narrowcast redelivery predicates', async () => {
    const { service } = makeService()

    await expect(
      service.narrowcast({
        oaId: 'oa-1',
        retryKey: undefined,
        body: {
          messages: [{ type: 'text', text: 'hello' }],
          recipient: { type: 'redelivery', requestId: 'request-1' },
        },
      }),
    ).resolves.toEqual({
      ok: false,
      code: 'UNSUPPORTED_AUDIENCE_FILTER',
      message: 'recipient.type redelivery is not supported',
    })
  })

  it('treats omitted top-level narrowcast recipient as all friends', async () => {
    const { service, campaign } = makeService()

    await service.narrowcast({
      oaId: 'oa-1',
      retryKey: undefined,
      body: { messages: [{ type: 'text', text: 'hello' }] },
    })

    expect(campaign.sendExternalTextCampaign).toHaveBeenCalledWith(
      expect.objectContaining({
        audienceFilterId: undefined,
        inlineAudienceQuery: { 'friendship.status': 'friend' },
      }),
    )
  })

  it('rejects empty narrowcast operator arrays', async () => {
    const { service } = makeService()

    await expect(
      service.narrowcast({
        oaId: 'oa-1',
        retryKey: undefined,
        body: {
          messages: [{ type: 'text', text: 'hello' }],
          recipient: { type: 'operator', and: [] },
        },
      }),
    ).resolves.toEqual({
      ok: false,
      code: 'UNSUPPORTED_AUDIENCE_FILTER',
      message: 'operator.and must be a non-empty array',
    })
  })

  it('rejects nested null operator branches', async () => {
    const { service } = makeService()

    await expect(
      service.narrowcast({
        oaId: 'oa-1',
        retryKey: undefined,
        body: {
          messages: [{ type: 'text', text: 'hello' }],
          recipient: { type: 'operator', or: [null] },
        },
      }),
    ).resolves.toEqual({
      ok: false,
      code: 'UNSUPPORTED_AUDIENCE_FILTER',
      message: 'recipient must be an object',
    })
  })

  it('rejects operators with more than one logical property', async () => {
    const { service } = makeService()

    await expect(
      service.narrowcast({
        oaId: 'oa-1',
        retryKey: undefined,
        body: {
          messages: [{ type: 'text', text: 'hello' }],
          recipient: {
            type: 'operator',
            and: [{ type: 'audience', audienceGroupId: 'filter-1' }],
            or: [{ type: 'audience', audienceGroupId: 'filter-2' }],
          },
        },
      }),
    ).resolves.toEqual({
      ok: false,
      code: 'UNSUPPORTED_AUDIENCE_FILTER',
      message: 'operator recipient must include exactly one of and, or, or not',
    })
  })
})
```

- [ ] **Step 2: Run the focused failing test**

Run:

```bash
rtk bun run --cwd apps/server test -- src/services/oa-messaging-facade.test.ts
```

Expected: FAIL because `oa-messaging-facade.ts` does not exist.

- [ ] **Step 3: Implement the facade service**

Create `apps/server/src/services/oa-messaging-facade.ts` with these exports and behavior:

```ts
import { randomUUID } from 'crypto'
import { oaAudienceFilter, oaCampaign } from '@vine/db/schema-oa'
import { oaMessageRequest } from '@vine/db/schema-private'
import { and, eq, or } from 'drizzle-orm'
import type { createOACampaignService } from './oa-campaign'
import type { schema } from '@vine/db'
import { validateAudienceQuery, type AudienceQueryJson } from '@vine/zero-schema'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

type TextMessage = { type: 'text'; text: string }
type CampaignBody = { messages?: unknown[] }
type MulticastBody = CampaignBody & { to?: unknown }
type UploadAudienceGroupBody = {
  description?: unknown
  audiences?: unknown
}
type NarrowcastBody = CampaignBody & {
  recipient?: unknown
  filter?: unknown
  limit?: unknown
}

type FacadeDeps = {
  db: NodePgDatabase<typeof schema>
  campaign: ReturnType<typeof createOACampaignService>
  now?: () => Date
  createId?: () => string
}

type FacadeErrorCode =
  | 'INVALID_REQUEST'
  | 'UNSUPPORTED_MESSAGE_TYPE'
  | 'UNSUPPORTED_AUDIENCE_FILTER'
  | 'AUDIENCE_GROUP_NOT_FOUND'

type FacadeError = { ok: false; code: FacadeErrorCode; message: string }

function readSingleTextMessage(body: CampaignBody): TextMessage | FacadeError {
  if (!Array.isArray(body.messages) || body.messages.length !== 1) {
    return {
      ok: false,
      code: 'UNSUPPORTED_MESSAGE_TYPE',
      message: 'Campaign facade supports exactly one text message',
    }
  }
  const [message] = body.messages
  if (
    typeof message !== 'object' ||
    message === null ||
    (message as { type?: unknown }).type !== 'text' ||
    typeof (message as { text?: unknown }).text !== 'string'
  ) {
    return {
      ok: false,
      code: 'UNSUPPORTED_MESSAGE_TYPE',
      message: 'Campaign facade supports exactly one text message',
    }
  }
  return message as TextMessage
}

function isFacadeError(value: unknown): value is FacadeError {
  return typeof value === 'object' && value !== null && (value as FacadeError).ok === false
}

function compileRecipient(
  recipient: unknown,
  options: { allowAllFriends: boolean },
):
  | { audienceFilterId: string | undefined; query: AudienceQueryJson | undefined }
  | FacadeError {
  if (recipient === undefined || recipient === null) {
    if (!options.allowAllFriends) {
      return {
        ok: false,
        code: 'UNSUPPORTED_AUDIENCE_FILTER',
        message: 'recipient must be an object',
      }
    }
    return { audienceFilterId: undefined, query: { 'friendship.status': 'friend' } }
  }
  if (typeof recipient !== 'object') {
    return {
      ok: false,
      code: 'UNSUPPORTED_AUDIENCE_FILTER',
      message: 'recipient must be an object',
    }
  }
  const value = recipient as Record<string, unknown>
  if (value.type === 'audience' && typeof value.audienceGroupId === 'string') {
    return { audienceFilterId: value.audienceGroupId, query: undefined }
  }
  if (value.type === 'operator') {
    return compileOperator(value)
  }
  if (value.type === 'redelivery') {
    return {
      ok: false,
      code: 'UNSUPPORTED_AUDIENCE_FILTER',
      message: 'recipient.type redelivery is not supported',
    }
  }
  return {
    ok: false,
    code: 'UNSUPPORTED_AUDIENCE_FILTER',
    message: `recipient.type ${String(value.type)} is not supported`,
  }
}

function compileOperator(value: Record<string, unknown>):
  | { audienceFilterId: undefined; query: AudienceQueryJson }
  | FacadeError {
  const andList = value.and
  const orList = value.or
  const notValue = value.not
  const providedOperators = [andList !== undefined, orList !== undefined, notValue !== undefined]
    .filter(Boolean).length
  if (providedOperators !== 1) {
    return {
      ok: false,
      code: 'UNSUPPORTED_AUDIENCE_FILTER',
      message: 'operator recipient must include exactly one of and, or, or not',
    }
  }
  if (Array.isArray(andList)) {
    if (andList.length === 0) {
      return {
        ok: false,
        code: 'UNSUPPORTED_AUDIENCE_FILTER',
        message: 'operator.and must be a non-empty array',
      }
    }
    const branches: AudienceQueryJson[] = []
    for (const branch of andList) {
      const compiled = compileRecipient(branch, { allowAllFriends: false })
      if (isFacadeError(compiled)) return compiled
      if (compiled.audienceFilterId) {
        return {
          ok: false,
          code: 'UNSUPPORTED_AUDIENCE_FILTER',
          message: 'audienceGroupId cannot be nested inside operator recipients',
        }
      }
      branches.push(compiled.query ?? {})
    }
    return {
      audienceFilterId: undefined,
      query: { $and: branches },
    }
  }
  if (Array.isArray(orList)) {
    if (orList.length === 0) {
      return {
        ok: false,
        code: 'UNSUPPORTED_AUDIENCE_FILTER',
        message: 'operator.or must be a non-empty array',
      }
    }
    const branches: AudienceQueryJson[] = []
    for (const branch of orList) {
      const compiled = compileRecipient(branch, { allowAllFriends: false })
      if (isFacadeError(compiled)) return compiled
      if (compiled.audienceFilterId) {
        return {
          ok: false,
          code: 'UNSUPPORTED_AUDIENCE_FILTER',
          message: 'audienceGroupId cannot be nested inside operator recipients',
        }
      }
      branches.push(compiled.query ?? {})
    }
    return {
      audienceFilterId: undefined,
      query: { $or: branches },
    }
  }
  if (notValue !== undefined) {
    const compiled = compileRecipient(notValue, { allowAllFriends: false })
    if (isFacadeError(compiled)) return compiled
    if (compiled.audienceFilterId) {
      return {
        ok: false,
        code: 'UNSUPPORTED_AUDIENCE_FILTER',
        message: 'audienceGroupId cannot be nested inside operator recipients',
      }
    }
    return { audienceFilterId: undefined, query: { $not: compiled.query ?? {} } }
  }
  return {
    ok: false,
    code: 'UNSUPPORTED_AUDIENCE_FILTER',
    message: 'operator recipient must include exactly one of and, or, or not',
  }
}

function validateCompiledQuery(query: AudienceQueryJson | undefined): FacadeError | undefined {
  if (!query) return undefined
  const result = validateAudienceQuery(query)
  if (result.ok) return undefined
  return {
    ok: false,
    code: 'UNSUPPORTED_AUDIENCE_FILTER',
    message: result.error,
  }
}

export function createOAMessagingFacadeService(deps: FacadeDeps) {
  const now = deps.now ?? (() => new Date())
  const createId = deps.createId ?? randomUUID

  async function sendCampaign(input: {
    oaId: string
    retryKey: string | undefined
    namePrefix: string
    body: CampaignBody
    audienceFilterId: string | undefined
    inlineAudienceQuery: AudienceQueryJson | undefined
  }) {
    const text = readSingleTextMessage(input.body)
    if (isFacadeError(text)) return text
    return deps.campaign.sendExternalTextCampaign({
      campaignId: createId(),
      oaId: input.oaId,
      retryKey: input.retryKey,
      name: `${input.namePrefix} ${now().toISOString()}`,
      messageText: text.text,
      audienceFilterId: input.audienceFilterId,
      inlineAudienceQuery: input.inlineAudienceQuery,
    })
  }

  async function broadcast(input: {
    oaId: string
    retryKey: string | undefined
    body: CampaignBody
  }) {
    return sendCampaign({
      ...input,
      namePrefix: 'Messaging API broadcast',
      audienceFilterId: undefined,
      inlineAudienceQuery: { 'friendship.status': 'friend' },
    })
  }

  async function multicast(input: {
    oaId: string
    retryKey: string | undefined
    body: MulticastBody
  }) {
    if (!Array.isArray(input.body.to) || input.body.to.length === 0) {
      return { ok: false as const, code: 'INVALID_REQUEST', message: 'to is required' }
    }
    if (!input.body.to.every((userId) => typeof userId === 'string')) {
      return { ok: false as const, code: 'INVALID_REQUEST', message: 'to must contain strings' }
    }
    if (input.body.to.length > 500) {
      return {
        ok: false as const,
        code: 'INVALID_REQUEST',
        message: 'to must contain 500 or fewer user IDs',
      }
    }
    if (new Set(input.body.to).size !== input.body.to.length) {
      return {
        ok: false as const,
        code: 'INVALID_REQUEST',
        message: 'to must not contain duplicate user IDs',
      }
    }
    return sendCampaign({
      oaId: input.oaId,
      retryKey: input.retryKey,
      body: input.body,
      namePrefix: 'Messaging API multicast',
      audienceFilterId: undefined,
      inlineAudienceQuery: { providerUserId: { $in: input.body.to } },
    })
  }

  async function narrowcast(input: {
    oaId: string
    retryKey: string | undefined
    body: NarrowcastBody
  }) {
    if (input.body.filter !== undefined) {
      return {
        ok: false as const,
        code: 'UNSUPPORTED_AUDIENCE_FILTER',
        message: 'narrowcast filter is not supported',
      }
    }
    if (input.body.limit !== undefined) {
      return {
        ok: false as const,
        code: 'UNSUPPORTED_AUDIENCE_FILTER',
        message: 'narrowcast limit is not supported',
      }
    }
    const compiled = compileRecipient(input.body.recipient, { allowAllFriends: true })
    if (isFacadeError(compiled)) return compiled
    const invalidQuery = validateCompiledQuery(compiled.query)
    if (invalidQuery) return invalidQuery
    return sendCampaign({
      oaId: input.oaId,
      retryKey: input.retryKey,
      body: input.body,
      namePrefix: 'Messaging API narrowcast',
      audienceFilterId: compiled.audienceFilterId,
      inlineAudienceQuery: compiled.query,
    })
  }

  async function uploadAudienceGroup(input: {
    oaId: string
    body: UploadAudienceGroupBody
  }) {
    const name =
      typeof input.body.description === 'string' && input.body.description.trim()
        ? input.body.description.trim()
        : `Messaging API audience ${now().toISOString()}`
    const audiences = Array.isArray(input.body.audiences) ? input.body.audiences : []
    const userIds = audiences
      .map((item) =>
        typeof item === 'object' && item !== null ? (item as { id?: unknown }).id : undefined,
      )
      .filter((id): id is string => typeof id === 'string')
    if (userIds.length === 0) {
      return {
        ok: false as const,
        code: 'INVALID_REQUEST',
        message: 'audiences must contain at least one id',
      }
    }
    let filter: { id: string }
    try {
      const [createdFilter] = await deps.db
        .insert(oaAudienceFilter)
        .values({
          id: createId(),
          oaId: input.oaId,
          name,
          queryVersion: 1,
          queryJson: { providerUserId: { $in: [...new Set(userIds)] } },
          createdByManagerId: 'messaging-api',
          createdAt: now().toISOString(),
          updatedAt: now().toISOString(),
        })
        .returning({ id: oaAudienceFilter.id })
      if (!createdFilter) throw new Error('Audience group was not created')
      filter = createdFilter
    } catch (err) {
      if (err instanceof Error && err.message.includes('oaAudienceFilter_oaId_name_unique')) {
        return {
          ok: false as const,
          code: 'INVALID_REQUEST',
          message: 'audience description already exists',
        }
      }
      throw err
    }
    return { ok: true as const, audienceGroupId: filter.id, description: name }
  }

  async function getAudienceGroup(input: { oaId: string; audienceGroupId: string }) {
    const [filter] = await deps.db
      .select()
      .from(oaAudienceFilter)
      .where(
        and(
          eq(oaAudienceFilter.oaId, input.oaId),
          eq(oaAudienceFilter.id, input.audienceGroupId),
        ),
      )
      .limit(1)
    if (!filter) {
      return {
        ok: false as const,
        code: 'AUDIENCE_GROUP_NOT_FOUND',
        message: 'Audience group not found',
      }
    }
    return {
      ok: true as const,
      audienceGroupId: filter.id,
      description: filter.name,
      created: Math.floor(new Date(filter.createdAt).getTime() / 1000),
      permission: 'READ_WRITE',
      createRoute: 'MESSAGING_API',
      audienceCount: null,
    }
  }

  async function getMessageEventInsight(input: { oaId: string; requestId: string }) {
    const [row] = await deps.db
      .select({
        campaignId: oaCampaign.id,
        successCount: oaCampaign.successCount,
        failedCount: oaCampaign.failedCount,
        recipientSnapshotCount: oaCampaign.recipientSnapshotCount,
      })
      .from(oaCampaign)
      .leftJoin(oaMessageRequest, eq(oaMessageRequest.id, oaCampaign.messageRequestId))
      .where(
        and(
          eq(oaCampaign.oaId, input.oaId),
          or(
            eq(oaCampaign.id, input.requestId),
            eq(oaMessageRequest.acceptedRequestId, input.requestId),
          ),
        ),
      )
      .limit(1)
    if (!row) {
      return { ok: false as const, code: 'INVALID_REQUEST', message: 'requestId not found' }
    }
    return {
      ok: true as const,
      overview: {
        requestId: row.campaignId,
        delivered: row.successCount,
        failed: row.failedCount,
        target: row.recipientSnapshotCount,
      },
    }
  }

  return {
    broadcast,
    multicast,
    narrowcast,
    uploadAudienceGroup,
    getAudienceGroup,
    getMessageEventInsight,
  }
}
```

- [ ] **Step 4: Run the focused facade test**

Run:

```bash
rtk bun run --cwd apps/server test -- src/services/oa-messaging-facade.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/services/oa-messaging-facade.ts apps/server/src/services/oa-messaging-facade.test.ts
git commit -m "feat: add messaging api campaign facade"
```

## Task 3: Route Phase 3B Endpoints Through The Facade

**Files:**
- Modify: `apps/server/src/plugins/oa-messaging.ts`
- Modify: `apps/server/src/plugins/oa-messaging.test.ts`
- Modify: `apps/server/src/index.ts`

- [ ] **Step 1: Add failing route tests**

In `apps/server/src/plugins/oa-messaging.test.ts`, extend `createTestApp` so `mockMessagingOverrides` accepts a `facade` object. Register the plugin with:

```ts
facade: mockFacade as any,
```

Build `mockFacade` with default `vi.fn()` methods for `broadcast`, `multicast`, `narrowcast`, `uploadAudienceGroup`, `getAudienceGroup`, and `getMessageEventInsight`, then spread `mockMessagingOverrides?.facade` over those defaults. This lets each route test override only the facade method it exercises.

Update the existing broadcast and multicast route tests in this file to assert facade behavior instead of direct `mockMessaging.broadcast` / `mockMessaging.multicast` calls. Keep the existing validation, quota, and retry-key coverage, but route expected accepted/error results through the facade methods because Task 3 intentionally moves broadcast and multicast off `createOAMessagingService`.

Add this test block:

```ts
describe('oaMessagingPlugin — Phase 3B campaign facade', () => {
  it('routes broadcast through the campaign facade', async () => {
    const mockDb = makeMockDb([{ oaId, token: validToken, expiresAt: null }], [])
    const facade = {
      broadcast: vi.fn().mockResolvedValue({
        ok: true,
        accepted: {
          httpRequestId: 'req_campaign',
          acceptedRequestId: 'acc_campaign',
        },
      }),
    }
    const { app } = createTestApp(mockDb, { facade })
    await app.ready()

    const res = await app.inject({
      method: 'POST',
      url: oaApiPath('/bot/message/broadcast'),
      headers: {
        authorization: `Bearer ${validToken}`,
        'x-line-retry-key': '123e4567-e89b-12d3-a456-426614174000',
      },
      payload: { messages: [{ type: 'text', text: 'hello' }] },
    })

    await app.close()
    expect(res.statusCode).toBe(200)
    expect(res.headers['x-line-request-id']).toBe('req_campaign')
    expect(facade.broadcast).toHaveBeenCalledWith({
      oaId,
      retryKey: '123e4567-e89b-12d3-a456-426614174000',
      body: { messages: [{ type: 'text', text: 'hello' }] },
    })
  })

  it('routes narrowcast through the campaign facade', async () => {
    const mockDb = makeMockDb([{ oaId, token: validToken, expiresAt: null }], [])
    const facade = {
      narrowcast: vi.fn().mockResolvedValue({
        ok: true,
        accepted: {
          httpRequestId: 'req_narrowcast',
          acceptedRequestId: 'acc_narrowcast',
        },
      }),
    }
    const { app } = createTestApp(mockDb, { facade })
    await app.ready()

    const payload = {
      messages: [{ type: 'text', text: 'hello' }],
      recipient: { type: 'audience', audienceGroupId: 'filter-1' },
    }
    const res = await app.inject({
      method: 'POST',
      url: oaApiPath('/bot/message/narrowcast'),
      headers: { authorization: `Bearer ${validToken}` },
      payload,
    })

    await app.close()
    expect(res.statusCode).toBe(200)
    expect(facade.narrowcast).toHaveBeenCalledWith({
      oaId,
      retryKey: undefined,
      body: payload,
    })
  })

  it('creates uploaded audience groups through the campaign facade', async () => {
    const mockDb = makeMockDb([{ oaId, token: validToken, expiresAt: null }], [])
    const facade = {
      uploadAudienceGroup: vi.fn().mockResolvedValue({
        ok: true,
        audienceGroupId: 'filter-1',
        description: 'VIP import',
      }),
    }
    const { app } = createTestApp(mockDb, { facade })
    await app.ready()

    const res = await app.inject({
      method: 'POST',
      url: oaApiPath('/bot/audienceGroup/upload'),
      headers: { authorization: `Bearer ${validToken}` },
      payload: {
        description: 'VIP import',
        audiences: [{ id: 'user-1' }],
      },
    })

    await app.close()
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toEqual({
      audienceGroupId: 'filter-1',
      description: 'VIP import',
    })
  })

  it('returns audience group metadata through the campaign facade', async () => {
    const mockDb = makeMockDb([{ oaId, token: validToken, expiresAt: null }], [])
    const facade = {
      getAudienceGroup: vi.fn().mockResolvedValue({
        ok: true,
        audienceGroupId: 'filter-1',
        description: 'VIP import',
        created: 1778716800,
        permission: 'READ_WRITE',
        createRoute: 'MESSAGING_API',
        audienceCount: null,
      }),
    }
    const { app } = createTestApp(mockDb, { facade })
    await app.ready()

    const res = await app.inject({
      method: 'GET',
      url: oaApiPath('/bot/audienceGroup/filter-1'),
      headers: { authorization: `Bearer ${validToken}` },
    })

    await app.close()
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body).audienceGroupId).toBe('filter-1')
  })

  it('returns campaign insight through the campaign facade', async () => {
    const mockDb = makeMockDb([{ oaId, token: validToken, expiresAt: null }], [])
    const facade = {
      getMessageEventInsight: vi.fn().mockResolvedValue({
        ok: true,
        overview: { requestId: 'campaign-1', delivered: 2, failed: 0, target: 2 },
      }),
    }
    const { app } = createTestApp(mockDb, { facade })
    await app.ready()

    const res = await app.inject({
      method: 'GET',
      url: oaApiPath('/bot/insight/message/event?requestId=campaign-1'),
      headers: { authorization: `Bearer ${validToken}` },
    })

    await app.close()
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toEqual({
      overview: { requestId: 'campaign-1', delivered: 2, failed: 0, target: 2 },
    })
  })

  it('does not register the root /v2 narrowcast route', async () => {
    const mockDb = makeMockDb([{ oaId, token: validToken, expiresAt: null }], [])
    const { app } = createTestApp(mockDb)
    await app.ready()

    const res = await app.inject({
      method: 'POST',
      url: '/v2/bot/message/narrowcast',
      headers: { authorization: `Bearer ${validToken}` },
      payload: { messages: [{ type: 'text', text: 'hello' }] },
    })

    await app.close()
    expect(res.statusCode).toBe(404)
  })
})
```

- [ ] **Step 2: Run the route tests and verify failure**

Run:

```bash
rtk bun run --cwd apps/server test -- src/plugins/oa-messaging.test.ts
```

Expected: FAIL because `oaMessagingPlugin` does not accept or use `facade`.

- [ ] **Step 3: Wire facade dependency and response helper**

In `apps/server/src/plugins/oa-messaging.ts`, import the facade service type:

```ts
import type { createOAMessagingFacadeService } from '../services/oa-messaging-facade'
```

Add it to `MessagingPluginDeps`:

```ts
facade: ReturnType<typeof createOAMessagingFacadeService>
```

Destructure it:

```ts
const { oa, messaging, facade, db, drive } = deps
```

Add a helper for facade validation failures:

```ts
function sendFacadeResult(reply: FastifyReply, result: any) {
  if (!result.ok && result.message) {
    const status = result.code === 'AUDIENCE_GROUP_NOT_FOUND' ? 404 : 400
    return reply.code(status).send({ message: result.message, code: result.code })
  }
  return sendMessagingResult(reply, result)
}
```

- [ ] **Step 4: Route broadcast and multicast through the facade**

Replace the service calls in existing broadcast and multicast route handlers:

```ts
const result = await facade.multicast({
  oaId,
  retryKey: request.headers['x-line-retry-key'] as string | undefined,
  body,
})
return await sendFacadeResult(reply, result)
```

```ts
const result = await facade.broadcast({
  oaId,
  retryKey: request.headers['x-line-retry-key'] as string | undefined,
  body,
})
return await sendFacadeResult(reply, result)
```

Keep the existing auth catch blocks unchanged.

- [ ] **Step 5: Add narrowcast, audience group, and insight routes**

Add these route handlers in `oaMessagingPlugin` after broadcast:

```ts
fastify.post(
  oaApiPath('/bot/message/narrowcast'),
  async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const oaId = await extractOaFromToken(request, db)
      const result = await facade.narrowcast({
        oaId,
        retryKey: request.headers['x-line-retry-key'] as string | undefined,
        body: request.body as Record<string, unknown>,
      })
      return await sendFacadeResult(reply, result)
    } catch (err) {
      if (err instanceof Error && err.message === 'Missing Bearer token') {
        return reply.code(401).send({ message: 'Missing Bearer token', code: 'INVALID_TOKEN' })
      }
      if (err instanceof Error && err.message === 'Invalid access token') {
        return reply.code(401).send({ message: 'Invalid access token', code: 'INVALID_TOKEN' })
      }
      if (err instanceof Error && err.message === 'Access token expired') {
        return reply.code(401).send({ message: 'Access token expired', code: 'TOKEN_EXPIRED' })
      }
      return reply.code(500).send({ message: 'Internal server error' })
    }
  },
)

fastify.post(
  oaApiPath('/bot/audienceGroup/upload'),
  async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const oaId = await extractOaFromToken(request, db)
      const result = await facade.uploadAudienceGroup({
        oaId,
        body: request.body as Record<string, unknown>,
      })
      if (!result.ok) {
        return reply.code(400).send({ message: result.message, code: result.code })
      }
      return reply.send({
        audienceGroupId: result.audienceGroupId,
        description: result.description,
      })
    } catch (err) {
      if (err instanceof Error && err.message === 'Missing Bearer token') {
        return reply.code(401).send({ message: 'Missing Bearer token', code: 'INVALID_TOKEN' })
      }
      if (err instanceof Error && err.message === 'Invalid access token') {
        return reply.code(401).send({ message: 'Invalid access token', code: 'INVALID_TOKEN' })
      }
      if (err instanceof Error && err.message === 'Access token expired') {
        return reply.code(401).send({ message: 'Access token expired', code: 'TOKEN_EXPIRED' })
      }
      return reply.code(500).send({ message: 'Internal server error' })
    }
  },
)

fastify.get(
  oaApiPath('/bot/audienceGroup/:id'),
  async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const oaId = await extractOaFromToken(request, db)
      const params = request.params as { id: string }
      const result = await facade.getAudienceGroup({ oaId, audienceGroupId: params.id })
      if (!result.ok) {
        return reply.code(404).send({ message: result.message, code: result.code })
      }
      return reply.send(result)
    } catch (err) {
      if (err instanceof Error && err.message === 'Missing Bearer token') {
        return reply.code(401).send({ message: 'Missing Bearer token', code: 'INVALID_TOKEN' })
      }
      if (err instanceof Error && err.message === 'Invalid access token') {
        return reply.code(401).send({ message: 'Invalid access token', code: 'INVALID_TOKEN' })
      }
      if (err instanceof Error && err.message === 'Access token expired') {
        return reply.code(401).send({ message: 'Access token expired', code: 'TOKEN_EXPIRED' })
      }
      return reply.code(500).send({ message: 'Internal server error' })
    }
  },
)

fastify.get(
  oaApiPath('/bot/insight/message/event'),
  async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const oaId = await extractOaFromToken(request, db)
      const query = request.query as { requestId?: string }
      if (!query.requestId) {
        return reply.code(400).send({ message: 'requestId is required', code: 'INVALID_REQUEST' })
      }
      const result = await facade.getMessageEventInsight({ oaId, requestId: query.requestId })
      if (!result.ok) {
        return reply.code(400).send({ message: result.message, code: result.code })
      }
      return reply.send({ overview: result.overview })
    } catch (err) {
      if (err instanceof Error && err.message === 'Missing Bearer token') {
        return reply.code(401).send({ message: 'Missing Bearer token', code: 'INVALID_TOKEN' })
      }
      if (err instanceof Error && err.message === 'Invalid access token') {
        return reply.code(401).send({ message: 'Invalid access token', code: 'INVALID_TOKEN' })
      }
      if (err instanceof Error && err.message === 'Access token expired') {
        return reply.code(401).send({ message: 'Access token expired', code: 'TOKEN_EXPIRED' })
      }
      return reply.code(500).send({ message: 'Internal server error' })
    }
  },
)
```

- [ ] **Step 6: Wire the service in app startup**

In `apps/server/src/index.ts`, import and construct:

```ts
import { createOAMessagingFacadeService } from './services/oa-messaging-facade'
```

```ts
const oaMessagingFacade = createOAMessagingFacadeService({
  db,
  campaign: oaCampaign,
})
```

Pass it into the plugin registration:

```ts
await oaMessagingPlugin(app, {
  oa,
  messaging: oaMessaging,
  facade: oaMessagingFacade,
  db,
  drive,
})
```

- [ ] **Step 7: Run the route tests**

Run:

```bash
rtk bun run --cwd apps/server test -- src/plugins/oa-messaging.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/server/src/plugins/oa-messaging.ts apps/server/src/plugins/oa-messaging.test.ts apps/server/src/index.ts
git commit -m "feat: route messaging api campaigns through facade"
```

## Task 4: Integration Coverage For Campaign-Backed Facade

**Files:**
- Create: `apps/server/src/services/oa-messaging-facade.int.test.ts`

- [ ] **Step 1: Add integration tests for facade-created campaigns**

Create `apps/server/src/services/oa-messaging-facade.int.test.ts`:

```ts
import { randomUUID } from 'crypto'
import {
  oaAudienceFilter,
  oaCampaign,
  oaFriendship,
  oaProvider,
  officialAccount,
} from '@vine/db/schema-oa'
import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { withRollbackDb } from '../test/integration-db'
import { createOAAudienceService } from './oa-audience'
import { createOACampaignService } from './oa-campaign'
import { createOAMessagingFacadeService } from './oa-messaging-facade'
import { createOAMessagingService } from './oa-messaging'

async function seedOaWithFriends(db: any, suffix: string, userIds: string[]) {
  const [provider] = await db
    .insert(oaProvider)
    .values({ name: `Phase 3B Provider ${suffix}`, ownerId: `owner-${suffix}` })
    .returning()
  const [oa] = await db
    .insert(officialAccount)
    .values({
      providerId: provider.id,
      name: `Phase 3B OA ${suffix}`,
      uniqueId: `phase-3b-${suffix}`,
      channelSecret: 'secret',
    })
    .returning()
  await db.insert(oaFriendship).values(
    userIds.map((userId) => ({
      oaId: oa.id,
      userId,
      status: 'friend' as const,
    })),
  )
  return oa
}

function createFacade(db: any, ids: string[]) {
  const messaging = createOAMessagingService({
    db,
    instanceId: 'phase-3b-test',
    now: () => new Date('2026-05-14T00:00:00.000Z'),
  })
  const campaign = createOACampaignService({
    db,
    audience: createOAAudienceService({ db }),
    messaging,
    now: () => new Date('2026-05-14T00:00:00.000Z'),
  })
  return createOAMessagingFacadeService({
    db,
    campaign,
    now: () => new Date('2026-05-14T00:00:00.000Z'),
    createId: () => ids.shift() ?? randomUUID(),
  })
}

describe('OA messaging campaign facade DB integration', () => {
  it('creates a campaign and recipient snapshot for external broadcast', async () => {
    await withRollbackDb(async (db) => {
      const suffix = randomUUID()
      const oa = await seedOaWithFriends(db, suffix, [
        `user-1-${suffix}`,
        `user-2-${suffix}`,
      ])
      const campaignId = randomUUID()
      const facade = createFacade(db, [campaignId])

      const result = await facade.broadcast({
        oaId: oa.id,
        retryKey: undefined,
        body: { messages: [{ type: 'text', text: 'hello friends' }] },
      })

      expect(result.ok).toBe(true)
      const [campaign] = await db
        .select()
        .from(oaCampaign)
        .where(eq(oaCampaign.id, campaignId))
        .limit(1)
      expect(campaign.messageText).toBe('hello friends')
      expect(campaign.recipientSnapshotCount).toBe(2)
      expect(campaign.inlineAudienceQueryJson).toEqual({
        'friendship.status': 'friend',
      })
    })
  })

  it('uploads an audience and narrowcasts to the saved filter', async () => {
    await withRollbackDb(async (db) => {
      const suffix = randomUUID()
      const targetUser = `target-${suffix}`
      const oa = await seedOaWithFriends(db, suffix, [targetUser, `other-${suffix}`])
      const filterId = randomUUID()
      const campaignId = randomUUID()
      const facade = createFacade(db, [filterId, campaignId])

      const upload = await facade.uploadAudienceGroup({
        oaId: oa.id,
        body: {
          description: 'Uploaded target',
          audiences: [{ id: targetUser }],
        },
      })
      expect(upload).toEqual({
        ok: true,
        audienceGroupId: filterId,
        description: 'Uploaded target',
      })

      const result = await facade.narrowcast({
        oaId: oa.id,
        retryKey: undefined,
        body: {
          messages: [{ type: 'text', text: 'hello target' }],
          recipient: { type: 'audience', audienceGroupId: filterId },
        },
      })
      expect(result.ok).toBe(true)

      const [filter] = await db
        .select()
        .from(oaAudienceFilter)
        .where(eq(oaAudienceFilter.id, filterId))
        .limit(1)
      expect(filter.queryJson).toEqual({ providerUserId: { $in: [targetUser] } })

      const [campaign] = await db
        .select()
        .from(oaCampaign)
        .where(eq(oaCampaign.id, campaignId))
        .limit(1)
      expect(campaign.audienceFilterId).toBe(filterId)
      expect(campaign.recipientSnapshotCount).toBe(1)
    })
  })
})
```

- [ ] **Step 2: Run the integration tests and verify failure**

Run:

```bash
rtk bun scripts/integration.ts --db-only oa-messaging-facade.int.test.ts
```

Expected: FAIL until Tasks 1 and 2 are implemented.

- [ ] **Step 3: Run the integration tests after Tasks 1-3**

Run:

```bash
rtk bun scripts/integration.ts --db-only oa-messaging-facade.int.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/services/oa-messaging-facade.int.test.ts
git commit -m "test: cover campaign-backed messaging api facade"
```

## Task 5: Final Verification

**Files:**
- No source changes.

- [ ] **Step 1: Run focused server tests**

Run:

```bash
rtk bun run --cwd apps/server test -- src/services/oa-campaign.test.ts src/services/oa-messaging-facade.test.ts src/plugins/oa-messaging.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run the server test suite**

Run:

```bash
rtk bun run --cwd apps/server test
```

Expected: PASS.

- [ ] **Step 3: Run repository checks**

Run:

```bash
rtk bun run check:all
```

Expected: PASS.

- [ ] **Step 4: Run focused DB integration coverage**

Run:

```bash
rtk bun scripts/integration.ts --db-only oa-messaging-facade.int.test.ts
```

Expected: PASS.

- [ ] **Step 5: Manual acceptance check**

Verify these conditions from the Phase 3B spec:

- `POST /api/oa/v2/bot/message/broadcast` creates a campaign with all-friends audience query.
- `POST /api/oa/v2/bot/message/multicast` creates a campaign with `providerUserId.$in`.
- `POST /api/oa/v2/bot/message/narrowcast` accepts supported audience references.
- `POST /api/oa/v2/bot/audienceGroup/upload` creates an `oaAudienceFilter`.
- `GET /api/oa/v2/bot/audienceGroup/{id}` returns LINE-shaped metadata for the filter.
- `GET /api/oa/v2/bot/insight/message/event?requestId=...` returns campaign delivery summary.
- Unsupported predicates return `400` with `UNSUPPORTED_AUDIENCE_FILTER`.
- Root `/v2/bot/message/narrowcast` returns `404`.

- [ ] **Step 6: Commit verification fixes after a concrete failure**

If verification produced a specific failing assertion and the fix touches source or tests, commit it:

```bash
git add apps/server
git commit -m "fix: stabilize messaging api campaign facade"
```

## Self-Review

- Spec coverage: broadcast, multicast, narrowcast, audience upload, audience metadata, insight lookup, retry-key passthrough, and unsupported-predicate rejection all have explicit tasks.
- Scope control: no manager UI, Zero schema, rich message composer, scheduling, automation, or root `/v2` route work is included.
- Type consistency: route methods call facade methods with `oaId`, `retryKey`, and raw `body`; facade methods call `sendExternalTextCampaign` with existing `oaCampaign` fields.
- Residual risk: changing broadcast and multicast to text-only campaign-backed sends may narrow earlier Messaging API behavior for non-text bulk sends. This is intentional for the Phase 3B supported subset, but it should be called out before execution if backwards compatibility for rich broadcast/multicast is required.
