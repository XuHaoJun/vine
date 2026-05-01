# Messaging API v1 Design

## Summary

Messaging API v1 turns Vine Official Accounts into a durable, LINE-like bot
messaging surface while keeping the implementation Vine-native. External bot
developers call REST endpoints with LINE-like request and response shapes.
Internally, Vine uses PostgreSQL for request idempotency, durable delivery work,
chat/message writes, and crash recovery. Zero remains the real-time sync layer
that delivers chat updates to clients.

Vine is not the official LINE platform. This design does not call LINE-hosted
`api.line.me`, does not require LINE Developers Console channels, and does not
implement real LINE cloud integration.

## Goals

- Provide a first reliable Vine-owned Messaging API for Official Accounts.
- Support `reply`, `push`, and `broadcast` message sends.
- Support message types already represented in Vine: text, sticker, image,
  location, imagemap, and flex.
- Follow LINE retry-key semantics where applicable.
- Make broadcast crash-safe and idempotent through PostgreSQL state.
- Use `/api/oa/v2` as the single public OA API namespace.
- Keep the REST route layer thin and move business behavior into Vine-native
  services.

## Non-Goals

- No RabbitMQ or external broker in v1.
- No root `/v2/...` public routes and no legacy aliases.
- No narrowcast, audience management, or large-campaign segmentation.
- No production-grade async broadcast product with progress UI.
- No Playwright coverage unless a developer-console UI is changed.
- No official LINE cloud dependency.

## Public API Namespace

Vine does not have a separate public Messaging API domain, so public OA APIs use
this canonical base path:

```text
/api/oa/v2
```

All public OA Messaging API routes must live under that base:

```text
POST /api/oa/v2/bot/message/reply
POST /api/oa/v2/bot/message/push
POST /api/oa/v2/bot/message/broadcast

GET  /api/oa/v2/bot/message/quota
GET  /api/oa/v2/bot/message/quota/consumption

PUT  /api/oa/v2/bot/channel/webhook/endpoint
GET  /api/oa/v2/bot/channel/webhook/endpoint
POST /api/oa/v2/bot/channel/webhook/test

POST /api/oa/v2/oauth/accessToken
POST /api/oa/v2/oauth/revoke
```

Existing root-level `/v2/bot/...` routes should move under `/api/oa/v2/...`.
Do not add aliases. Route plugins and tests should define a shared route
constant, such as `OA_API_BASE = '/api/oa/v2'`, with comments explaining that
new public OA API endpoints must not be mounted at root `/v2`.

## Architecture

```text
Fastify REST route under /api/oa/v2
  -> thin HTTP translation layer
  -> Vine-native OA messaging service
  -> PostgreSQL durable request/delivery ledger
  -> PostgreSQL chat/message writes
  -> Zero syncs chat/message rows to clients
```

The REST plugin should parse headers and bodies, call a service, and map service
results to HTTP status, body, and headers. Business behavior should not stay
embedded in route handlers.

Relevant existing foundations:

- `apps/server/src/plugins/oa-messaging.ts`
- `apps/server/src/plugins/oa-webhook-endpoint.ts`
- `apps/server/src/plugins/oa-richmenu.ts`
- `apps/server/src/services/oa.ts`
- `packages/db/src/schema-oa.ts`
- `packages/db/src/schema-public.ts`
- `packages/zero-schema/src/models/message.ts`

## Retry-Key Semantics

Vine follows LINE retry-key behavior:

- `reply` does not support `X-Line-Retry-Key`.
- If `reply` receives `X-Line-Retry-Key`, return `400`.
- `reply` reliability comes from single-use `replyToken`.
- `push` supports `X-Line-Retry-Key`; it is recommended but not required.
- `broadcast` supports `X-Line-Retry-Key`; it is recommended but not required.
- Duplicate accepted retry key returns `409 Conflict`.
- `409` responses include `x-line-accepted-request-id`.
- Retry-key retention is 24 hours.
- Same retry key with a different normalized request body returns conflict.
- Requests without retry key are accepted, but client retries cannot be
  deduplicated across separate HTTP attempts. This matches LINE behavior.

Every attempted send request should return:

```text
x-line-request-id: <request id for this HTTP attempt>
```

Duplicate accepted retry key:

```text
HTTP 409
x-line-request-id: <new request id for this retry attempt>
x-line-accepted-request-id: <accepted request id from the original request>

{
  "message": "The retry key is already accepted"
}
```

## Data Model

These tables are operational server state and should live in
`packages/db/src/schema-oa.ts`. They should not be added to Zero.

### `oaMessageRequest`

One row per accepted Messaging API send request.

```text
id                  uuid primary key
oaId                uuid not null
requestType          text not null    # reply | push | broadcast
retryKey             text nullable     # push/broadcast only
requestHash          text not null
acceptedRequestId    text not null
status               text not null     # accepted | processing | completed | failed | partially_failed
messagesJson         jsonb not null
targetJson           jsonb nullable
errorCode            text nullable
errorMessage         text nullable
createdAt            timestamp not null
updatedAt            timestamp not null
completedAt          timestamp nullable
expiresAt            timestamp nullable
```

Indexes:

```text
index (oaId, requestType, createdAt)
unique (acceptedRequestId)
```

`requestHash` is computed from a normalized representation of the request
method, endpoint identity, target, and message payload. This detects retry-key
reuse with different content.

### `oaMessageDelivery`

One row per recipient delivery unit. `reply` and `push` create one delivery.
`broadcast` creates one delivery per recipient.

```text
id                  uuid primary key
requestId            uuid not null references oaMessageRequest(id)
oaId                uuid not null
userId              text not null
chatId              text nullable
status              text not null      # pending | processing | delivered | failed
messageIdsJson       jsonb not null
attemptCount         integer not null default 0
lastErrorCode        text nullable
lastErrorMessage     text nullable
lockedAt             timestamp nullable
lockedBy             text nullable
createdAt            timestamp not null
updatedAt            timestamp not null
deliveredAt          timestamp nullable
```

Indexes and constraints:

```text
unique (requestId, userId)
index (status, lockedAt)
index (oaId, userId)
```

Deterministic message IDs are required:

```text
oa:req:<requestId>:<userId>:<messageIndex>
```

The exact encoding can be shorter. The important property is that message IDs
are deterministic from request, recipient, and message index. If a server
crashes after message insert but before marking delivery delivered, recovery
attempts the same message IDs and cannot create duplicate chat messages.

### `oaRetryKey`

Use a separate active retry-key table for clean 24-hour retention.

```text
id                  uuid primary key
oaId                uuid not null
retryKey             text not null
requestId            uuid not null references oaMessageRequest(id)
requestHash          text not null
acceptedRequestId    text not null
expiresAt            timestamp not null
createdAt            timestamp not null
```

Constraint:

```text
unique (oaId, retryKey)
```

Expired rows can be cleaned up without deleting `oaMessageRequest` audit rows.
After cleanup, reuse of the same key can be accepted, matching the LINE 24-hour
retention model.

### Future `oaWebhookDelivery`

Webhook event logs and manual redelivery are in v1 scope, but can be a second
slice after send reliability:

```text
oaWebhookDelivery
  id
  oaId
  eventId
  payloadJson
  status: pending | delivered | failed
  attemptCount
  responseStatus
  lastError
  createdAt
  deliveredAt
```

It should use the same PostgreSQL-backed `FOR UPDATE SKIP LOCKED` pattern.

## Request Flows

### Shared Pipeline

All send endpoints use this internal pipeline:

1. Authenticate OA access token.
2. Validate route-specific request body.
3. Normalize request and compute `requestHash`.
4. Create or resolve `oaMessageRequest`.
5. Create `oaMessageDelivery` rows.
6. Process delivery rows.
7. Return LINE-like HTTP response.

Request acceptance is the committed `oaMessageRequest` plus any active
`oaRetryKey` row. After that point, retry-key semantics apply even if delivery
later fails.

### Reply

```text
POST /api/oa/v2/bot/message/reply
```

Flow:

1. Reject `X-Line-Retry-Key` with `400`.
2. Validate `replyToken` and `messages`.
3. Resolve reply token.
4. In one transaction:
   - create `oaMessageRequest`
   - create one `oaMessageDelivery`
   - mark reply token used
5. Process delivery.
6. Return `{}` if accepted.

If delivery fails after reply token is marked used, the request remains
recoverable through the delivery ledger. The same reply token cannot be
submitted again.

### Push

```text
POST /api/oa/v2/bot/message/push
```

Flow:

1. Validate `to` and `messages`.
2. Validate message objects.
3. If `X-Line-Retry-Key` exists, resolve or create active retry-key state.
4. Confirm `to` is an OA friend.
5. Check and increment quota.
6. Create one `oaMessageDelivery`.
7. Process delivery.
8. Return response.

If the same retry key was already accepted with the same hash, return `409`.
If it was used with a different hash, return conflict.

### Broadcast

```text
POST /api/oa/v2/bot/message/broadcast
```

Flow:

1. Validate `messages`.
2. If `X-Line-Retry-Key` exists, resolve or create active retry-key state.
3. Snapshot recipients from `oaFriendship` where `status = 'friend'`.
4. Check and increment quota based on recipient count.
5. Create one `oaMessageDelivery` per recipient.
6. Process pending delivery rows.
7. Return response with request id or accepted id.

Recipient snapshot happens once per accepted request. A retry with the same
accepted retry key must not re-query friendships and add new recipients.

## Delivery Processing

V1 uses a PostgreSQL-backed durable outbox, not RabbitMQ.

Delivery claiming uses:

```sql
SELECT ...
FROM oaMessageDelivery
WHERE status IN ('pending', 'processing')
  AND (lockedAt IS NULL OR lockedAt < $staleThreshold)
ORDER BY createdAt
LIMIT $batchSize
FOR UPDATE SKIP LOCKED
```

For each claimed delivery:

1. Set `status = 'processing'`, `lockedAt = now`, `lockedBy = instanceId`,
   increment `attemptCount`.
2. Find or create the OA chat for `oaId + userId`.
3. Insert deterministic `message` rows.
4. Update `chat.lastMessageId` and `chat.lastMessageAt`.
5. Mark delivery `delivered`.

If a deterministic message ID already exists for this request/delivery, treat it
as success for that message. Do not create a second message row.

Delivery processing can be called from:

- the HTTP request path after request creation
- startup recovery
- a lightweight periodic interval owned by the server entrypoint
- a future worker process

Follow Vine server patterns: pass dependencies explicitly and avoid module-level
singletons.

## Request Status

`oaMessageRequest.status` is updated from delivery state:

```text
accepted          request row exists, deliveries not yet created
processing        at least one delivery is pending or processing
completed         all deliveries delivered
partially_failed  delivered + failed mix
failed            all deliveries failed or request-level accepted failure
```

The retry-key acceptance point is independent from final delivery success.
Retry keys prevent duplicate execution; they do not guarantee final delivery.

## Quota

Quota counts accepted execution, not duplicate retry attempts.

Rules:

- Duplicate retry-key request returning `409` does not increment quota.
- `quotaDelta = deliveryCount * messages.length`.
- `push` has one delivery.
- `broadcast` has one delivery per snapshotted recipient.
- `reply` can count accepted messages unless product later chooses free replies.
- Quota check and increment must be atomic.

Existing `checkAndIncrementUsage(oaId, delta)` is the right shape for this. Use
`delta = recipientCount * messages.length`.

If quota is insufficient:

- return `429 QUOTA_EXCEEDED`
- do not create delivery rows
- do not mark retry key as accepted
- allow retry later

## Error Mapping

Authentication:

```text
401 INVALID_TOKEN     missing or invalid Bearer token
401 TOKEN_EXPIRED     expired token
```

Validation:

```text
400 INVALID_REQUEST       missing required fields
400 INVALID_MESSAGE_TYPE  unsupported or invalid message object
400 INVALID_RETRY_KEY     retry key present on unsupported endpoint or invalid format
409 RETRY_KEY_CONFLICT    retry key already accepted or reused with different body
```

Recipient state:

```text
403 NOT_FRIEND           push target is not OA friend
400 INVALID_REPLY_TOKEN  reply token missing, expired, used, or not found
```

Processing:

```text
500 INTERNAL_ERROR  unexpected failure before durable acceptance
202 ACCEPTED        request accepted but delivery still processing
```

If a failure happens after durable acceptance, retry-key semantics apply and the
request must be recoverable from database state.

## Testing

Server unit tests:

- route namespace uses `/api/oa/v2`
- root `/v2/...` routes are not registered
- reply rejects `X-Line-Retry-Key`
- push and broadcast accept `X-Line-Retry-Key`
- duplicate accepted retry key returns `409`
- same retry key with different body returns conflict
- `x-line-request-id` and `x-line-accepted-request-id` headers are set
- invalid message types are rejected
- quota is not incremented for duplicate retry-key attempts
- broadcast quota uses `recipientCount * messages.length`

Server DB integration tests:

- active retry-key uniqueness and expiry cleanup behavior
- `FOR UPDATE SKIP LOCKED` does not double-claim delivery rows
- deterministic message IDs prevent duplicates after simulated crash
- broadcast recipient snapshot does not change on retry
- stale `processing` deliveries can be recovered and delivered

No Playwright is needed for the backend-only slice.

## Implementation Notes

- Prefer extracting a dedicated OA messaging service from
  `apps/server/src/plugins/oa-messaging.ts`.
- Keep REST plugins as HTTP adapters.
- Add comments near OA route constants explaining the `/api/oa/v2` namespace.
- Keep operational tables in `schema-oa.ts`; do not add them to Zero.
- Chat/message writes still target `chat`, `chatMember`, and `message` in
  `schema-public.ts`, so Zero clients receive updates through the existing sync
  path.
- Do not introduce RabbitMQ unless later throughput and operational needs justify
  the added complexity.

## Final V1 Decisions

- Reply messages count against monthly quota in v1. This keeps quota accounting
  simple and consistent across all accepted message sends.
- Delivery processing should run for a bounded in-request budget. If delivery is
  still pending after that budget, return `202 Accepted` with the accepted
  request id and let recovery/periodic processing finish the remaining rows.
- Duplicate accepted push retry responses should include `sentMessages` when the
  original delivery has deterministic message IDs available. If delivery is
  still pending, return the `409` headers and omit `sentMessages`.
