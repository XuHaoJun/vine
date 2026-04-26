# Vine Creator Market — Growth And Discovery (Phase 3) Design

> **Slice scope**: Turn the sticker store from a purchasable catalog into a browsable marketplace with search, curated shelves, bestseller ranking, creator follows, launch notifications, and purchase-gated ratings.
>
> **Upstream roadmap**: [`docs/vine-creator-market-roadmap.md`](../../vine-creator-market-roadmap.md)
> **Product spec**: [`docs/vine-creator-market-spec.md`](../../vine-creator-market-spec.md), §6, §7.1, §10.2, §10.3, and §11.
> **UI/UX reference**: [`docs/vine-creator-market-uiux.md`](../../vine-creator-market-uiux.md), U1, U2, U3, U6, U7, and U8.
> **Previous phase**: [`2026-04-26-vine-creator-market-manual-payout-design.md`](./2026-04-26-vine-creator-market-manual-payout-design.md)

---

## 1. Goals And Success Criteria

### 1.1 Problem

Phases 1 through 2.5 make creator stickers sellable, usable, reportable, and payable. The store is still mostly a flat catalog: users can buy what they already know exists, but there is little reason to browse, follow creators, compare results, or trust unknown packages.

Phase 3 adds the first growth and discovery layer. It should create user-visible discovery loops without introducing a full recommendation engine or external search infrastructure.

### 1.2 Success Criteria

This slice is complete when:

1. The store home shows curated featured packages, 7-day bestsellers, 30-day bestsellers, and latest releases from real on-sale packages.
2. Admins can manage featured shelves without code changes.
3. Users can search packages by title, creator display name, tags, and sticker keywords.
4. Search results support type, price, owned/unowned, creator, and sort filters.
5. Package detail pages show creator profile, follower count, rating summary, short reviews, and same-creator recommendations.
6. Users can follow and unfollow creators from package detail and creator public pages.
7. When a followed creator publishes a new package, the system records a notification event for each follower.
8. Users can rate or review only packages they own, and only once per package.
9. Ratings shown in store UI exclude deleted or moderated reviews and cannot be submitted for unowned packages.
10. Multi-currency display is available for store browsing as display-only conversion; checkout and settlement remain TWD until a later payments phase.

---

## 2. Non-Goals

Phase 3 explicitly does not include:

- ML-based personalized recommendations.
- External search services such as Meilisearch, Typesense, Elasticsearch, or hosted Algolia.
- Automated marketing emails or push delivery. This phase records notification events and shows in-app surfaces only.
- Discounting, coupons, bundles, creator campaigns, or price-change notifications.
- Multi-currency checkout, settlement, payout, or creator reporting.
- Review replies, helpful votes, media reviews, or public moderation queues.
- Full analytics dashboards for impressions, CTR, conversion rate, LTV, or follower trends.
- Any LINE Developers, LINE Login, or `api.line.me` integration.

---

## 3. Chosen Approach

Use the existing database plus small marketplace tables, and expose discovery reads through ConnectRPC.

The store UI already reads public package data through Zero. That remains useful for live package metadata, ownership, and chat sticker use. Phase 3 discovery queries need ranking, search, private order aggregates, and write validation for reviews/follows, so those flows should live server-side behind ConnectRPC.

The implementation is intentionally split:

1. **Discovery MVP**: curated shelves, bestsellers, latest, search/filter/sort.
2. **Social trust MVP**: creator public pages, follows, purchase-gated ratings and reviews.
3. **Notification and chat entry points**: new-package notification records and locked recommendation tab in the sticker picker.
4. **Display currency**: browse-time conversion only, with clear checkout boundary.

Personalized recommendation can later consume the same tables and events, but it is not part of this phase's launch criteria.

---

## 4. Data Model

### 4.1 Featured Shelf

`stickerFeaturedShelf` stores admin-managed shelves.

Required fields:

- `id`
- `slug`
- `title`
- `status`: `draft` / `published` / `archived`
- `startsAt`
- `endsAt`
- `createdByUserId`
- `createdAt`
- `updatedAt`

`stickerFeaturedShelfItem` stores package membership and order:

- `id`
- `shelfId`
- `packageId`
- `position`
- `createdAt`

Rules:

- Store home only returns published shelves whose time window includes `now`.
- Shelf items whose package is not `on_sale` are omitted from public responses.
- Admin reorder should write stable integer positions.

### 4.2 Creator Follow

`creatorFollow` stores the user-to-creator relationship.

Required fields:

- `userId`
- `creatorId`
- `createdAt`

Rules:

- Unique key: `(userId, creatorId)`.
- A creator cannot follow themselves.
- Follower counts are computed from this table in Phase 3. A denormalized count can be added later if needed.

### 4.3 Package Review

`stickerPackageReview` stores one purchase-gated review per user/package.

Required fields:

- `id`
- `packageId`
- `userId`
- `rating`: integer 1 through 5
- `body`: optional short text, capped at 280 chars
- `status`: `published` / `deleted` / `hidden`
- `createdAt`
- `updatedAt`

Rules:

- Unique key: `(packageId, userId)`.
- Server verifies the user has an entitlement for the package before create/update.
- Reviews for packages that are no longer on sale remain visible on the package detail page unless moderated.
- Only `published` reviews count toward public average rating and review count.

### 4.4 Launch Notification Event

`creatorLaunchNotification` records a durable in-app notification fact when an followed creator publishes a package.

Required fields:

- `id`
- `recipientUserId`
- `creatorId`
- `packageId`
- `status`: `unread` / `read`
- `createdAt`
- `readAt`

Rules:

- Created when package status transitions to `on_sale`.
- One notification per `(recipientUserId, packageId)`.
- No push/email delivery in this phase.

### 4.5 Currency Rate Snapshot

`currencyDisplayRate` stores display-only exchange rates.

Required fields:

- `baseCurrency`: initially `TWD`
- `quoteCurrency`: `USD`, `JPY`, and later additional display currencies
- `rate`
- `source`
- `effectiveDate`
- `createdAt`

Rules:

- Checkout still uses the package's stored order currency and amount.
- Store UI can show approximate display prices with "約" or equivalent copy.
- If no rate exists, fall back to TWD.

---

## 5. Discovery Semantics

### 5.1 Package Eligibility

Public discovery surfaces include only packages where:

```text
stickerPackage.status = "on_sale"
```

Existing entitlements still allow users to use previously purchased packages if a package is later unlisted or removed, but discovery does not promote those packages.

### 5.2 Bestseller Ranking

Bestsellers are computed from `stickerOrder` at read time for Phase 3.

Included order states:

| Status | Ranking treatment |
| --- | --- |
| `paid` | Counts as one sale and contributes gross amount. |
| `refund_failed` | Counts as one sale and contributes gross amount. |
| `refunded` | Excluded. |
| `refund_pending` | Excluded. |

Windows:

- 7-day: `[now - 7 days, now)`
- 30-day: `[now - 30 days, now)`

Sort order:

1. sold count descending
2. gross amount descending
3. package published date descending
4. package name ascending

### 5.3 Search

Search should use PostgreSQL for this phase.

Searchable fields:

- package name
- package description
- package tags
- creator display name
- sticker asset keywords

Filters:

- sticker type
- price range
- owned/unowned for authenticated users
- creator ID
- locale

Sort options:

- relevance
- popular: 30-day sales
- newest: published date
- price low to high
- price high to low
- rating

The first implementation can use `ILIKE` plus token normalization. If search quality becomes a product blocker, add PostgreSQL full-text indexes before considering external search.

### 5.4 Ratings

Rating summary fields:

- average rating rounded to one decimal place
- published review count
- current user's review if authenticated and owned

Anti-abuse rules for Phase 3:

- entitlement required
- one review per user/package
- cannot review a package owned by the same creator profile
- server-side body length cap
- hidden/deleted reviews excluded from public summary

---

## 6. Server Design

### 6.1 Services

Add focused services under `apps/server/src/services/sticker-market/`:

```text
discovery.repository.ts
discovery.service.ts
follow.repository.ts
follow.service.ts
review.repository.ts
review.service.ts
featured-shelf.repository.ts
featured-shelf.service.ts
currency-display.service.ts
launch-notification.service.ts
```

Responsibilities:

- Discovery service reads public discovery surfaces and ranking data.
- Featured shelf service validates admin-managed shelves and omits ineligible packages from public shelves.
- Follow service owns follow/unfollow idempotency and self-follow validation.
- Review service owns entitlement validation, one-review rule, and rating summary.
- Launch notification service creates durable notification rows after publish.
- Currency display service converts browse prices without touching checkout amounts.

### 6.2 ConnectRPC

Extend the existing sticker market services instead of adding raw REST endpoints.

User-facing RPCs:

```proto
rpc GetStoreHome(GetStoreHomeRequest) returns (GetStoreHomeResponse);
rpc SearchStickerPackages(SearchStickerPackagesRequest) returns (SearchStickerPackagesResponse);
rpc GetStickerPackageDetail(GetStickerPackageDetailRequest) returns (GetStickerPackageDetailResponse);
rpc GetCreatorPublicProfile(GetCreatorPublicProfileRequest) returns (GetCreatorPublicProfileResponse);
rpc FollowCreator(FollowCreatorRequest) returns (FollowCreatorResponse);
rpc UnfollowCreator(UnfollowCreatorRequest) returns (UnfollowCreatorResponse);
rpc UpsertStickerPackageReview(UpsertStickerPackageReviewRequest) returns (UpsertStickerPackageReviewResponse);
rpc DeleteStickerPackageReview(DeleteStickerPackageReviewRequest) returns (DeleteStickerPackageReviewResponse);
rpc ListLaunchNotifications(ListLaunchNotificationsRequest) returns (ListLaunchNotificationsResponse);
rpc MarkLaunchNotificationRead(MarkLaunchNotificationReadRequest) returns (MarkLaunchNotificationReadResponse);
```

Admin RPCs:

```proto
rpc ListFeaturedShelves(ListFeaturedShelvesRequest) returns (ListFeaturedShelvesResponse);
rpc UpsertFeaturedShelf(UpsertFeaturedShelfRequest) returns (UpsertFeaturedShelfResponse);
rpc PublishFeaturedShelf(PublishFeaturedShelfRequest) returns (PublishFeaturedShelfResponse);
rpc ArchiveFeaturedShelf(ArchiveFeaturedShelfRequest) returns (ArchiveFeaturedShelfResponse);
```

Authenticated reads should include ownership, follow state, and user review where relevant. Anonymous-compatible reads can return the public data without user-specific flags.

---

## 7. Frontend Design

### 7.1 Store Home

Update `/store` to match UIUX U1:

- prominent search input
- type chips
- featured shelves
- 7-day bestseller shelf
- 30-day bestseller shelf
- latest releases shelf
- owned state on package cards
- display currency label when available

### 7.2 Search Results

Add `/store/search` for UIUX U2:

- query input in header
- filter controls for type, price, sort, owned state
- list layout, not grid
- package cover, title, creator, type, count, rating, price, owned state

### 7.3 Package Detail

Extend `/store/[packageId]` for UIUX U3:

- creator card with follow button and follower count
- rating summary and review list preview
- review editor for owners
- tags
- same-creator recommendations
- display-only converted price alongside checkout price when applicable

### 7.4 Creator Public Page

Add `/creators/[creatorId]` for UIUX U8:

- creator banner/avatar/name/bio
- follower count
- follow/unfollow CTA
- package grid with type filter

### 7.5 Sticker Picker Discovery

Extend the chat sticker picker for UIUX U6:

- search owned sticker assets by package name and keywords
- locked discovery tab with packages from followed creators first, then featured packages
- "go to store" entry remains visible

---

## 8. Testing Strategy

Server unit tests:

- search filter and sort semantics
- bestseller status/window semantics
- review entitlement validation
- one-review-per-user/package rule
- self-follow rejection
- launch notification idempotency

Server integration tests:

- discovery repository returns only on-sale packages
- bestseller query excludes refunded/refund-pending orders
- featured shelf public query omits ineligible packages
- creator public profile is scoped to public fields

Frontend tests:

- search page renders owned state and filters
- package detail shows rating/follow/review states
- creator page follow toggle updates UI
- sticker picker locked tab does not allow sending unowned stickers

Manual verification:

- `bun turbo proto:generate`
- targeted server tests for sticker market services
- targeted web checks for `/store`, `/store/search`, `/store/[packageId]`, `/creators/[creatorId]`
- `bun run check:all` before final merge

---

## 9. Rollout Plan

1. Ship discovery read APIs and store home shelves behind existing store route.
2. Add admin featured shelf management.
3. Add search page and package detail enrichment.
4. Add creator public page and follow state.
5. Add review/rating writes after entitlement validation.
6. Add launch notification records on publish.
7. Add sticker picker discovery tab.
8. Add display-only currency conversion.

Phase 3 can go live after step 5 if notification and chat discovery need to be held back. The hard launch requirement is that search, shelves, follows, and ratings all work against real creator packages.
