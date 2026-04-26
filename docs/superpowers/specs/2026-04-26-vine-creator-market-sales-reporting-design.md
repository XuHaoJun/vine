# Vine Creator Market — Creator Sales Reporting (Phase 2B) Design

> **Slice scope**: Add the minimum sales reporting creators need after Phase 2A submission/review/on-sale flow has produced real creator-owned packages and real sticker orders.
>
> **Upstream roadmap**: [`docs/vine-creator-market-roadmap.md`](../../vine-creator-market-roadmap.md)
> **Product spec**: [`docs/vine-creator-market-spec.md`](../../vine-creator-market-spec.md)
> **UI/UX reference**: [`docs/vine-creator-market-uiux.md`](../../vine-creator-market-uiux.md), C1 and C7 only.
> **Previous phase**: [`2026-04-25-vine-creator-market-submission-mvp-design.md`](./2026-04-25-vine-creator-market-submission-mvp-design.md)

---

## 1. Goals And Success Criteria

### 1.1 Problem

Phase 2A lets creators submit sticker packages, lets admins approve them, and lets approved packages enter the existing store/payment/entitlement flow. The creator dashboard still cannot answer the next basic question: "What sold, and what is my estimated share?"

Phase 2B adds a small reporting slice without introducing payout, tax, month-close, or aggregate ledger infrastructure.

### 1.2 Success Criteria

This slice is complete when:

1. A creator can open Creator Studio and see current-month sales and estimated revenue backed by real orders.
2. A creator can open `/creator/sales` and view one UTC calendar month at a time.
3. The report shows total gross sales, estimated 70% creator revenue, sold count, refunded count/amount, refund-pending count/amount, daily trend rows, and per-package ranking.
4. Reports include only packages owned by the authenticated creator.
5. Orders for packages owned by other creators never appear in the report.
6. Refunded and refund-pending orders follow the reporting semantics in this document.
7. No new persisted reporting or aggregate table is required for Phase 2B.

---

## 2. Non-Goals

Phase 2B explicitly does not include:

- Payout application, payout balance, payout history, or Hyperswitch Payout API.
- Tier 2 KYC, tax documents, W-8BEN, bank account verification, or tax withholding.
- USD conversion or multi-currency settlement. Current sticker orders are `TWD`.
- PSP fee deduction. Platform fee/payment fee treatment is a later finance decision.
- Monthly close, creator ledger, invoice generation, or emailed settlement reports.
- Buyer region distribution from C7.
- Persisted daily/monthly aggregate tables.
- Any LINE Developers, LINE Login, or `api.line.me` integration.

---

## 3. Chosen Approach

Use a ConnectRPC report endpoint that computes results from existing tables at read time.

The report reads private payment data server-side from `stickerOrder`, joins creator-owned `stickerPackage` rows, computes summary/trend/ranking data, and returns only aggregate report values to the authenticated creator. The frontend reads it with React Query wrapped around a typed ConnectRPC client.

This is intentionally narrower than a ledger or aggregate-table design. It avoids writing report data during payment/refund transitions, avoids adding Zero permissions for private order rows, and keeps Phase 2B focused on creator visibility rather than payout correctness.

---

## 4. Data Sources And Ownership

No database table is added in this phase.

Existing tables:

- `creatorProfile`: maps authenticated Vine users to creator profile IDs.
- `stickerPackage`: owns package metadata and `creatorId`.
- `stickerOrder`: owns private order/payment/refund state.

Ownership rule:

```text
auth.user.id
  -> creatorProfile.userId
  -> creatorProfile.id
  -> stickerPackage.creatorId
  -> stickerOrder.packageId
```

Only orders whose package belongs to the authenticated creator can be included in report calculations.

Seed packages have `creatorId = NULL`; they are excluded from creator reporting.

---

## 5. Reporting Semantics

Phase 2B reports one UTC calendar month at a time. The request month is a `YYYY-MM` string, and the server computes `[monthStart, nextMonthStart)` in UTC.

### 5.1 Included Order States

Only these `stickerOrder.status` values participate in reporting:

| Status | Reporting treatment |
| --- | --- |
| `paid` | Counted as sold and included in confirmed gross sales. |
| `refund_failed` | Counted as sold and included in confirmed gross sales because the refund did not complete. |
| `refunded` | Excluded from confirmed gross sales and sold count, but shown as refunded count/amount. |
| `refund_pending` | Excluded from confirmed gross sales and sold count, but shown as pending refund count/amount. |

`created` and `failed` orders are ignored.

### 5.2 Revenue Share

Phase 2B uses a fixed estimated creator share:

```ts
const CREATOR_REVENUE_SHARE_BPS = 7000
confirmedRevenueMinor = Math.floor(grossSalesMinor * CREATOR_REVENUE_SHARE_BPS / 10000)
```

The UI must label this as "預估分潤" or equivalent wording, not "可提領" or "已結算".

### 5.3 Currency

All report rows return `currency = "TWD"` because `stickerOrder.currency` currently only supports `TWD`.

Mixed-currency behavior is out of scope for this phase.

---

## 6. Server Design

### 6.1 Files

```text
apps/server/src/services/sticker-market/
  sales-report.repository.ts
  sales-report.repository.int.test.ts
  sales-report.service.ts
  sales-report.service.test.ts
  index.ts

apps/server/src/connect/
  stickerMarketCreator.ts

packages/proto/proto/stickerMarket/v1/
  stickerMarket.proto
```

### 6.2 Repository

`sales-report.repository.ts` performs the creator-scoped SQL query. It should return raw rows, not UI-shaped response objects.

Responsibilities:

- Join `stickerOrder` to `stickerPackage`.
- Filter by `stickerPackage.creatorId`.
- Filter `stickerOrder.createdAt >= monthStart` and `< nextMonthStart`.
- Filter statuses to `paid`, `refund_failed`, `refund_pending`, `refunded`.
- Select order ID, package ID/name, amount, currency, status, and created/refund timestamps needed by the service.

The repository does not calculate revenue share. That stays in the service.

### 6.3 Service

`sales-report.service.ts` owns business rules.

Responsibilities:

- Validate month format as `YYYY-MM`.
- Compute UTC month bounds.
- Resolve the creator profile for the authenticated user.
- Return an empty report if the user has no creator profile.
- Apply status semantics from section 5.
- Aggregate:
  - report summary
  - daily rows for every day in the selected month
  - package ranking sorted by confirmed gross sales descending, then sold count descending, then package name ascending

Daily rows should include zero-value days so the frontend can render a stable month chart without filling missing dates itself.

### 6.4 ConnectRPC

Extend existing `StickerMarketCreatorService`:

```proto
rpc GetCreatorSalesReport(GetCreatorSalesReportRequest)
  returns (GetCreatorSalesReportResponse);

message GetCreatorSalesReportRequest {
  string month = 1; // YYYY-MM, UTC month
}

message SalesReportSummary {
  int32 gross_sales_minor = 1;
  int32 confirmed_revenue_minor = 2;
  int32 sold_count = 3;
  int32 refunded_count = 4;
  int32 refunded_minor = 5;
  int32 refund_pending_count = 6;
  int32 refund_pending_minor = 7;
  string currency = 8;
}

message SalesReportDailyRow {
  string date = 1; // YYYY-MM-DD
  int32 gross_sales_minor = 2;
  int32 confirmed_revenue_minor = 3;
  int32 sold_count = 4;
}

message SalesReportPackageRow {
  string package_id = 1;
  string package_name = 2;
  int32 gross_sales_minor = 3;
  int32 confirmed_revenue_minor = 4;
  int32 sold_count = 5;
  int32 refunded_count = 6;
}

message GetCreatorSalesReportResponse {
  string month = 1;
  SalesReportSummary summary = 2;
  repeated SalesReportDailyRow daily_rows = 3;
  repeated SalesReportPackageRow package_rows = 4;
}
```

The handler uses `requireAuthData(ctx)` and delegates to the sales report service with `auth.id`.

---

## 7. Frontend Design

### 7.1 Files

```text
apps/web/app/(app)/creator/
  sales.tsx

apps/web/src/features/sticker-market/creator/
  CreatorDashboard.tsx
  CreatorSalesReport.tsx
  CreatorShell.tsx
  client.ts
```

### 7.2 Data Fetching

Use the existing creator ConnectRPC client and `useTanQuery`. Do not use raw `fetch()`.

Query key:

```ts
['sticker-market', 'creator-sales-report', month]
```

The month value should be generated client-side from the current date in `YYYY-MM` format for the dashboard and controlled by previous/next month buttons on `/creator/sales`.

### 7.3 Dashboard

`CreatorDashboard` keeps the Phase 2A package counts from Zero and adds the current-month report query.

Cards:

- 本月銷售: `summary.grossSalesMinor`
- 預估分潤: `summary.confirmedRevenueMinor`
- 作品總數: existing package count
- 審核中: existing in-review count

The existing "銷售報表將在 Phase 2B 開放" placeholder is removed.

### 7.4 Sales Report Page

`CreatorSalesReport` renders:

- Month navigation with previous/next controls.
- Summary cards for gross sales, estimated revenue, sold count, refunded amount, and refund-pending amount.
- A simple daily bar chart built with Tamagui stacks. No chart library is added.
- A per-package ranking table/list.
- Empty state with zero values when there are no orders.

The page uses existing `~/interface/*` components where available and Tamagui layout tokens/shorthands. It should remain dense and dashboard-like, not a marketing page.

---

## 8. Error Handling

- Invalid `month` returns `Code.InvalidArgument`.
- Unauthenticated requests are handled by existing Connect auth wrappers.
- Missing creator profile returns an empty report instead of an error, matching the dashboard flow where a user may still need to create a creator profile.
- Repository errors surface as normal server errors; no special retry behavior is added in Phase 2B.

---

## 9. Testing

### 9.1 Server Unit Tests

Add `sales-report.service.test.ts` for:

- valid month parsing and UTC month bounds
- invalid month rejection
- `paid` and `refund_failed` included in confirmed totals
- `refunded` excluded from confirmed totals and shown as refunded
- `refund_pending` excluded from confirmed totals and shown as pending
- fixed 70% revenue share using floor rounding
- package ranking sort order
- zero daily rows are present for days without sales

### 9.2 Server DB Integration Test

Add `sales-report.repository.int.test.ts` using `withRollbackDb()` for:

- creator-owned package orders are returned
- another creator's package orders are excluded
- seed packages with `creatorId = NULL` are excluded
- orders outside the selected month are excluded
- ignored statuses `created` and `failed` are excluded

### 9.3 Web Verification

Keep web logic thin. Add web unit coverage only if report formatting or month navigation becomes non-trivial.

Required verification commands for implementation:

```bash
bun turbo proto:generate
bun run --cwd apps/server test:unit
ZERO_UPSTREAM_DB=postgresql://user:password@localhost:5533/postgres bun run --cwd apps/server test:integration
bun run check:all
```

The DB integration command requires Docker Compose PostgreSQL and migrations to be running.

---

## 10. Open Follow-Ups For Later Phases

These are intentionally deferred:

- Replace read-time calculation with persisted daily/monthly aggregates if order volume requires it.
- Introduce creator ledger rows when payout/month-close begins.
- Decide whether creator revenue is calculated before or after PSP fees.
- Add USD or multi-currency reporting once orders support more than `TWD`.
- Add buyer region distribution after user/order geography exists.
