# Vine Roadmap

Vine is a self-hostable, LINE-style instant-messaging product. It is not the
official LINE platform and should not depend on LINE Developers Console,
Messaging API, LINE Login channel IDs, or `api.line.me` unless a future scope
explicitly asks for real LINE cloud integration.

This roadmap uses LINE Developers and LINE Official Account feature areas as
the product target, then maps them to Vine-owned server, sync, web, and mobile
capabilities. Vine should prefer LINE-like public behavior and management
workflows over Vine-only operator surfaces unless the extra surface is needed
to run a self-hosted deployment safely.

## Product Direction

The next phase should focus on turning Vine from a chat clone into a closer
LINE platform clone:

1. Make the core chat experience feel complete.
2. Close the LINE-like Official Account and Messaging API loop.
3. Productize LINE-style rich interactive messages and rich menus.
4. Extend LIFF-style mini apps once chat and OA flows are stable.
5. Add heavier native and social features after the LINE-parity surface is
   useful.

When a tradeoff appears, prefer the feature shape a LINE developer or OA
manager would recognize: public API behavior, message objects, webhook settings,
rich menus, LIFF, and OA management flows. Vine-specific implementation details
such as outbox rows, retry-key ledgers, and delivery workers should stay behind
admin diagnostics unless they are necessary for developer-facing LINE parity.

## Priority Roadmap

| Priority | Area | Why | Scope |
| --- | --- | --- | --- |
| P0 | Chat core | Chat is the base surface for every OA, LIFF, sticker, and bot feature. | Reply/quote, mentions, search, media polish, notification behavior, chat settings, block/report flows. |
| P1 | Official Account + Messaging API parity | Vine already has OA, webhook, access-token, Rich Menu, Flex simulator, and message-rendering foundations. This is the highest-leverage next LINE-clone milestone. | LINE-like reply, push, multicast, broadcast, webhook settings/errors/redelivery, retry keys, quota/consumption, profile/content APIs, developer-facing API docs, and a bot test console. |
| P1 | Interactive message pack | Rich bot interactions are one of LINE's most recognizable developer features. | Quick Reply, Template Message, Imagemap, Flex Message delivery into real chats, action dispatch for message/postback/URI/datetime/camera/camera roll/location/clipboard. |
| P2 | Rich Menu parity | Rich menus are already partially modeled in Vine; the next step is making them usable through LINE-like manager and API flows. | Image upload, tappable-area editor, default rich menu, per-user rich menu, rich menu alias/tab switching, chat UI integration, and manager-side display/click insights where feasible. |
| P2 | LIFF / Mini App platform | This turns Vine from chat-only into an app container inside conversations. | LIFF app registry, SDK parity for core methods, share target picker, permanent links, mini app gallery, developer playground. |
| P3 | OA Manager parity | Official accounts become more useful when managers can operate the familiar LINE OA surface. | OA profile/home, announcements, coupons, membership card, basic audience segments, scheduled broadcasts, and lightweight insights. |
| P3 | Business operations | Broadcast, audience, and campaign features need LINE-like observability and guardrails before serious use. | Audience import, segment targeting, message analytics, coupon redemption, A/B message experiments, and admin-only operational diagnostics. |
| P4 | Heavy native features | These are valuable but expensive, and should come after the messaging platform is coherent. | Voice/video calls, albums, notes, Keep-like saved items, desktop parity. |

## Recommended Next Theme

The next major theme should be:

**Official Account + Messaging API LINE-parity hardening**

The success criterion is:

> A developer can create a Vine Official Account, issue an access token, set a
> webhook, add the OA as a friend, receive a user message, reply or push a rich
> message, and see the result in a real Vine chat.

The Messaging API v1 server baseline now exists under `/api/oa/v2`. The next
roadmap work should make that loop behave like a recognizable LINE Developers
Messaging API channel before starting a new major subsystem. Developer-facing
work should favor docs, examples, endpoint parity, console settings, bot
testing, and chat-visible behavior. Vine-only operational internals should be
kept as admin diagnostics, not the primary product surface.

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
- LINE-like developer console surface for channel settings, Messaging API
  endpoint guidance, access tokens, webhook settings/errors, quota/consumption,
  and a bot test console.
- Messaging API parity gaps: multicast, profile/content API behavior, richer
  quota and sent-message statistics, and request/response examples that match
  LINE's developer expectations while using Vine-owned URLs.
- Message content upload/retrieval documentation and tests for image, video,
  and audio messages.
- Production limits: body size, per-OA rate limiting, quota reset policy, and
  retention cleanup for request/delivery/retry-key rows.
- End-to-end bot sandbox that creates an OA, sends a user message, receives a
  webhook, replies, pushes, broadcasts, and shows the resulting Vine chat.
- Admin-only diagnostics for accepted requests, delivery rows, retry-key state,
  and failed recovery attempts. These help self-hosted operators, but should not
  displace LINE-like developer/OA manager workflows.

Out of scope:

- Narrowcast until basic multicast, broadcast, and audience primitives are
  stable.
- Full audience management beyond the subset needed for LINE-like multicast and
  later narrowcast.
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
- Legacy LINE-only behavior that has no value in a self-hosted LINE clone.

### Milestone 3: Rich Menu Parity

Goal: let OA managers and bot developers create and operate rich menus through
LINE-like manager and Messaging API workflows.

Deliverables:

- Rich menu image upload and validation.
- Visual tappable-area editor for manager-created rich menus.
- Messaging API rich menu create/upload/set-default flow.
- Per-user rich menu linking and unlinking.
- Rich menu alias/tab switching.
- Chat UI integration for active rich menus.
- Manager-side display/click insights where feasible, with Messaging API rich
  menu analytics treated separately to match LINE's product boundary.

Out of scope:

- Advanced scheduling.
- Sophisticated per-segment personalization beyond LINE-like per-user rich menu
  assignment.

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
- Advanced audience import and segmentation.
- A/B testing.
- Desktop-specific chat polish.

## Explicit Non-Goals

- Do not call LINE-hosted `api.line.me` as part of normal Vine product behavior.
- Do not require LINE Developers Console channels for Vine features.
- Do not implement real LINE Login unless the requested scope is external LINE cloud integration.
- Do not prioritize voice/video calls before the chat, OA, Messaging API, and rich message surfaces are coherent.
- Do not build a generic social network feed before the messaging platform has clear end-to-end value.
- Do not expose Vine's internal outbox, retry-key, and worker implementation as
  primary developer-console features when a LINE-like product surface is enough.

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
