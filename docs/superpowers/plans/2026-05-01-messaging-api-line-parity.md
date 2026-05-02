# Messaging API LINE Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the next Messaging API slice closer to LINE behavior by adding multicast on the same persistent/idempotent outbox path as broadcast, fixing quota counting semantics, documenting Vine-owned `/api/oa/v2` usage, and showing LINE-like endpoint/quota guidance in the developer console.

**Architecture:** Keep public bot APIs in `apps/server/src/plugins/oa-messaging.ts` and durable delivery behavior in `apps/server/src/services/oa-messaging.ts`. Use ConnectRPC only for authenticated developer-console management data. Keep outbox and retry-key internals as implementation/admin diagnostics, not the primary developer-console surface.

**Tech Stack:** Fastify REST, ConnectRPC, Drizzle/PostgreSQL, Bun, Vitest, One, Tamagui, React Query.

---

## Scope

This slice implements LINE-parity basics only:

- Add `POST /api/oa/v2/bot/message/multicast`.
- Make quota accounting count recipients, not message objects, matching LINE's "sent messages are counted by recipients" behavior.
- Add authenticated ConnectRPC quota summary for the developer console.
- Add a compact Messaging API guide section to the console with Vine URLs, supported send methods, retry-key rules, and curl examples.
- Add docs for Vine's Messaging API differences from LINE cloud.

Out of scope:

- Narrowcast.
- Audience management.
- Automatic webhook redelivery scheduler.
- Public request/delivery ledger views.
- Full end-to-end bot sandbox.

## Files

- Modify `apps/server/src/services/oa-messaging.ts`: add `multicast`, include it in retry-key/request hashing types, keep it on the existing `oaMessageRequest` / `oaMessageDelivery` / `oaRetryKey` durable path, and fix quota accounting.
- Modify `apps/server/src/services/oa-messaging.test.ts`: add unit coverage for LINE quota counting and multicast service shape.
- Modify `apps/server/src/services/oa-messaging.int.test.ts`: add focused DB integration coverage for accepted multicast requests with zero eligible recipients.
- Modify `apps/server/src/plugins/oa-messaging.ts`: add REST route and validation for `/bot/message/multicast`.
- Modify `apps/server/src/plugins/oa-messaging.test.ts`: add route coverage for multicast validation, auth, retry key pass-through, and namespace guardrail.
- Modify `packages/proto/proto/oa/v1/oa.proto`: add `GetMessagingApiQuotaSummary` request/response and service RPC.
- Run generated code update via `bun turbo proto:generate`.
- Modify `apps/server/src/connect/oa.ts`: implement authenticated quota summary handler.
- Create `apps/server/src/connect/oa-messaging-console.test.ts`: cover quota summary ownership behavior.
- Create `apps/web/app/(app)/developers/console/channel/[channelId]/MessagingApiGuideSection.tsx`: LINE-like endpoint and examples panel.
- Create `apps/web/app/(app)/developers/console/channel/[channelId]/MessagingApiQuotaSection.tsx`: quota/consumption display from ConnectRPC.
- Modify `apps/web/app/(app)/developers/console/channel/[channelId]/MessagingApiTab.tsx`: render quota and guide sections without exposing internal outbox details.
- Create `docs/messaging-api-vine.md`: developer-facing Vine Messaging API docs and explicit differences from LINE cloud.

---

## Task 1: Fix LINE-like Quota Accounting

**Files:**
- Modify: `apps/server/src/services/oa-messaging.ts`
- Modify: `apps/server/src/services/oa-messaging.test.ts`

- [ ] **Step 1: Write the failing unit test**

Add this test to the first `oa messaging request utilities` describe block in `apps/server/src/services/oa-messaging.test.ts` and add `calculateMessagingQuotaDelta` to the import list from `./oa-messaging`:

```ts
it('counts quota by recipient, not by message object', () => {
  expect(
    calculateMessagingQuotaDelta({
      recipientCount: 1,
      messageObjectCount: 5,
    }),
  ).toBe(1)
  expect(
    calculateMessagingQuotaDelta({
      recipientCount: 3,
      messageObjectCount: 2,
    }),
  ).toBe(3)
})
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
bun run --cwd apps/server test:unit -- src/services/oa-messaging.test.ts
```

Expected: FAIL because `calculateMessagingQuotaDelta` is not exported and quota uses `recipients.length * messages.length`.

- [ ] **Step 3: Add quota helper and fix quota counting**

In `apps/server/src/services/oa-messaging.ts`, add this exported helper near `createDeterministicMessageIds`:

```ts
export function calculateMessagingQuotaDelta(input: {
  recipientCount: number
  messageObjectCount: number
}): number {
  return input.recipientCount
}
```

Then change quota delta inside `acceptMessagingExecution`:

```ts
const quotaDelta = calculateMessagingQuotaDelta({
  recipientCount: recipients.length,
  messageObjectCount: input.messages.length,
})
```

- [ ] **Step 4: Run the focused test and verify it passes**

Run:

```bash
bun run --cwd apps/server test:unit -- src/services/oa-messaging.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/services/oa-messaging.ts apps/server/src/services/oa-messaging.test.ts
git commit -m "fix(oa): count messaging quota by recipient"
```

---

## Task 2: Add Multicast Service Behavior

**Files:**
- Modify: `apps/server/src/services/oa-messaging.ts`
- Modify: `apps/server/src/services/oa-messaging.test.ts`
- Modify: `apps/server/src/services/oa-messaging.int.test.ts`

- [ ] **Step 1: Add the failing service test**

Add these tests to `apps/server/src/services/oa-messaging.test.ts` and add `resolveMulticastRecipients`, `getInitialAcceptedRequestStatus`, and `createRequestHash` to the import list from `./oa-messaging` if they are not already imported:

```ts
describe('oa messaging multicast', () => {
  it('resolves only requested users who are current OA friends', async () => {
    const tx = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ userId: 'user-1' }, { userId: 'user-2' }]),
        }),
      }),
    } as any

    await expect(
      resolveMulticastRecipients(tx, {
        oaId: 'oa-1',
        userIds: ['user-1', 'user-2', 'blocked-user'],
      }),
    ).resolves.toEqual(['user-1', 'user-2'])
  })

  it('exposes multicast on the messaging service', () => {
    const service = createOAMessagingService({
      db: {} as any,
      instanceId: 'test',
      now: () => new Date('2026-05-01T00:00:00.000Z'),
    })

    expect(typeof service.multicast).toBe('function')
  })

  it('uses completed request status when no eligible recipients are resolved', () => {
    expect(getInitialAcceptedRequestStatus({ recipientCount: 0 })).toBe('completed')
    expect(getInitialAcceptedRequestStatus({ recipientCount: 1 })).toBe('processing')
  })

  it('keeps multicast retry-key hashes separate from push and broadcast', () => {
    const multicast = createRequestHash({
      endpoint: 'multicast',
      target: { to: ['user-1', 'user-2'] },
      messages: [{ type: 'text', text: 'hello' }],
    })

    expect(multicast).not.toBe(
      createRequestHash({
        endpoint: 'push',
        target: { to: 'user-1' },
        messages: [{ type: 'text', text: 'hello' }],
      }),
    )
    expect(multicast).not.toBe(
      createRequestHash({
        endpoint: 'broadcast',
        target: { audience: 'all_friends' },
        messages: [{ type: 'text', text: 'hello' }],
      }),
    )
  })
})
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
bun run --cwd apps/server test:unit -- src/services/oa-messaging.test.ts
```

Expected: FAIL because `resolveMulticastRecipients`, `getInitialAcceptedRequestStatus`, `createRequestHash({ endpoint: 'multicast', ... })`, and `multicast` are not defined or accepted yet.

- [ ] **Step 3: Extend request type and service method**

In `apps/server/src/services/oa-messaging.ts`, change:

```ts
export type SendRequestType = 'reply' | 'push' | 'broadcast'
```

to:

```ts
export type SendRequestType = 'reply' | 'push' | 'multicast' | 'broadcast'
```

Also update `createRequestHash` so its endpoint type accepts `multicast`:

```ts
export function createRequestHash(input: {
  endpoint: SendRequestType
  target: unknown
  messages: unknown[]
}): string {
  return createHash('sha256').update(stableJson(input)).digest('hex')
}
```

Add this exported helper near `createOAMessagingService`:

```ts
export async function resolveMulticastRecipients(
  tx: any,
  input: { oaId: string; userIds: string[] },
): Promise<string[]> {
  const friendships = await tx
    .select({ userId: oaFriendship.userId })
    .from(oaFriendship)
    .where(
      and(
        eq(oaFriendship.oaId, input.oaId),
        inArray(oaFriendship.userId, input.userIds),
        eq(oaFriendship.status, 'friend'),
      ),
    )
  return friendships.map((row: { userId: string }) => row.userId)
}
```

Add this exported helper near `calculateMessagingQuotaDelta`:

```ts
export function getInitialAcceptedRequestStatus(input: {
  recipientCount: number
}): 'processing' | 'completed' {
  return input.recipientCount === 0 ? 'completed' : 'processing'
}
```

Update `insertAcceptedRequest` to accept the initial status:

```ts
async function insertAcceptedRequest(
  tx: any,
  input: {
    oaId: string
    requestType: SendRequestType
    retryKey?: string
    requestHash: string
    acceptedRequestId: string
    messages: unknown[]
    target: unknown
    nowIso: string
    status: 'processing' | 'completed'
  },
) {
```

Inside the insert values, set:

```ts
status: input.status,
completedAt: input.status === 'completed' ? input.nowIso : null,
```

In `acceptMessagingExecution`, compute the initial status after recipients are
resolved and pass it into `insertAcceptedRequest`:

```ts
const initialStatus = getInitialAcceptedRequestStatus({
  recipientCount: recipients.length,
})
```

```ts
const request = await insertAcceptedRequest(tx, {
  oaId: input.oaId,
  requestType: input.requestType,
  retryKey: input.retryKey,
  requestHash: checked.requestHash,
  acceptedRequestId,
  messages: input.messages,
  target: input.target,
  nowIso,
  status: initialStatus,
})
```

Keep `createDeliveryRows()` after the request insert. It already does nothing
for an empty recipient list, so accepted zero-recipient requests become durable,
idempotent, and immediately completed with no delivery rows.

Add this method beside `push` and `broadcast`:

```ts
async function multicast(input: {
  oaId: string
  retryKey?: string
  to: string[]
  messages: NormalizedMessage[]
}) {
  const accepted = await acceptMessagingExecution({
    oaId: input.oaId,
    requestType: 'multicast',
    retryKey: input.retryKey,
    target: { to: input.to },
    messages: input.messages,
    resolveRecipients: async (tx) => {
      return resolveMulticastRecipients(tx, {
        oaId: input.oaId,
        userIds: input.to,
      })
    },
  })
  if (!accepted.ok) return accepted
  const processed = await processPendingDeliveries({
    batchSize: 25,
    staleAfterMs: 30_000,
  })
  return { ...accepted, processed }
}
```

Add `multicast` to the returned service object.

Multicast must keep using `acceptMessagingExecution()` and
`processPendingDeliveries()`. Do not insert chat messages directly in the REST
route or in a multicast-only shortcut; durable request rows, delivery rows,
retry-key rows, and deterministic message IDs are required for the same
persistent/idempotent behavior as broadcast.

- [ ] **Step 4: Run the focused test and verify it passes**

Run:

```bash
bun run --cwd apps/server test:unit -- src/services/oa-messaging.test.ts
```

Expected: PASS.

- [ ] **Step 5: Add zero-eligible durable acceptance integration coverage**

In `apps/server/src/services/oa-messaging.int.test.ts`, add a focused integration
test that:

- creates an OA quota row with enough monthly limit;
- calls `service.multicast()` with a retry key and only non-friend user IDs;
- asserts the result is accepted with `recipientCount: 0`;
- asserts one `oaMessageRequest` row exists with `requestType: 'multicast'`,
  `status: 'completed'`, and non-null `completedAt`;
- asserts one `oaRetryKey` row exists for the retry key;
- asserts no `oaMessageDelivery` rows exist for the accepted request.

Run:

```bash
docker compose up -d pgdb migrate
ZERO_UPSTREAM_DB=postgresql://user:password@localhost:5533/postgres bun run --cwd apps/server test:integration -- src/services/oa-messaging.int.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/services/oa-messaging.ts apps/server/src/services/oa-messaging.test.ts apps/server/src/services/oa-messaging.int.test.ts
git commit -m "feat(oa): add multicast delivery service"
```

---

## Task 3: Add Multicast REST Route

**Files:**
- Modify: `apps/server/src/plugins/oa-messaging.ts`
- Modify: `apps/server/src/plugins/oa-messaging.test.ts`

- [ ] **Step 1: Extend test app mock**

In `apps/server/src/plugins/oa-messaging.test.ts`, add `multicast` to `mockMessagingOverrides` and `mockMessaging`:

```ts
mockMessagingOverrides?: {
  reply?: ReturnType<typeof vi.fn>
  push?: ReturnType<typeof vi.fn>
  multicast?: ReturnType<typeof vi.fn>
  broadcast?: ReturnType<typeof vi.fn>
}
```

```ts
multicast:
  mockMessagingOverrides?.multicast ??
  vi.fn().mockResolvedValue({
    ok: true,
    accepted: { httpRequestId: 'req_multicast', acceptedRequestId: 'acc_multicast' },
    processed: { processed: 2 },
    recipientCount: 2,
  }),
```

- [ ] **Step 2: Add failing route tests**

Add this describe block:

```ts
describe('oaMessagingPlugin — Multicast Message', () => {
  it('does not register the root /v2 multicast route', async () => {
    const mockDb = makeMockDb([{ oaId, token: validToken, expiresAt: null }], [])
    const { app } = createTestApp(mockDb)
    await app.ready()

    const res = await app.inject({
      method: 'POST',
      url: '/v2/bot/message/multicast',
      headers: { authorization: `Bearer ${validToken}` },
      payload: { to: [userId], messages: [{ type: 'text', text: 'hello' }] },
    })

    await app.close()
    expect(res.statusCode).toBe(404)
  })

  it('passes validated multicast payload and retry key to the messaging service', async () => {
    const mockDb = makeMockDb([{ oaId, token: validToken, expiresAt: null }], [])
    const multicast = vi.fn().mockResolvedValue({
      ok: true,
      accepted: { httpRequestId: 'req_multicast', acceptedRequestId: 'acc_multicast' },
      processed: { processed: 1 },
      recipientCount: 1,
    })
    const { app } = createTestApp(mockDb, { multicast })
    await app.ready()

    const res = await app.inject({
      method: 'POST',
      url: oaApiPath('/bot/message/multicast'),
      headers: {
        authorization: `Bearer ${validToken}`,
        'x-line-retry-key': '123e4567-e89b-12d3-a456-426614174000',
      },
      payload: { to: [userId], messages: [{ type: 'text', text: 'hello' }] },
    })

    await app.close()
    expect(res.statusCode).toBe(200)
    expect(multicast).toHaveBeenCalledWith({
      oaId,
      retryKey: '123e4567-e89b-12d3-a456-426614174000',
      to: [userId],
      messages: [{ valid: true, type: 'text', text: 'hello', metadata: null }],
    })
  })

  it('returns 400 when multicast recipients are missing', async () => {
    const mockDb = makeMockDb([{ oaId, token: validToken, expiresAt: null }], [])
    const { app } = createTestApp(mockDb)
    await app.ready()

    const res = await app.inject({
      method: 'POST',
      url: oaApiPath('/bot/message/multicast'),
      headers: { authorization: `Bearer ${validToken}` },
      payload: { to: [], messages: [{ type: 'text', text: 'hello' }] },
    })

    await app.close()
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body).code).toBe('INVALID_REQUEST')
  })

  it('returns 400 when multicast has more than 500 recipients', async () => {
    const mockDb = makeMockDb([{ oaId, token: validToken, expiresAt: null }], [])
    const { app } = createTestApp(mockDb)
    await app.ready()

    const res = await app.inject({
      method: 'POST',
      url: oaApiPath('/bot/message/multicast'),
      headers: { authorization: `Bearer ${validToken}` },
      payload: {
        to: Array.from({ length: 501 }, (_, index) => `user-${index}`),
        messages: [{ type: 'text', text: 'hello' }],
      },
    })

    await app.close()
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body).code).toBe('INVALID_REQUEST')
  })

  it('returns 400 when multicast recipients contain duplicates', async () => {
    const mockDb = makeMockDb([{ oaId, token: validToken, expiresAt: null }], [])
    const { app } = createTestApp(mockDb)
    await app.ready()

    const res = await app.inject({
      method: 'POST',
      url: oaApiPath('/bot/message/multicast'),
      headers: { authorization: `Bearer ${validToken}` },
      payload: {
        to: [userId, userId],
        messages: [{ type: 'text', text: 'hello' }],
      },
    })

    await app.close()
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body).code).toBe('INVALID_REQUEST')
  })
})
```

- [ ] **Step 3: Run route tests and verify failure**

Run:

```bash
bun run --cwd apps/server test:unit -- src/plugins/oa-messaging.test.ts
```

Expected: FAIL because `/bot/message/multicast` is not registered.

- [ ] **Step 4: Implement multicast route**

In `apps/server/src/plugins/oa-messaging.ts`, add a route between push and broadcast:

```ts
fastify.post(
  oaApiPath('/bot/message/multicast'),
  async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const oaId = await extractOaFromToken(request, db)
      const body = request.body as { to: string[]; messages: MessageItem[] }

      if (!Array.isArray(body.to) || body.to.length === 0 || !body.messages?.length) {
        return await reply
          .code(400)
          .send({ message: 'to and messages are required', code: 'INVALID_REQUEST' })
      }
      if (body.to.length > 500) {
        return await reply.code(400).send({
          message: 'to must contain 500 or fewer user IDs',
          code: 'INVALID_REQUEST',
        })
      }
      if (new Set(body.to).size !== body.to.length) {
        return await reply.code(400).send({
          message: 'to must not contain duplicate user IDs',
          code: 'INVALID_REQUEST',
        })
      }

      const validated = body.messages.map((msg) => validateMessage(msg))
      const failed = validated.find((r) => !r.valid)
      if (failed && !failed.valid) {
        return await reply.code(400).send({
          message: failed.error,
          code: failed.code ?? 'INVALID_MESSAGE_TYPE',
        })
      }

      const validMessages = validated as ValidationSuccess[]
      const result = await messaging.multicast({
        oaId,
        retryKey: request.headers['x-line-retry-key'] as string | undefined,
        to: body.to,
        messages: validMessages,
      })
      return sendMessagingResult(reply, result)
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

- [ ] **Step 5: Run route tests and verify pass**

Run:

```bash
bun run --cwd apps/server test:unit -- src/plugins/oa-messaging.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/plugins/oa-messaging.ts apps/server/src/plugins/oa-messaging.test.ts
git commit -m "feat(oa): add multicast messaging route"
```

---

## Task 4: Add Console Quota Summary RPC

**Files:**
- Modify: `packages/proto/proto/oa/v1/oa.proto`
- Modify: `packages/proto/gen/oa/v1/oa_pb.ts`
- Modify: `apps/server/src/connect/oa.ts`
- Create: `apps/server/src/connect/oa-messaging-console.test.ts`

- [ ] **Step 1: Add proto messages and RPC**

In `packages/proto/proto/oa/v1/oa.proto`, add before `// ── Search ──`:

```protobuf
// ── Messaging API Console ──

message GetMessagingApiQuotaSummaryRequest {
  string official_account_id = 1;
}

message GetMessagingApiQuotaSummaryResponse {
  string type = 1;
  optional int32 monthly_limit = 2;
  int32 total_usage = 3;
}
```

Add the RPC after `RevokeAllAccessTokens`:

```protobuf
rpc GetMessagingApiQuotaSummary(GetMessagingApiQuotaSummaryRequest) returns (GetMessagingApiQuotaSummaryResponse);
```

- [ ] **Step 2: Generate proto code**

Run:

```bash
bun turbo proto:generate
```

Expected: generated `packages/proto/gen/oa/v1/oa_pb.ts` updates.

- [ ] **Step 3: Add failing connect test**

Create `apps/server/src/connect/oa-messaging-console.test.ts`:

```ts
import { Code, createContextValues } from '@connectrpc/connect'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { oaHandler } from './oa'
import { connectAuthDataKey } from './auth-context'

vi.mock('@take-out/better-auth-utils/server', () => ({
  getAuthDataFromRequest: vi.fn(),
}))

import { getAuthDataFromRequest } from '@take-out/better-auth-utils/server'
const mockedGetAuthDataFromRequest = vi.mocked(getAuthDataFromRequest)

function makeAuthCtx(userId: string) {
  const values = createContextValues()
  values.set(connectAuthDataKey, { id: userId } as any)
  return {
    values,
    signal: new AbortController().signal,
    timeoutMs: undefined,
    method: {} as any,
    service: {} as any,
    requestMethod: 'POST',
    url: new URL('http://localhost/'),
    peer: { addr: '127.0.0.1' },
    requestHeader: new Headers(),
    responseHeader: new Headers(),
    responseTrailer: new Headers(),
  } as any
}

function makeDeps(ownerId = 'user-1') {
  const capturedImpl: any = {}
  const router = {
    service: (_desc: any, impl: any) => Object.assign(capturedImpl, impl),
  }
  const oa = {
    getOfficialAccount: vi.fn().mockResolvedValue({ id: 'oa-1', providerId: 'provider-1' }),
    getProvider: vi.fn().mockResolvedValue({ id: 'provider-1', ownerId }),
    getQuota: vi.fn().mockResolvedValue({ type: 'limited', value: 1000, totalUsage: 25 }),
  }
  oaHandler({
    auth: {} as any,
    drive: {} as any,
    webhookDelivery: {} as any,
    oa: oa as any,
  })(router as any)
  return { capturedImpl, oa }
}

beforeEach(() => {
  mockedGetAuthDataFromRequest.mockReset()
})

describe('OA connect messaging console', () => {
  it('requires ownership before returning quota summary', async () => {
    const { capturedImpl } = makeDeps('user-1')
    mockedGetAuthDataFromRequest.mockResolvedValue({ id: 'user-1' } as any)

    const result = await capturedImpl.getMessagingApiQuotaSummary(
      { officialAccountId: 'oa-1' },
      makeAuthCtx('user-1'),
    )

    expect(result).toEqual({
      type: 'limited',
      monthlyLimit: 1000,
      totalUsage: 25,
    })
  })

  it('rejects quota summary for another provider owner', async () => {
    const { capturedImpl, oa } = makeDeps('other-user')
    mockedGetAuthDataFromRequest.mockResolvedValue({ id: 'user-1' } as any)

    await expect(
      capturedImpl.getMessagingApiQuotaSummary(
        { officialAccountId: 'oa-1' },
        makeAuthCtx('user-1'),
      ),
    ).rejects.toMatchObject({ code: Code.PermissionDenied })
    expect(oa.getQuota).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 4: Run the connect test and verify failure**

Run:

```bash
bun run --cwd apps/server test:unit -- src/connect/oa-messaging-console.test.ts
```

Expected: FAIL because `getMessagingApiQuotaSummary` is not implemented.

- [ ] **Step 5: Implement the handler**

In `apps/server/src/connect/oa.ts`, add to `oaServiceImpl` near access-token handlers:

```ts
async getMessagingApiQuotaSummary(req, ctx) {
  const auth = requireAuthData(ctx)
  await assertOfficialAccountOwnedByUser(deps, req.officialAccountId, auth.id)
  const quota = await deps.oa.getQuota(req.officialAccountId)
  return {
    type: quota.type,
    monthlyLimit: quota.value,
    totalUsage: quota.totalUsage,
  }
},
```

- [ ] **Step 6: Run the connect test and verify pass**

Run:

```bash
bun run --cwd apps/server test:unit -- src/connect/oa-messaging-console.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/proto/proto/oa/v1/oa.proto packages/proto/gen/oa/v1/oa_pb.ts apps/server/src/connect/oa.ts apps/server/src/connect/oa-messaging-console.test.ts
git commit -m "feat(oa): expose messaging quota summary"
```

---

## Task 5: Add LINE-like Console Guide and Quota Sections

**Files:**
- Create: `apps/web/app/(app)/developers/console/channel/[channelId]/MessagingApiGuideSection.tsx`
- Create: `apps/web/app/(app)/developers/console/channel/[channelId]/MessagingApiQuotaSection.tsx`
- Modify: `apps/web/app/(app)/developers/console/channel/[channelId]/MessagingApiTab.tsx`

- [ ] **Step 1: Create quota section**

Create `MessagingApiQuotaSection.tsx`:

```tsx
import { SizableText, XStack, YStack } from 'tamagui'

import { oaClient } from '~/features/oa/client'
import { useTanQuery } from '~/query'

export function MessagingApiQuotaSection({ channelId }: { channelId: string }) {
  const { data, isLoading } = useTanQuery({
    queryKey: ['oa', 'messaging-api-quota', channelId],
    queryFn: () => oaClient.getMessagingApiQuotaSummary({ officialAccountId: channelId }),
    enabled: !!channelId,
  })

  const limit =
    data?.type === 'limited' && data.monthlyLimit !== undefined
      ? data.monthlyLimit.toLocaleString()
      : 'Unlimited'

  return (
    <YStack gap="$3" p="$4" borderWidth={1} borderColor="$borderColor" rounded="$2">
      <SizableText size="$5" fontWeight="700" color="$color12">
        Message quota
      </SizableText>
      <XStack gap="$4" flexWrap="wrap">
        <YStack minW={160}>
          <SizableText size="$2" color="$color10">
            Monthly limit
          </SizableText>
          <SizableText size="$4" color="$color12" fontWeight="700">
            {isLoading ? 'Loading' : limit}
          </SizableText>
        </YStack>
        <YStack minW={160}>
          <SizableText size="$2" color="$color10">
            Used this month
          </SizableText>
          <SizableText size="$4" color="$color12" fontWeight="700">
            {isLoading ? 'Loading' : (data?.totalUsage ?? 0).toLocaleString()}
          </SizableText>
        </YStack>
      </XStack>
    </YStack>
  )
}
```

- [ ] **Step 2: Create guide section**

Create `MessagingApiGuideSection.tsx`:

```tsx
import { SizableText, YStack } from 'tamagui'

const basePath = '/api/oa/v2'
const curlBaseUrl = `${globalThis.location?.origin ?? ''}${basePath}`
const curlExample = `curl -X POST ${curlBaseUrl}/bot/message/push \\
  -H 'Content-Type: application/json' \\
  -H 'Authorization: Bearer {channel access token}' \\
  -H 'X-Line-Retry-Key: 123e4567-e89b-12d3-a456-426614174000' \\
  -d '{"to":"{userId}","messages":[{"type":"text","text":"Hello from Vine"}]}'`

export function MessagingApiGuideSection() {
  return (
    <YStack gap="$3" p="$4" borderWidth={1} borderColor="$borderColor" rounded="$2">
      <SizableText size="$5" fontWeight="700" color="$color12">
        Messaging API endpoint
      </SizableText>
      <SizableText size="$2" color="$color10">
        Vine uses its own LINE-like endpoint namespace. Use Vine-issued access tokens
        with this server, not LINE Developers channel tokens.
      </SizableText>
      <SizableText size="$3" color="$color12" fontFamily="$mono">
        {basePath}
      </SizableText>
      <SizableText size="$2" color="$color10">
        Supported send methods: reply, push, multicast, broadcast. Retry keys are
        supported for push, multicast, and broadcast.
      </SizableText>
      <YStack bg="$color2" p="$3" rounded="$2">
        <SizableText size="$2" color="$color12" fontFamily="$mono">
          {curlExample}
        </SizableText>
      </YStack>
    </YStack>
  )
}
```

- [ ] **Step 3: Render the sections**

Modify `MessagingApiTab.tsx`:

```tsx
import { MessagingApiGuideSection } from './MessagingApiGuideSection'
import { MessagingApiQuotaSection } from './MessagingApiQuotaSection'
import { TestWebhookSection } from './TestWebhookSection'
import { WebhookErrorsSection } from './WebhookErrorsSection'
import { WebhookSettingsSection } from './WebhookSettingsSection'

export function MessagingApiTab({ channelId }: { channelId: string }) {
  return (
    <YStack gap="$6">
      <MessagingApiGuideSection />
      <MessagingApiQuotaSection channelId={channelId} />
      <WebhookSettingsSection channelId={channelId} />
      <WebhookErrorsSection channelId={channelId} />
      <TestWebhookSection channelId={channelId} />
    </YStack>
  )
}
```

- [ ] **Step 4: Run web typecheck**

Run:

```bash
bun run --cwd apps/web typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add 'apps/web/app/(app)/developers/console/channel/[channelId]/MessagingApiGuideSection.tsx' 'apps/web/app/(app)/developers/console/channel/[channelId]/MessagingApiQuotaSection.tsx' 'apps/web/app/(app)/developers/console/channel/[channelId]/MessagingApiTab.tsx'
git commit -m "feat(web): show messaging api parity guidance"
```

---

## Task 6: Add Developer-Facing Messaging API Docs

**Files:**
- Create: `docs/messaging-api-vine.md`

- [ ] **Step 1: Create the docs page**

Create `docs/messaging-api-vine.md`:

````md
# Vine Messaging API

Vine exposes a LINE-like Messaging API for Vine Official Accounts under:

```text
/api/oa/v2
```

Vine is not the official LINE platform. Do not use LINE Developers channel IDs,
LINE channel access tokens, or `https://api.line.me` for normal Vine behavior.

## Supported Send APIs

| Method | Endpoint | Retry key |
| --- | --- | --- |
| Reply | `POST /api/oa/v2/bot/message/reply` | No |
| Push | `POST /api/oa/v2/bot/message/push` | Yes |
| Multicast | `POST /api/oa/v2/bot/message/multicast` | Yes |
| Broadcast | `POST /api/oa/v2/bot/message/broadcast` | Yes |

`X-Line-Retry-Key` follows LINE-like semantics for supported send APIs:

- use a UUID retry key on the first request;
- retry the same request body with the same key within 24 hours;
- accepted duplicate retries return `409` with `x-line-accepted-request-id`;
- reply requests reject retry keys.

Multicast accepts up to 500 user IDs in the `to` array. Users who are not
current friends of the Official Account are excluded from delivery. If no users
are eligible, Vine accepts and completes the request without creating delivery
rows.

## Example: Push Message

```sh
curl -X POST http://localhost:3001/api/oa/v2/bot/message/push \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer {vine_oa_access_token}' \
  -H 'X-Line-Retry-Key: 123e4567-e89b-12d3-a456-426614174000' \
  -d '{
    "to": "{vine_user_id}",
    "messages": [
      { "type": "text", "text": "Hello from Vine" }
    ]
  }'
```

## Example: Multicast Message

```sh
curl -X POST http://localhost:3001/api/oa/v2/bot/message/multicast \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer {vine_oa_access_token}' \
  -H 'X-Line-Retry-Key: 123e4567-e89b-12d3-a456-426614174000' \
  -d '{
    "to": ["{vine_user_id_1}", "{vine_user_id_2}"],
    "messages": [
      { "type": "text", "text": "Hello from Vine" }
    ]
  }'
```

## Message Types

The current Vine baseline accepts text, sticker, image, audio, video, location,
template, imagemap, flex, and quick reply metadata. Rendering parity varies by
client surface and should be checked in a real Vine chat.

## Quota Semantics

Vine counts sent message usage by recipient, not by the number of message
objects in a request. A push request containing five message objects to one
user counts as one usage unit.

## Differences From Official LINE Cloud

- Vine uses `/api/oa/v2`, not `https://api.line.me/v2`.
- Vine access tokens are issued by the Vine developer console.
- Vine does not require LINE Developers Console channels.
- Vine does not implement narrowcast in this phase.
- Vine webhook and message delivery are backed by Vine-owned PostgreSQL state.
````

- [ ] **Step 2: Verify docs are linked from roadmap references**

Add `docs/messaging-api-vine.md` to the References section of `ROADMAP.md`.

- [ ] **Step 3: Run markdown diff check**

Run:

```bash
git diff --check -- docs/messaging-api-vine.md ROADMAP.md
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add docs/messaging-api-vine.md ROADMAP.md
git commit -m "docs(oa): document Vine messaging api"
```

---

## Task 7: Final Verification

**Files:**
- No source edits unless verification exposes failures.

- [ ] **Step 1: Run focused server unit tests**

Run:

```bash
bun run --cwd apps/server test:unit -- src/services/oa-messaging.test.ts src/plugins/oa-messaging.test.ts src/connect/oa-messaging-console.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run focused server integration test**

Run:

```bash
docker compose up -d pgdb migrate
ZERO_UPSTREAM_DB=postgresql://user:password@localhost:5533/postgres bun run --cwd apps/server test:integration -- src/services/oa-messaging.int.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run web typecheck**

Run:

```bash
bun run --cwd apps/web typecheck
```

Expected: PASS.

- [ ] **Step 4: Run server typecheck**

Run:

```bash
bun run --cwd apps/server typecheck
```

Expected: PASS.

- [ ] **Step 5: Run repo check if time allows**

Run:

```bash
bun run check:all
```

Expected: PASS.

- [ ] **Step 6: Commit verification fixes only if needed**

If verification requires fixes, stage only the files changed by those fixes. If no fixes are needed, do not create an empty commit.

---

## Self-Review Checklist

- LINE-like send methods include reply, push, multicast, and broadcast.
- Retry keys remain unsupported for reply and supported for push, multicast, and broadcast.
- Quota counting is by recipient, not message object count.
- Multicast uses the same durable request/delivery/retry-key path as broadcast.
- Multicast rejects more than 500 requested recipients.
- Multicast rejects duplicate requested recipients before service execution.
- Multicast accepts zero eligible recipients and completes the accepted request without delivery rows.
- The console surfaces endpoint guidance and quota, not internal outbox ledgers.
- No root `/v2/...` routes are registered.
- No LINE cloud calls or LINE Developers Console dependency is introduced.
- Raw `fetch()` is not used for normal developer-console data; ConnectRPC is wrapped in React Query.
- Narrowcast and audience management remain out of scope.
