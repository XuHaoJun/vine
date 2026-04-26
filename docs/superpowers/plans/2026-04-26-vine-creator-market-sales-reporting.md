# Vine Creator Market Sales Reporting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Phase 2B so creators can see current-month and monthly sales reports computed from real sticker orders.

**Architecture:** Add a creator-only ConnectRPC report endpoint backed by a server service and repository that read existing `stickerOrder`, `stickerPackage`, and `creatorProfile` rows at request time. Use React Query around the typed ConnectRPC client for the report UI; keep Zero for package/profile reads already used by the dashboard. No reporting tables, payout ledger, or payment/refund write-path changes are introduced.

**Tech Stack:** Bun, Drizzle/PostgreSQL, ConnectRPC, Fastify, OneJS, Tamagui, React Query, Vitest.

**Upstream spec:** [`docs/superpowers/specs/2026-04-26-vine-creator-market-sales-reporting-design.md`](../specs/2026-04-26-vine-creator-market-sales-reporting-design.md)

---

## File Structure

### Proto

- Modify: `packages/proto/proto/stickerMarket/v1/stickerMarket.proto`
  - Add `GetCreatorSalesReport` RPC and report response messages to `StickerMarketCreatorService`.
- Generated: `packages/proto/gen/stickerMarket/v1/stickerMarket_pb.ts`
  - Created by `bun turbo proto:generate`.

### Server

- Create: `apps/server/src/services/sticker-market/sales-report.repository.ts`
  - Creator-scoped SQL query for reportable orders.
- Create: `apps/server/src/services/sticker-market/sales-report.repository.int.test.ts`
  - DB integration coverage for creator ownership and month/status filters.
- Create: `apps/server/src/services/sticker-market/sales-report.service.ts`
  - Month parsing, creator lookup, revenue-share math, daily/package aggregation.
- Create: `apps/server/src/services/sticker-market/sales-report.service.test.ts`
  - Unit coverage for report semantics and aggregation.
- Modify: `apps/server/src/services/sticker-market/index.ts`
  - Instantiate and expose the sales report service.
- Modify: `apps/server/src/connect/stickerMarketCreator.ts`
  - Add handler method and response mapping.
- Modify: `apps/server/src/index.ts`
  - Pass `stickerMarket.salesReport` into the creator handler deps.

### Web

- Create: `apps/web/app/(app)/creator/sales.tsx`
  - One route for the C7 sales report page.
- Create: `apps/web/src/features/sticker-market/creator/CreatorSalesReport.tsx`
  - Month picker, summary cards, daily bars, package ranking.
- Modify: `apps/web/src/features/sticker-market/creator/client.ts`
  - Add query key/helper for creator sales report.
- Modify: `apps/web/src/features/sticker-market/creator/CreatorShell.tsx`
  - Add nav link to `/creator/sales`.
- Modify: `apps/web/src/features/sticker-market/creator/CreatorDashboard.tsx`
  - Replace Phase 2B placeholder with real current-month cards.

---

## Task 1: Proto Contract

**Files:**
- Modify: `packages/proto/proto/stickerMarket/v1/stickerMarket.proto`
- Generated: `packages/proto/gen/stickerMarket/v1/stickerMarket_pb.ts`

- [ ] **Step 1.1: Extend `StickerMarketCreatorService`**

In `packages/proto/proto/stickerMarket/v1/stickerMarket.proto`, add this RPC at the end of `StickerMarketCreatorService`:

```proto
  rpc GetCreatorSalesReport(GetCreatorSalesReportRequest) returns (GetCreatorSalesReportResponse);
```

The service block should become:

```proto
service StickerMarketCreatorService {
  rpc GetCreatorProfile(GetCreatorProfileRequest) returns (GetCreatorProfileResponse);
  rpc UpsertCreatorProfile(UpsertCreatorProfileRequest) returns (UpsertCreatorProfileResponse);
  rpc CreateStickerPackageDraft(CreateStickerPackageDraftRequest) returns (CreateStickerPackageDraftResponse);
  rpc UpdateStickerPackageDraft(UpdateStickerPackageDraftRequest) returns (UpdateStickerPackageDraftResponse);
  rpc UploadStickerPackageAssets(UploadStickerPackageAssetsRequest) returns (UploadStickerPackageAssetsResponse);
  rpc SubmitStickerPackageReview(SubmitStickerPackageReviewRequest) returns (SubmitStickerPackageReviewResponse);
  rpc PublishApprovedStickerPackage(PublishApprovedStickerPackageRequest) returns (PublishApprovedStickerPackageResponse);
  rpc GetCreatorSalesReport(GetCreatorSalesReportRequest) returns (GetCreatorSalesReportResponse);
}
```

- [ ] **Step 1.2: Add report messages**

Append these messages after `PublishApprovedStickerPackageResponse`:

```proto
message GetCreatorSalesReportRequest {
  string month = 1;
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
  string date = 1;
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

- [ ] **Step 1.3: Generate proto code**

Run:

```bash
bun turbo proto:generate
```

Expected: command exits 0 and updates `packages/proto/gen/stickerMarket/v1/stickerMarket_pb.ts`.

- [ ] **Step 1.4: Commit proto contract**

```bash
git add packages/proto/proto/stickerMarket/v1/stickerMarket.proto packages/proto/gen/stickerMarket/v1/stickerMarket_pb.ts
git commit -m "feat(creator-market): add sales report rpc contract"
```

---

## Task 2: Sales Report Service Unit Tests

**Files:**
- Create: `apps/server/src/services/sticker-market/sales-report.service.test.ts`
- Create later in Task 3: `apps/server/src/services/sticker-market/sales-report.service.ts`

- [ ] **Step 2.1: Write failing service tests**

Create `apps/server/src/services/sticker-market/sales-report.service.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { createSalesReportService } from './sales-report.service'

function makeService(rows: any[], profile: any = { id: 'creator_1', userId: 'user_1' }) {
  return createSalesReportService({
    db: {},
    creatorRepo: {
      findByUserId: vi.fn().mockResolvedValue(profile),
    } as any,
    salesReportRepo: {
      listReportableOrders: vi.fn().mockResolvedValue(rows),
    } as any,
  })
}

describe('createSalesReportService', () => {
  it('rejects invalid report months', async () => {
    const service = makeService([])

    await expect(
      service.getCreatorSalesReport({ userId: 'user_1', month: '2026-4' }),
    ).rejects.toThrow('invalid report month')
  })

  it('returns an empty current-month report when the user has no creator profile', async () => {
    const service = makeService([], undefined)

    const report = await service.getCreatorSalesReport({
      userId: 'user_1',
      month: '2026-04',
    })

    expect(report.summary).toMatchObject({
      grossSalesMinor: 0,
      confirmedRevenueMinor: 0,
      soldCount: 0,
      refundedCount: 0,
      refundedMinor: 0,
      refundPendingCount: 0,
      refundPendingMinor: 0,
      currency: 'TWD',
    })
    expect(report.dailyRows).toHaveLength(30)
    expect(report.packageRows).toEqual([])
  })

  it('includes paid and refund_failed orders in confirmed totals', async () => {
    const service = makeService([
      {
        orderId: 'order_1',
        packageId: 'pkg_1',
        packageName: 'Cats',
        amountMinor: 100,
        currency: 'TWD',
        status: 'paid',
        createdAt: '2026-04-03T10:00:00Z',
      },
      {
        orderId: 'order_2',
        packageId: 'pkg_1',
        packageName: 'Cats',
        amountMinor: 200,
        currency: 'TWD',
        status: 'refund_failed',
        createdAt: '2026-04-03T11:00:00Z',
      },
    ])

    const report = await service.getCreatorSalesReport({
      userId: 'user_1',
      month: '2026-04',
    })

    expect(report.summary.grossSalesMinor).toBe(300)
    expect(report.summary.confirmedRevenueMinor).toBe(210)
    expect(report.summary.soldCount).toBe(2)
    expect(report.packageRows[0]).toMatchObject({
      packageId: 'pkg_1',
      packageName: 'Cats',
      grossSalesMinor: 300,
      confirmedRevenueMinor: 210,
      soldCount: 2,
      refundedCount: 0,
    })
  })

  it('separates refunded and refund_pending orders from confirmed totals', async () => {
    const service = makeService([
      {
        orderId: 'order_paid',
        packageId: 'pkg_1',
        packageName: 'Cats',
        amountMinor: 300,
        currency: 'TWD',
        status: 'paid',
        createdAt: '2026-04-04T10:00:00Z',
      },
      {
        orderId: 'order_refunded',
        packageId: 'pkg_1',
        packageName: 'Cats',
        amountMinor: 100,
        currency: 'TWD',
        status: 'refunded',
        createdAt: '2026-04-04T11:00:00Z',
      },
      {
        orderId: 'order_pending',
        packageId: 'pkg_2',
        packageName: 'Dogs',
        amountMinor: 200,
        currency: 'TWD',
        status: 'refund_pending',
        createdAt: '2026-04-05T10:00:00Z',
      },
    ])

    const report = await service.getCreatorSalesReport({
      userId: 'user_1',
      month: '2026-04',
    })

    expect(report.summary).toMatchObject({
      grossSalesMinor: 300,
      confirmedRevenueMinor: 210,
      soldCount: 1,
      refundedCount: 1,
      refundedMinor: 100,
      refundPendingCount: 1,
      refundPendingMinor: 200,
    })
  })

  it('sorts package rows by confirmed gross, sold count, then package name', async () => {
    const service = makeService([
      {
        orderId: 'order_b1',
        packageId: 'pkg_b',
        packageName: 'Beta',
        amountMinor: 100,
        currency: 'TWD',
        status: 'paid',
        createdAt: '2026-04-01T10:00:00Z',
      },
      {
        orderId: 'order_a1',
        packageId: 'pkg_a',
        packageName: 'Alpha',
        amountMinor: 100,
        currency: 'TWD',
        status: 'paid',
        createdAt: '2026-04-01T11:00:00Z',
      },
      {
        orderId: 'order_c1',
        packageId: 'pkg_c',
        packageName: 'Gamma',
        amountMinor: 200,
        currency: 'TWD',
        status: 'paid',
        createdAt: '2026-04-01T12:00:00Z',
      },
    ])

    const report = await service.getCreatorSalesReport({
      userId: 'user_1',
      month: '2026-04',
    })

    expect(report.packageRows.map((row) => row.packageId)).toEqual([
      'pkg_c',
      'pkg_a',
      'pkg_b',
    ])
  })
})
```

- [ ] **Step 2.2: Run unit test and verify failure**

Run:

```bash
bun run --cwd apps/server test:unit -- sales-report.service.test.ts
```

Expected: FAIL because `./sales-report.service` does not exist.

---

## Task 3: Sales Report Service Implementation

**Files:**
- Create: `apps/server/src/services/sticker-market/sales-report.service.ts`
- Modify: `apps/server/src/services/sticker-market/sales-report.service.test.ts` only if the test import/type setup needs a mechanical adjustment.

- [ ] **Step 3.1: Implement service**

Create `apps/server/src/services/sticker-market/sales-report.service.ts`:

```ts
export const CREATOR_REVENUE_SHARE_BPS = 7000
const DEFAULT_CURRENCY = 'TWD'

export type SalesReportOrderRow = {
  orderId: string
  packageId: string
  packageName: string
  amountMinor: number
  currency: 'TWD'
  status: 'paid' | 'refund_failed' | 'refund_pending' | 'refunded'
  createdAt: string
}

export type SalesReportSummary = {
  grossSalesMinor: number
  confirmedRevenueMinor: number
  soldCount: number
  refundedCount: number
  refundedMinor: number
  refundPendingCount: number
  refundPendingMinor: number
  currency: 'TWD'
}

export type SalesReportDailyRow = {
  date: string
  grossSalesMinor: number
  confirmedRevenueMinor: number
  soldCount: number
}

export type SalesReportPackageRow = {
  packageId: string
  packageName: string
  grossSalesMinor: number
  confirmedRevenueMinor: number
  soldCount: number
  refundedCount: number
}

export type CreatorSalesReport = {
  month: string
  summary: SalesReportSummary
  dailyRows: SalesReportDailyRow[]
  packageRows: SalesReportPackageRow[]
}

type SalesReportDeps = {
  db: any
  creatorRepo: {
    findByUserId(db: any, userId: string): Promise<{ id: string } | undefined>
  }
  salesReportRepo: {
    listReportableOrders(
      db: any,
      input: { creatorId: string; monthStart: Date; nextMonthStart: Date },
    ): Promise<SalesReportOrderRow[]>
  }
}

export function createSalesReportService(deps: SalesReportDeps) {
  return {
    async getCreatorSalesReport(input: {
      userId: string
      month: string
    }): Promise<CreatorSalesReport> {
      const bounds = parseReportMonth(input.month)
      const emptyReport = createEmptyReport(input.month, bounds.daysInMonth)
      const profile = await deps.creatorRepo.findByUserId(deps.db, input.userId)
      if (!profile) return emptyReport

      const rows = await deps.salesReportRepo.listReportableOrders(deps.db, {
        creatorId: profile.id,
        monthStart: bounds.monthStart,
        nextMonthStart: bounds.nextMonthStart,
      })

      return aggregateReport(input.month, bounds.daysInMonth, rows)
    },
  }
}

export function parseReportMonth(month: string): {
  monthStart: Date
  nextMonthStart: Date
  daysInMonth: number
} {
  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw new Error('invalid report month')
  }

  const [yearText, monthText] = month.split('-')
  const year = Number(yearText)
  const monthIndex = Number(monthText) - 1
  if (!Number.isInteger(year) || monthIndex < 0 || monthIndex > 11) {
    throw new Error('invalid report month')
  }

  const monthStart = new Date(Date.UTC(year, monthIndex, 1))
  const nextMonthStart = new Date(Date.UTC(year, monthIndex + 1, 1))
  const daysInMonth = Math.round(
    (nextMonthStart.getTime() - monthStart.getTime()) / 86_400_000,
  )

  return { monthStart, nextMonthStart, daysInMonth }
}

function aggregateReport(
  month: string,
  daysInMonth: number,
  rows: SalesReportOrderRow[],
): CreatorSalesReport {
  const report = createEmptyReport(month, daysInMonth)
  const packageMap = new Map<string, SalesReportPackageRow>()

  for (const row of rows) {
    const packageRow = getPackageRow(packageMap, row)
    if (row.status === 'refunded') {
      report.summary.refundedCount += 1
      report.summary.refundedMinor += row.amountMinor
      packageRow.refundedCount += 1
      continue
    }
    if (row.status === 'refund_pending') {
      report.summary.refundPendingCount += 1
      report.summary.refundPendingMinor += row.amountMinor
      continue
    }

    report.summary.grossSalesMinor += row.amountMinor
    report.summary.soldCount += 1
    packageRow.grossSalesMinor += row.amountMinor
    packageRow.soldCount += 1

    const dayIndex = Number(row.createdAt.slice(8, 10)) - 1
    const daily = report.dailyRows[dayIndex]
    if (daily) {
      daily.grossSalesMinor += row.amountMinor
      daily.soldCount += 1
    }
  }

  report.summary.confirmedRevenueMinor = revenueShare(report.summary.grossSalesMinor)
  for (const daily of report.dailyRows) {
    daily.confirmedRevenueMinor = revenueShare(daily.grossSalesMinor)
  }
  for (const row of packageMap.values()) {
    row.confirmedRevenueMinor = revenueShare(row.grossSalesMinor)
  }

  report.packageRows = [...packageMap.values()]
    .filter((row) => row.soldCount > 0 || row.refundedCount > 0)
    .sort((a, b) => {
      if (b.grossSalesMinor !== a.grossSalesMinor) {
        return b.grossSalesMinor - a.grossSalesMinor
      }
      if (b.soldCount !== a.soldCount) return b.soldCount - a.soldCount
      return a.packageName.localeCompare(b.packageName)
    })

  return report
}

function createEmptyReport(month: string, daysInMonth: number): CreatorSalesReport {
  return {
    month,
    summary: {
      grossSalesMinor: 0,
      confirmedRevenueMinor: 0,
      soldCount: 0,
      refundedCount: 0,
      refundedMinor: 0,
      refundPendingCount: 0,
      refundPendingMinor: 0,
      currency: DEFAULT_CURRENCY,
    },
    dailyRows: Array.from({ length: daysInMonth }, (_, index) => {
      const day = String(index + 1).padStart(2, '0')
      return {
        date: `${month}-${day}`,
        grossSalesMinor: 0,
        confirmedRevenueMinor: 0,
        soldCount: 0,
      }
    }),
    packageRows: [],
  }
}

function getPackageRow(
  packageMap: Map<string, SalesReportPackageRow>,
  row: SalesReportOrderRow,
): SalesReportPackageRow {
  const existing = packageMap.get(row.packageId)
  if (existing) return existing

  const next = {
    packageId: row.packageId,
    packageName: row.packageName,
    grossSalesMinor: 0,
    confirmedRevenueMinor: 0,
    soldCount: 0,
    refundedCount: 0,
  }
  packageMap.set(row.packageId, next)
  return next
}

function revenueShare(amountMinor: number): number {
  return Math.floor((amountMinor * CREATOR_REVENUE_SHARE_BPS) / 10_000)
}
```

- [ ] **Step 3.2: Run service unit tests**

Run:

```bash
bun run --cwd apps/server test:unit -- sales-report.service.test.ts
```

Expected: PASS.

- [ ] **Step 3.3: Commit service behavior**

```bash
git add apps/server/src/services/sticker-market/sales-report.service.ts apps/server/src/services/sticker-market/sales-report.service.test.ts
git commit -m "feat(creator-market): calculate creator sales reports"
```

---

## Task 4: Sales Report Repository Integration

**Files:**
- Create: `apps/server/src/services/sticker-market/sales-report.repository.ts`
- Create: `apps/server/src/services/sticker-market/sales-report.repository.int.test.ts`

- [ ] **Step 4.1: Implement repository**

Create `apps/server/src/services/sticker-market/sales-report.repository.ts`:

```ts
import { and, eq, gte, inArray, lt } from 'drizzle-orm'
import { stickerPackage } from '@vine/db/schema-public'
import { stickerOrder } from '@vine/db/schema-private'

import type { SalesReportOrderRow } from './sales-report.service'

const REPORTABLE_ORDER_STATUSES = [
  'paid',
  'refund_failed',
  'refund_pending',
  'refunded',
] as const

export function createSalesReportRepository() {
  return {
    async listReportableOrders(
      db: any,
      input: { creatorId: string; monthStart: Date; nextMonthStart: Date },
    ): Promise<SalesReportOrderRow[]> {
      const rows = await db
        .select({
          orderId: stickerOrder.id,
          packageId: stickerPackage.id,
          packageName: stickerPackage.name,
          amountMinor: stickerOrder.amountMinor,
          currency: stickerOrder.currency,
          status: stickerOrder.status,
          createdAt: stickerOrder.createdAt,
        })
        .from(stickerOrder)
        .innerJoin(stickerPackage, eq(stickerOrder.packageId, stickerPackage.id))
        .where(
          and(
            eq(stickerPackage.creatorId, input.creatorId),
            gte(stickerOrder.createdAt, input.monthStart.toISOString()),
            lt(stickerOrder.createdAt, input.nextMonthStart.toISOString()),
            inArray(stickerOrder.status, REPORTABLE_ORDER_STATUSES),
          ),
        )
        .orderBy(stickerOrder.createdAt)

      return rows as SalesReportOrderRow[]
    },
  }
}
```

- [ ] **Step 4.2: Write integration tests**

Create `apps/server/src/services/sticker-market/sales-report.repository.int.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { creatorProfile, stickerPackage } from '@vine/db/schema-public'
import { stickerOrder } from '@vine/db/schema-private'
import { withRollbackDb } from '../../test/integration-db'
import { createSalesReportRepository } from './sales-report.repository'

describe('SalesReportRepository DB integration', () => {
  it('returns only current-month reportable orders for creator-owned packages', async () => {
    await withRollbackDb(async (db) => {
      const repo = createSalesReportRepository()
      await insertCreator(db, 'creator_a', 'user_a')
      await insertCreator(db, 'creator_b', 'user_b')
      await insertPackage(db, 'pkg_a', 'creator_a', 'Cats')
      await insertPackage(db, 'pkg_b', 'creator_b', 'Dogs')
      await insertPackage(db, 'pkg_seed', null, 'Seed')

      await insertOrder(db, 'order_paid', 'pkg_a', 'paid', 100, '2026-04-03T10:00:00Z')
      await insertOrder(
        db,
        'order_refund_failed',
        'pkg_a',
        'refund_failed',
        200,
        '2026-04-03T11:00:00Z',
      )
      await insertOrder(
        db,
        'order_refund_pending',
        'pkg_a',
        'refund_pending',
        300,
        '2026-04-03T12:00:00Z',
      )
      await insertOrder(
        db,
        'order_refunded',
        'pkg_a',
        'refunded',
        400,
        '2026-04-03T13:00:00Z',
      )
      await insertOrder(db, 'order_created', 'pkg_a', 'created', 500, '2026-04-03T14:00:00Z')
      await insertOrder(db, 'order_failed', 'pkg_a', 'failed', 600, '2026-04-03T15:00:00Z')
      await insertOrder(db, 'order_other_creator', 'pkg_b', 'paid', 700, '2026-04-03T16:00:00Z')
      await insertOrder(db, 'order_seed', 'pkg_seed', 'paid', 800, '2026-04-03T17:00:00Z')
      await insertOrder(db, 'order_other_month', 'pkg_a', 'paid', 900, '2026-05-01T00:00:00Z')

      const rows = await repo.listReportableOrders(db, {
        creatorId: 'creator_a',
        monthStart: new Date('2026-04-01T00:00:00Z'),
        nextMonthStart: new Date('2026-05-01T00:00:00Z'),
      })

      expect(rows.map((row) => row.orderId)).toEqual([
        'order_paid',
        'order_refund_failed',
        'order_refund_pending',
        'order_refunded',
      ])
      expect(rows.every((row) => row.packageId === 'pkg_a')).toBe(true)
    })
  })
})

async function insertCreator(db: any, id: string, userId: string) {
  await db.insert(creatorProfile).values({
    id,
    userId,
    displayName: id,
    country: 'TW',
    bio: '',
    createdAt: '2026-04-01T00:00:00Z',
    updatedAt: '2026-04-01T00:00:00Z',
  })
}

async function insertPackage(
  db: any,
  id: string,
  creatorId: string | null,
  name: string,
) {
  await db.insert(stickerPackage).values({
    id,
    creatorId,
    name,
    description: '',
    priceMinor: 75,
    currency: 'TWD',
    coverDriveKey: 'cover.png',
    tabIconDriveKey: 'tab.png',
    stickerCount: 8,
    status: 'on_sale',
    stickerType: 'static',
    locale: 'zh-TW',
    tags: '[]',
    copyrightText: '',
    autoPublish: true,
    reviewProblemAssetNumbers: '[]',
    createdAt: '2026-04-01T00:00:00Z',
    updatedAt: '2026-04-01T00:00:00Z',
  })
}

async function insertOrder(
  db: any,
  id: string,
  packageId: string,
  status: 'created' | 'paid' | 'failed' | 'refund_pending' | 'refunded' | 'refund_failed',
  amountMinor: number,
  createdAt: string,
) {
  await db.insert(stickerOrder).values({
    id,
    userId: `${id}_user`,
    packageId,
    amountMinor,
    currency: 'TWD',
    status,
    connectorName: 'ecpay',
    createdAt,
    updatedAt: createdAt,
  })
}
```

- [ ] **Step 4.3: Run repository integration test and fix only repository/test issues**

Ensure PostgreSQL and migrations are running:

```bash
docker compose up -d pgdb migrate
ZERO_UPSTREAM_DB=postgresql://user:password@localhost:5533/postgres bun run --cwd apps/server test:integration -- sales-report.repository.int.test.ts
```

Expected: PASS.

- [ ] **Step 4.4: Commit repository**

```bash
git add apps/server/src/services/sticker-market/sales-report.repository.ts apps/server/src/services/sticker-market/sales-report.repository.int.test.ts
git commit -m "feat(creator-market): query creator sales report orders"
```

---

## Task 5: Server Wiring And Connect Handler

**Files:**
- Modify: `apps/server/src/services/sticker-market/index.ts`
- Modify: `apps/server/src/connect/stickerMarketCreator.ts`
- Modify: `apps/server/src/index.ts`

- [ ] **Step 5.1: Wire service factory**

In `apps/server/src/services/sticker-market/index.ts`, add imports:

```ts
import { createSalesReportRepository } from './sales-report.repository'
import { createSalesReportService } from './sales-report.service'
```

Inside `createStickerMarketServices`, instantiate the repo:

```ts
  const salesReportRepo = createSalesReportRepository()
```

Return the service:

```ts
    salesReport: createSalesReportService({
      db: deps.db,
      creatorRepo,
      salesReportRepo,
    }),
```

The returned object should include `salesReport` next to `submission` and `review`.

- [ ] **Step 5.2: Extend creator handler deps**

In `apps/server/src/connect/stickerMarketCreator.ts`, update `StickerMarketCreatorHandlerDeps`:

```ts
export type StickerMarketCreatorHandlerDeps = {
  creatorRepo: any
  submission: any
  salesReport: any
  db: any
}
```

- [ ] **Step 5.3: Add creator handler method**

In the object returned by `createStickerMarketCreatorHandler`, add:

```ts
    async getCreatorSalesReport(req: { month: string }, ctx: HandlerContext) {
      const auth = requireAuthData(ctx)
      try {
        const report = await deps.salesReport.getCreatorSalesReport({
          userId: auth.id,
          month: req.month,
        })
        return mapCreatorSalesReport(report)
      } catch (err) {
        if (err instanceof Error && err.message === 'invalid report month') {
          throw new ConnectError('invalid report month', Code.InvalidArgument)
        }
        throw err
      }
    },
```

Append mapper functions near the existing mappers:

```ts
function mapCreatorSalesReport(report: any) {
  return {
    month: report.month,
    summary: {
      grossSalesMinor: report.summary.grossSalesMinor,
      confirmedRevenueMinor: report.summary.confirmedRevenueMinor,
      soldCount: report.summary.soldCount,
      refundedCount: report.summary.refundedCount,
      refundedMinor: report.summary.refundedMinor,
      refundPendingCount: report.summary.refundPendingCount,
      refundPendingMinor: report.summary.refundPendingMinor,
      currency: report.summary.currency,
    },
    dailyRows: report.dailyRows.map((row: any) => ({
      date: row.date,
      grossSalesMinor: row.grossSalesMinor,
      confirmedRevenueMinor: row.confirmedRevenueMinor,
      soldCount: row.soldCount,
    })),
    packageRows: report.packageRows.map((row: any) => ({
      packageId: row.packageId,
      packageName: row.packageName,
      grossSalesMinor: row.grossSalesMinor,
      confirmedRevenueMinor: row.confirmedRevenueMinor,
      soldCount: row.soldCount,
      refundedCount: row.refundedCount,
    })),
  }
}
```

- [ ] **Step 5.4: Pass service into Connect routes**

In `apps/server/src/index.ts`, update `stickerMarketCreator` deps:

```ts
    stickerMarketCreator: {
      creatorRepo: stickerMarket.creatorRepo,
      submission: stickerMarket.submission,
      salesReport: stickerMarket.salesReport,
      db,
    },
```

- [ ] **Step 5.5: Run targeted server checks**

Run:

```bash
bun run --cwd apps/server test:unit -- sales-report.service.test.ts
ZERO_UPSTREAM_DB=postgresql://user:password@localhost:5533/postgres bun run --cwd apps/server test:integration -- sales-report.repository.int.test.ts
```

Expected: both PASS.

- [ ] **Step 5.6: Commit server wiring**

```bash
git add apps/server/src/services/sticker-market/index.ts apps/server/src/connect/stickerMarketCreator.ts apps/server/src/index.ts
git commit -m "feat(creator-market): expose creator sales report endpoint"
```

---

## Task 6: Web Client Helpers

**Files:**
- Modify: `apps/web/src/features/sticker-market/creator/client.ts`

- [ ] **Step 6.1: Add report query helpers**

Update `apps/web/src/features/sticker-market/creator/client.ts`:

```ts
import { createClient } from '@connectrpc/connect'
import { StickerMarketCreatorService } from '@vine/proto/stickerMarket'
import { connectTransport } from '~/features/auth/client/connectTransport'

export const stickerMarketCreatorClient = createClient(
  StickerMarketCreatorService,
  connectTransport,
)

export function creatorSalesReportQueryKey(month: string) {
  return ['sticker-market', 'creator-sales-report', month] as const
}

export function getCurrentReportMonth(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

export function shiftReportMonth(month: string, delta: number) {
  const [yearText, monthText] = month.split('-')
  const date = new Date(Number(yearText), Number(monthText) - 1 + delta, 1)
  return getCurrentReportMonth(date)
}

export function formatTwdMinor(amountMinor: number) {
  return `NT$${amountMinor.toLocaleString('zh-TW')}`
}
```

- [ ] **Step 6.2: Run typecheck once generated proto exists**

Run:

```bash
bun run check:all
```

Expected at this point: either PASS or failures only from not-yet-created UI imports. If unrelated failures exist, record them before continuing.

- [ ] **Step 6.3: Commit client helpers**

```bash
git add apps/web/src/features/sticker-market/creator/client.ts
git commit -m "feat(creator-market): add sales report client helpers"
```

---

## Task 7: Sales Report Page UI

**Files:**
- Create: `apps/web/src/features/sticker-market/creator/CreatorSalesReport.tsx`
- Create: `apps/web/app/(app)/creator/sales.tsx`
- Modify: `apps/web/src/features/sticker-market/creator/CreatorShell.tsx`

- [ ] **Step 7.1: Create route file**

Create `apps/web/app/(app)/creator/sales.tsx`:

```ts
import { CreatorSalesReport } from '~/features/sticker-market/creator/CreatorSalesReport'

export default CreatorSalesReport
```

- [ ] **Step 7.2: Create sales report component**

Create `apps/web/src/features/sticker-market/creator/CreatorSalesReport.tsx`:

```tsx
import { useMemo, useState } from 'react'
import { SizableText, XStack, YStack } from 'tamagui'

import { Button } from '~/interface/buttons/Button'
import { useTanQuery } from '~/query'
import {
  creatorSalesReportQueryKey,
  formatTwdMinor,
  getCurrentReportMonth,
  shiftReportMonth,
  stickerMarketCreatorClient,
} from '~/features/sticker-market/creator/client'

export function CreatorSalesReport() {
  const [month, setMonth] = useState(() => getCurrentReportMonth())
  const report = useTanQuery({
    queryKey: creatorSalesReportQueryKey(month),
    queryFn: () => stickerMarketCreatorClient.getCreatorSalesReport({ month }),
  })
  const data = report.data
  const maxDailyGross = useMemo(
    () => Math.max(1, ...(data?.dailyRows ?? []).map((row) => row.grossSalesMinor)),
    [data?.dailyRows],
  )

  return (
    <YStack flex={1} minW={0} p="$4" gap="$4">
      <XStack items="center" justify="space-between" gap="$3" flexWrap="wrap">
        <SizableText size="$6" fontWeight="700">
          銷售報表
        </SizableText>
        <XStack items="center" gap="$2">
          <Button variant="outlined" onPress={() => setMonth(shiftReportMonth(month, -1))}>
            上個月
          </Button>
          <SizableText minW={84} text="center" fontWeight="600">
            {month}
          </SizableText>
          <Button variant="outlined" onPress={() => setMonth(shiftReportMonth(month, 1))}>
            下個月
          </Button>
        </XStack>
      </XStack>

      {report.isLoading && <SizableText color="$color10">載入中...</SizableText>}
      {report.isError && <SizableText color="$red10">銷售報表載入失敗</SizableText>}

      {data && (
        <>
          <XStack gap="$3" flexWrap="wrap">
            <MetricCard label="本月銷售" value={formatTwdMinor(data.summary?.grossSalesMinor ?? 0)} />
            <MetricCard
              label="預估分潤"
              value={formatTwdMinor(data.summary?.confirmedRevenueMinor ?? 0)}
            />
            <MetricCard label="銷售件數" value={`${data.summary?.soldCount ?? 0} 份`} />
            <MetricCard
              label="退款扣回"
              value={formatTwdMinor(data.summary?.refundedMinor ?? 0)}
              detail={`${data.summary?.refundedCount ?? 0} 筆`}
            />
            <MetricCard
              label="退款處理中"
              value={formatTwdMinor(data.summary?.refundPendingMinor ?? 0)}
              detail={`${data.summary?.refundPendingCount ?? 0} 筆`}
            />
          </XStack>

          <YStack gap="$3">
            <SizableText size="$4" fontWeight="700">
              每日銷售趨勢
            </SizableText>
            <XStack height={160} items="flex-end" gap="$1" px="$2" py="$2" bg="$color2" rounded="$4">
              {data.dailyRows.map((row) => {
                const height = row.grossSalesMinor === 0 ? 4 : Math.max(8, (row.grossSalesMinor / maxDailyGross) * 132)
                return (
                  <YStack key={row.date} flex={1} minW={6} items="center" gap="$1">
                    <YStack width="100%" maxW={18} height={height} bg="$green9" rounded="$2" />
                    <SizableText size="$1" color="$color10">
                      {Number(row.date.slice(8, 10))}
                    </SizableText>
                  </YStack>
                )
              })}
            </XStack>
          </YStack>

          <YStack gap="$3">
            <SizableText size="$4" fontWeight="700">
              各貼圖組銷售排行
            </SizableText>
            <YStack bg="$color2" rounded="$4" overflow="hidden">
              {data.packageRows.length === 0 && (
                <SizableText p="$3" color="$color10">
                  這個月份還沒有銷售資料
                </SizableText>
              )}
              {data.packageRows.map((row, index) => (
                <XStack
                  key={row.packageId}
                  px="$3"
                  py="$2"
                  gap="$3"
                  items="center"
                  borderBottomWidth={index === data.packageRows.length - 1 ? 0 : 1}
                  borderBottomColor="$color4"
                >
                  <SizableText width={28} color="$color10">
                    #{index + 1}
                  </SizableText>
                  <SizableText flex={1} minW={0} numberOfLines={1} fontWeight="600">
                    {row.packageName}
                  </SizableText>
                  <SizableText width={72} text="right">
                    {row.soldCount} 份
                  </SizableText>
                  <SizableText width={96} text="right">
                    {formatTwdMinor(row.grossSalesMinor)}
                  </SizableText>
                  <SizableText width={96} text="right" color="$color10">
                    {formatTwdMinor(row.confirmedRevenueMinor)}
                  </SizableText>
                </XStack>
              ))}
            </YStack>
          </YStack>
        </>
      )}
    </YStack>
  )
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string
  value: string
  detail?: string | undefined
}) {
  return (
    <YStack flex={1} minW={150} p="$3" bg="$color2" rounded="$4" gap="$1">
      <SizableText size="$2" color="$color10">
        {label}
      </SizableText>
      <SizableText size="$6" fontWeight="700">
        {value}
      </SizableText>
      {detail && (
        <SizableText size="$2" color="$color10">
          {detail}
        </SizableText>
      )}
    </YStack>
  )
}
```

- [ ] **Step 7.3: Add nav link**

In `apps/web/src/features/sticker-market/creator/CreatorShell.tsx`, insert this link after the packages link:

```tsx
        <Link href={'/creator/sales' as any}>
          <SizableText>銷售報表</SizableText>
        </Link>
```

- [ ] **Step 7.4: Run web checks**

Run:

```bash
bun run check:all
```

Expected: PASS. If Tamagui prop typing fails, fix the component using repo-supported shorthands and existing `~/interface/*` components.

- [ ] **Step 7.5: Commit sales page UI**

```bash
git add apps/web/app/\\(app\\)/creator/sales.tsx apps/web/src/features/sticker-market/creator/CreatorSalesReport.tsx apps/web/src/features/sticker-market/creator/CreatorShell.tsx
git commit -m "feat(creator-market): add creator sales report page"
```

---

## Task 8: Dashboard Sales Cards

**Files:**
- Modify: `apps/web/src/features/sticker-market/creator/CreatorDashboard.tsx`

- [ ] **Step 8.1: Import report helpers**

Add imports to `CreatorDashboard.tsx`:

```ts
import {
  creatorSalesReportQueryKey,
  formatTwdMinor,
  getCurrentReportMonth,
  stickerMarketCreatorClient,
} from '~/features/sticker-market/creator/client'
import { useTanQuery } from '~/query'
```

If `useTanQuery` is already imported from `~/query`, merge it with the existing import.

- [ ] **Step 8.2: Query current-month sales report**

Inside `CreatorDashboard`, after the package Zero query:

```ts
  const reportMonth = getCurrentReportMonth()
  const salesReport = useTanQuery({
    queryKey: creatorSalesReportQueryKey(reportMonth),
    queryFn: () => stickerMarketCreatorClient.getCreatorSalesReport({ month: reportMonth }),
    enabled: Boolean(profile?.id),
  })
```

- [ ] **Step 8.3: Replace dashboard card layout**

Replace the current three cards and placeholder sales-report block with four cards:

```tsx
      <XStack gap="$3" flexWrap="wrap">
        <YStack flex={1} minW={140} p="$3" bg="$color2" rounded="$4" gap="$1">
          <SizableText size="$2" color="$color10">
            本月銷售
          </SizableText>
          <SizableText size="$7" fontWeight="700">
            {formatTwdMinor(salesReport.data?.summary?.grossSalesMinor ?? 0)}
          </SizableText>
        </YStack>
        <YStack flex={1} minW={140} p="$3" bg="$color2" rounded="$4" gap="$1">
          <SizableText size="$2" color="$color10">
            預估分潤
          </SizableText>
          <SizableText size="$7" fontWeight="700">
            {formatTwdMinor(salesReport.data?.summary?.confirmedRevenueMinor ?? 0)}
          </SizableText>
        </YStack>
        <YStack flex={1} minW={140} p="$3" bg="$color2" rounded="$4" gap="$1">
          <SizableText size="$2" color="$color10">
            作品總數
          </SizableText>
          <SizableText size="$7" fontWeight="700">
            {stats.packageCount}
          </SizableText>
        </YStack>
        <YStack flex={1} minW={140} p="$3" bg="$color2" rounded="$4" gap="$1">
          <SizableText size="$2" color="$color10">
            審核中
          </SizableText>
          <SizableText size="$7" fontWeight="700">
            {stats.inReviewCount}
          </SizableText>
        </YStack>
      </XStack>
```

Remove the old block with text `銷售報表將在 Phase 2B 開放`.

- [ ] **Step 8.4: Run checks**

Run:

```bash
bun run check:all
```

Expected: PASS.

- [ ] **Step 8.5: Commit dashboard wiring**

```bash
git add apps/web/src/features/sticker-market/creator/CreatorDashboard.tsx
git commit -m "feat(creator-market): show sales metrics on creator dashboard"
```

---

## Task 9: Final Verification

**Files:**
- No new files unless verification exposes required fixes.

- [ ] **Step 9.1: Run server unit tests**

```bash
bun run --cwd apps/server test:unit
```

Expected: PASS.

- [ ] **Step 9.2: Run server DB integration tests**

```bash
docker compose up -d pgdb migrate
ZERO_UPSTREAM_DB=postgresql://user:password@localhost:5533/postgres bun run --cwd apps/server test:integration
```

Expected: PASS.

- [ ] **Step 9.3: Run repo check**

```bash
bun run check:all
```

Expected: PASS.

- [ ] **Step 9.4: Inspect diff for scope**

Run:

```bash
git status --short
git diff --stat HEAD
```

Expected:

- Only Phase 2B files listed in this plan are changed.
- No `learn-projects/` changes.
- No payment/refund write-path changes.
- No new DB migration.

- [ ] **Step 9.5: Final commit for verification fixes if needed**

If verification required small fixes, commit them:

```bash
git add <fixed-files>
git commit -m "fix(creator-market): stabilize sales reporting"
```

If no fixes were needed, do not create an empty commit.
