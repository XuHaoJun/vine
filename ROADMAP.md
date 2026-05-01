# Vine Roadmap

Vine is a self-hostable, LINE-style instant-messaging product. It is not the
official LINE platform and should not depend on LINE Developers Console,
Messaging API, LINE Login channel IDs, or `api.line.me` unless a future scope
explicitly asks for real LINE cloud integration.

This roadmap uses LINE Developers feature areas as product inspiration, then
maps them to Vine-owned server, sync, web, and mobile capabilities.

## Product Direction

The next phase should focus on turning Vine from a chat clone into a platform
clone:

1. Make the core chat experience feel complete.
2. Close the Official Account and Messaging API loop.
3. Productize rich interactive messages and rich menus.
4. Extend LIFF-style mini apps once chat and OA flows are stable.
5. Add heavier native and social features after the platform surface is useful.

## Priority Roadmap

| Priority | Area | Why | Scope |
| --- | --- | --- | --- |
| P0 | Chat core | Chat is the base surface for every OA, LIFF, sticker, and bot feature. | Reply/quote, mentions, search, media polish, notification behavior, chat settings, block/report flows. |
| P1 | Official Account + Messaging API loop | Vine already has OA, webhook, access-token, Rich Menu, Flex simulator, and message-rendering foundations. This is the highest-leverage next platform milestone. | Reply, push, broadcast, webhook delivery logs, retries, idempotency, quota, bot test console, developer-facing API docs. |
| P1 | Interactive message pack | Rich bot interactions are one of LINE's most recognizable developer features. | Quick Reply, Template Message, Imagemap, Flex Message delivery into real chats, action dispatch for message/postback/URI/datetime/camera/camera roll/location/clipboard. |
| P2 | Rich Menu builder | Rich menus are already partially modeled in Vine; the next step is making them usable by OA managers. | Image upload, tappable-area editor, default rich menu, tab switching, per-user rich menu, click analytics. |
| P2 | LIFF / Mini App platform | This turns Vine from chat-only into an app container inside conversations. | LIFF app registry, SDK parity for core methods, share target picker, permanent links, mini app gallery, developer playground. |
| P3 | OA content and CRM | Official accounts become more useful when they can operate campaigns and customer journeys. | OA profile feed, announcements, coupons, event pages, membership card, basic audience segments. |
| P3 | Business operations | Broadcast and CRM features need observability and guardrails before serious use. | Audience import, segment targeting, scheduled broadcast, message analytics, coupon redemption, A/B message experiments. |
| P4 | Heavy native features | These are valuable but expensive, and should come after the messaging platform is coherent. | Voice/video calls, albums, notes, Keep-like saved items, desktop parity. |

## Recommended Next Theme

The next major theme should be:

**Official Account + Messaging API closed-loop hardening**

The success criterion is:

> A developer can create a Vine Official Account, issue an access token, set a
> webhook, add the OA as a friend, receive a user message, reply or push a rich
> message, and see the result in a real Vine chat.

The Messaging API v1 server baseline now exists under `/api/oa/v2`. The next
roadmap work should make that loop easier to operate, observe, document, and
use from real bot developers before starting a new major subsystem.

## Milestones

### Milestone 1: Messaging API v1 Baseline

Status: implemented as the current server baseline.

Goal: provide a minimal but real Vine-owned Messaging API for Official Accounts.

Completed:

- Public OA REST namespace is `/api/oa/v2`; root `/v2/...` is intentionally not
  registered because Vine does not have a dedicated Messaging API domain.
- Access-token authentication for OA API calls.
- `reply`, `push`, and `broadcast` message operations.
- Message support for text, sticker, image, audio, video, location, template,
  imagemap, flex, and quick reply metadata.
- PostgreSQL-backed request, delivery, and retry-key ledgers.
- Idempotency via LINE-compatible `X-Line-Retry-Key` semantics for push and
  broadcast, including 24-hour expiry reuse and duplicate retry responses.
- Durable delivery processing using deterministic message IDs and PostgreSQL
  `FOR UPDATE SKIP LOCKED`, so restart/crash recovery does not double-send.
- Broadcast recipient snapshots, quota accounting, and recovery tests.
- Webhook endpoint and rich menu public routes moved under `/api/oa/v2`.
- Tests around auth, validation, idempotency, delivery recovery, namespace
  guardrails, and message insertion.
- Webhook delivery logs (`oaWebhookDelivery`, `oaWebhookAttempt`) with LINE-like
  failure classification, attempt history, and 30-day retention cleanup.
- Manual redelivery of failed webhooks from the developer console, preserving
  the original `webhookEventId` and setting `deliveryContext.isRedelivery`.
- LINE-like webhook settings (Use webhook, Webhook redelivery, Error statistics
  aggregation) and diagnostic verify/test tools in the console.
- ConnectRPC management API for webhook settings, delivery listing, redelivery,
  and test events (not exposed on public `/v2` routes).

Not completed yet / next hardening:

- Developer-facing Messaging API docs and examples for Vine's `/api/oa/v2`
  endpoint, including explicit differences from the official LINE cloud.
- Operator views for accepted requests, delivery rows, retry-key state, and
  failed recovery attempts.
- Message content retrieval backed by stored media for image/video/audio.
- Production limits: body size, per-OA rate limiting, quota reset policy, and
  retention cleanup for request/delivery/retry-key rows.
- End-to-end bot sandbox that creates an OA, sends a user message, receives a
  webhook, replies, pushes, broadcasts, and shows the resulting Vine chat.

Out of scope:

- Narrowcast.
- Full audience management.
- External queue infrastructure such as RabbitMQ unless PostgreSQL outbox
  contention or throughput becomes a measured bottleneck.

### Milestone 2: Interactive Messages

Goal: make bot messages feel useful inside Vine chat, not only valid as JSON.

Deliverables:

- Quick Reply rendering and action dispatch from stored quick reply metadata.
- Template messages: buttons, confirm, carousel, and image carousel.
- Flex Message send flow from simulator into a real chat.
- Imagemap tap handling with action dispatch.
- Postback events sent back through the OA webhook pipeline.
- UI behavior for quick reply disappearance after use, matching the practical LINE-style interaction model.

Out of scope:

- Perfect visual parity with every LINE client.
- Legacy LINE-only behavior that has no value in Vine.

### Milestone 3: Rich Menu Builder

Goal: let OA managers create and operate rich menus without hand-writing JSON.

Deliverables:

- Rich menu image upload and validation.
- Visual tappable-area editor.
- Default rich menu assignment.
- Rich menu tab switching via alias-style actions.
- Chat UI integration for active rich menus.
- Click analytics for menu areas.

Out of scope:

- Advanced scheduling.
- Sophisticated per-segment personalization.

### Milestone 4: LIFF / Mini App MVP

Goal: let lightweight web apps run inside Vine conversations with useful context.

Deliverables:

- LIFF app registry under the developer console.
- Core SDK methods: `init`, `ready`, `getProfile`, `getContext`, `sendMessages`, `shareTargetPicker`, and `closeWindow`.
- Permanent links into LIFF apps.
- Mini app container inside the Vine app.
- Developer playground and fixture apps for integration tests.

Out of scope:

- External LINE LIFF compatibility guarantees.
- Public app review marketplace.
- Payments inside mini apps.

## Later Bets

These are useful but should wait until the platform loop is healthy:

- Voice and video calls.
- Group albums and notes.
- Saved items / Keep-like collection.
- OA feed and campaign center.
- Membership cards and coupons.
- Audience import and segmentation.
- Scheduled broadcast and A/B testing.
- Desktop-specific chat polish.

## Explicit Non-Goals

- Do not call LINE-hosted `api.line.me` as part of normal Vine product behavior.
- Do not require LINE Developers Console channels for Vine features.
- Do not implement real LINE Login unless the requested scope is external LINE cloud integration.
- Do not prioritize voice/video calls before the chat, OA, Messaging API, and rich message surfaces are coherent.
- Do not build a generic social network feed before the messaging platform has clear end-to-end value.

## References In This Repo

- `README.md`
- `docs/line-clone-dev-notes.md`
- `docs/line-clone-assessment.md`
- `docs/vine-creator-market-roadmap.md`
- `packages/proto/proto/oa/v1/oa.proto`
- `packages/liff`
- `packages/line-flex`
- `packages/richmenu-schema`
- `packages/imagemap-schema`
