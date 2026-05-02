# Messaging API LINE Parity Design

## Summary

This phase moves Vine's Official Account Messaging API closer to a recognizable
LINE Developers Messaging API channel while keeping all behavior Vine-owned and
self-hostable. It adds the next missing send method, fixes quota semantics to
match LINE's recipient-count model, exposes a small authenticated quota summary
for the developer console, and adds developer-facing endpoint guidance and docs.

Vine is not the official LINE platform. This design does not call LINE-hosted
`api.line.me`, does not require LINE Developers Console channels, and does not
implement real LINE cloud integration. LINE behavior is used as the product
shape Vine should clone.

## Context

The current Messaging API baseline already provides:

- `/api/oa/v2` as Vine's public OA REST namespace.
- Access-token authentication for OA API calls.
- `reply`, `push`, and `broadcast` send APIs.
- LINE-like retry-key handling for push and broadcast.
- Durable PostgreSQL request, delivery, and retry-key ledgers.
- Webhook settings, webhook error visibility, manual redelivery, and diagnostic
  webhook test tools in the developer console.
- Message content upload and retrieval routes for image, video, and audio.

The updated roadmap now favors pure LINE-clone parity over Vine-only operator
surfaces. This means the next slice should improve public API behavior, console
guidance, docs, and chat-visible developer workflows before exposing internal
outbox or worker details.

## Goals

- Add LINE-like multicast send support under Vine's `/api/oa/v2` namespace.
- Keep root `/v2/...` routes unregistered.
- Support `X-Line-Retry-Key` for multicast, matching push and broadcast.
- Fix message quota accounting so usage is counted by recipient, not by the
  number of message objects in one request.
- Add an authenticated developer-console quota summary through ConnectRPC.
- Add a Messaging API console guide section that shows Vine's base endpoint,
  supported send methods, retry-key rules, and a compact curl example.
- Add a developer-facing `docs/messaging-api-vine.md` page that explains Vine's
  Messaging API and explicit differences from official LINE cloud.

## Non-Goals

- No narrowcast.
- No audience upload or audience management.
- No full end-to-end bot sandbox.
- No public or primary developer-console view for accepted request rows,
  delivery rows, retry-key rows, or worker recovery internals.
- No automatic webhook redelivery scheduler.
- No LINE cloud calls, LINE Developers Console dependency, or `api.line.me`
  integration.

## LINE-Parity Behavior

### Send Methods

Vine should support these LINE-like send methods in this slice:

```text
POST /api/oa/v2/bot/message/reply
POST /api/oa/v2/bot/message/push
POST /api/oa/v2/bot/message/multicast
POST /api/oa/v2/bot/message/broadcast
```

`reply` remains tied to a single-use `replyToken` and must continue rejecting
`X-Line-Retry-Key`. `push`, `multicast`, and `broadcast` support retry keys.

### Multicast

`multicast` accepts a `to` array of Vine user IDs plus up to the same message
payload shape accepted by the existing send APIs. Vine should resolve only users
who are current friends of the OA. Recipients that are not friends are excluded
from delivery rather than creating visible chat messages.

The `to` array is capped at 500 user IDs per request. This keeps the first
multicast slice close to LINE's familiar API shape and prevents accidental large
requests before audience/narrowcast primitives exist.

For this phase, multicast does not introduce audience objects, demographic
filters, redelivery objects, or narrowcast-style progress APIs.

### Retry Keys

Multicast should use the existing retry-key ledger and hashing behavior:

- Retry key shape is a UUID.
- Retry key retention is 24 hours.
- Duplicate accepted retry keys return `409`.
- Duplicate accepted retry responses include `x-line-accepted-request-id`.
- Same retry key with different normalized request content returns conflict.

The normalized request hash must include the endpoint identity `multicast`, the
recipient array, and the message payload so multicast retries cannot collide
with push or broadcast retries.

Multicast must use the same durable outbox path as broadcast. An accepted
multicast request creates an `oaMessageRequest` row, one `oaMessageDelivery`
row per eligible recipient, and an `oaRetryKey` row when a retry key is present.
Delivery processing must use deterministic message IDs, so crash recovery and
retry processing cannot duplicate visible chat messages.

If a multicast request is accepted but resolves zero eligible friend recipients,
Vine still records the accepted `oaMessageRequest` and retry-key state when
provided, creates no delivery rows, and marks the request completed immediately.
This mirrors the LINE-like behavior that unavailable recipients are excluded
without inventing a new public error for this slice.

### Quota Counting

LINE counts sent messages by the number of recipients, not by the number of
message objects in a request. Vine should follow that rule:

- One push to one user with five message objects counts as one usage unit.
- One multicast to three eligible friends counts as three usage units.
- One broadcast to one hundred friends counts as one hundred usage units.

This phase does not add paid plan management. Existing `oaQuota` state remains
the server source of truth for monthly limit and current usage.

## Architecture

### Public REST Layer

`apps/server/src/plugins/oa-messaging.ts` remains the HTTP adapter for public
bot APIs. The new multicast route should follow the existing push and broadcast
route pattern:

```text
Fastify route under /api/oa/v2
  -> access token extraction
  -> body validation
  -> message validation
  -> createOAMessagingService.multicast()
  -> LINE-like HTTP response mapping
```

The route layer should stay thin. Recipient resolution, request acceptance,
retry-key handling, quota reservation, delivery rows, and message insertion
belong in `apps/server/src/services/oa-messaging.ts`.

### Messaging Service

`apps/server/src/services/oa-messaging.ts` should add:

- `SendRequestType` support for `multicast`.
- A small quota-delta helper that documents recipient-count semantics.
- A multicast recipient resolver that selects friend rows for the requested
  user IDs.
- `multicast()` using the existing `acceptMessagingExecution()` path.

This keeps push, multicast, and broadcast on the same persistent and idempotent
request path. Multicast must not insert chat messages directly from the HTTP
route or bypass `oaMessageRequest`, `oaMessageDelivery`, `oaRetryKey`, and
`processPendingDeliveries()`.

### Developer Console Data

The developer console should not call public OA bot REST routes with an OA
access token. It should use authenticated ConnectRPC, following existing Vine
patterns.

Add one management RPC:

```text
GetMessagingApiQuotaSummary(official_account_id)
  -> type
  -> monthly_limit
  -> total_usage
```

The handler must verify the logged-in user owns the OA's provider before
returning quota data.

### Developer Console UI

The Messaging API tab should become more LINE-like without exposing internal
worker state as the primary product surface. Add two compact sections above the
existing webhook sections:

- Messaging API endpoint guide: base path, supported send methods, retry-key
  rule summary, and a curl example using Vine-issued access tokens.
- Message quota: monthly limit and usage for the current month.

Use React Query around the ConnectRPC client. Do not use raw `fetch()` for this
console data.

### Documentation

Add `docs/messaging-api-vine.md` for bot developers. It should document:

- Vine base path `/api/oa/v2`.
- Supported send APIs and retry-key support.
- Push and multicast curl examples.
- Message type baseline.
- Recipient-count quota semantics.
- Differences from official LINE cloud.

## Data Model

No schema migration is required for this slice.

Existing state is reused:

- `oaFriendship` filters multicast recipients to current friends.
- `oaMessageRequest` stores accepted send requests.
- `oaMessageDelivery` stores one delivery row per eligible recipient.
- `oaRetryKey` stores retry-key acceptance state.
- `oaQuota` stores monthly limit and current usage.

The existing `oaMessageRequest.requestType` column is text, so adding the
literal value `multicast` does not require a SQL migration.

## Error Handling

- Missing or invalid access token returns the existing `401` token errors.
- Missing `to` or empty `to` on multicast returns `400 INVALID_REQUEST`.
- More than 500 multicast recipients returns `400 INVALID_REQUEST`.
- Missing messages returns `400 INVALID_REQUEST`.
- Invalid message objects return the existing validation error shape.
- Unsupported retry-key shape returns the existing retry-key error shape.
- Root `/v2/bot/message/multicast` returns `404`.
- Console quota summary for a non-owned OA returns Connect
  `PermissionDenied`.

## Testing

Server unit tests should cover:

- Recipient-count quota helper.
- Multicast recipient resolution filters to current friends.
- Accepted multicast with zero eligible recipients completes without delivery
  rows.
- Multicast service method is exposed.
- Public multicast route validation.
- Multicast recipient count cap.
- Multicast retry-key pass-through.
- Root `/v2` multicast route remains unregistered.
- Console quota summary ownership check.

Web verification should use typecheck for this slice. A Playwright test is not
required unless implementation changes route navigation or seeded console data
becomes stable enough to make the smoke test reliable.

## Acceptance Criteria

- `POST /api/oa/v2/bot/message/multicast` accepts a valid Vine OA access token,
  `to` array, message array, and optional `X-Line-Retry-Key`.
- `/v2/bot/message/multicast` is not registered.
- Retry-key behavior for multicast follows the same LINE-like semantics as push
  and broadcast.
- Multicast uses the same durable outbox and idempotency path as broadcast:
  `oaMessageRequest`, `oaMessageDelivery`, retry-key state when present, and
  deterministic message IDs.
- Quota usage increments by eligible recipient count, not by message object
  count.
- Multicast rejects more than 500 requested recipients with `400 INVALID_REQUEST`.
- Multicast requests with zero eligible friend recipients are accepted,
  persisted, and completed with no delivery rows.
- The developer console Messaging API tab shows Vine endpoint guidance and
  quota usage without exposing internal outbox tables as the primary UI.
- `docs/messaging-api-vine.md` documents supported APIs and differences from
  official LINE cloud.

## Follow-Up Work

After this slice, the next LINE-parity candidates are:

- End-to-end bot sandbox with real webhook, usable reply token, reply/push
  result, and visible chat output.
- Rich Menu parity gaps: per-user link/unlink public APIs and alias management
  in the developer/manager surface.
- Narrowcast and audience primitives after multicast and broadcast behavior are
  stable.
