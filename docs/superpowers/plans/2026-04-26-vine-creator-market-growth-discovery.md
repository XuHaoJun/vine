# Vine Creator Market Growth And Discovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Phase 3 so users can discover, search, follow, and trust creator sticker packages beyond the basic purchase flow.

**Architecture:** Add small marketplace tables for featured shelves, creator follows, reviews, launch notifications, and display currency rates. Expose ranking/search/social operations through ConnectRPC services. Keep Zero for synced package/entitlement data already used by chat and store UI; use React Query around typed ConnectRPC clients for ranked/search/admin flows. Public discovery reads must not live behind the existing fully authenticated `StickerMarketUserService` registration unless that registration is changed to optional auth.

**Tech Stack:** Bun, Drizzle/PostgreSQL, ConnectRPC, Fastify, OneJS, Tamagui, Zero, React Query, Vitest.

**Upstream spec:** [`docs/superpowers/specs/2026-04-26-vine-creator-market-growth-discovery-design.md`](../specs/2026-04-26-vine-creator-market-growth-discovery-design.md)

---

## File Structure

### Database

- Modify: `packages/db/src/schema-public.ts`
  - Add product-facing marketplace tables: `creatorFollow`, `stickerPackageReview`, `creatorLaunchNotification`. "Public schema" here means the existing DB schema file, not public read access.
- Modify: `packages/db/src/schema-private.ts`
  - Add admin/private operational tables: `stickerFeaturedShelf`, `stickerFeaturedShelfItem`, `currencyDisplayRate`.
- Add: `packages/db/src/migrations/20260426000002_creator_market_growth_discovery.ts`
  - Create Phase 3 tables and indexes.

### Zero Schema

- Add or modify models/queries only for tables that need live client sync:
  - `packages/zero-schema/src/models/creatorLaunchNotification.ts`
  - `packages/zero-schema/src/relationships.ts`
  - `packages/zero-schema/src/queries/*`
- Do not sync `creatorFollow` or raw `stickerPackageReview` rows in Phase 3 unless the implementation also defines strict permissions and a concrete UI need. Prefer ConnectRPC for follow/review writes and public aggregate/snippet reads.
- Generated files are updated through the existing Zero generation workflow.

### Proto

- Modify: `packages/proto/proto/stickerMarket/v1/stickerMarket.proto`
  - Add public discovery RPCs in a service that can be registered without whole-service auth.
  - Add authenticated follow/review/notification RPCs.
  - Add admin featured shelf RPCs.
- Generated: `packages/proto/gen/stickerMarket/v1/stickerMarket_pb.ts`
  - Created by `bun turbo proto:generate`.

### Server

- Create:
  - `apps/server/src/services/sticker-market/discovery.repository.ts`
  - `apps/server/src/services/sticker-market/discovery.service.ts`
  - `apps/server/src/services/sticker-market/featured-shelf.repository.ts`
  - `apps/server/src/services/sticker-market/featured-shelf.service.ts`
  - `apps/server/src/services/sticker-market/follow.repository.ts`
  - `apps/server/src/services/sticker-market/follow.service.ts`
  - `apps/server/src/services/sticker-market/review.repository.ts`
  - `apps/server/src/services/sticker-market/review.service.ts`
  - `apps/server/src/services/sticker-market/launch-notification.service.ts`
  - `apps/server/src/services/sticker-market/currency-display.service.ts`
- Modify:
  - `apps/server/src/services/sticker-market/index.ts`
  - `apps/server/src/connect/routes.ts`
  - `apps/server/src/connect/stickerMarketUser.ts`
  - `apps/server/src/connect/stickerMarketAdmin.ts`
  - `apps/server/src/index.ts`

### Web

- Modify:
  - `apps/web/src/features/sticker-market/StoreHome.tsx`
  - `apps/web/src/features/sticker-market/PackageDetail.tsx`
  - `apps/web/src/features/sticker-market/StickerPicker.tsx`
  - `apps/web/src/features/sticker-market/client.ts`
  - `apps/web/src/features/sticker-market/admin/client.ts`
- Create:
  - `apps/web/app/(app)/store/search.tsx`
  - `apps/web/app/(app)/creators/[creatorId].tsx`
  - `apps/web/app/(app)/admin/featured-shelves/index.tsx`
  - `apps/web/src/features/sticker-market/SearchResultsPage.tsx`
  - `apps/web/src/features/sticker-market/CreatorPublicPage.tsx`
  - `apps/web/src/features/sticker-market/admin/AdminFeaturedShelvesPage.tsx`

---

## Task 1: Data Model And Migration

**Files:**
- Modify: `packages/db/src/schema-public.ts`
- Modify: `packages/db/src/schema-private.ts`
- Add: `packages/db/src/migrations/20260426000002_creator_market_growth_discovery.ts`

- [ ] **Step 1.1: Add creator follows**

Add `creatorFollow` with `userId`, `creatorId`, and `createdAt`.

Indexes:

- unique `(userId, creatorId)`
- index `creatorId`
- index `userId`

Verify: schema compiles and self-follow remains a service-level validation, not a database concern.

- [ ] **Step 1.2: Add sticker package reviews**

Add `stickerPackageReview` with `id`, `packageId`, `userId`, `rating`, `body`, `status`, `createdAt`, and `updatedAt`.

Indexes:

- unique `(packageId, userId)`
- index `packageId`
- index `userId`
- index `(packageId, status)`

Verify: status values are typed consistently with existing schema style.

- [ ] **Step 1.3: Add launch notifications**

Add `creatorLaunchNotification` with `id`, `recipientUserId`, `creatorId`, `packageId`, `status`, `createdAt`, and `readAt`.

Indexes:

- unique `(recipientUserId, packageId)`
- index `(recipientUserId, status, createdAt)`
- index `creatorId`

Verify: table stores notification facts only; no push delivery fields.

- [ ] **Step 1.4: Add featured shelves**

Add `stickerFeaturedShelf` and `stickerFeaturedShelfItem` in the private schema.

Indexes:

- unique shelf `slug`
- index `(status, startsAt, endsAt)`
- unique `(shelfId, packageId)`
- unique `(shelfId, position)`

Verify: private schema is used because shelf editing is admin-only.

- [ ] **Step 1.5: Add display currency rates**

Add `currencyDisplayRate` with base/quote currency, rate, source, effective date, and created timestamp.

Indexes:

- unique `(baseCurrency, quoteCurrency, effectiveDate)`
- index `(quoteCurrency, effectiveDate)`

Verify: no checkout/order schema changes are introduced.

- [ ] **Step 1.6: Add migration**

Create `20260426000002_creator_market_growth_discovery.ts` with matching `up` and `down` SQL.

Run:

```bash
bun run --cwd packages/db typecheck
```

Expected: db package typecheck passes. Migration-backed behavior is verified by focused server integration tests in later tasks.

---

## Task 2: Proto Contract

**Files:**
- Modify: `packages/proto/proto/stickerMarket/v1/stickerMarket.proto`
- Generated: `packages/proto/gen/stickerMarket/v1/stickerMarket_pb.ts`

- [ ] **Step 2.1: Add discovery RPCs**

Add public discovery RPCs to a service that is not registered behind whole-service auth:

```proto
rpc GetStoreHome(GetStoreHomeRequest) returns (GetStoreHomeResponse);
rpc SearchStickerPackages(SearchStickerPackagesRequest) returns (SearchStickerPackagesResponse);
rpc GetStickerPackageDetail(GetStickerPackageDetailRequest) returns (GetStickerPackageDetailResponse);
rpc GetCreatorPublicProfile(GetCreatorPublicProfileRequest) returns (GetCreatorPublicProfileResponse);
```

Responses should share compact package card messages with fields for package ID, title, creator, cover URL, sticker type, count, rating summary, owned state, and display price.

Implementation constraint: existing `StickerMarketUserService` is registered through `withAuthService`. Either create a new public discovery service, or change route registration so these read methods support optional auth while checkout/order/follow/review/notification mutations still require auth.

- [ ] **Step 2.2: Add follow and review RPCs**

Add:

```proto
rpc FollowCreator(FollowCreatorRequest) returns (FollowCreatorResponse);
rpc UnfollowCreator(UnfollowCreatorRequest) returns (UnfollowCreatorResponse);
rpc UpsertStickerPackageReview(UpsertStickerPackageReviewRequest) returns (UpsertStickerPackageReviewResponse);
rpc DeleteStickerPackageReview(DeleteStickerPackageReviewRequest) returns (DeleteStickerPackageReviewResponse);
```

Verify: mutating RPCs require auth in handlers.

- [ ] **Step 2.3: Add notification RPCs**

Add:

```proto
rpc ListLaunchNotifications(ListLaunchNotificationsRequest) returns (ListLaunchNotificationsResponse);
rpc MarkLaunchNotificationRead(MarkLaunchNotificationReadRequest) returns (MarkLaunchNotificationReadResponse);
```

Verify: responses include only notifications owned by the authenticated user.

- [ ] **Step 2.4: Add admin featured shelf RPCs**

Extend the admin sticker market service with:

```proto
rpc ListFeaturedShelves(ListFeaturedShelvesRequest) returns (ListFeaturedShelvesResponse);
rpc UpsertFeaturedShelf(UpsertFeaturedShelfRequest) returns (UpsertFeaturedShelfResponse);
rpc PublishFeaturedShelf(PublishFeaturedShelfRequest) returns (PublishFeaturedShelfResponse);
rpc ArchiveFeaturedShelf(ArchiveFeaturedShelfRequest) returns (ArchiveFeaturedShelfResponse);
```

- [ ] **Step 2.5: Generate proto code**

Run:

```bash
bun turbo proto:generate
```

Expected: generated proto files update cleanly.

---

## Task 3: Discovery Services

**Files:**
- Create service/repository files under `apps/server/src/services/sticker-market/`
- Modify: `apps/server/src/services/sticker-market/index.ts`
- Modify: `apps/server/src/connect/stickerMarketUser.ts`

- [ ] **Step 3.1: Write discovery service tests**

Cover:

- only `on_sale` packages appear
- 7-day and 30-day bestseller windows
- `paid` and `refund_failed` count as sales
- `refunded` and `refund_pending` do not count
- latest releases sort by `publishedAt` descending
- missing currency rate falls back to TWD

Run:

```bash
bun test apps/server/src/services/sticker-market/discovery.service.test.ts
```

Expected before implementation: tests fail for missing service.

- [ ] **Step 3.2: Implement discovery repository**

Read package cards, featured shelf items, orders, reviews, creator profile data, entitlements, and display rates.

Keep repository output close to database rows; do UI shaping in the service.

- [ ] **Step 3.3: Implement discovery service**

Build:

- store home shelves
- bestseller rankings
- latest releases
- package detail enriched data
- creator public profile data
- display price mapping

Verify: Task 3.1 tests pass.

- [ ] **Step 3.4: Add ConnectRPC handlers**

Wire user-facing read handlers and map service results into proto responses.

Run targeted handler tests if existing handler tests are present; otherwise add service-level coverage and rely on generated types for contract shape.

Verify public discovery RPCs work without auth, and authenticated sessions enrich the response with owned/follow/current-user-review state.

---

## Task 4: Search And Filters

**Files:**
- Extend discovery repository/service
- Modify user ConnectRPC handler

- [ ] **Step 4.1: Write search tests**

Cover:

- title search
- creator display name search
- tag search
- sticker keyword search
- type filter
- price filter
- owned/unowned filter for authenticated user
- sort by relevance, popular, newest, price, rating

- [ ] **Step 4.2: Implement PostgreSQL-backed search**

Use existing text/tag/keyword fields first. Prefer structured JSON parsing for tags/keywords where stored as JSON text.

Avoid an external search service in this phase.

- [ ] **Step 4.3: Add pagination**

Use cursor or page/limit consistently with existing ConnectRPC patterns. Default page size should be small enough for mobile list rendering.

Verify: search tests pass.

---

## Task 5: Featured Shelf Admin

**Files:**
- Create featured shelf service/repository
- Modify admin ConnectRPC handler
- Create admin web page

- [ ] **Step 5.1: Write service tests**

Cover:

- create draft shelf
- update shelf metadata and item order
- publish shelf
- archive shelf
- public read omits unpublished shelves
- public read omits non-on-sale packages

- [ ] **Step 5.2: Implement service and repository**

Keep admin validation server-side:

- valid slug
- no duplicate package IDs
- package IDs must exist
- positions are normalized

- [ ] **Step 5.3: Build admin UI**

Add `/admin/featured-shelves` with:

- shelf list
- draft/published/archived state
- package ID search/add field
- reorder controls
- publish/archive actions

Verify with targeted web typecheck.

---

## Task 6: Creator Follows

**Files:**
- Create follow service/repository
- Modify user ConnectRPC handler
- Modify package detail and creator public page

- [ ] **Step 6.1: Write follow tests**

Cover:

- follow is idempotent
- unfollow is idempotent
- follower count changes
- user cannot follow own creator profile
- unauthenticated follow is rejected

- [ ] **Step 6.2: Implement follow service**

Use authenticated user ID and creator profile lookup to reject self-follow.

- [ ] **Step 6.3: Add UI follow controls**

Show follow/unfollow state in:

- package detail creator card
- creator public profile page

Verify: follow state updates without navigating away.

---

## Task 7: Ratings And Reviews

**Files:**
- Create review service/repository
- Modify user ConnectRPC handler
- Modify package detail

- [ ] **Step 7.1: Write review tests**

Cover:

- entitlement required
- one review per user/package
- update existing review
- delete marks review deleted/hidden instead of hard delete
- creator cannot review own package
- public summary excludes hidden/deleted reviews

- [ ] **Step 7.2: Implement review service**

Validate rating range and body length. Keep moderation minimal in Phase 3: allow users to delete their own review and keep `hidden` for future admin tooling.

- [ ] **Step 7.3: Add package detail review UI**

Add:

- rating summary
- preview list
- owner-only review editor
- owned-but-unreviewed CTA
- unauthenticated/ unowned read-only state

Verify: unowned users cannot submit from the UI or server.

---

## Task 8: Launch Notifications

**Files:**
- Create launch notification service
- Modify publish flow in sticker market package/submission service
- Add notification reads to user ConnectRPC

- [ ] **Step 8.1: Write notification tests**

Cover:

- notifications are created when a package becomes `on_sale`
- auto-published admin approvals create notifications
- creator manual publish creates notifications
- one notification per follower/package
- repeated publish event is idempotent
- creator does not notify themselves
- list endpoint returns only current user's rows

- [ ] **Step 8.2: Hook publish transition**

Call launch notification service for every `status -> on_sale` transition, including admin approval with `autoPublish = true` and creator manual publish from `approved`.

Verify: existing publish tests still pass.

- [ ] **Step 8.3: Add notification UI entry**

Add a small in-app notification list or reuse an existing notification surface if present. Keep push/email delivery out of scope.

---

## Task 9: Store, Search, Creator, And Sticker Picker UI

**Files:**
- Modify `StoreHome.tsx`
- Create `SearchResultsPage.tsx`
- Modify `PackageDetail.tsx`
- Create `CreatorPublicPage.tsx`
- Modify `StickerPicker.tsx`

- [ ] **Step 9.1: Update store home**

Render:

- search input
- type filter chips
- featured shelves
- 7-day bestsellers
- 30-day bestsellers
- latest releases

Verify: owned packages show owned state.

- [ ] **Step 9.2: Add search route**

Create `/store/search` with list layout and filters matching UIUX U2.

Verify: query params survive refresh/navigation.

- [ ] **Step 9.3: Enrich package detail**

Add creator card, follower count, follow CTA, ratings/reviews, tags, and same-creator recommendations.

- [ ] **Step 9.4: Add creator public route**

Create `/creators/[creatorId]` with profile header, follow CTA, type filters, and package grid.

- [ ] **Step 9.5: Extend sticker picker**

Add:

- owned sticker search by package name and sticker keywords
- locked discovery tab showing followed creators' latest packages first, then featured packages

Verify: locked stickers navigate to package detail and cannot be sent as messages.

---

## Task 10: Display Currency

**Files:**
- Create currency display service
- Extend discovery responses
- Update store UI price components

- [ ] **Step 10.1: Seed display rates**

Add seed/dev data for `TWD -> USD` and `TWD -> JPY`.

- [ ] **Step 10.2: Implement display conversion**

Return both checkout price and approximate display price where available.

Rules:

- checkout remains TWD
- order creation remains unchanged
- creator reporting/payout remains unchanged
- UI labels converted prices as approximate

- [ ] **Step 10.3: Add tests**

Cover:

- exact checkout amount remains unchanged
- missing rate falls back to TWD-only display
- conversion uses latest effective date

---

## Task 11: Verification

- [ ] **Step 11.1: Run proto generation**

```bash
bun turbo proto:generate
```

- [ ] **Step 11.2: Run Zero generation if synced tables were added**

If `creatorLaunchNotification` or any other new table is synced through Zero, run:

```bash
bun --filter @vine/zero-schema zero:generate
```

Then apply migrations through the repo migrate workflow so the Zero publication is rebuilt. In local Docker verification, restart `zero` and `server` after the migration/publication rebuild.

- [ ] **Step 11.3: Run targeted server tests**

```bash
bun test apps/server/src/services/sticker-market
```

- [ ] **Step 11.4: Run targeted web checks**

Use the existing repo check command:

```bash
bun run check:all
```

- [ ] **Step 11.5: Manual acceptance pass**

Verify:

- `/store` has shelves and owned state.
- `/store/search?q=...` supports filters and sorting.
- `/store/[packageId]` shows follow and review states.
- `/creators/[creatorId]` lists only on-sale packages.
- Admin can publish a featured shelf.
- A followed creator publishing a package creates notification rows.
- Sticker picker locked tab cannot send unowned stickers.
