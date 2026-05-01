# Messaging API Webhook Observability Design

## Summary

This phase hardens Vine's Official Account webhook loop after the Messaging API
v1 baseline. It adds durable webhook delivery logs, manual redelivery, LINE-like
webhook settings in the developer console, and a minimal test webhook tool.

Vine remains a standalone LINE-style product. This design does not call
LINE-hosted `api.line.me`, does not require LINE Developers Console channels,
and does not implement real LINE cloud integration. LINE Developers behavior is
used only as product reference for a familiar developer-console shape.

## Context

The current Messaging API v1 baseline already provides:

- `/api/oa/v2` public OA REST namespace.
- Access-token authentication.
- Reply, push, and broadcast message sending.
- Durable send request, delivery, and retry-key tables.
- Basic webhook endpoint configuration and test route.
- Internal webhook dispatch for user message and postback events.

The roadmap's next theme is Official Account + Messaging API closed-loop
hardening. The remaining weak point is webhook operation: a developer can set a
webhook and receive events, but cannot inspect delivery history, understand why
events failed, manually redeliver an event, or test the loop from a console that
resembles the LINE Developers Console.

## LINE Reference Behavior

Use these LINE-inspired behaviors as product reference:

- The Messaging API channel settings page exposes Webhook URL, Use webhook,
  Verify, Webhook redelivery, and Error statistics aggregation controls.
- Verify sends a POST with an empty events array:

```json
{
  "destination": "xxxxxxxxxx",
  "events": []
}
```

- Webhook redelivery sends the same event again after failed delivery. The
  event keeps the same webhook event ID and has
  `deliveryContext.isRedelivery = true`.
- Webhook error statistics categorize failures as:
  `could_not_connect`, `request_timeout`, `error_status_code`, or
  `unclassified`.
- Webhook error statistics do not include webhook URL verification requests.
- LINE Bot Designer is no longer maintained; Vine should not clone it. Vine's
  existing Flex Simulator remains the right tool for Flex authoring.

Vine should not copy LINE's hidden retry schedule exactly. Vine should expose a
simple, deterministic operator model that is easy to test.

## Goals

- Persist every real webhook delivery attempt for OA events.
- Show recent webhook delivery history in the developer console.
- Show failure reason, detail, response status, attempt count, redelivery state,
  and payload detail for each delivery.
- Let OA managers manually redeliver failed webhook events.
- Add LINE-like settings controls for Use webhook, Webhook redelivery, and Error
  statistics aggregation.
- Keep Verify behavior separate from delivery logs, matching LINE's model.
- Add a minimal Test webhook panel for sending an empty verify payload and a
  sample text-message event to the configured webhook URL.
- Keep webhook delivery service code testable through explicit dependencies.

## Non-Goals

- No full bot IDE or Bot Designer clone.
- No automatic redelivery scheduler in this phase. The schema and settings
  should support it later, but this phase only requires manual redelivery.
- No exact LINE retry interval or retry-count compatibility.
- No TSV export in the first slice.
- No email or notification-center alerts.
- No public Messaging API endpoint for listing webhook logs. Log management is
  authenticated developer-console behavior, so it belongs behind ConnectRPC.
- No Zero schema publication for webhook delivery rows; these are operational
  logs, not synced chat product state.

## Product UX

The channel detail page should grow from a mostly Basic settings page into a
LINE-like channel settings page with working tabs. The immediate focus is the
Messaging API tab.

### Messaging API Tab

The tab should contain three sections.

#### Webhook Settings

Fields and controls:

- Webhook URL input.
- Use webhook toggle.
- Verify button.
- Webhook redelivery toggle.
- Error statistics aggregation toggle.
- Last verified timestamp and current status.

Behavior:

- Saving Webhook URL updates the OA webhook endpoint through the authenticated
  management API.
- Verify sends an empty `events: []` payload to the target endpoint and shows
  status code, reason, and timestamp.
- Verify results are shown in the settings panel, but are not stored in
  `oaWebhookDelivery`.
- Use webhook off means real user/postback events should not dispatch to the bot
  server. The UI still allows saving and verifying a URL.
- Webhook redelivery off means failed rows are not eligible for redelivery
  actions. In this phase there is no background scheduler, so this toggle gates
  manual redelivery and preserves LINE-like settings semantics for a future
  automatic worker.
- Error statistics aggregation off means Vine may still keep the minimum server
  state needed to operate, but the developer-facing Webhook errors table should
  not show newly attempted deliveries from periods while aggregation is off.
  The service should store whether a delivery is developer-visible when it is
  created, so changing the toggle later does not rewrite history.

#### Webhook Errors

Show a dense operational table:

- Time.
- Event type.
- Status: pending, delivered, failed.
- HTTP status.
- Reason.
- Detail.
- Attempt count.
- Redelivery marker.
- Action: Redeliver for failed rows.

Selecting a row opens a detail panel or inline expansion with:

- Webhook delivery ID.
- Webhook event ID.
- Request payload JSON.
- Response status and response body excerpt.
- Last error message.
- Created, attempted, and delivered timestamps.

Manual Redeliver:

- Available only for failed real event deliveries.
- Available only when Webhook redelivery is enabled for the OA.
- Creates a new attempt against the same `oaWebhookDelivery` row.
- Sends the same payload except each event's `deliveryContext.isRedelivery`
  becomes `true`.
- Keeps the original `webhookEventId`, reply token, source, timestamp, and
  message object.
- Updates attempt count, status, response fields, and timestamps.

#### Test Webhook

Provide a small tool, not a bot builder:

- Verify current endpoint: sends `{ destination, events: [] }`.
- Send sample message event: sends a Vine-generated text message event to the
  current endpoint with a test user/source and a real signed payload.
- Show the latest test result inline.

Sample test deliveries should not appear in Webhook errors unless they are
explicitly created as real `oaWebhookDelivery` rows in a later phase. For this
phase, they are diagnostics inside the Test webhook panel.

## Data Model

Add operational delivery tables to `packages/db/src/schema-private.ts`, matching
the private-table pattern used by the v1 Messaging API outbox tables. Add a
database migration in `packages/db/src/migrations/`. Do not add delivery tables
to Zero.

### `oaWebhookDelivery`

One row per real webhook event payload Vine tries to send to an OA bot server.

```text
id                  uuid primary key
oaId                uuid not null
webhookEventId      text not null
eventType           text not null
payloadJson         jsonb not null
status              text not null      # pending | delivered | failed
reason              text nullable      # could_not_connect | request_timeout | error_status_code | unclassified
detail              text nullable
responseStatus      integer nullable
responseBodyExcerpt text nullable
attemptCount        integer not null default 0
isRedelivery        boolean not null default false
developerVisible    boolean not null default true
createdAt           timestamp not null
lastAttemptedAt     timestamp nullable
deliveredAt         timestamp nullable
updatedAt           timestamp not null
```

Indexes:

```text
index (oaId, createdAt)
index (oaId, status, createdAt)
unique (oaId, webhookEventId)
```

`unique (oaId, webhookEventId)` prevents duplicate event rows. Manual
redelivery updates the same row instead of creating a second logical event.

### `oaWebhookAttempt`

One row per HTTP attempt. This keeps detail history without overloading the
summary row.

```text
id                  uuid primary key
deliveryId          uuid not null references oaWebhookDelivery(id)
oaId                uuid not null
attemptNumber       integer not null
isRedelivery        boolean not null
requestUrl          text not null
requestBodyJson     jsonb not null
responseStatus      integer nullable
responseBodyExcerpt text nullable
reason              text nullable
detail              text nullable
startedAt           timestamp not null
completedAt         timestamp nullable
```

Indexes:

```text
index (deliveryId, attemptNumber)
index (oaId, startedAt)
```

### `oaWebhook` Settings Additions

Extend the existing webhook settings row with:

```text
useWebhook                    boolean not null default true
webhookRedeliveryEnabled      boolean not null default false
errorStatisticsEnabled        boolean not null default false
lastVerifyStatusCode          integer nullable
lastVerifyReason              text nullable
lastVerifiedAt                timestamp nullable
```

If the existing `oaWebhook.status` remains the source of verified/failed status,
these fields should supplement it rather than replace it.

## Server Architecture

Create a dedicated webhook delivery service, separate from route plugins:

```text
apps/server/src/services/oa-webhook-delivery.ts
```

Responsibilities:

- Build signed webhook payloads from existing OA event builders.
- Create `oaWebhookDelivery` rows for real events.
- Send signed HTTP POST requests with bounded timeout.
- Categorize failure reasons and details.
- Persist `oaWebhookAttempt` rows.
- Update delivery summary state.
- Redeliver failed events manually.
- Run verify/test sends without creating delivery rows.

Follow Vine server patterns:

- Construct the service in `apps/server/src/index.ts`.
- Pass `db`, `oa`, timeout, and clock/random ID helpers through explicit deps.
- Do not create module-level singletons.
- Keep Fastify plugins as transport adapters.

The existing `apps/server/src/plugins/oa-webhook.ts` should become thinner. It
should authorize the user/chat, ask the delivery service to create and send a
message or postback webhook, then map the result to HTTP responses for the
internal chat action callers.

## ConnectRPC Management API

Developer-console operations should be added to the existing OA ConnectRPC
service, or to a clearly named OA webhook management service if the file becomes
too large.

Required RPCs:

```text
GetWebhookSettings(official_account_id)
UpdateWebhookSettings(official_account_id, url, use_webhook,
  webhook_redelivery_enabled, error_statistics_enabled)
VerifyWebhook(official_account_id, optional endpoint_override)
ListWebhookDeliveries(official_account_id, page_size, cursor, status_filter)
GetWebhookDelivery(official_account_id, delivery_id)
RedeliverWebhook(official_account_id, delivery_id)
SendTestWebhookEvent(official_account_id, text)
```

Auth:

- All RPCs require the logged-in user to have access to the OA's provider.
- Do not expose these RPCs to OA access tokens; access tokens are for public
  Messaging API calls, not console administration.

Client data access:

- Use `createClient(..., connectTransport)` in `apps/web/src/features/oa/client.ts`.
- Use `useTanQuery` for settings, list, and detail reads.
- Use `useTanMutation` for update, verify, redeliver, and test sends.
- Invalidate settings and delivery query keys after successful mutations.
- Do not use raw `fetch()` for console data.

## Error Classification

Map delivery failures into LINE-like reasons:

```text
could_not_connect   fetch/network failure before an HTTP response exists
request_timeout     AbortSignal timeout
error_status_code   HTTP response exists but status is not 2xx
unclassified        unexpected delivery error
```

Details should be concrete and stable enough for UI filtering:

```text
Connection failed
Request timeout
HTTP 500
HTTP 404
Unclassified webhook dispatch error
```

For non-2xx responses, store the HTTP status and a bounded response body excerpt.
Use a small cap such as 4 KB to avoid storing large HTML error pages.

## Frontend Architecture

Modify:

```text
apps/web/app/(app)/developers/console/channel/[channelId]/index.tsx
```

If the file grows too large, split focused components next to the route:

```text
apps/web/app/(app)/developers/console/channel/[channelId]/ChannelHeader.tsx
apps/web/app/(app)/developers/console/channel/[channelId]/MessagingApiTab.tsx
apps/web/app/(app)/developers/console/channel/[channelId]/WebhookSettingsSection.tsx
apps/web/app/(app)/developers/console/channel/[channelId]/WebhookErrorsSection.tsx
apps/web/app/(app)/developers/console/channel/[channelId]/TestWebhookSection.tsx
```

Use existing Vine frontend conventions:

- `~/interface/*` components for buttons, inputs, dialogs, and toasts where
  available.
- Tamagui layout tokens and compact operational UI, not a marketing layout.
- Real tabs or local tab state for Basic settings / Messaging API / LIFF /
  Security / Roles. Only Basic settings and Messaging API need to be functional
  in this phase.
- `react-hook-form` + Valibot for the webhook settings form.
- Toasts for verify/redeliver/test success or failure.
- A confirmation dialog is optional for manual redelivery; if used, it should be
  a short blocking confirmation because redelivery sends data to an external bot
  server.

The UI should resemble LINE Developers Console structure but use Vine naming and
avoid implying that this is the official LINE platform.

## Request Flows

### Real User Message Webhook

```text
chat UI sends user message
  -> internal dispatch endpoint authorizes chat membership
  -> webhook delivery service builds message event and reply token
  -> service creates oaWebhookDelivery if Use webhook is enabled
  -> service sends signed payload
  -> service records oaWebhookAttempt
  -> service updates delivery summary
  -> developer console can show the result if developerVisible is true
```

If Use webhook is off, no delivery row is created and no request is sent.

If Error statistics aggregation is off, the service may create a non-visible row
only if it is needed for future redelivery mechanics. The first implementation
should prefer `developerVisible = false` over deleting operational history.

### Verify Webhook

```text
developer clicks Verify
  -> ConnectRPC VerifyWebhook
  -> service signs { destination, events: [] }
  -> service POSTs to endpoint
  -> service updates last verify status fields
  -> service returns status, reason, and timestamp
```

No `oaWebhookDelivery` row is created.

### Manual Redelivery

```text
developer clicks Redeliver on failed row
  -> ConnectRPC RedeliverWebhook
  -> service loads failed delivery for the OA
  -> service mutates payload events to deliveryContext.isRedelivery = true
  -> service sends signed payload to current webhook URL
  -> service inserts oaWebhookAttempt
  -> service updates oaWebhookDelivery
  -> UI refreshes list and detail
```

Manual redelivery should use the current webhook URL. If the URL changed since
the original failure, the attempt row records the URL used for that attempt.

## Testing

Server unit tests:

- failure classification for connection failure, timeout, non-2xx, and unknown
  errors.
- verify sends empty events and does not create delivery rows.
- real dispatch creates a delivery row only when Use webhook is enabled.
- Error statistics aggregation controls `developerVisible` at creation time.
- manual redelivery sets `deliveryContext.isRedelivery = true`.
- manual redelivery preserves the original `webhookEventId`.
- response body excerpts are capped.

Server integration tests:

- `oaWebhookDelivery` and `oaWebhookAttempt` persist expected rows.
- duplicate `webhookEventId` does not create duplicate delivery rows.
- redelivery updates attempt count and status.
- list/detail RPCs enforce OA/provider authorization.
- failed dispatch remains inspectable after the request path returns.

Frontend tests:

- channel settings page can switch to Messaging API tab.
- webhook settings form renders current URL and toggles.
- Verify button shows result without adding a delivery row in mocked data.
- Webhook errors table renders failed rows with reason/detail/status.
- Redeliver mutation invalidates delivery list/detail queries.

Playwright:

- Add one smoke test for the developer console Messaging API tab if the page is
  stable in the integration environment. Do not block the backend slice on a
  broad browser automation suite.

## Acceptance Criteria

- A developer can open a Vine OA channel, switch to Messaging API, configure a
  webhook URL, and verify it.
- A real user message or postback webhook attempt is persisted with status,
  reason/detail, response status, attempt count, and payload.
- A failed webhook appears in the Webhook errors table when Error statistics
  aggregation was enabled at event time.
- A developer can manually redeliver a failed webhook and see the attempt count
  and status update.
- Redelivered payloads keep the original webhook event ID and set
  `deliveryContext.isRedelivery = true`.
- Test webhook can send an empty verify payload and a sample message event from
  the console.
- No new root `/v2/...` routes are added.
- No LINE-hosted APIs are called.

## Future Work

- Automatic redelivery worker with a bounded retry schedule.
- TSV export for webhook error logs.
- Email or notification-center alerts when redelivery starts or stops.
- Webhook error charts and time-bucketed statistics.
- Public docs and examples for webhook troubleshooting.
- Message content retrieval for user-sent media.
