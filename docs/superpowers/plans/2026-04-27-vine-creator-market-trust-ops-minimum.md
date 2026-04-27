# Vine Creator Market Trust Ops Minimum Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Phase 4A Trust Ops Minimum: logged-in sticker package reports, admin triage, force remove/restore, creator payout holds, audit history, and removed-package/payout enforcement.

**Architecture:** Trust operations are private server data handled through ConnectRPC. User-facing reports go through `StickerMarketUserService`; admin triage and actions go through `StickerMarketAdminService`; payout holds live on `creatorProfile` and are enforced in `payout.service.ts`. Removed packages remain usable by existing entitlement owners but are hidden from discovery and blocked from new checkout.

**Tech Stack:** Bun, TypeScript, Drizzle schema, hand-written DB migrations, ConnectRPC, Vitest, One, Tamagui, React Query.

---

## Scope And Current Constraints

- Approved design spec: `docs/superpowers/specs/2026-04-27-vine-creator-market-trust-ops-minimum-design.md`.
- Existing uncommitted file before this plan: `docs/vine-creator-market-roadmap.md`. Do not stage it unless the user explicitly asks.
- Do not modify `learn-projects/`.
- Do not use raw `fetch()` for these flows. Use the generated ConnectRPC client.
- Frontend UI in `apps/web` must use existing `~/interface/*` components where available.
- Public discovery paths and checkout must reject `removed`; chat entitlement usage must remain unchanged.

---

## File Map

Create:

- `packages/db/src/migrations/20260427000001_creator_market_trust_ops.ts` - DB migration for trust tables and creator payout hold fields.
- `apps/server/src/services/sticker-market/trust.repository.ts` - private trust report/action/hold persistence and joins.
- `apps/server/src/services/sticker-market/trust.service.ts` - validation and orchestration for reports, report transitions, remove/restore, and creator payout holds.
- `apps/server/src/services/sticker-market/trust.service.test.ts` - trust service unit tests.
- `apps/web/app/(app)/admin/trust-reports/index.tsx` - admin trust report queue route.
- `apps/web/app/(app)/admin/trust-reports/[reportId].tsx` - admin trust report detail route.
- `apps/web/src/features/sticker-market/admin/AdminTrustReportsPage.tsx` - trust report queue UI.
- `apps/web/src/features/sticker-market/admin/AdminTrustReportDetail.tsx` - trust report detail/action UI.
- `apps/web/src/features/sticker-market/ReportStickerPackageDialog.tsx` - package report form.

Modify:

- `packages/db/src/schema-private.ts` - add trust tables.
- `packages/db/src/schema-public.ts` - add creator payout hold fields to `creatorProfile`.
- `packages/proto/proto/stickerMarket/v1/stickerMarket.proto` - add report/admin messages and RPCs.
- `packages/proto/gen/stickerMarket/v1/stickerMarket_pb.ts` - generated via `bun run --cwd packages/proto proto:generate`.
- `apps/server/src/services/sticker-market/index.ts` - instantiate trust service.
- `apps/server/src/services/sticker-market/package.repository.ts` - add remove/restore methods.
- `apps/server/src/services/sticker-market/payout.repository.ts` - expose creator hold state for pending requests and gate lookups.
- `apps/server/src/services/sticker-market/payout.service.ts` - block payout-forward transitions for held creators.
- `apps/server/src/services/sticker-market/discovery.repository.ts` and/or `discovery.service.ts` - ensure all public discovery paths omit removed packages.
- `apps/server/src/connect/stickerMarketUser.ts` - add `reportStickerPackage`.
- `apps/server/src/connect/stickerMarketAdmin.ts` - add trust ops admin RPCs.
- `apps/server/src/connect/stickerMarketAdmin.test.ts` - admin permission and mapping tests.
- `apps/server/src/connect/stickerMarketUser.test.ts` - user report handler tests.
- `apps/web/src/features/sticker-market/PackageDetail.tsx` - add report entry point and hide checkout for removed packages if returned.
- `apps/web/src/features/sticker-market/admin/AdminPayoutsPage.tsx` - display hold state and disable forward payout actions.
- `apps/web/src/features/sticker-market/admin/client.ts` - uses generated client only; usually no manual change beyond generated proto typing.
- `apps/web/src/test/unit/features/sticker-market/creator-client.test.ts` or new focused web tests if the current test setup supports these surfaces.

---

### Task 1: Database Schema And Migration

**Files:**
- Create: `packages/db/src/migrations/20260427000001_creator_market_trust_ops.ts`
- Modify: `packages/db/src/schema-private.ts`
- Modify: `packages/db/src/schema-public.ts`

- [ ] **Step 1: Add failing type-level references in schema**

Add the private table declarations and public creator hold fields. The first compile/check run should fail until all imports and table definitions are correct.

In `packages/db/src/schema-private.ts`, extend the import list:

```ts
import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
```

Append after `creatorPayoutAuditEvent`:

```ts
export const stickerTrustReport = pgTable(
  'stickerTrustReport',
  {
    id: text('id').primaryKey(),
    packageId: text('packageId')
      .notNull()
      .references(() => stickerPackage.id),
    reporterUserId: text('reporterUserId').notNull(),
    reasonCategory: text('reasonCategory')
      .notNull()
      .$type<'copyright' | 'prohibited_content' | 'fraud' | 'other'>(),
    reasonText: text('reasonText').notNull(),
    status: text('status')
      .notNull()
      .$type<'open' | 'reviewing' | 'resolved' | 'dismissed'>()
      .default('open'),
    reviewedByUserId: text('reviewedByUserId'),
    resolutionText: text('resolutionText'),
    resolvedAt: timestamp('resolvedAt', { mode: 'string' }),
    createdAt: timestamp('createdAt', { mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp('updatedAt', { mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    index('stickerTrustReport_packageId_idx').on(table.packageId),
    index('stickerTrustReport_reporterUserId_idx').on(table.reporterUserId),
    index('stickerTrustReport_status_idx').on(table.status),
  ],
)

export const stickerTrustActionEvent = pgTable(
  'stickerTrustActionEvent',
  {
    id: text('id').primaryKey(),
    reportId: text('reportId').references(() => stickerTrustReport.id),
    packageId: text('packageId').references(() => stickerPackage.id),
    creatorId: text('creatorId'),
    actorUserId: text('actorUserId').notNull(),
    action: text('action')
      .notNull()
      .$type<
        | 'report_created'
        | 'report_reviewing'
        | 'report_resolved'
        | 'report_dismissed'
        | 'package_removed'
        | 'package_restored'
        | 'creator_payout_hold_enabled'
        | 'creator_payout_hold_cleared'
      >(),
    reasonText: text('reasonText').notNull().default(''),
    metadataJson: text('metadataJson').notNull().default('{}'),
    createdAt: timestamp('createdAt', { mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    index('stickerTrustActionEvent_reportId_idx').on(table.reportId),
    index('stickerTrustActionEvent_packageId_idx').on(table.packageId),
    index('stickerTrustActionEvent_creatorId_idx').on(table.creatorId),
  ],
)
```

In `packages/db/src/schema-public.ts`, add these fields to `creatorProfile`:

```ts
payoutHoldAt: timestamp('payoutHoldAt', { mode: 'string' }),
payoutHoldByUserId: text('payoutHoldByUserId'),
payoutHoldReason: text('payoutHoldReason'),
```

- [ ] **Step 2: Add migration**

Create `packages/db/src/migrations/20260427000001_creator_market_trust_ops.ts`:

```ts
import type { PoolClient } from 'pg'

export async function up(client: PoolClient) {
  await client.query(`
ALTER TABLE "creatorProfile"
  ADD COLUMN IF NOT EXISTS "payoutHoldAt" timestamp,
  ADD COLUMN IF NOT EXISTS "payoutHoldByUserId" text,
  ADD COLUMN IF NOT EXISTS "payoutHoldReason" text;

CREATE TABLE "stickerTrustReport" (
  "id" text PRIMARY KEY,
  "packageId" text NOT NULL REFERENCES "stickerPackage" ("id"),
  "reporterUserId" text NOT NULL,
  "reasonCategory" text NOT NULL,
  "reasonText" text NOT NULL,
  "status" text NOT NULL DEFAULT 'open',
  "reviewedByUserId" text,
  "resolutionText" text,
  "resolvedAt" timestamp,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX "stickerTrustReport_packageId_idx" ON "stickerTrustReport" ("packageId");
CREATE INDEX "stickerTrustReport_reporterUserId_idx" ON "stickerTrustReport" ("reporterUserId");
CREATE INDEX "stickerTrustReport_status_idx" ON "stickerTrustReport" ("status");

CREATE TABLE "stickerTrustActionEvent" (
  "id" text PRIMARY KEY,
  "reportId" text REFERENCES "stickerTrustReport" ("id"),
  "packageId" text REFERENCES "stickerPackage" ("id"),
  "creatorId" text,
  "actorUserId" text NOT NULL,
  "action" text NOT NULL,
  "reasonText" text NOT NULL DEFAULT '',
  "metadataJson" text NOT NULL DEFAULT '{}',
  "createdAt" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX "stickerTrustActionEvent_reportId_idx" ON "stickerTrustActionEvent" ("reportId");
CREATE INDEX "stickerTrustActionEvent_packageId_idx" ON "stickerTrustActionEvent" ("packageId");
CREATE INDEX "stickerTrustActionEvent_creatorId_idx" ON "stickerTrustActionEvent" ("creatorId");
`)
}

export async function down(client: PoolClient) {
  await client.query(`
DROP TABLE IF EXISTS "stickerTrustActionEvent";
DROP TABLE IF EXISTS "stickerTrustReport";
ALTER TABLE "creatorProfile"
  DROP COLUMN IF EXISTS "payoutHoldAt",
  DROP COLUMN IF EXISTS "payoutHoldByUserId",
  DROP COLUMN IF EXISTS "payoutHoldReason";
`)
}
```

- [ ] **Step 3: Verify database package compiles**

Run:

```bash
bun run --cwd apps/server typecheck
```

Expected: it may fail because later code still does not reference new generated proto methods. Fix only schema import/type errors in this task.

- [ ] **Step 4: Commit database schema slice**

```bash
git add packages/db/src/schema-private.ts packages/db/src/schema-public.ts packages/db/src/migrations/20260427000001_creator_market_trust_ops.ts
git commit -m "feat(creator-market): add trust ops schema"
```

---

### Task 2: Proto Contract And Generated Client

**Files:**
- Modify: `packages/proto/proto/stickerMarket/v1/stickerMarket.proto`
- Modify: `packages/proto/gen/stickerMarket/v1/stickerMarket_pb.ts`

- [ ] **Step 1: Add proto messages and RPCs**

In `StickerMarketUserService`, add:

```proto
rpc ReportStickerPackage(ReportStickerPackageRequest) returns (ReportStickerPackageResponse);
```

In `StickerMarketAdminService`, add:

```proto
rpc ListTrustReports(ListTrustReportsRequest) returns (ListTrustReportsResponse);
rpc GetTrustReportDetail(GetTrustReportDetailRequest) returns (GetTrustReportDetailResponse);
rpc MarkTrustReportReviewing(MarkTrustReportReviewingRequest) returns (MarkTrustReportReviewingResponse);
rpc ResolveTrustReport(ResolveTrustReportRequest) returns (ResolveTrustReportResponse);
rpc DismissTrustReport(DismissTrustReportRequest) returns (DismissTrustReportResponse);
rpc ForceRemoveStickerPackage(ForceRemoveStickerPackageRequest) returns (ForceRemoveStickerPackageResponse);
rpc RestoreStickerPackage(RestoreStickerPackageRequest) returns (RestoreStickerPackageResponse);
rpc HoldCreatorPayouts(HoldCreatorPayoutsRequest) returns (HoldCreatorPayoutsResponse);
rpc ClearCreatorPayoutHold(ClearCreatorPayoutHoldRequest) returns (ClearCreatorPayoutHoldResponse);
```

Add these messages near the existing shared sticker market types:

```proto
enum TrustReportStatus {
  TRUST_REPORT_STATUS_UNSPECIFIED = 0;
  TRUST_REPORT_STATUS_OPEN = 1;
  TRUST_REPORT_STATUS_REVIEWING = 2;
  TRUST_REPORT_STATUS_RESOLVED = 3;
  TRUST_REPORT_STATUS_DISMISSED = 4;
}

message ReportStickerPackageRequest {
  string package_id = 1;
  string reason_category = 2;
  string reason_text = 3;
}

message ReportStickerPackageResponse {
  string report_id = 1;
  TrustReportStatus status = 2;
}

message TrustReportSummary {
  string id = 1;
  string package_id = 2;
  string package_name = 3;
  StickerPackageStatus package_status = 4;
  string creator_id = 5;
  string creator_display_name = 6;
  string reporter_user_id = 7;
  string reason_category = 8;
  string reason_text = 9;
  TrustReportStatus status = 10;
  string created_at = 11;
}

message TrustActionEvent {
  string id = 1;
  string report_id = 2;
  string package_id = 3;
  string creator_id = 4;
  string actor_user_id = 5;
  string action = 6;
  string reason_text = 7;
  string metadata_json = 8;
  string created_at = 9;
}

message CreatorPayoutHold {
  bool held = 1;
  string held_at = 2;
  string held_by_user_id = 3;
  string reason = 4;
}

message ListTrustReportsRequest {
  TrustReportStatus status = 1;
  int32 limit = 2;
}

message ListTrustReportsResponse {
  repeated TrustReportSummary reports = 1;
}

message GetTrustReportDetailRequest {
  string report_id = 1;
}

message GetTrustReportDetailResponse {
  TrustReportSummary report = 1;
  StickerPackageDraft package = 2;
  CreatorProfile creator = 3;
  CreatorPayoutHold payout_hold = 4;
  repeated StickerAsset assets = 5;
  repeated TrustActionEvent events = 6;
}

message MarkTrustReportReviewingRequest {
  string report_id = 1;
  string note = 2;
}
message MarkTrustReportReviewingResponse { TrustReportSummary report = 1; }

message ResolveTrustReportRequest {
  string report_id = 1;
  string resolution_text = 2;
}
message ResolveTrustReportResponse { TrustReportSummary report = 1; }

message DismissTrustReportRequest {
  string report_id = 1;
  string resolution_text = 2;
}
message DismissTrustReportResponse { TrustReportSummary report = 1; }

message ForceRemoveStickerPackageRequest {
  string package_id = 1;
  string reason_text = 2;
  string report_id = 3;
}
message ForceRemoveStickerPackageResponse { StickerPackageDraft package = 1; }

message RestoreStickerPackageRequest {
  string package_id = 1;
  string reason_text = 2;
  string report_id = 3;
}
message RestoreStickerPackageResponse { StickerPackageDraft package = 1; }

message HoldCreatorPayoutsRequest {
  string creator_id = 1;
  string reason_text = 2;
  string report_id = 3;
  string package_id = 4;
}
message HoldCreatorPayoutsResponse { CreatorPayoutHold payout_hold = 1; }

message ClearCreatorPayoutHoldRequest {
  string creator_id = 1;
  string reason_text = 2;
  string report_id = 3;
  string package_id = 4;
}
message ClearCreatorPayoutHoldResponse { CreatorPayoutHold payout_hold = 1; }
```

Extend existing `CreatorPayoutHistoryRow` with admin payout context:

```proto
message CreatorPayoutHistoryRow {
  string id = 1;
  string status = 2;
  int32 net_amount_minor = 3;
  string currency = 4;
  string requested_at = 5;
  string paid_at = 6;
  string failure_reason = 7;
  string reject_reason = 8;
  string creator_id = 9;
  string creator_display_name = 10;
  CreatorPayoutHold payout_hold = 11;
}
```

- [ ] **Step 2: Generate TypeScript proto**

Run:

```bash
bun run --cwd packages/proto proto:generate
```

Expected: command exits 0 and updates `packages/proto/gen/stickerMarket/v1/stickerMarket_pb.ts`.

- [ ] **Step 3: Commit proto slice**

```bash
git add packages/proto/proto/stickerMarket/v1/stickerMarket.proto packages/proto/gen/stickerMarket/v1/stickerMarket_pb.ts
git commit -m "feat(creator-market): add trust ops rpc contract"
```

---

### Task 3: Trust Repository And Service

**Files:**
- Create: `apps/server/src/services/sticker-market/trust.repository.ts`
- Create: `apps/server/src/services/sticker-market/trust.service.ts`
- Create: `apps/server/src/services/sticker-market/trust.service.test.ts`
- Modify: `apps/server/src/services/sticker-market/package.repository.ts`
- Modify: `apps/server/src/services/sticker-market/index.ts`

- [ ] **Step 1: Write failing service tests**

Create `apps/server/src/services/sticker-market/trust.service.test.ts`:

```ts
import { Code, ConnectError } from '@connectrpc/connect'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createTrustService } from './trust.service'

function makeDeps() {
  const repo = {
    createReport: vi.fn(),
    insertActionEvent: vi.fn(),
    listReports: vi.fn(),
    getReportDetail: vi.fn(),
    markReportReviewing: vi.fn(),
    resolveReport: vi.fn(),
    dismissReport: vi.fn(),
    holdCreatorPayouts: vi.fn(),
    clearCreatorPayoutHold: vi.fn(),
  }
  const packageRepo = {
    findById: vi.fn(),
    forceRemove: vi.fn(),
    restoreRemoved: vi.fn(),
  }
  const deps = {
    db: {},
    repo,
    packageRepo,
    createId: vi.fn(),
    now: vi.fn(),
  }
  deps.createId.mockReturnValueOnce('report-1').mockReturnValueOnce('event-1')
  deps.now.mockReturnValue(new Date('2026-04-27T00:00:00.000Z'))
  return deps
}

describe('createTrustService', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates an open report and audit event for an on-sale package', async () => {
    const deps = makeDeps()
    deps.packageRepo.findById.mockResolvedValue({
      id: 'pkg-1',
      creatorId: 'creator-1',
      status: 'on_sale',
    })
    deps.repo.createReport.mockResolvedValue({
      id: 'report-1',
      packageId: 'pkg-1',
      reporterUserId: 'user-1',
      reasonCategory: 'copyright',
      reasonText: 'This looks copied from my artwork.',
      status: 'open',
      createdAt: '2026-04-27T00:00:00.000Z',
    })
    const service = createTrustService(deps)

    const report = await service.reportStickerPackage({
      packageId: 'pkg-1',
      reporterUserId: 'user-1',
      reasonCategory: 'copyright',
      reasonText: ' This looks copied from my artwork. ',
    })

    expect(report.id).toBe('report-1')
    expect(deps.repo.createReport).toHaveBeenCalledWith(deps.db, {
      id: 'report-1',
      packageId: 'pkg-1',
      reporterUserId: 'user-1',
      reasonCategory: 'copyright',
      reasonText: 'This looks copied from my artwork.',
      now: '2026-04-27T00:00:00.000Z',
    })
    expect(deps.repo.insertActionEvent).toHaveBeenCalledWith(deps.db, {
      id: 'event-1',
      reportId: 'report-1',
      packageId: 'pkg-1',
      creatorId: 'creator-1',
      actorUserId: 'user-1',
      action: 'report_created',
      reasonText: 'This looks copied from my artwork.',
      metadataJson: JSON.stringify({ reasonCategory: 'copyright' }),
      now: '2026-04-27T00:00:00.000Z',
    })
  })

  it('rejects invalid reason categories', async () => {
    const service = createTrustService(makeDeps())
    await expect(
      service.reportStickerPackage({
        packageId: 'pkg-1',
        reporterUserId: 'user-1',
        reasonCategory: 'spam',
        reasonText: 'This reason has enough characters.',
      }),
    ).rejects.toMatchObject({ code: Code.InvalidArgument })
  })

  it('rejects short reasons', async () => {
    const service = createTrustService(makeDeps())
    await expect(
      service.reportStickerPackage({
        packageId: 'pkg-1',
        reporterUserId: 'user-1',
        reasonCategory: 'copyright',
        reasonText: 'short',
      }),
    ).rejects.toMatchObject({ code: Code.InvalidArgument })
  })

  it('rejects reports for packages that are not on sale', async () => {
    const deps = makeDeps()
    deps.packageRepo.findById.mockResolvedValue({ id: 'pkg-1', status: 'approved' })
    const service = createTrustService(deps)
    await expect(
      service.reportStickerPackage({
        packageId: 'pkg-1',
        reporterUserId: 'user-1',
        reasonCategory: 'copyright',
        reasonText: 'This reason has enough characters.',
      }),
    ).rejects.toMatchObject({ code: Code.FailedPrecondition })
  })

  it('force removes packages and writes an action event', async () => {
    const deps = makeDeps()
    deps.createId.mockReset()
    deps.createId.mockReturnValue('event-1')
    deps.packageRepo.forceRemove.mockResolvedValue({
      id: 'pkg-1',
      creatorId: 'creator-1',
      status: 'removed',
    })
    const service = createTrustService(deps)

    await service.forceRemovePackage({
      actorUserId: 'admin-1',
      packageId: 'pkg-1',
      reportId: 'report-1',
      reasonText: 'Confirmed infringement.',
    })

    expect(deps.packageRepo.forceRemove).toHaveBeenCalled()
    expect(deps.repo.insertActionEvent).toHaveBeenCalledWith(
      deps.db,
      expect.objectContaining({
        action: 'package_removed',
        reasonText: 'Confirmed infringement.',
      }),
    )
  })

  it('restores removed packages and writes an action event', async () => {
    const deps = makeDeps()
    deps.createId.mockReset()
    deps.createId.mockReturnValue('event-1')
    deps.packageRepo.restoreRemoved.mockResolvedValue({
      id: 'pkg-1',
      creatorId: 'creator-1',
      status: 'on_sale',
    })
    const service = createTrustService(deps)

    await service.restorePackage({
      actorUserId: 'admin-1',
      packageId: 'pkg-1',
      reportId: 'report-1',
      reasonText: 'Rights verified.',
    })

    expect(deps.packageRepo.restoreRemoved).toHaveBeenCalled()
    expect(deps.repo.insertActionEvent).toHaveBeenCalledWith(
      deps.db,
      expect.objectContaining({
        action: 'package_restored',
        reasonText: 'Rights verified.',
      }),
    )
  })
})
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
bun run --cwd apps/server test:unit -- src/services/sticker-market/trust.service.test.ts
```

Expected: FAIL because `./trust.service` does not exist.

- [ ] **Step 3: Implement repository**

Create `apps/server/src/services/sticker-market/trust.repository.ts`:

```ts
import { and, desc, eq, inArray } from 'drizzle-orm'
import { creatorProfile, stickerAsset, stickerPackage } from '@vine/db/schema-public'
import {
  stickerTrustActionEvent,
  stickerTrustReport,
} from '@vine/db/schema-private'

export type TrustReportStatus = 'open' | 'reviewing' | 'resolved' | 'dismissed'
export type TrustReasonCategory =
  | 'copyright'
  | 'prohibited_content'
  | 'fraud'
  | 'other'

export function createTrustRepository() {
  return {
    createReport(db: any, input: any) {
      return db
        .insert(stickerTrustReport)
        .values({
          id: input.id,
          packageId: input.packageId,
          reporterUserId: input.reporterUserId,
          reasonCategory: input.reasonCategory,
          reasonText: input.reasonText,
          status: 'open',
          createdAt: input.now,
          updatedAt: input.now,
        })
        .returning()
        .then((rows: any[]) => rows[0])
    },

    insertActionEvent(db: any, input: any) {
      return db.insert(stickerTrustActionEvent).values({
        id: input.id,
        reportId: input.reportId || null,
        packageId: input.packageId || null,
        creatorId: input.creatorId || null,
        actorUserId: input.actorUserId,
        action: input.action,
        reasonText: input.reasonText,
        metadataJson: input.metadataJson ?? '{}',
        createdAt: input.now,
      })
    },

    listReports(db: any, input: { status?: TrustReportStatus; limit: number }) {
      const query = db
        .select({
          id: stickerTrustReport.id,
          packageId: stickerTrustReport.packageId,
          packageName: stickerPackage.name,
          packageStatus: stickerPackage.status,
          creatorId: creatorProfile.id,
          creatorDisplayName: creatorProfile.displayName,
          reporterUserId: stickerTrustReport.reporterUserId,
          reasonCategory: stickerTrustReport.reasonCategory,
          reasonText: stickerTrustReport.reasonText,
          status: stickerTrustReport.status,
          createdAt: stickerTrustReport.createdAt,
        })
        .from(stickerTrustReport)
        .innerJoin(stickerPackage, eq(stickerTrustReport.packageId, stickerPackage.id))
        .leftJoin(creatorProfile, eq(stickerPackage.creatorId, creatorProfile.id))
      const filtered = input.status
        ? query.where(eq(stickerTrustReport.status, input.status))
        : query
      return filtered.orderBy(desc(stickerTrustReport.createdAt))
        .limit(input.limit)
    },

    async getReportDetail(db: any, reportId: string) {
      const [report] = await db
        .select({
          id: stickerTrustReport.id,
          packageId: stickerTrustReport.packageId,
          packageName: stickerPackage.name,
          packageStatus: stickerPackage.status,
          creatorId: creatorProfile.id,
          creatorDisplayName: creatorProfile.displayName,
          reporterUserId: stickerTrustReport.reporterUserId,
          reasonCategory: stickerTrustReport.reasonCategory,
          reasonText: stickerTrustReport.reasonText,
          status: stickerTrustReport.status,
          createdAt: stickerTrustReport.createdAt,
          creatorUserId: creatorProfile.userId,
          creatorCountry: creatorProfile.country,
          creatorBio: creatorProfile.bio,
          creatorStatus: creatorProfile.status,
          payoutHoldAt: creatorProfile.payoutHoldAt,
          payoutHoldByUserId: creatorProfile.payoutHoldByUserId,
          payoutHoldReason: creatorProfile.payoutHoldReason,
        })
        .from(stickerTrustReport)
        .innerJoin(stickerPackage, eq(stickerTrustReport.packageId, stickerPackage.id))
        .leftJoin(creatorProfile, eq(stickerPackage.creatorId, creatorProfile.id))
        .where(eq(stickerTrustReport.id, reportId))
        .limit(1)
      if (!report) return undefined
      const [pkg] = await db
        .select()
        .from(stickerPackage)
        .where(eq(stickerPackage.id, report.packageId))
        .limit(1)
      const assets = await db
        .select()
        .from(stickerAsset)
        .where(eq(stickerAsset.packageId, report.packageId))
        .orderBy(stickerAsset.number)
      const events = await db
        .select()
        .from(stickerTrustActionEvent)
        .where(eq(stickerTrustActionEvent.reportId, reportId))
        .orderBy(desc(stickerTrustActionEvent.createdAt))
      return { report, package: pkg, assets, events }
    },

    transitionReport(db: any, input: any) {
      return db
        .update(stickerTrustReport)
        .set({
          status: input.status,
          reviewedByUserId: input.actorUserId,
          resolutionText: input.resolutionText ?? null,
          resolvedAt:
            input.status === 'resolved' || input.status === 'dismissed'
              ? input.now
              : null,
          updatedAt: input.now,
        })
        .where(
          and(
            eq(stickerTrustReport.id, input.reportId),
            inArray(stickerTrustReport.status, input.fromStatuses),
          ),
        )
        .returning()
        .then((rows: any[]) => rows[0])
    },

    holdCreatorPayouts(db: any, input: any) {
      return db
        .update(creatorProfile)
        .set({
          payoutHoldAt: input.now,
          payoutHoldByUserId: input.actorUserId,
          payoutHoldReason: input.reasonText,
          updatedAt: input.now,
        })
        .where(eq(creatorProfile.id, input.creatorId))
        .returning()
        .then((rows: any[]) => rows[0])
    },

    clearCreatorPayoutHold(db: any, input: any) {
      return db
        .update(creatorProfile)
        .set({
          payoutHoldAt: null,
          payoutHoldByUserId: null,
          payoutHoldReason: null,
          updatedAt: input.now,
        })
        .where(eq(creatorProfile.id, input.creatorId))
        .returning()
        .then((rows: any[]) => rows[0])
    },
  }
}
```

- [ ] **Step 4: Implement package transitions**

In `apps/server/src/services/sticker-market/package.repository.ts`, add methods inside the returned object:

```ts
async forceRemove(
  db: any,
  input: { packageId: string; now: string },
): Promise<StickerPackageRow> {
  const [row] = await db
    .update(stickerPackage)
    .set({ status: 'removed', updatedAt: input.now })
    .where(
      and(
        eq(stickerPackage.id, input.packageId),
        inArray(stickerPackage.status, ['on_sale', 'unlisted', 'approved']),
      ),
    )
    .returning()
  if (!row) throw new Error('package not found or not removable')
  return row
},

async restoreRemoved(
  db: any,
  input: { packageId: string; now: string },
): Promise<StickerPackageRow> {
  const [row] = await db
    .update(stickerPackage)
    .set({ status: 'on_sale', updatedAt: input.now })
    .where(
      and(
        eq(stickerPackage.id, input.packageId),
        eq(stickerPackage.status, 'removed'),
      ),
    )
    .returning()
  if (!row) throw new Error('package not found or not removed')
  return row
},
```

- [ ] **Step 5: Implement service**

Create `apps/server/src/services/sticker-market/trust.service.ts`:

```ts
import { Code, ConnectError } from '@connectrpc/connect'

const reasonCategories = new Set([
  'copyright',
  'prohibited_content',
  'fraud',
  'other',
])

function requireReason(value: string, min = 1) {
  const trimmed = value.trim()
  if (trimmed.length < min) {
    throw new ConnectError('reason is required', Code.InvalidArgument)
  }
  if (trimmed.length > 1000) {
    throw new ConnectError('reason must be 1000 characters or fewer', Code.InvalidArgument)
  }
  return trimmed
}

export function createTrustService(deps: {
  db: any
  repo: any
  packageRepo: any
  createId: () => string
  now: () => Date
}) {
  const nowIso = () => deps.now().toISOString()

  return {
    async reportStickerPackage(input: {
      packageId: string
      reporterUserId: string
      reasonCategory: string
      reasonText: string
    }) {
      if (!reasonCategories.has(input.reasonCategory)) {
        throw new ConnectError('invalid report category', Code.InvalidArgument)
      }
      const reasonText = requireReason(input.reasonText, 10)
      const pkg = await deps.packageRepo.findById(deps.db, input.packageId)
      if (!pkg) throw new ConnectError('package not found', Code.NotFound)
      if (pkg.status !== 'on_sale') {
        throw new ConnectError('package is not reportable', Code.FailedPrecondition)
      }
      const now = nowIso()
      const report = await deps.repo.createReport(deps.db, {
        id: deps.createId(),
        packageId: input.packageId,
        reporterUserId: input.reporterUserId,
        reasonCategory: input.reasonCategory,
        reasonText,
        now,
      })
      await deps.repo.insertActionEvent(deps.db, {
        id: deps.createId(),
        reportId: report.id,
        packageId: input.packageId,
        creatorId: pkg.creatorId,
        actorUserId: input.reporterUserId,
        action: 'report_created',
        reasonText,
        metadataJson: JSON.stringify({ reasonCategory: input.reasonCategory }),
        now,
      })
      return report
    },

    listReports(input: { status?: string; limit: number }) {
      const status =
        input.status && ['open', 'reviewing', 'resolved', 'dismissed'].includes(input.status)
          ? input.status
          : undefined
      return deps.repo.listReports(deps.db, {
        status,
        limit: input.limit > 0 ? input.limit : 50,
      })
    },

    async getReportDetail(input: { reportId: string }) {
      const detail = await deps.repo.getReportDetail(deps.db, input.reportId)
      if (!detail) throw new ConnectError('report not found', Code.NotFound)
      return detail
    },

    async markReviewing(input: { reportId: string; actorUserId: string; note: string }) {
      const now = nowIso()
      const report = await deps.repo.transitionReport(deps.db, {
        reportId: input.reportId,
        actorUserId: input.actorUserId,
        status: 'reviewing',
        fromStatuses: ['open'],
        now,
      })
      if (!report) throw new ConnectError('report is not open', Code.FailedPrecondition)
      await deps.repo.insertActionEvent(deps.db, {
        id: deps.createId(),
        reportId: report.id,
        packageId: report.packageId,
        actorUserId: input.actorUserId,
        action: 'report_reviewing',
        reasonText: input.note.trim(),
        metadataJson: '{}',
        now,
      })
      return report
    },

    async resolveReport(input: {
      reportId: string
      actorUserId: string
      resolutionText: string
    }) {
      return transitionClosed('resolved', 'report_resolved', input)
    },

    async dismissReport(input: {
      reportId: string
      actorUserId: string
      resolutionText: string
    }) {
      return transitionClosed('dismissed', 'report_dismissed', input)
    },

    async forceRemovePackage(input: {
      actorUserId: string
      packageId: string
      reportId?: string
      reasonText: string
    }) {
      const reasonText = requireReason(input.reasonText)
      const now = nowIso()
      const pkg = await deps.packageRepo.forceRemove(deps.db, {
        packageId: input.packageId,
        now,
      })
      await deps.repo.insertActionEvent(deps.db, {
        id: deps.createId(),
        reportId: input.reportId || null,
        packageId: pkg.id,
        creatorId: pkg.creatorId,
        actorUserId: input.actorUserId,
        action: 'package_removed',
        reasonText,
        metadataJson: '{}',
        now,
      })
      return pkg
    },

    async restorePackage(input: {
      actorUserId: string
      packageId: string
      reportId?: string
      reasonText: string
    }) {
      const reasonText = requireReason(input.reasonText)
      const now = nowIso()
      const pkg = await deps.packageRepo.restoreRemoved(deps.db, {
        packageId: input.packageId,
        now,
      })
      await deps.repo.insertActionEvent(deps.db, {
        id: deps.createId(),
        reportId: input.reportId || null,
        packageId: pkg.id,
        creatorId: pkg.creatorId,
        actorUserId: input.actorUserId,
        action: 'package_restored',
        reasonText,
        metadataJson: '{}',
        now,
      })
      return pkg
    },

    async holdCreatorPayouts(input: {
      actorUserId: string
      creatorId: string
      reportId?: string
      packageId?: string
      reasonText: string
    }) {
      const reasonText = requireReason(input.reasonText)
      const now = nowIso()
      const creator = await deps.repo.holdCreatorPayouts(deps.db, {
        ...input,
        reasonText,
        now,
      })
      if (!creator) throw new ConnectError('creator not found', Code.NotFound)
      await deps.repo.insertActionEvent(deps.db, {
        id: deps.createId(),
        reportId: input.reportId || null,
        packageId: input.packageId || null,
        creatorId: input.creatorId,
        actorUserId: input.actorUserId,
        action: 'creator_payout_hold_enabled',
        reasonText,
        metadataJson: '{}',
        now,
      })
      return creator
    },

    async clearCreatorPayoutHold(input: {
      actorUserId: string
      creatorId: string
      reportId?: string
      packageId?: string
      reasonText: string
    }) {
      const reasonText = requireReason(input.reasonText)
      const now = nowIso()
      const creator = await deps.repo.clearCreatorPayoutHold(deps.db, {
        ...input,
        reasonText,
        now,
      })
      if (!creator) throw new ConnectError('creator not found', Code.NotFound)
      await deps.repo.insertActionEvent(deps.db, {
        id: deps.createId(),
        reportId: input.reportId || null,
        packageId: input.packageId || null,
        creatorId: input.creatorId,
        actorUserId: input.actorUserId,
        action: 'creator_payout_hold_cleared',
        reasonText,
        metadataJson: '{}',
        now,
      })
      return creator
    },
  }

  async function transitionClosed(
    status: 'resolved' | 'dismissed',
    action: 'report_resolved' | 'report_dismissed',
    input: { reportId: string; actorUserId: string; resolutionText: string },
  ) {
    const resolutionText = requireReason(input.resolutionText)
    const now = nowIso()
    const report = await deps.repo.transitionReport(deps.db, {
      reportId: input.reportId,
      actorUserId: input.actorUserId,
      status,
      fromStatuses: ['open', 'reviewing'],
      resolutionText,
      now,
    })
    if (!report) {
      throw new ConnectError('report is not open or reviewing', Code.FailedPrecondition)
    }
    await deps.repo.insertActionEvent(deps.db, {
      id: deps.createId(),
      reportId: report.id,
      packageId: report.packageId,
      actorUserId: input.actorUserId,
      action,
      reasonText: resolutionText,
      metadataJson: '{}',
      now,
    })
    return report
  }
}
```

- [ ] **Step 6: Wire service factory**

In `apps/server/src/services/sticker-market/index.ts`, add imports:

```ts
import { createTrustRepository } from './trust.repository'
import { createTrustService } from './trust.service'
```

Instantiate and return:

```ts
const trustRepo = createTrustRepository()
```

Add to returned object:

```ts
trust: createTrustService({
  db: deps.db,
  repo: trustRepo,
  packageRepo,
  now: () => new Date(),
  createId: () => randomUUID(),
}),
```

- [ ] **Step 7: Run trust service tests**

Run:

```bash
bun run --cwd apps/server test:unit -- src/services/sticker-market/trust.service.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit trust service slice**

```bash
git add apps/server/src/services/sticker-market/trust.repository.ts apps/server/src/services/sticker-market/trust.service.ts apps/server/src/services/sticker-market/trust.service.test.ts apps/server/src/services/sticker-market/package.repository.ts apps/server/src/services/sticker-market/index.ts
git commit -m "feat(creator-market): add trust ops service"
```

---

### Task 4: ConnectRPC Handlers And Wiring

**Files:**
- Modify: `apps/server/src/connect/stickerMarketUser.ts`
- Modify: `apps/server/src/connect/stickerMarketAdmin.ts`
- Modify: `apps/server/src/connect/stickerMarketUser.test.ts`
- Modify: `apps/server/src/connect/stickerMarketAdmin.test.ts`
- Modify: `apps/server/src/index.ts`

- [ ] **Step 1: Write failing handler tests**

In `apps/server/src/connect/stickerMarketUser.test.ts`, add:

```ts
it('reports sticker packages through trust service', async () => {
  const deps = makeDeps()
  deps.trust = {
    reportStickerPackage: vi.fn().mockResolvedValue({
      id: 'report-1',
      status: 'open',
    }),
  } as any
  const handler = createStickerMarketUserHandler(deps)

  const result = await handler.reportStickerPackage(
    {
      packageId: 'pkg-1',
      reasonCategory: 'copyright',
      reasonText: 'This looks copied from my artwork.',
    },
    makeAuthCtx({ id: 'user-1' }),
  )

  expect(result.reportId).toBe('report-1')
  expect(deps.trust.reportStickerPackage).toHaveBeenCalledWith({
    packageId: 'pkg-1',
    reporterUserId: 'user-1',
    reasonCategory: 'copyright',
    reasonText: 'This looks copied from my artwork.',
  })
})
```

In `apps/server/src/connect/stickerMarketAdmin.test.ts`, add:

```ts
it('rejects non-admin trust report queue access with PermissionDenied', async () => {
  const handler = createStickerMarketAdminHandler({
    ...makeDeps(),
    trust: { listReports: vi.fn() },
  } as any)

  await expect(
    handler.listTrustReports({ limit: 50 }, makeAuthCtx({ id: 'user-1' })),
  ).rejects.toMatchObject({ code: Code.PermissionDenied })
})

it('calls trust service for admin force remove', async () => {
  const deps = {
    ...makeDeps(),
    trust: {
      forceRemovePackage: vi.fn().mockResolvedValue({
        id: 'pkg-1',
        creatorId: 'creator-1',
        name: 'Pack',
        description: '',
        priceMinor: 30,
        currency: 'TWD',
        stickerCount: 8,
        status: 'removed',
        tags: '[]',
      }),
    },
  } as any
  const handler = createStickerMarketAdminHandler(deps)

  await handler.forceRemoveStickerPackage(
    {
      packageId: 'pkg-1',
      reportId: 'report-1',
      reasonText: 'Confirmed infringement.',
    },
    makeAuthCtx({ id: 'admin-1', role: 'admin' }),
  )

  expect(deps.trust.forceRemovePackage).toHaveBeenCalledWith({
    actorUserId: 'admin-1',
    packageId: 'pkg-1',
    reportId: 'report-1',
    reasonText: 'Confirmed infringement.',
  })
})
```

- [ ] **Step 2: Run handler tests to verify failure**

Run:

```bash
bun run --cwd apps/server test:unit -- src/connect/stickerMarketUser.test.ts src/connect/stickerMarketAdmin.test.ts
```

Expected: FAIL because handler deps and methods are missing.

- [ ] **Step 3: Extend user handler deps and method**

In `apps/server/src/connect/stickerMarketUser.ts`, add to `StickerMarketUserHandlerDeps`:

```ts
trust?: {
  reportStickerPackage(input: {
    packageId: string
    reporterUserId: string
    reasonCategory: string
    reasonText: string
  }): Promise<any>
}
```

Add method inside returned handler:

```ts
async reportStickerPackage(
  req: { packageId: string; reasonCategory: string; reasonText: string },
  ctx: HandlerContext,
) {
  const auth = requireAuthData(ctx)
  if (!deps.trust) throw new ConnectError('trust service not configured', Code.Internal)
  const report = await deps.trust.reportStickerPackage({
    packageId: req.packageId,
    reporterUserId: auth.id,
    reasonCategory: req.reasonCategory,
    reasonText: req.reasonText,
  })
  return {
    reportId: report.id,
    status: trustReportStatusToProto(report.status),
  }
}
```

Add mapper:

```ts
function trustReportStatusToProto(status: string): TrustReportStatus {
  switch (status) {
    case 'open':
      return TrustReportStatus.OPEN
    case 'reviewing':
      return TrustReportStatus.REVIEWING
    case 'resolved':
      return TrustReportStatus.RESOLVED
    case 'dismissed':
      return TrustReportStatus.DISMISSED
    default:
      return TrustReportStatus.UNSPECIFIED
  }
}
```

Import `Code`, `ConnectError`, and `TrustReportStatus` if not already available.

- [ ] **Step 4: Extend admin handler deps and methods**

In `apps/server/src/connect/stickerMarketAdmin.ts`, add `trust: any` to deps and add methods:

```ts
async listTrustReports(req: any, ctx: HandlerContext) {
  requireAdmin(ctx)
  const reports = await deps.trust.listReports({
    status: trustReportStatusFromProto(req.status),
    limit: req.limit > 0 ? req.limit : 50,
  })
  return { reports: reports.map(mapTrustReportSummary) }
},

async getTrustReportDetail(req: { reportId: string }, ctx: HandlerContext) {
  requireAdmin(ctx)
  const detail = await deps.trust.getReportDetail({ reportId: req.reportId })
  return {
    report: mapTrustReportSummary(detail.report),
    package: mapStickerPackageDraft(detail.package),
    creator: mapCreatorProfile(detail.report),
    payoutHold: mapCreatorPayoutHold(detail.report),
    assets: (detail.assets ?? []).map(mapStickerAsset),
    events: (detail.events ?? []).map(mapTrustActionEvent),
  }
},

async markTrustReportReviewing(req: any, ctx: HandlerContext) {
  const auth = requireAdmin(ctx)
  const report = await deps.trust.markReviewing({
    reportId: req.reportId,
    actorUserId: auth.id,
    note: req.note ?? '',
  })
  return { report: mapTrustReportSummary(report) }
},

async resolveTrustReport(req: any, ctx: HandlerContext) {
  const auth = requireAdmin(ctx)
  const report = await deps.trust.resolveReport({
    reportId: req.reportId,
    actorUserId: auth.id,
    resolutionText: req.resolutionText,
  })
  return { report: mapTrustReportSummary(report) }
},

async dismissTrustReport(req: any, ctx: HandlerContext) {
  const auth = requireAdmin(ctx)
  const report = await deps.trust.dismissReport({
    reportId: req.reportId,
    actorUserId: auth.id,
    resolutionText: req.resolutionText,
  })
  return { report: mapTrustReportSummary(report) }
},

async forceRemoveStickerPackage(req: any, ctx: HandlerContext) {
  const auth = requireAdmin(ctx)
  const pkg = await deps.trust.forceRemovePackage({
    actorUserId: auth.id,
    packageId: req.packageId,
    reportId: req.reportId || undefined,
    reasonText: req.reasonText,
  })
  return { package: mapStickerPackageDraft(pkg) }
},

async restoreStickerPackage(req: any, ctx: HandlerContext) {
  const auth = requireAdmin(ctx)
  const pkg = await deps.trust.restorePackage({
    actorUserId: auth.id,
    packageId: req.packageId,
    reportId: req.reportId || undefined,
    reasonText: req.reasonText,
  })
  return { package: mapStickerPackageDraft(pkg) }
},

async holdCreatorPayouts(req: any, ctx: HandlerContext) {
  const auth = requireAdmin(ctx)
  const creator = await deps.trust.holdCreatorPayouts({
    actorUserId: auth.id,
    creatorId: req.creatorId,
    reportId: req.reportId || undefined,
    packageId: req.packageId || undefined,
    reasonText: req.reasonText,
  })
  return { payoutHold: mapCreatorPayoutHold(creator) }
},

async clearCreatorPayoutHold(req: any, ctx: HandlerContext) {
  const auth = requireAdmin(ctx)
  const creator = await deps.trust.clearCreatorPayoutHold({
    actorUserId: auth.id,
    creatorId: req.creatorId,
    reportId: req.reportId || undefined,
    packageId: req.packageId || undefined,
    reasonText: req.reasonText,
  })
  return { payoutHold: mapCreatorPayoutHold(creator) }
},
```

Add mappers in the same file:

```ts
function trustReportStatusFromProto(status: TrustReportStatus): string | undefined {
  switch (status) {
    case TrustReportStatus.OPEN:
      return 'open'
    case TrustReportStatus.REVIEWING:
      return 'reviewing'
    case TrustReportStatus.RESOLVED:
      return 'resolved'
    case TrustReportStatus.DISMISSED:
      return 'dismissed'
    default:
      return undefined
  }
}

function mapTrustReportSummary(row: any) {
  return {
    id: row.id,
    packageId: row.packageId,
    packageName: row.packageName ?? '',
    packageStatus: statusToProto(row.packageStatus ?? row.status ?? ''),
    creatorId: row.creatorId ?? '',
    creatorDisplayName: row.creatorDisplayName ?? '',
    reporterUserId: row.reporterUserId ?? '',
    reasonCategory: row.reasonCategory ?? '',
    reasonText: row.reasonText ?? '',
    status: trustReportStatusToProto(row.status),
    createdAt: row.createdAt ?? '',
  }
}

function trustReportStatusToProto(status: string): TrustReportStatus {
  switch (status) {
    case 'open':
      return TrustReportStatus.OPEN
    case 'reviewing':
      return TrustReportStatus.REVIEWING
    case 'resolved':
      return TrustReportStatus.RESOLVED
    case 'dismissed':
      return TrustReportStatus.DISMISSED
    default:
      return TrustReportStatus.UNSPECIFIED
  }
}

function mapCreatorProfile(row: any) {
  return {
    id: row.creatorId ?? row.id ?? '',
    userId: row.creatorUserId ?? row.userId ?? '',
    displayName: row.creatorDisplayName ?? row.displayName ?? '',
    country: row.creatorCountry ?? row.country ?? '',
    bio: row.creatorBio ?? row.bio ?? '',
    status: row.creatorStatus ?? row.status ?? '',
  }
}

function mapCreatorPayoutHold(row: any) {
  return {
    held: Boolean(row.payoutHoldAt),
    heldAt: row.payoutHoldAt ?? '',
    heldByUserId: row.payoutHoldByUserId ?? '',
    reason: row.payoutHoldReason ?? '',
  }
}

function mapTrustActionEvent(row: any) {
  return {
    id: row.id,
    reportId: row.reportId ?? '',
    packageId: row.packageId ?? '',
    creatorId: row.creatorId ?? '',
    actorUserId: row.actorUserId,
    action: row.action,
    reasonText: row.reasonText ?? '',
    metadataJson: row.metadataJson ?? '{}',
    createdAt: row.createdAt,
  }
}
```

- [ ] **Step 5: Wire services in `index.ts`**

In `apps/server/src/index.ts`, add trust to handler deps:

```ts
stickerMarketUser: {
  db,
  pay: payments.pay,
  mode: paymentsEnv.PAYMENTS_ECPAY_MODE,
  returnUrl: paymentsEnv.PAYMENTS_RETURN_URL,
  orderResultUrl: paymentsEnv.PAYMENTS_ORDER_RESULT_URL,
  clientBackUrl: paymentsEnv.PAYMENTS_CLIENT_BACK_URL,
  follow: stickerMarket.follow,
  review: stickerMarket.review,
  launchNotification: stickerMarket.launchNotification,
  trust: stickerMarket.trust,
},
```

And in `stickerMarketAdmin` deps:

```ts
trust: stickerMarket.trust,
```

- [ ] **Step 6: Run handler tests**

Run:

```bash
bun run --cwd apps/server test:unit -- src/connect/stickerMarketUser.test.ts src/connect/stickerMarketAdmin.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit RPC handler slice**

```bash
git add apps/server/src/connect/stickerMarketUser.ts apps/server/src/connect/stickerMarketAdmin.ts apps/server/src/connect/stickerMarketUser.test.ts apps/server/src/connect/stickerMarketAdmin.test.ts apps/server/src/index.ts
git commit -m "feat(creator-market): wire trust ops rpc handlers"
```

---

### Task 5: Creator Payout Hold Enforcement

**Files:**
- Modify: `apps/server/src/services/sticker-market/payout.repository.ts`
- Modify: `apps/server/src/services/sticker-market/payout.service.ts`
- Modify: `apps/server/src/services/sticker-market/payout.service.test.ts`

- [ ] **Step 1: Write failing payout service tests**

In `apps/server/src/services/sticker-market/payout.service.test.ts`, add tests matching existing setup style:

```ts
it('blocks creator payout requests while creator is held', async () => {
  const deps = makeDeps()
  deps.repo.getCreatorPayoutOverview.mockResolvedValue({
    creator: {
      id: 'creator-1',
      payoutHoldAt: '2026-04-27T00:00:00.000Z',
      payoutHoldReason: 'Investigating infringement.',
    },
    account: { id: 'account-1' },
    availableLedgers: [{ id: 'ledger-1', netAmountMinor: 30000 }],
    history: [],
  })
  const service = createPayoutService(deps)

  await expect(service.requestCreatorPayout({ userId: 'user-1' })).rejects.toThrow(
    'creator payouts are on hold',
  )
})

it('blocks approving held creator payout requests', async () => {
  const deps = makeDeps()
  deps.repo.findRequestCreatorHold.mockResolvedValue({
    creatorId: 'creator-1',
    payoutHoldAt: '2026-04-27T00:00:00.000Z',
  })
  const service = createPayoutService(deps)

  await expect(
    service.approveRequest({ actorUserId: 'admin-1', requestId: 'request-1' }),
  ).rejects.toThrow('creator payouts are on hold')
})

it('allows rejecting held creator payout requests', async () => {
  const deps = makeDeps()
  deps.repo.rejectRequest.mockResolvedValue({ id: 'request-1', status: 'rejected' })
  const service = createPayoutService(deps)

  await expect(
    service.rejectRequest({
      actorUserId: 'admin-1',
      requestId: 'request-1',
      reason: 'Missing information.',
    }),
  ).resolves.toMatchObject({ status: 'rejected' })
  expect(deps.repo.findRequestCreatorHold).not.toHaveBeenCalled()
})
```

- [ ] **Step 2: Run payout tests to verify failure**

Run:

```bash
bun run --cwd apps/server test:unit -- src/services/sticker-market/payout.service.test.ts
```

Expected: FAIL because hold methods are missing.

- [ ] **Step 3: Add repository hold lookups and hold status in list**

In `apps/server/src/services/sticker-market/payout.repository.ts`, add selected fields to `listPendingRequests` by replacing simple `.select()` with a join:

```ts
listPendingRequests(db: any, input: { limit: number }) {
  return db
    .select({
      id: creatorPayoutRequest.id,
      ledgerIdsJson: creatorPayoutRequest.ledgerIdsJson,
      creatorId: creatorPayoutRequest.creatorId,
      payoutAccountId: creatorPayoutRequest.payoutAccountId,
      batchId: creatorPayoutRequest.batchId,
      currency: creatorPayoutRequest.currency,
      grossAmountMinor: creatorPayoutRequest.grossAmountMinor,
      taxWithholdingMinor: creatorPayoutRequest.taxWithholdingMinor,
      transferFeeMinor: creatorPayoutRequest.transferFeeMinor,
      netAmountMinor: creatorPayoutRequest.netAmountMinor,
      status: creatorPayoutRequest.status,
      rejectReason: creatorPayoutRequest.rejectReason,
      failureReason: creatorPayoutRequest.failureReason,
      bankTransactionId: creatorPayoutRequest.bankTransactionId,
      paidAt: creatorPayoutRequest.paidAt,
      requestedAt: creatorPayoutRequest.requestedAt,
      reviewedAt: creatorPayoutRequest.reviewedAt,
      reviewedByUserId: creatorPayoutRequest.reviewedByUserId,
      updatedAt: creatorPayoutRequest.updatedAt,
      creatorDisplayName: creatorProfile.displayName,
      payoutHoldAt: creatorProfile.payoutHoldAt,
      payoutHoldByUserId: creatorProfile.payoutHoldByUserId,
      payoutHoldReason: creatorProfile.payoutHoldReason,
    })
    .from(creatorPayoutRequest)
    .innerJoin(creatorProfile, eq(creatorPayoutRequest.creatorId, creatorProfile.id))
    .where(
      inArray(creatorPayoutRequest.status, ['requested', 'approved', 'exported']),
    )
    .limit(input.limit)
},
```

Add:

```ts
async findRequestCreatorHold(db: any, requestId: string) {
  const [row] = await db
    .select({
      requestId: creatorPayoutRequest.id,
      creatorId: creatorPayoutRequest.creatorId,
      payoutHoldAt: creatorProfile.payoutHoldAt,
      payoutHoldReason: creatorProfile.payoutHoldReason,
    })
    .from(creatorPayoutRequest)
    .innerJoin(creatorProfile, eq(creatorPayoutRequest.creatorId, creatorProfile.id))
    .where(eq(creatorPayoutRequest.id, requestId))
    .limit(1)
  return row
},

async findAnyHeldCreatorInRequests(db: any, requestIds: string[]) {
  if (requestIds.length === 0) return undefined
  const [row] = await db
    .select({
      requestId: creatorPayoutRequest.id,
      creatorId: creatorPayoutRequest.creatorId,
      payoutHoldAt: creatorProfile.payoutHoldAt,
      payoutHoldReason: creatorProfile.payoutHoldReason,
    })
    .from(creatorPayoutRequest)
    .innerJoin(creatorProfile, eq(creatorPayoutRequest.creatorId, creatorProfile.id))
    .where(inArray(creatorPayoutRequest.id, requestIds))
  return row?.payoutHoldAt ? row : undefined
},

async findAnyHeldCreatorInBatch(db: any, batchId: string) {
  const [row] = await db
    .select({
      requestId: creatorPayoutRequest.id,
      creatorId: creatorPayoutRequest.creatorId,
      payoutHoldAt: creatorProfile.payoutHoldAt,
      payoutHoldReason: creatorProfile.payoutHoldReason,
    })
    .from(creatorPayoutRequest)
    .innerJoin(creatorProfile, eq(creatorPayoutRequest.creatorId, creatorProfile.id))
    .where(eq(creatorPayoutRequest.batchId, batchId))
  return row?.payoutHoldAt ? row : undefined
},
```

- [ ] **Step 4: Add service guards**

In `apps/server/src/services/sticker-market/payout.service.ts`, add helper inside `createPayoutService` before `return`:

```ts
async function assertRequestCreatorNotHeld(requestId: string) {
  const hold = await deps.repo.findRequestCreatorHold?.(deps.db, requestId)
  if (hold?.payoutHoldAt) throw new Error('creator payouts are on hold')
}

async function assertRequestIdsNotHeld(requestIds: string[]) {
  const hold = await deps.repo.findAnyHeldCreatorInRequests?.(deps.db, requestIds)
  if (hold?.payoutHoldAt) throw new Error('creator payouts are on hold')
}

async function assertBatchCreatorsNotHeld(batchId: string) {
  const hold = await deps.repo.findAnyHeldCreatorInBatch?.(deps.db, batchId)
  if (hold?.payoutHoldAt) throw new Error('creator payouts are on hold')
}
```

Add in `requestCreatorPayout` after overview load:

```ts
if (overview.creator?.payoutHoldAt) {
  throw new Error('creator payouts are on hold')
}
```

Change methods to async and guard:

```ts
async approveRequest(input: { actorUserId: string; requestId: string }) {
  await assertRequestCreatorNotHeld(input.requestId)
  return deps.repo.approveRequest(deps.db, {
    ...input,
    now: deps.now().toISOString(),
  })
},

async createBatch(input: { actorUserId: string; requestIds: string[] }) {
  await assertRequestIdsNotHeld(input.requestIds)
  return deps.repo.createBatchFromApprovedRequests(deps.db, {
    id: deps.createId(),
    ...input,
    now: deps.now().toISOString(),
  })
},

async exportBatchCsv(input: { actorUserId: string; batchId: string }) {
  await assertBatchCreatorsNotHeld(input.batchId)
  const rows = await deps.repo.exportBatchRows(deps.db, {
    ...input,
    now: deps.now().toISOString(),
  })
  return encodeCsv(rows)
},

async markPaid(input: {
  actorUserId: string
  requestId: string
  bankTransactionId: string
  paidAt: string
}) {
  await assertRequestCreatorNotHeld(input.requestId)
  return deps.repo.markRequestPaid(deps.db, {
    ...input,
    now: deps.now().toISOString(),
  })
},
```

Do not add holds to `rejectRequest` or `markFailed`.

- [ ] **Step 5: Run payout tests**

Run:

```bash
bun run --cwd apps/server test:unit -- src/services/sticker-market/payout.service.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit payout hold slice**

```bash
git add apps/server/src/services/sticker-market/payout.repository.ts apps/server/src/services/sticker-market/payout.service.ts apps/server/src/services/sticker-market/payout.service.test.ts
git commit -m "feat(creator-market): enforce creator payout holds"
```

---

### Task 6: Removed Package Discovery And Checkout Enforcement

**Files:**
- Modify: `apps/server/src/connect/stickerMarketUser.ts`
- Modify: `apps/server/src/connect/stickerMarketUser.test.ts`
- Modify: `apps/server/src/services/sticker-market/discovery.repository.ts`
- Modify: `apps/server/src/services/sticker-market/discovery.service.test.ts`
- Modify: `apps/server/src/services/sticker-market/featured-shelf.service.ts` if shelves can include removed packages in public responses.

- [ ] **Step 1: Add failing checkout test for removed package**

In `apps/server/src/connect/stickerMarketUser.test.ts`, add a test near checkout tests:

```ts
it('rejects checkout for removed packages', async () => {
  const deps = makeDeps()
  deps.db.select.mockReturnValue({
    from: () => ({
      where: () => ({
        limit: () =>
          Promise.resolve([
            {
              id: 'pkg-1',
              status: 'removed',
              priceMinor: 30,
              currency: 'TWD',
            },
          ]),
      }),
    }),
  } as any)
  const handler = createStickerMarketUserHandler(deps)

  await expect(
    handler.createCheckout(
      { packageId: 'pkg-1', simulatePaid: false },
      makeAuthCtx({ id: 'user-1' }),
    ),
  ).rejects.toMatchObject({ code: Code.FailedPrecondition })
})
```

- [ ] **Step 2: Add failing discovery test for removed package omission**

In `apps/server/src/services/sticker-market/discovery.service.test.ts`, add a repository-level expectation matching existing test style:

```ts
it('omits removed packages from public package detail', async () => {
  const deps = makeDeps()
  deps.discoveryRepo.findPackageWithCreator.mockResolvedValue(undefined)
  const service = createDiscoveryService(deps)

  await expect(
    service.getPackageDetail({ packageId: 'removed-pkg', userId: undefined }),
  ).resolves.toBeUndefined()
})
```

- [ ] **Step 3: Run tests to verify failure**

Run:

```bash
bun run --cwd apps/server test:unit -- src/connect/stickerMarketUser.test.ts src/services/sticker-market/discovery.service.test.ts
```

Expected: FAIL until filters and checkout status checks are implemented.

- [ ] **Step 4: Enforce checkout status**

In `apps/server/src/connect/stickerMarketUser.ts`, update create checkout package validation:

```ts
if (!pkg) {
  throw new ConnectError('package not found', Code.NotFound)
}
if (pkg.status !== 'on_sale') {
  throw new ConnectError('package is not available for purchase', Code.FailedPrecondition)
}
```

- [ ] **Step 5: Ensure discovery queries filter `on_sale` only**

In `apps/server/src/services/sticker-market/discovery.repository.ts`, every public package query should filter:

```ts
eq(stickerPackage.status, 'on_sale')
```

Apply this to:

- store home packages
- search results
- package detail
- same-creator packages
- creator public profile packages
- bestseller/ranking queries
- featured shelf package joins

Use existing `and(...)` patterns rather than string SQL.

- [ ] **Step 6: Run discovery and checkout tests**

Run:

```bash
bun run --cwd apps/server test:unit -- src/connect/stickerMarketUser.test.ts src/services/sticker-market/discovery.service.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit removed package enforcement slice**

```bash
git add apps/server/src/connect/stickerMarketUser.ts apps/server/src/connect/stickerMarketUser.test.ts apps/server/src/services/sticker-market/discovery.repository.ts apps/server/src/services/sticker-market/discovery.service.test.ts apps/server/src/services/sticker-market/featured-shelf.service.ts
git commit -m "feat(creator-market): hide removed sticker packages"
```

---

### Task 7: User Report UI

**Files:**
- Create: `apps/web/src/features/sticker-market/ReportStickerPackageDialog.tsx`
- Modify: `apps/web/src/features/sticker-market/PackageDetail.tsx`
- Modify: web tests under `apps/web/src/test/unit/features/sticker-market/`

- [ ] **Step 1: Add report dialog component**

Create `apps/web/src/features/sticker-market/ReportStickerPackageDialog.tsx`:

```tsx
import { useState } from 'react'
import { Dialog, SizableText, XStack, YStack } from 'tamagui'

import { Button } from '~/interface/buttons/Button'
import { TextArea } from '~/interface/forms/TextArea'
import { showToast } from '~/interface/toast/Toast'
import { useTanMutation } from '~/query'
import { stickerMarketUserClient } from './client'

const categories = [
  { value: 'copyright', label: '侵權' },
  { value: 'prohibited_content', label: '違禁內容' },
  { value: 'fraud', label: '詐欺' },
  { value: 'other', label: '其他' },
] as const

type ReportStickerPackageDialogProps = {
  packageId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ReportStickerPackageDialog({
  packageId,
  open,
  onOpenChange,
}: ReportStickerPackageDialogProps) {
  const [reasonCategory, setReasonCategory] =
    useState<(typeof categories)[number]['value']>('copyright')
  const [reasonText, setReasonText] = useState('')

  const report = useTanMutation({
    mutationFn: () =>
      stickerMarketUserClient.reportStickerPackage({
        packageId,
        reasonCategory,
        reasonText,
      }),
    onSuccess: () => {
      setReasonText('')
      setReasonCategory('copyright')
      onOpenChange(false)
      showToast('已收到回報', { type: 'success' })
    },
    onError: () => showToast('回報送出失敗', { type: 'error' }),
  })

  const canSubmit = reasonText.trim().length >= 10 && !report.isPending

  return (
    <Dialog modal open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay key="overlay" bg="$shadowColor" opacity={0.4} />
        <Dialog.Content
          key="content"
          bg="$background"
          p="$4"
          rounded="$4"
          width="min(92vw, 420px)"
          gap="$3"
        >
          <Dialog.Title>
            <SizableText size="$5" fontWeight="700" color="$color12">
              回報貼圖
            </SizableText>
          </Dialog.Title>

          <XStack gap="$2" flexWrap="wrap">
            {categories.map((category) => (
              <Button
                key={category.value}
                size="$3"
                variant={reasonCategory === category.value ? 'default' : 'outlined'}
                onPress={() => setReasonCategory(category.value)}
              >
                {category.label}
              </Button>
            ))}
          </XStack>

          <YStack gap="$2">
            <TextArea
              value={reasonText}
              onChangeText={setReasonText}
              placeholder="請描述你要回報的原因"
              minHeight={120}
            />
            <SizableText size="$2" color="$color10">
              至少 10 字
            </SizableText>
          </YStack>

          <XStack gap="$2" justify="flex-end">
            <Button variant="outlined" onPress={() => onOpenChange(false)}>
              取消
            </Button>
            <Button disabled={!canSubmit} onPress={() => report.mutate()}>
              送出
            </Button>
          </XStack>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  )
}
```

- [ ] **Step 2: Add entry point in package detail**

In `apps/web/src/features/sticker-market/PackageDetail.tsx`, add:

```tsx
import { ReportStickerPackageDialog } from './ReportStickerPackageDialog'
```

Add state:

```tsx
const [reportOpen, setReportOpen] = useState(false)
```

Add a small action near package metadata or bottom area:

```tsx
<Button size="$2" variant="transparent" onPress={() => setReportOpen(true)}>
  回報
</Button>
```

Render dialog:

```tsx
<ReportStickerPackageDialog
  packageId={packageId}
  open={reportOpen}
  onOpenChange={setReportOpen}
/>
```

- [ ] **Step 3: Run web unit tests**

Run:

```bash
bun run --cwd apps/web test:unit -- src/test/unit/features/sticker-market
```

Expected: PASS after import/type fixes.

- [ ] **Step 4: Commit user report UI slice**

```bash
git add apps/web/src/features/sticker-market/ReportStickerPackageDialog.tsx apps/web/src/features/sticker-market/PackageDetail.tsx apps/web/src/test/unit/features/sticker-market
git commit -m "feat(creator-market): add sticker report UI"
```

---

### Task 8: Admin Trust Reports UI

**Files:**
- Create: `apps/web/app/(app)/admin/trust-reports/index.tsx`
- Create: `apps/web/app/(app)/admin/trust-reports/[reportId].tsx`
- Create: `apps/web/src/features/sticker-market/admin/AdminTrustReportsPage.tsx`
- Create: `apps/web/src/features/sticker-market/admin/AdminTrustReportDetail.tsx`

- [ ] **Step 1: Add routes**

Create `apps/web/app/(app)/admin/trust-reports/index.tsx`:

```tsx
import { AdminTrustReportsPage } from '~/features/sticker-market/admin/AdminTrustReportsPage'

export default function AdminTrustReportsRoute() {
  return <AdminTrustReportsPage />
}
```

Create `apps/web/app/(app)/admin/trust-reports/[reportId].tsx`:

```tsx
import { createRoute } from 'one'
import { AdminTrustReportDetail } from '~/features/sticker-market/admin/AdminTrustReportDetail'

const route = createRoute<'/admin/trust-reports/[reportId]'>()

export default function AdminTrustReportDetailRoute() {
  const { reportId } = route.useParams()
  return <AdminTrustReportDetail reportId={reportId} />
}
```

- [ ] **Step 2: Add queue page**

Create `apps/web/src/features/sticker-market/admin/AdminTrustReportsPage.tsx`:

```tsx
import { router } from 'one'
import { ScrollView, SizableText, XStack, YStack } from 'tamagui'
import { TrustReportStatus } from '@vine/proto/stickerMarket'
import { useTanQuery } from '~/query'
import { stickerMarketAdminClient } from './client'

function statusLabel(status: TrustReportStatus) {
  switch (status) {
    case TrustReportStatus.OPEN:
      return '待處理'
    case TrustReportStatus.REVIEWING:
      return '處理中'
    case TrustReportStatus.RESOLVED:
      return '已處理'
    case TrustReportStatus.DISMISSED:
      return '不處理'
    default:
      return '未知'
  }
}

export function AdminTrustReportsPage() {
  const { data, isLoading } = useTanQuery({
    queryKey: ['sticker-market', 'admin', 'trust-reports'],
    queryFn: () =>
      stickerMarketAdminClient.listTrustReports({
        status: TrustReportStatus.UNSPECIFIED,
        limit: 100,
      }),
  })
  const reports = data?.reports ?? []

  return (
    <YStack flex={1} bg="$background">
      <XStack px="$4" py="$3" items="center" borderBottomWidth={1} borderBottomColor="$color4">
        <SizableText size="$6" fontWeight="700" color="$color12">
          信任與安全回報
        </SizableText>
      </XStack>
      <ScrollView flex={1}>
        <YStack p="$4" gap="$3">
          {isLoading && <SizableText color="$color10">載入中...</SizableText>}
          {!isLoading && reports.length === 0 && (
            <SizableText color="$color10">尚無回報</SizableText>
          )}
          {reports.map((report) => (
            <YStack
              key={report.id}
              bg="$color2"
              rounded="$4"
              p="$3"
              gap="$2"
              cursor="pointer"
              hoverStyle={{ bg: '$color3' }}
              onPress={() => router.push(`/admin/trust-reports/${report.id}` as any)}
            >
              <XStack justify="space-between" items="center">
                <SizableText size="$4" fontWeight="700" color="$color12">
                  {report.packageName}
                </SizableText>
                <SizableText size="$2" color="$color10">
                  {statusLabel(report.status)}
                </SizableText>
              </XStack>
              <SizableText size="$3" color="$color10">
                {report.reasonCategory} · {report.creatorDisplayName || report.creatorId}
              </SizableText>
              <SizableText size="$3" color="$color11" numberOfLines={2}>
                {report.reasonText}
              </SizableText>
            </YStack>
          ))}
        </YStack>
      </ScrollView>
    </YStack>
  )
}
```

- [ ] **Step 3: Add detail page**

Create `apps/web/src/features/sticker-market/admin/AdminTrustReportDetail.tsx` with this structure:

```tsx
import { useState } from 'react'
import { router } from 'one'
import { ScrollView, SizableText, XStack, YStack } from 'tamagui'
import { Button } from '~/interface/buttons/Button'
import { TextArea } from '~/interface/forms/TextArea'
import { showToast } from '~/interface/toast/Toast'
import { useTanMutation, useTanQuery, useTanQueryClient } from '~/query'
import { stickerMarketAdminClient } from './client'

type AdminTrustReportDetailProps = {
  reportId: string
}

export function AdminTrustReportDetail({ reportId }: AdminTrustReportDetailProps) {
  const queryClient = useTanQueryClient()
  const [reasonText, setReasonText] = useState('')

  const { data, isLoading } = useTanQuery({
    queryKey: ['sticker-market', 'admin', 'trust-report', reportId],
    queryFn: () => stickerMarketAdminClient.getTrustReportDetail({ reportId }),
  })

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: ['sticker-market', 'admin', 'trust-report', reportId],
    })

  const remove = useTanMutation({
    mutationFn: () =>
      stickerMarketAdminClient.forceRemoveStickerPackage({
        reportId,
        packageId: data!.report!.packageId,
        reasonText,
      }),
    onSuccess: () => {
      setReasonText('')
      invalidate()
      showToast('已下架貼圖', { type: 'success' })
    },
  })

  const restore = useTanMutation({
    mutationFn: () =>
      stickerMarketAdminClient.restoreStickerPackage({
        reportId,
        packageId: data!.report!.packageId,
        reasonText,
      }),
    onSuccess: () => {
      setReasonText('')
      invalidate()
      showToast('已恢復上架', { type: 'success' })
    },
  })

  const hold = useTanMutation({
    mutationFn: () =>
      stickerMarketAdminClient.holdCreatorPayouts({
        reportId,
        packageId: data!.report!.packageId,
        creatorId: data!.report!.creatorId,
        reasonText,
      }),
    onSuccess: () => {
      setReasonText('')
      invalidate()
      showToast('已暫停創作者提領', { type: 'success' })
    },
  })

  const clearHold = useTanMutation({
    mutationFn: () =>
      stickerMarketAdminClient.clearCreatorPayoutHold({
        reportId,
        packageId: data!.report!.packageId,
        creatorId: data!.report!.creatorId,
        reasonText,
      }),
    onSuccess: () => {
      setReasonText('')
      invalidate()
      showToast('已解除提領暫停', { type: 'success' })
    },
  })

  const markReviewing = useTanMutation({
    mutationFn: () =>
      stickerMarketAdminClient.markTrustReportReviewing({
        reportId,
        note: reasonText,
      }),
    onSuccess: () => {
      setReasonText('')
      invalidate()
      showToast('已標記處理中', { type: 'success' })
    },
  })

  const resolve = useTanMutation({
    mutationFn: () =>
      stickerMarketAdminClient.resolveTrustReport({
        reportId,
        resolutionText: reasonText,
      }),
    onSuccess: () => {
      setReasonText('')
      invalidate()
      showToast('已結案', { type: 'success' })
    },
  })

  const dismiss = useTanMutation({
    mutationFn: () =>
      stickerMarketAdminClient.dismissTrustReport({
        reportId,
        resolutionText: reasonText,
      }),
    onSuccess: () => {
      setReasonText('')
      invalidate()
      showToast('已標記不處理', { type: 'success' })
    },
  })

  const canAct = reasonText.trim().length > 0 && data?.report

  return (
    <YStack flex={1} bg="$background">
      <XStack px="$4" py="$3" items="center" gap="$3" borderBottomWidth={1} borderBottomColor="$color4">
        <YStack cursor="pointer" onPress={() => router.back()}>
          <SizableText size="$5" color="$color12">‹</SizableText>
        </YStack>
        <SizableText size="$5" fontWeight="700" color="$color12" flex={1}>
          回報詳情
        </SizableText>
      </XStack>
      <ScrollView flex={1}>
        <YStack p="$4" gap="$4">
          {isLoading && <SizableText color="$color10">載入中...</SizableText>}
          {data?.report && (
            <>
              <YStack gap="$2">
                <SizableText size="$6" fontWeight="700" color="$color12">
                  {data.report.packageName}
                </SizableText>
                <SizableText size="$3" color="$color10">
                  創作者：{data.report.creatorDisplayName || data.report.creatorId}
                </SizableText>
                <SizableText size="$3" color="$color10">
                  回報者：{data.report.reporterUserId}
                </SizableText>
                <SizableText size="$3" color="$color11">
                  {data.report.reasonText}
                </SizableText>
              </YStack>

              <XStack flexWrap="wrap" gap="$2">
                {data.assets.map((asset) => (
                  <YStack key={asset.id} width={72} height={88} rounded="$3" bg="$color2" items="center" justify="center">
                    <img src={`/uploads/${asset.driveKey}`} alt={`${asset.number}`} style={{ width: 64, height: 64, objectFit: 'contain' }} />
                  </YStack>
                ))}
              </XStack>

              <YStack gap="$2">
                <SizableText size="$4" fontWeight="600" color="$color11">
                  操作原因
                </SizableText>
                <TextArea value={reasonText} onChangeText={setReasonText} minHeight={96} />
              </YStack>

              <XStack gap="$2" flexWrap="wrap">
                <Button disabled={!canAct || markReviewing.isPending} onPress={() => markReviewing.mutate()}>
                  標記處理中
                </Button>
                <Button disabled={!canAct || resolve.isPending} onPress={() => resolve.mutate()}>
                  結案
                </Button>
                <Button disabled={!canAct || dismiss.isPending} variant="outlined" onPress={() => dismiss.mutate()}>
                  不處理
                </Button>
                <Button disabled={!canAct || remove.isPending} theme="red" onPress={() => remove.mutate()}>
                  強制下架
                </Button>
                <Button disabled={!canAct || restore.isPending} onPress={() => restore.mutate()}>
                  恢復上架
                </Button>
                <Button disabled={!canAct || hold.isPending || !data.report.creatorId} theme="red" onPress={() => hold.mutate()}>
                  暫停提領
                </Button>
                <Button disabled={!canAct || clearHold.isPending || !data.report.creatorId} onPress={() => clearHold.mutate()}>
                  解除提領暫停
                </Button>
              </XStack>

              <YStack gap="$2">
                <SizableText size="$4" fontWeight="600" color="$color11">
                  操作紀錄
                </SizableText>
                {data.events.map((event) => (
                  <YStack key={event.id} bg="$color2" rounded="$3" p="$2">
                    <SizableText size="$3" color="$color12">{event.action}</SizableText>
                    <SizableText size="$2" color="$color10">{event.createdAt}</SizableText>
                    {event.reasonText ? <SizableText size="$3" color="$color11">{event.reasonText}</SizableText> : null}
                  </YStack>
                ))}
              </YStack>
            </>
          )}
        </YStack>
      </ScrollView>
    </YStack>
  )
}
```

- [ ] **Step 4: Run web typecheck/unit tests**

Run:

```bash
bun run --cwd apps/web typecheck
bun run --cwd apps/web test:unit -- src/test/unit/features/sticker-market
```

Expected: PASS after generated proto and import fixes.

- [ ] **Step 5: Commit admin trust UI slice**

```bash
git add 'apps/web/app/(app)/admin/trust-reports/index.tsx' 'apps/web/app/(app)/admin/trust-reports/[reportId].tsx' apps/web/src/features/sticker-market/admin/AdminTrustReportsPage.tsx apps/web/src/features/sticker-market/admin/AdminTrustReportDetail.tsx
git commit -m "feat(creator-market): add admin trust report UI"
```

---

### Task 9: Admin Payout Hold UI

**Files:**
- Modify: `apps/server/src/connect/stickerMarketAdmin.ts`
- Modify: `apps/web/src/features/sticker-market/admin/AdminPayoutsPage.tsx`

- [ ] **Step 1: Include hold fields in payout request responses**

Task 2 extends `CreatorPayoutHistoryRow` with `creator_id`, `creator_display_name`, and `payout_hold`. In `apps/server/src/connect/stickerMarketAdmin.ts`, map those fields when returning `listPayoutRequests`:

```ts
payoutHold: mapCreatorPayoutHold(row),
creatorId: row.creatorId ?? '',
creatorDisplayName: row.creatorDisplayName ?? '',
```

- [ ] **Step 2: Update payout page UI**

In `apps/web/src/features/sticker-market/admin/AdminPayoutsPage.tsx`, add held state:

```tsx
const isHeld = Boolean(req.payoutHold?.held)
```

Show warning inside each request card:

```tsx
{isHeld && (
  <YStack bg="$red3" rounded="$3" p="$2">
    <SizableText size="$3" color="$red11">
      提領暫停：{req.payoutHold?.reason}
    </SizableText>
  </YStack>
)}
```

Disable forward actions:

```tsx
disabled={isHeld || approveMutation.isPending}
```

For approved request select button:

```tsx
disabled={isHeld}
```

For mark paid:

```tsx
disabled={isHeld || markPaidMutation.isPending}
```

Do not disable reject or mark failed.

- [ ] **Step 3: Run web typecheck**

Run:

```bash
bun run --cwd apps/web typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit payout UI slice**

```bash
git add apps/server/src/connect/stickerMarketAdmin.ts apps/web/src/features/sticker-market/admin/AdminPayoutsPage.tsx
git commit -m "feat(creator-market): show payout hold state"
```

---

### Task 10: Final Verification And Cleanup

**Files:**
- Review all files changed in this feature branch.
- Do not stage unrelated `docs/vine-creator-market-roadmap.md` unless the user asks.

- [ ] **Step 1: Run focused server tests**

```bash
bun run --cwd apps/server test:unit -- src/services/sticker-market/trust.service.test.ts src/services/sticker-market/payout.service.test.ts src/services/sticker-market/discovery.service.test.ts src/connect/stickerMarketUser.test.ts src/connect/stickerMarketAdmin.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run focused web tests and typechecks**

```bash
bun run --cwd apps/web typecheck
bun run --cwd apps/web test:unit -- src/test/unit/features/sticker-market
```

Expected: PASS.

- [ ] **Step 3: Run repo formatting/checks**

```bash
bun run format:check
bun run check:all
```

Expected: PASS. If `check:all` is too broad or blocked by local services, record the exact failing command and error in the final handoff.

- [ ] **Step 4: Inspect diff for unrelated changes**

```bash
git status --short
git diff --stat
```

Expected: only Phase 4A implementation files are modified, plus the pre-existing roadmap edit if it is still uncommitted.

- [ ] **Step 5: Final commit if needed**

If any final cleanup changes remain unstaged:

```bash
git add <phase-4a-files-only>
git commit -m "fix(creator-market): finish trust ops integration"
```

Do not include unrelated dirty files.
