# Vine Creator Market — Creator Submission MVP (Phase 2A) Design

> **Slice 範圍**:在 Phase 1 / 1.5 已完成付款、refund、對帳後,補上真實創作者把靜態 PNG 貼圖組提交審核、人工審核、上架到既有商店付款閉環的最小路徑。
>
> **上層 roadmap**:[`docs/vine-creator-market-roadmap.md`](../../vine-creator-market-roadmap.md)
> **產品規格**:[`docs/vine-creator-market-spec.md`](../../vine-creator-market-spec.md)
> **UI/UX 參考**:[`docs/vine-creator-market-uiux.md`](../../vine-creator-market-uiux.md),採用 C1-C6 的最小可用版本。
> **前一階段設計**:[`2026-04-25-vine-creator-market-payments-hardening-design.md`](./2026-04-25-vine-creator-market-payments-hardening-design.md)

---

## 1. 目標與成功標準

### 1.1 要解決什麼

Phase 1 目前的 sticker store 只靠 seed package。Phase 2A 要把「真創作者內容」接進同一條 pipeline:

1. Vine user 可以申請成為 creator,完成 Tier 1 基本資料。
2. Creator 可以建立 draft sticker package,上傳 ZIP,看見逐張驗證結果。
3. Creator 可以提交審核;審核中不可改 package metadata 或素材。
4. Admin 可以人工 approve / reject。
5. Approved package 若選擇 auto-publish,會變成 `on_sale`,出現在現有 store,沿用 Phase 1 的 checkout / entitlement / sticker picker。

### 1.2 成功標準

這個 slice 完成後,以下情境必須可測:

1. 一個登入使用者可建立 creator profile,填入 display name、country,狀態為 Tier 1 verified。
2. Creator 可建立 static PNG sticker package draft,填名稱、描述、tags、數量、TWD 價格、原創聲明。
3. Creator 上傳 ZIP 後,server 驗證 ZIP 結構、PNG 數量、尺寸、偶數像素、單張檔案大小,並回傳逐檔結果。
4. 有 blocking validation error 時不可 submit review;只有 warning 時可繼續。
5. Creator submit 後 package 狀態為 `in_review`,creator UI 顯示預計 3 個工作天。
6. Admin approve 後 package 依 `autoPublish` 變成 `on_sale`;store Zero query 只同步 `on_sale` packages。
7. Admin reject 後 package 狀態為 `rejected`,creator 可看見結構化拒絕原因與問題檔號。
8. `on_sale` package 可用既有 `StickerMarketUserService.CreateCheckout` 購買,付款成功後 entitlement 可讓聊天室 sticker picker 使用。

---

## 2. 非目標

以下明確不放進 Phase 2A:

- 銷售報表(C7)、Dashboard 真實收入卡片、creator revenue aggregation。
- Payout、稅務、Tier 2 KYC、W-8BEN、銀行帳戶驗證。
- AI 輔助審核、DMCA、申訴、違規處分治理。
- 多語系完整管理。資料模型預留 `locale`,但 UI 只提交單一預設語言。
- 動態 / 有聲 / popup / message sticker。Phase 2A 只支援 static PNG。
- 公開 creator page(U8) 與 follow creator。
- 外部物件儲存整合。Phase 2A 使用既有 local upload serving pattern,保留 `driveKey` 命名。
- 重新設計付款流程。購買仍走 Phase 1 / 1.5 的 ECPay credit checkout 與 refund/reconciliation 能力。

---

## 3. 方案比較

### 3.1 推薦方案:Submission-first vertical slice

先做 creator profile、draft package、ZIP validation/upload、manual review、approved package 上架。Creator dashboard 只做到 C1-C6 的 submission / review 狀態,admin UI 只做到審核清單與 approve/reject。

優點是最短路徑驗證「真內容進入付款閉環」,也避免 Phase 2A 同時承擔報表與 payout。缺點是 creator 首版看不到銷售數字,但這是 Phase 2B 的專門範圍。

### 3.2 替代方案:Dashboard-first

先把 Creator Studio C1-C9 視覺與 navigation 做完整,再逐步接資料。這會較快產出可展示畫面,但核心 submission / review / store integration 風險會延後暴露,所以不採用。

### 3.3 替代方案:Schema-first broad foundation

一次建立 creator、asset、review、reporting、payout、tax 相關表。這會看起來完整,但會過早承諾 Phase 2B / 2.5 的資料形狀,也違反目前 roadmap 的分期意圖,所以不採用。

---

## 4. 模組邊界

```text
packages/db/src/
  schema-public.ts              creatorProfile, stickerPackage extensions, stickerAsset
  schema-private.ts             stickerReviewEvent
  migrations/                   Phase 2A migration

packages/zero-schema/src/
  models/creatorProfile.ts      creator-visible profile rows
  models/stickerPackage.ts      public on_sale read + owner/admin scoped state
  models/stickerAsset.ts        sticker asset metadata
  queries/creatorProfile.ts
  queries/stickerPackage.ts     store + creator dashboard queries
  queries/stickerAsset.ts
  relationships.ts              package -> creator/assets

packages/proto/proto/stickerMarket/v1/
  stickerMarket.proto           add creator/admin submission RPCs

apps/server/src/services/sticker-market/
  creator.repository.ts         creator profile reads/writes
  package.repository.ts         package state transitions
  asset-validator.ts            ZIP/PNG validation
  asset-storage.ts              local file persistence + driveKey generation
  submission.service.ts         creator submission orchestration
  review.service.ts             admin approve/reject orchestration

apps/server/src/connect/
  stickerMarketCreator.ts       authenticated creator RPCs
  stickerMarketAdmin.ts         extend admin RPCs with review operations
  routes.ts                     register new handlers with auth

apps/server/src/plugins/
  sticker-assets-public.ts      serve uploaded sticker assets from local storage

apps/web/app/(app)/
  creator/...                   Creator Studio C1-C6 minimal flow
  admin/sticker-reviews/...     Admin review queue and detail

apps/web/src/features/sticker-market/
  creator/*                     creator hooks/components
  admin/*                       admin review hooks/components
```

Boundary rules:

- Zero owns synced catalog/profile/package/asset reads.
- ConnectRPC + TanStack Query owns uploads, submit review, approve, reject, and other command-style operations.
- No raw `fetch()` for normal server data. File upload may use React Query around a typed ConnectRPC or HTTP upload endpoint if Connect binary upload is too awkward; the endpoint still lives behind explicit auth and service boundaries.
- Server services are factory functions with explicit `deps`; no service reads `process.env` directly.
- Admin review operations require `auth.role === 'admin'`, matching existing `StickerMarketAdminService` authorization.

---

## 5. Data Model

### 5.1 `creatorProfile` public table

Creator profile is public enough for store attribution later, but Phase 2A only exposes creator-visible dashboard data and package ownership.

```ts
export const creatorProfile = pgTable(
  'creatorProfile',
  {
    id: text('id').primaryKey(),
    userId: text('userId').notNull(),
    displayName: text('displayName').notNull(),
    country: text('country').notNull(),
    bio: text('bio').notNull().default(''),
    avatarDriveKey: text('avatarDriveKey'),
    kycTier: text('kycTier').notNull().$type<'tier1'>().default('tier1'),
    status: text('status').notNull().$type<'active' | 'suspended'>().default('active'),
    createdAt: timestamp('createdAt', { mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp('updatedAt', { mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('creatorProfile_userId_unique').on(table.userId),
    index('creatorProfile_status_idx').on(table.status),
  ],
)
```

### 5.2 `stickerPackage` extensions

The existing table remains the catalog row bought by Phase 1 checkout. Phase 2A extends it instead of creating a parallel draft table so approved packages can flow into existing checkout without copy jobs.

New columns:

```ts
creatorId: text('creatorId'),
status: text('status')
  .$type<'draft' | 'in_review' | 'approved' | 'rejected' | 'on_sale' | 'unlisted' | 'removed'>()
  .notNull()
  .default('on_sale'),
stickerType: text('stickerType').$type<'static'>().notNull().default('static'),
locale: text('locale').notNull().default('zh-TW'),
tags: text('tags').notNull().default('[]'),
copyrightText: text('copyrightText').notNull().default(''),
licenseConfirmedAt: timestamp('licenseConfirmedAt', { mode: 'string' }),
autoPublish: boolean('autoPublish').notNull().default(true),
submittedAt: timestamp('submittedAt', { mode: 'string' }),
reviewedAt: timestamp('reviewedAt', { mode: 'string' }),
publishedAt: timestamp('publishedAt', { mode: 'string' }),
reviewReasonCategory: text('reviewReasonCategory'),
reviewReasonText: text('reviewReasonText'),
reviewSuggestion: text('reviewSuggestion'),
reviewProblemAssetNumbers: text('reviewProblemAssetNumbers').notNull().default('[]'),
```

Compatibility:

- Seed packages get `status='on_sale'` and `creatorId=NULL`.
- Existing store and checkout continue to use `stickerPackage.id`, `priceMinor`, `currency`, `coverDriveKey`, `tabIconDriveKey`, `stickerCount`.
- `StickerMarketUserService.CreateCheckout` must reject any package whose status is not `on_sale`.

### 5.3 `stickerAsset` public table

```ts
export const stickerAsset = pgTable(
  'stickerAsset',
  {
    id: text('id').primaryKey(),
    packageId: text('packageId').notNull(),
    number: integer('number').notNull(),
    driveKey: text('driveKey').notNull(),
    width: integer('width').notNull(),
    height: integer('height').notNull(),
    sizeBytes: integer('sizeBytes').notNull(),
    mimeType: text('mimeType').notNull().$type<'image/png'>(),
    resourceType: text('resourceType').notNull().$type<'static'>().default('static'),
    keywords: text('keywords').notNull().default('[]'),
    createdAt: timestamp('createdAt', { mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    index('stickerAsset_packageId_idx').on(table.packageId),
    uniqueIndex('stickerAsset_packageNumber_unique').on(table.packageId, table.number),
  ],
)
```

### 5.4 `stickerReviewEvent` private table

Review events are operational audit data, not synced to normal clients.

```ts
export const stickerReviewEvent = pgTable(
  'stickerReviewEvent',
  {
    id: text('id').primaryKey(),
    packageId: text('packageId').notNull(),
    actorUserId: text('actorUserId').notNull(),
    action: text('action').notNull().$type<'submitted' | 'approved' | 'rejected'>(),
    reasonCategory: text('reasonCategory'),
    reasonText: text('reasonText'),
    suggestion: text('suggestion'),
    problemAssetNumbers: text('problemAssetNumbers').notNull().default('[]'),
    createdAt: timestamp('createdAt', { mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [index('stickerReviewEvent_packageId_idx').on(table.packageId)],
)
```

---

## 6. State Machine

```text
draft
  -> submitReview -> in_review

in_review
  -> approve(autoPublish=true)  -> on_sale
  -> approve(autoPublish=false) -> approved
  -> reject                    -> rejected

approved
  -> publish -> on_sale

rejected
  -> edit -> draft

on_sale
  -> creator unlist -> unlisted
  -> platform remove -> removed
```

Phase 2A implements:

- `draft -> in_review`
- `in_review -> on_sale`
- `in_review -> approved`
- `in_review -> rejected`
- `approved -> on_sale`
- `rejected -> draft`

Phase 2A does not implement `unlisted` / `removed` UI, but those statuses are included because they are already in the product-level state machine and affect store filtering.

State guards:

- Only the owning creator can mutate `draft`, `rejected`, or `approved` package rows through creator RPCs.
- `in_review` package metadata and assets are immutable to creators.
- Only admin can approve/reject.
- `on_sale` is readable by all store users.
- Checkout only accepts `on_sale`.

---

## 7. Asset Upload And Validation

### 7.1 ZIP structure

Phase 2A accepts only:

```text
submission.zip
├── png/
│   ├── 01.png
│   ├── 02.png
│   └── ...
├── cover.png
└── tab_icon.png
```

The package `stickerCount` determines required `png/NN.png` files. For static packages, allowed counts are `8 | 16 | 24 | 32 | 40`.

### 7.2 Validation rules

Blocking errors:

- ZIP cannot be opened.
- Missing `png/NN.png`, `cover.png`, or `tab_icon.png`.
- Extra static count does not match selected `stickerCount`.
- Any sticker is not PNG.
- Sticker width or height is odd.
- Sticker width > 370 px or height > 320 px.
- Sticker shortest side < 270 px.
- `cover.png` or `tab_icon.png` is not PNG.
- `tab_icon.png` is not 60 x 60 px.

Warnings:

- Sticker file size > 500 KB.
- Cover image is not square.

Warnings do not block submission; errors do.

### 7.3 Storage

Use local upload storage consistent with existing `/uploads/{driveKey}` access:

```text
uploads/stickers/{packageId}/cover.png
uploads/stickers/{packageId}/tab_icon.png
uploads/stickers/{packageId}/01.png
...
```

Database stores relative `driveKey` values such as `stickers/{packageId}/01.png`. Re-uploading assets for a `draft` or `rejected` package replaces prior files and `stickerAsset` rows inside a DB transaction after validation succeeds.

---

## 8. ConnectRPC Contract

Extend `packages/proto/proto/stickerMarket/v1/stickerMarket.proto`.

### 8.1 Creator service

```protobuf
service StickerMarketCreatorService {
  rpc GetCreatorProfile(GetCreatorProfileRequest) returns (GetCreatorProfileResponse);
  rpc UpsertCreatorProfile(UpsertCreatorProfileRequest) returns (UpsertCreatorProfileResponse);
  rpc CreateStickerPackageDraft(CreateStickerPackageDraftRequest) returns (CreateStickerPackageDraftResponse);
  rpc UpdateStickerPackageDraft(UpdateStickerPackageDraftRequest) returns (UpdateStickerPackageDraftResponse);
  rpc UploadStickerPackageAssets(UploadStickerPackageAssetsRequest) returns (UploadStickerPackageAssetsResponse);
  rpc SubmitStickerPackageReview(SubmitStickerPackageReviewRequest) returns (SubmitStickerPackageReviewResponse);
  rpc PublishApprovedStickerPackage(PublishApprovedStickerPackageRequest) returns (PublishApprovedStickerPackageResponse);
}
```

Phase 2A keeps the uploaded ZIP as `bytes zip_file` in proto unless generated client/server behavior proves too heavy during implementation. If that becomes impractical, the implementation plan may use an authenticated HTTP upload endpoint wrapped by React Query, but the command still calls `submission.service.ts` and returns the same validation result shape.

### 8.2 Admin service additions

```protobuf
service StickerMarketAdminService {
  rpc RefundOrder(RefundOrderRequest) returns (RefundOrderResponse);
  rpc ReconcileStickerOrders(ReconcileStickerOrdersRequest) returns (ReconcileStickerOrdersResponse);
  rpc ListStickerReviewQueue(ListStickerReviewQueueRequest) returns (ListStickerReviewQueueResponse);
  rpc GetStickerReviewDetail(GetStickerReviewDetailRequest) returns (GetStickerReviewDetailResponse);
  rpc ApproveStickerPackage(ApproveStickerPackageRequest) returns (ApproveStickerPackageResponse);
  rpc RejectStickerPackage(RejectStickerPackageRequest) returns (RejectStickerPackageResponse);
}
```

Review rejection requires:

- `reason_category`: one of spec §5.3 categories.
- `reason_text`: human-readable issue.
- `suggestion`: actionable improvement.
- `problem_asset_numbers`: repeated int32, optional.

---

## 9. Zero Queries And Permissions

### 9.1 Store queries

Update `allStickerPackages()` and `stickerPackageById()` to include only `status='on_sale'` for normal store reads. This prevents draft/rejected/in-review rows from leaking through the existing store UI.

### 9.2 Creator queries

Add creator-scoped synced reads:

- `creatorProfileByUserId({ userId })`
- `stickerPackagesByCreatorId({ creatorId })`
- `stickerPackageForCreator({ packageId, creatorId })`
- `stickerAssetsByPackageId({ packageId })`

Creator permissions:

- Creator can read their own profile.
- Creator can read packages where `stickerPackage.creatorId` belongs to their profile.
- Creator can read assets for packages they own.

Admin review queue can use ConnectRPC instead of Zero to avoid broad admin sync permissions in Phase 2A.

---

## 10. Frontend UX

Frontend follows `docs/vine-creator-market-uiux.md` C1-C6, reduced to the Phase 2A path.

### 10.1 Creator routes

```text
apps/web/app/(app)/creator/
  _layout.tsx                    Creator Studio shell; auth guard via useAuth()
  index.tsx                      C1 dashboard overview
  packages/index.tsx             C5 status management
  packages/new.tsx               C2-C4 wizard
  packages/[packageId].tsx       draft/rejected edit + review result
```

Minimum dashboard cards:

- package count
- in-review count
- rejected count
- CTA to create new package

Sales / revenue cards display a disabled placeholder that points to Phase 2B wording, not fake numbers.

### 10.2 Creator wizard

Step 1: Basic information

- name
- description
- tags
- sticker count
- copyright text
- original work checkbox

Step 2: Upload assets

- ZIP upload
- validation result list grouped by error/warning/ok
- cover and tab icon preview
- CTA disabled when blocking errors exist

Step 3: Pricing and publish setting

- TWD price using existing `priceMinor` / `currency='TWD'`
- 70% payout preview shown as informational copy only; no report/payout state is created
- `autoPublish` radio
- submit review CTA

Forms use `react-hook-form` + Valibot. UI imports shared `~/interface/*` components where available, with Tamagui layout following RN-first constraints.

### 10.3 Admin routes

```text
apps/web/app/(app)/admin/sticker-reviews/
  index.tsx                      in_review queue
  [packageId].tsx                review detail + approve/reject
```

Admin review detail shows:

- package metadata
- cover, tab icon, sticker grid
- ZIP validation summary stored from latest upload
- approve button
- reject form with category, issue, suggestion, problem asset numbers

---

## 11. Server Flow

### 11.1 Creator onboarding

1. Web calls `GetCreatorProfile`.
2. If none, creator route shows Tier 1 form.
3. `UpsertCreatorProfile` creates `creatorProfile` for `auth.id`.
4. Server sets `kycTier='tier1'`, `status='active'`.

Email verification is considered satisfied by having a valid Vine account in Phase 2A. Country declaration is the only new Tier 1 field.

### 11.2 Draft and asset upload

1. `CreateStickerPackageDraft` creates `stickerPackage` with `status='draft'`, `creatorId`, `currency='TWD'`.
2. `UploadStickerPackageAssets` verifies ownership and status in `draft | rejected`.
3. Server validates ZIP fully before writing files.
4. On success, server writes files, replaces `stickerAsset` rows, updates `coverDriveKey`, `tabIconDriveKey`, `updatedAt`.
5. Response returns validation results for UI display.

### 11.3 Submit review

1. Server verifies owner, `status in ('draft','rejected')`, no blocking validation errors, assets count equals `stickerCount`, license confirmed.
2. Package becomes `in_review`, `submittedAt=now`.
3. Server inserts `stickerReviewEvent(action='submitted')`.

### 11.4 Admin review

Approve:

1. Admin handler verifies `auth.role === 'admin'`.
2. `review.service.approve()` verifies package is `in_review`.
3. If `autoPublish`, status becomes `on_sale`, `publishedAt=now`; otherwise status becomes `approved`.
4. Server inserts `stickerReviewEvent(action='approved')`.

Reject:

1. Admin handler verifies `auth.role === 'admin'`.
2. `review.service.reject()` verifies package is `in_review`.
3. Package becomes `rejected`, review reason fields are copied to `stickerPackage`.
4. Server inserts `stickerReviewEvent(action='rejected')`.

---

## 12. Testing Strategy

### 12.1 Server unit tests

Add focused unit tests for:

- `asset-validator.ts`: valid ZIP, missing file, odd dimensions, over-limit dimensions, size warning.
- `submission.service.ts`: ownership checks, draft/rejected upload allowed, in_review upload rejected, submit blocked by validation errors.
- `review.service.ts`: approve/reject state guards, autoPublish status transition, review event creation.

### 12.2 Server DB integration tests

Use `withRollbackDb()` for:

- `stickerPackage.creatorId + status` migration shape.
- `stickerAsset(packageId, number)` unique index.
- submit review transaction updates package and review event atomically.
- approve auto-publish makes package visible to store query but draft/rejected/in_review do not.

### 12.3 Web unit / integration tests

- Unit test wizard validation helpers if extracted from UI.
- Playwright happy path: creator profile -> draft -> upload valid fixture ZIP -> submit -> admin approve -> package visible in store.
- Playwright validation path: invalid ZIP shows blocking errors and submit CTA remains disabled.

### 12.4 Verification commands

Relevant checks for implementation:

```bash
bun --filter @vine/zero-schema zero:generate
bun turbo proto:generate
bun run --cwd apps/server test:unit
ZERO_UPSTREAM_DB=postgresql://user:password@localhost:5533/postgres bun run --cwd apps/server test:integration
bun run --cwd apps/web test:unit
bun run --cwd apps/web test:integration
bun run check:all
```

Playwright and backend DB integration require Docker Compose services per `vine-dev-stack`.

---

## 13. Rollout Notes

- Seed packages remain `on_sale` and continue to work.
- Store UI should not need a route migration; it receives real creator packages through the same `stickerPackage` query after filtering by `on_sale`.
- Existing orders stay valid because `stickerOrder.packageId` still points at `stickerPackage.id`.
- Future Phase 2B report work will use `stickerOrder.packageId -> stickerPackage.creatorId` for creator ownership attribution.

---

## 14. Open Decisions Resolved For Phase 2A

1. Currency: keep `TWD` only to match current checkout implementation.
2. KYC Tier 1: treat Vine account email/session as email verification; collect country declaration.
3. Asset types: static PNG only.
4. Admin queue: ConnectRPC-backed, not Zero synced, to keep admin permissions narrow.
5. Sales reporting: excluded until Phase 2B.
