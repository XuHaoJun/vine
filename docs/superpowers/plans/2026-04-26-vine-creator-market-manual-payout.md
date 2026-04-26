# Vine Creator Market Manual Payout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Phase 2.5 so creators can request manual bank-transfer payouts and admins can review, batch, export CSV data, and mark results.

**Architecture:** Keep user payments unchanged through the existing sticker order and Hyperswitch/ECPay flow. Add private payout tables for creator bank accounts, monthly ledger rows, payout requests, payout batches, and audit events; expose creator-facing ConnectRPC methods for C8 and admin-only ConnectRPC methods for approval, export, and result entry. The first executor is manual CSV export; future Stripe payouts can replace only the executor behind the same batch/request model.

**Tech Stack:** Bun, Drizzle/PostgreSQL, ConnectRPC, Fastify, OneJS, Tamagui, React Query, Vitest, CSV export.

**Upstream docs:**
- [`docs/superpowers/specs/2026-04-26-vine-creator-market-manual-payout-design.md`](../specs/2026-04-26-vine-creator-market-manual-payout-design.md)
- [`docs/vine-creator-market-roadmap.md`](../../vine-creator-market-roadmap.md)
- [`docs/vine-creator-market-spec.md`](../../vine-creator-market-spec.md)
- [`docs/vine-creator-market-uiux.md`](../../vine-creator-market-uiux.md)

---

## File Structure

### Database

- Modify: `packages/db/src/schema-private.ts`
  - Add `creatorPayoutAccount`, `creatorPayoutLedger`, `creatorPayoutRequest`, `creatorPayoutBatch`, and `creatorPayoutAuditEvent`.
- Create: `packages/db/src/migrations/20260426000001_creator_manual_payout.ts`
  - Create the private payout tables and indexes.

Full bank account numbers stay in `schema-private.ts`. No payout-account table is added to Zero.

### Proto

- Modify: `packages/proto/proto/stickerMarket/v1/stickerMarket.proto`
  - Add creator payout RPCs to `StickerMarketCreatorService`.
  - Add admin payout RPCs to `StickerMarketAdminService`.
- Generated: `packages/proto/gen/stickerMarket/v1/stickerMarket_pb.ts`
  - Created by `bun turbo proto:generate`.

### Server

- Create: `apps/server/src/services/sticker-market/payout.types.ts`
  - Shared manual payout domain types and state constants.
- Create: `apps/server/src/services/sticker-market/payout.repository.ts`
  - SQL reads/writes for payout accounts, ledgers, requests, batches, and audit events.
- Create: `apps/server/src/services/sticker-market/payout.repository.int.test.ts`
  - Integration coverage for month locking, creator scoping, and batch export reads.
- Create: `apps/server/src/services/sticker-market/payout.service.ts`
  - Creator-facing balance, payout account upsert, request creation, admin approval, batch creation, CSV export, and result marking.
- Create: `apps/server/src/services/sticker-market/payout.service.test.ts`
  - Unit coverage for state transitions, fee/tax math, and manual executor behavior.
- Modify: `apps/server/src/services/sticker-market/index.ts`
  - Instantiate `payout`.
- Modify: `apps/server/src/connect/stickerMarketCreator.ts`
  - Add creator payout handlers.
- Modify: `apps/server/src/connect/stickerMarketAdmin.ts`
  - Add admin payout handlers.
- Modify: `apps/server/src/index.ts`
  - Wire `stickerMarket.payout` into creator and admin handler deps.

### Web

- Create: `apps/web/app/(app)/creator/payouts.tsx`
  - Route for the C8 creator payout page.
- Create: `apps/web/src/features/sticker-market/creator/CreatorPayoutPage.tsx`
  - Balance, bank account form/summary, tax status, request CTA, and payout history.
- Modify: `apps/web/src/features/sticker-market/creator/client.ts`
  - Add payout query keys and mutations.
- Modify: `apps/web/src/features/sticker-market/creator/CreatorShell.tsx`
  - Add nav link to `/creator/payouts`.
- Create: `apps/web/app/(app)/admin/payouts/index.tsx`
  - Admin payout queue and batch page.
- Create: `apps/web/src/features/sticker-market/admin/AdminPayoutsPage.tsx`
  - Pending request list, approve/reject controls, batch creation, export, mark paid/failed.
- Modify: `apps/web/src/features/sticker-market/admin/client.ts`
  - Add admin payout client helpers.

---

## Task 1: Private Payout Schema

**Files:**
- Modify: `packages/db/src/schema-private.ts`
- Create: `packages/db/src/migrations/20260426000001_creator_manual_payout.ts`

- [ ] **Step 1.1: Add private payout table definitions**

In `packages/db/src/schema-private.ts`, extend the import:

```ts
import { index, integer, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'
```

Append these tables after `stickerReviewEvent`:

```ts
export const creatorPayoutAccount = pgTable(
  'creatorPayoutAccount',
  {
    id: text('id').primaryKey(),
    creatorId: text('creatorId').notNull(),
    legalName: text('legalName').notNull(),
    bankCode: text('bankCode').notNull(),
    bankName: text('bankName').notNull(),
    branchName: text('branchName').notNull().default(''),
    accountNumber: text('accountNumber').notNull(),
    accountLast4: text('accountLast4').notNull(),
    currency: text('currency').notNull().$type<'TWD'>().default('TWD'),
    status: text('status').notNull().$type<'active' | 'disabled'>().default('active'),
    createdAt: timestamp('createdAt', { mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp('updatedAt', { mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    index('creatorPayoutAccount_creatorId_idx').on(table.creatorId),
    uniqueIndex('creatorPayoutAccount_creatorId_active_unique')
      .on(table.creatorId)
      .where(sql`${table.status} = 'active'`),
  ],
)

export const creatorPayoutLedger = pgTable(
  'creatorPayoutLedger',
  {
    id: text('id').primaryKey(),
    creatorId: text('creatorId').notNull(),
    month: text('month').notNull(),
    currency: text('currency').notNull().$type<'TWD'>().default('TWD'),
    grossAmountMinor: integer('grossAmountMinor').notNull(),
    refundedAmountMinor: integer('refundedAmountMinor').notNull().default(0),
    platformFeeMinor: integer('platformFeeMinor').notNull(),
    creatorShareMinor: integer('creatorShareMinor').notNull(),
    taxWithholdingMinor: integer('taxWithholdingMinor').notNull().default(0),
    transferFeeMinor: integer('transferFeeMinor').notNull().default(0),
    netAmountMinor: integer('netAmountMinor').notNull(),
    status: text('status')
      .notNull()
      .$type<'available' | 'requested' | 'locked' | 'paid' | 'void'>()
      .default('available'),
    createdAt: timestamp('createdAt', { mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp('updatedAt', { mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('creatorPayoutLedger_creator_month_unique').on(table.creatorId, table.month),
    index('creatorPayoutLedger_status_idx').on(table.status),
  ],
)

export const creatorPayoutBatch = pgTable(
  'creatorPayoutBatch',
  {
    id: text('id').primaryKey(),
    status: text('status')
      .notNull()
      .$type<'draft' | 'exported' | 'paid' | 'closed'>()
      .default('draft'),
    exportedAt: timestamp('exportedAt', { mode: 'string' }),
    exportedByUserId: text('exportedByUserId'),
    paidAt: timestamp('paidAt', { mode: 'string' }),
    createdByUserId: text('createdByUserId').notNull(),
    createdAt: timestamp('createdAt', { mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp('updatedAt', { mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [index('creatorPayoutBatch_status_idx').on(table.status)],
)

export const creatorPayoutRequest = pgTable(
  'creatorPayoutRequest',
  {
    id: text('id').primaryKey(),
    ledgerIdsJson: text('ledgerIdsJson').notNull().default('[]'),
    creatorId: text('creatorId').notNull(),
    payoutAccountId: text('payoutAccountId').notNull(),
    batchId: text('batchId'),
    currency: text('currency').notNull().$type<'TWD'>().default('TWD'),
    grossAmountMinor: integer('grossAmountMinor').notNull(),
    taxWithholdingMinor: integer('taxWithholdingMinor').notNull().default(0),
    transferFeeMinor: integer('transferFeeMinor').notNull().default(0),
    netAmountMinor: integer('netAmountMinor').notNull(),
    status: text('status')
      .notNull()
      .$type<'requested' | 'approved' | 'exported' | 'paid' | 'rejected' | 'failed'>()
      .default('requested'),
    rejectReason: text('rejectReason'),
    failureReason: text('failureReason'),
    bankTransactionId: text('bankTransactionId'),
    paidAt: timestamp('paidAt', { mode: 'string' }),
    requestedAt: timestamp('requestedAt', { mode: 'string' }).defaultNow().notNull(),
    reviewedAt: timestamp('reviewedAt', { mode: 'string' }),
    reviewedByUserId: text('reviewedByUserId'),
    updatedAt: timestamp('updatedAt', { mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    index('creatorPayoutRequest_creatorId_idx').on(table.creatorId),
    index('creatorPayoutRequest_status_idx').on(table.status),
    index('creatorPayoutRequest_batchId_idx').on(table.batchId),
  ],
)

export const creatorPayoutAuditEvent = pgTable(
  'creatorPayoutAuditEvent',
  {
    id: text('id').primaryKey(),
    payoutRequestId: text('payoutRequestId'),
    payoutBatchId: text('payoutBatchId'),
    actorUserId: text('actorUserId').notNull(),
    action: text('action').notNull(),
    metadataJson: text('metadataJson').notNull().default('{}'),
    createdAt: timestamp('createdAt', { mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    index('creatorPayoutAuditEvent_request_idx').on(table.payoutRequestId),
    index('creatorPayoutAuditEvent_batch_idx').on(table.payoutBatchId),
  ],
)
```

Also add this import at the top because the partial unique index uses SQL:

```ts
import { sql } from 'drizzle-orm'
```

- [ ] **Step 1.2: Add migration**

Create `packages/db/src/migrations/20260426000001_creator_manual_payout.ts`:

```ts
import type { PoolClient } from 'pg'

export async function up(client: PoolClient) {
  await client.query(`
CREATE TABLE "creatorPayoutAccount" (
  "id" text PRIMARY KEY,
  "creatorId" text NOT NULL,
  "legalName" text NOT NULL,
  "bankCode" text NOT NULL,
  "bankName" text NOT NULL,
  "branchName" text NOT NULL DEFAULT '',
  "accountNumber" text NOT NULL,
  "accountLast4" text NOT NULL,
  "currency" text NOT NULL DEFAULT 'TWD',
  "status" text NOT NULL DEFAULT 'active',
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX "creatorPayoutAccount_creatorId_idx" ON "creatorPayoutAccount" ("creatorId");
CREATE UNIQUE INDEX "creatorPayoutAccount_creatorId_active_unique" ON "creatorPayoutAccount" ("creatorId") WHERE "status" = 'active';

CREATE TABLE "creatorPayoutLedger" (
  "id" text PRIMARY KEY,
  "creatorId" text NOT NULL,
  "month" text NOT NULL,
  "currency" text NOT NULL DEFAULT 'TWD',
  "grossAmountMinor" integer NOT NULL,
  "refundedAmountMinor" integer NOT NULL DEFAULT 0,
  "platformFeeMinor" integer NOT NULL,
  "creatorShareMinor" integer NOT NULL,
  "taxWithholdingMinor" integer NOT NULL DEFAULT 0,
  "transferFeeMinor" integer NOT NULL DEFAULT 0,
  "netAmountMinor" integer NOT NULL,
  "status" text NOT NULL DEFAULT 'available',
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX "creatorPayoutLedger_creator_month_unique" ON "creatorPayoutLedger" ("creatorId", "month");
CREATE INDEX "creatorPayoutLedger_status_idx" ON "creatorPayoutLedger" ("status");

CREATE TABLE "creatorPayoutBatch" (
  "id" text PRIMARY KEY,
  "status" text NOT NULL DEFAULT 'draft',
  "exportedAt" timestamp,
  "exportedByUserId" text,
  "paidAt" timestamp,
  "createdByUserId" text NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX "creatorPayoutBatch_status_idx" ON "creatorPayoutBatch" ("status");

CREATE TABLE "creatorPayoutRequest" (
  "id" text PRIMARY KEY,
  "ledgerIdsJson" text NOT NULL DEFAULT '[]',
  "creatorId" text NOT NULL,
  "payoutAccountId" text NOT NULL,
  "batchId" text,
  "currency" text NOT NULL DEFAULT 'TWD',
  "grossAmountMinor" integer NOT NULL,
  "taxWithholdingMinor" integer NOT NULL DEFAULT 0,
  "transferFeeMinor" integer NOT NULL DEFAULT 0,
  "netAmountMinor" integer NOT NULL,
  "status" text NOT NULL DEFAULT 'requested',
  "rejectReason" text,
  "failureReason" text,
  "bankTransactionId" text,
  "paidAt" timestamp,
  "requestedAt" timestamp DEFAULT now() NOT NULL,
  "reviewedAt" timestamp,
  "reviewedByUserId" text,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX "creatorPayoutRequest_creatorId_idx" ON "creatorPayoutRequest" ("creatorId");
CREATE INDEX "creatorPayoutRequest_status_idx" ON "creatorPayoutRequest" ("status");
CREATE INDEX "creatorPayoutRequest_batchId_idx" ON "creatorPayoutRequest" ("batchId");

CREATE TABLE "creatorPayoutAuditEvent" (
  "id" text PRIMARY KEY,
  "payoutRequestId" text,
  "payoutBatchId" text,
  "actorUserId" text NOT NULL,
  "action" text NOT NULL,
  "metadataJson" text NOT NULL DEFAULT '{}',
  "createdAt" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX "creatorPayoutAuditEvent_request_idx" ON "creatorPayoutAuditEvent" ("payoutRequestId");
CREATE INDEX "creatorPayoutAuditEvent_batch_idx" ON "creatorPayoutAuditEvent" ("payoutBatchId");
`)
}

export async function down(client: PoolClient) {
  await client.query(`
DROP TABLE IF EXISTS "creatorPayoutAuditEvent";
DROP TABLE IF EXISTS "creatorPayoutRequest";
DROP TABLE IF EXISTS "creatorPayoutBatch";
DROP TABLE IF EXISTS "creatorPayoutLedger";
DROP TABLE IF EXISTS "creatorPayoutAccount";
`)
}
```

- [ ] **Step 1.3: Verify schema compiles**

Run:

```bash
bun run --cwd packages/db typecheck
```

Expected: command exits 0.

- [ ] **Step 1.4: Commit schema**

```bash
git add packages/db/src/schema-private.ts packages/db/src/migrations/20260426000001_creator_manual_payout.ts
git commit -m "feat(creator-market): add manual payout private schema"
```

---

## Task 2: Payout Domain Service

**Files:**
- Create: `apps/server/src/services/sticker-market/payout.types.ts`
- Create: `apps/server/src/services/sticker-market/payout.service.test.ts`
- Create: `apps/server/src/services/sticker-market/payout.service.ts`

- [ ] **Step 2.1: Add shared payout types**

Create `apps/server/src/services/sticker-market/payout.types.ts`:

```ts
export const MIN_PAYOUT_MINOR = 300
export const DEFAULT_TRANSFER_FEE_MINOR = 30
export const CREATOR_REVENUE_SHARE_BPS = 7000

export type PayoutRequestStatus =
  | 'requested'
  | 'approved'
  | 'exported'
  | 'paid'
  | 'rejected'
  | 'failed'

export type PayoutLedgerStatus = 'available' | 'requested' | 'locked' | 'paid' | 'void'

export type PayoutAccountInput = {
  legalName: string
  bankCode: string
  bankName: string
  branchName: string
  accountNumber: string
  accountNumberConfirmation: string
}

export type ManualPayoutCsvRow = {
  batchId: string
  payoutRequestId: string
  creatorId: string
  creatorDisplayName: string
  legalName: string
  bankCode: string
  bankName: string
  branchName: string
  accountNumber: string
  accountLast4: string
  currency: 'TWD'
  grossAmountMinor: number
  taxWithholdingMinor: number
  transferFeeMinor: number
  netAmountMinor: number
  memo: string
}
```

- [ ] **Step 2.2: Write failing unit tests**

Create `apps/server/src/services/sticker-market/payout.service.test.ts` with tests for these behaviors:

```ts
import { describe, expect, it, vi } from 'vitest'
import { createPayoutService } from './payout.service'

function makeService(overrides: Partial<any> = {}) {
  const repo = {
    getCreatorPayoutOverview: vi.fn().mockResolvedValue({
      creator: { id: 'creator_1', displayName: 'Studio' },
      account: {
        id: 'acct_1',
        bankName: 'Taiwan Bank',
        accountLast4: '5678',
      },
      availableLedgers: [
        {
          id: 'ledger_1',
          creatorId: 'creator_1',
          month: '2026-03',
          currency: 'TWD',
          grossAmountMinor: 2000,
          refundedAmountMinor: 0,
          platformFeeMinor: 600,
          creatorShareMinor: 1400,
          taxWithholdingMinor: 0,
          transferFeeMinor: 30,
          netAmountMinor: 1370,
          status: 'available',
        },
      ],
      history: [],
    }),
    createRequestForLedgers: vi.fn().mockResolvedValue({
      id: 'req_1',
      status: 'requested',
      netAmountMinor: 1370,
    }),
    replaceActivePayoutAccount: vi.fn().mockResolvedValue({
      id: 'acct_new',
      bankName: 'Taiwan Bank',
      accountLast4: '9012',
    }),
    listPendingRequests: vi.fn().mockResolvedValue([]),
    approveRequest: vi.fn().mockResolvedValue({ id: 'req_1', status: 'approved' }),
    rejectRequest: vi.fn().mockResolvedValue({ id: 'req_1', status: 'rejected' }),
    createBatchFromApprovedRequests: vi.fn().mockResolvedValue({ id: 'batch_1' }),
    exportBatchRows: vi.fn().mockResolvedValue([]),
    markRequestPaid: vi.fn().mockResolvedValue({ id: 'req_1', status: 'paid' }),
    markRequestFailed: vi.fn().mockResolvedValue({ id: 'req_1', status: 'failed' }),
    ...overrides.repo,
  }
  return {
    repo,
    service: createPayoutService({
      db: {},
      repo,
      createId: () => 'generated_id',
      now: () => new Date('2026-04-26T00:00:00.000Z'),
    }),
  }
}

describe('createPayoutService', () => {
  it('returns creator payout overview with masked bank account', async () => {
    const { service } = makeService()

    const overview = await service.getCreatorPayoutOverview({ userId: 'user_1' })

    expect(overview.availableNetAmountMinor).toBe(1370)
    expect(overview.bankAccount).toEqual({
      id: 'acct_1',
      bankName: 'Taiwan Bank',
      accountLast4: '5678',
    })
  })

  it('rejects payout requests below the minimum threshold', async () => {
    const { service } = makeService({
      repo: {
        getCreatorPayoutOverview: vi.fn().mockResolvedValue({
          creator: { id: 'creator_1', displayName: 'Studio' },
          account: { id: 'acct_1', bankName: 'Taiwan Bank', accountLast4: '0001' },
          availableLedgers: [{ id: 'ledger_1', netAmountMinor: 299 }],
          history: [],
        }),
      },
    })

    await expect(service.requestCreatorPayout({ userId: 'user_1' })).rejects.toThrow(
      'minimum payout amount not reached',
    )
  })

  it('replaces active payout account and returns only masked fields', async () => {
    const { service, repo } = makeService()

    const account = await service.upsertCreatorPayoutAccount({
      userId: 'user_1',
      legalName: 'Creator Legal Name',
      bankCode: '004',
      bankName: 'Taiwan Bank',
      branchName: 'Main',
      accountNumber: '123456789012',
      accountNumberConfirmation: '123456789012',
    })

    expect(repo.replaceActivePayoutAccount).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        id: 'generated_id',
        creatorId: 'creator_1',
        accountNumber: '123456789012',
        accountLast4: '9012',
      }),
    )
    expect(account).toEqual({
      id: 'acct_new',
      bankName: 'Taiwan Bank',
      accountLast4: '9012',
    })
    expect(JSON.stringify(account)).not.toContain('123456789012')
  })

  it('rejects payout account confirmation mismatch', async () => {
    const { service } = makeService()

    await expect(
      service.upsertCreatorPayoutAccount({
        userId: 'user_1',
        legalName: 'Creator Legal Name',
        bankCode: '004',
        bankName: 'Taiwan Bank',
        branchName: 'Main',
        accountNumber: '123456789012',
        accountNumberConfirmation: '999999999999',
      }),
    ).rejects.toThrow('account number confirmation mismatch')
  })

  it('exports CSV with full account number only for admin batch export', async () => {
    const { service, repo } = makeService({
      repo: {
        exportBatchRows: vi.fn().mockResolvedValue([
          {
            batchId: 'batch_1',
            payoutRequestId: 'req_1',
            creatorId: 'creator_1',
            creatorDisplayName: 'Studio',
            legalName: 'Creator Legal Name',
            bankCode: '004',
            bankName: 'Taiwan Bank',
            branchName: 'Main',
            accountNumber: '123456789012',
            accountLast4: '9012',
            currency: 'TWD',
            grossAmountMinor: 2000,
            taxWithholdingMinor: 0,
            transferFeeMinor: 30,
            netAmountMinor: 1370,
            memo: 'Vine payout req_1',
          },
        ]),
      },
    })

    const csv = await service.exportBatchCsv({
      actorUserId: 'admin_1',
      batchId: 'batch_1',
    })

    expect(repo.exportBatchRows).toHaveBeenCalledWith({}, { batchId: 'batch_1' })
    expect(csv).toContain('accountNumber')
    expect(csv).toContain('123456789012')
  })
})
```

- [ ] **Step 2.3: Run tests to verify they fail**

Run:

```bash
bun run --cwd apps/server test:unit -- payout.service.test.ts
```

Expected: FAIL because `payout.service.ts` does not exist.

- [ ] **Step 2.4: Implement minimal service**

Create `apps/server/src/services/sticker-market/payout.service.ts`:

```ts
import { MIN_PAYOUT_MINOR, type ManualPayoutCsvRow } from './payout.types'

export function createPayoutService(deps: {
  db: any
  repo: any
  createId: () => string
  now: () => Date
}) {
  return {
    async getCreatorPayoutOverview(input: { userId: string }) {
      const overview = await deps.repo.getCreatorPayoutOverview(deps.db, input)
      const availableNetAmountMinor = overview.availableLedgers.reduce(
        (sum: number, row: any) => sum + row.netAmountMinor,
        0,
      )
      return {
        availableNetAmountMinor,
        currency: 'TWD' as const,
        bankAccount: overview.account
          ? {
              id: overview.account.id,
              bankName: overview.account.bankName,
              accountLast4: overview.account.accountLast4,
            }
          : undefined,
        ledgers: overview.availableLedgers,
        history: overview.history,
      }
    },

    async requestCreatorPayout(input: { userId: string }) {
      const overview = await deps.repo.getCreatorPayoutOverview(deps.db, input)
      if (!overview.account) throw new Error('payout account required')
      const availableNetAmountMinor = overview.availableLedgers.reduce(
        (sum: number, row: any) => sum + row.netAmountMinor,
        0,
      )
      const grossAmountMinor = overview.availableLedgers.reduce(
        (sum: number, row: any) => sum + row.grossAmountMinor,
        0,
      )
      const taxWithholdingMinor = overview.availableLedgers.reduce(
        (sum: number, row: any) => sum + row.taxWithholdingMinor,
        0,
      )
      const transferFeeMinor = overview.availableLedgers.reduce(
        (sum: number, row: any) => sum + row.transferFeeMinor,
        0,
      )
      if (availableNetAmountMinor < MIN_PAYOUT_MINOR) {
        throw new Error('minimum payout amount not reached')
      }
      return deps.repo.createRequestForLedgers(deps.db, {
        id: deps.createId(),
        creatorId: overview.creator.id,
        payoutAccountId: overview.account.id,
        ledgerIds: overview.availableLedgers.map((row: any) => row.id),
        grossAmountMinor,
        taxWithholdingMinor,
        transferFeeMinor,
        netAmountMinor: availableNetAmountMinor,
        now: deps.now().toISOString(),
      })
    },

    async upsertCreatorPayoutAccount(input: {
      userId: string
      legalName: string
      bankCode: string
      bankName: string
      branchName: string
      accountNumber: string
      accountNumberConfirmation: string
    }) {
      const overview = await deps.repo.getCreatorPayoutOverview(deps.db, {
        userId: input.userId,
      })
      if (!overview.creator) throw new Error('creator profile required')
      const accountNumber = input.accountNumber.trim()
      if (accountNumber !== input.accountNumberConfirmation.trim()) {
        throw new Error('account number confirmation mismatch')
      }
      if (!/^[0-9 -]+$/.test(accountNumber)) {
        throw new Error('invalid account number')
      }
      const account = await deps.repo.replaceActivePayoutAccount(deps.db, {
        id: deps.createId(),
        creatorId: overview.creator.id,
        legalName: input.legalName.trim(),
        bankCode: input.bankCode.trim(),
        bankName: input.bankName.trim(),
        branchName: input.branchName.trim(),
        accountNumber,
        accountLast4: accountNumber.replaceAll(/[^0-9]/g, '').slice(-4),
        now: deps.now().toISOString(),
      })
      return {
        id: account.id,
        bankName: account.bankName,
        accountLast4: account.accountLast4,
      }
    },

    listPendingRequests(input: { limit: number }) {
      return deps.repo.listPendingRequests(deps.db, input)
    },

    approveRequest(input: { actorUserId: string; requestId: string }) {
      return deps.repo.approveRequest(deps.db, {
        ...input,
        now: deps.now().toISOString(),
      })
    },

    rejectRequest(input: { actorUserId: string; requestId: string; reason: string }) {
      return deps.repo.rejectRequest(deps.db, {
        ...input,
        now: deps.now().toISOString(),
      })
    },

    createBatch(input: { actorUserId: string; requestIds: string[] }) {
      return deps.repo.createBatchFromApprovedRequests(deps.db, {
        id: deps.createId(),
        ...input,
        now: deps.now().toISOString(),
      })
    },

    async exportBatchCsv(input: { actorUserId: string; batchId: string }) {
      const rows = await deps.repo.exportBatchRows(deps.db, { batchId: input.batchId })
      return encodeCsv(rows)
    },

    markPaid(input: {
      actorUserId: string
      requestId: string
      bankTransactionId: string
      paidAt: string
    }) {
      return deps.repo.markRequestPaid(deps.db, {
        ...input,
        now: deps.now().toISOString(),
      })
    },

    markFailed(input: { actorUserId: string; requestId: string; reason: string }) {
      return deps.repo.markRequestFailed(deps.db, {
        ...input,
        now: deps.now().toISOString(),
      })
    },
  }
}

function encodeCsv(rows: ManualPayoutCsvRow[]) {
  const headers = [
    'batchId',
    'payoutRequestId',
    'creatorId',
    'creatorDisplayName',
    'legalName',
    'bankCode',
    'bankName',
    'branchName',
    'accountNumber',
    'accountLast4',
    'currency',
    'grossAmountMinor',
    'taxWithholdingMinor',
    'transferFeeMinor',
    'netAmountMinor',
    'memo',
  ] as const
  const lines = [
    headers.join(','),
    ...rows.map((row) => headers.map((key) => csvCell(String(row[key] ?? ''))).join(',')),
  ]
  return `${lines.join('\n')}\n`
}

function csvCell(value: string) {
  if (!/[",\n]/.test(value)) return value
  return `"${value.replaceAll('"', '""')}"`
}
```

- [ ] **Step 2.5: Verify service tests pass**

Run:

```bash
bun run --cwd apps/server test:unit -- payout.service.test.ts
```

Expected: PASS.

- [ ] **Step 2.6: Commit service**

```bash
git add apps/server/src/services/sticker-market/payout.types.ts apps/server/src/services/sticker-market/payout.service.ts apps/server/src/services/sticker-market/payout.service.test.ts
git commit -m "feat(creator-market): add manual payout service"
```

---

## Task 3: Payout Repository

**Files:**
- Create: `apps/server/src/services/sticker-market/payout.repository.ts`
- Create: `apps/server/src/services/sticker-market/payout.repository.int.test.ts`
- Modify: `apps/server/src/services/sticker-market/index.ts`

- [ ] **Step 3.1: Write repository integration tests**

Create `apps/server/src/services/sticker-market/payout.repository.int.test.ts` with coverage for:

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import { creatorProfile } from '@vine/db/schema-public'
import {
  creatorPayoutAccount,
  creatorPayoutLedger,
  creatorPayoutRequest,
} from '@vine/db/schema-private'
import { createPayoutRepository } from './payout.repository'
import { db } from '../../test/integration-db'

describe('createPayoutRepository', () => {
  const repo = createPayoutRepository()

  beforeEach(async () => {
    await db.delete(creatorPayoutRequest)
    await db.delete(creatorPayoutLedger)
    await db.delete(creatorPayoutAccount)
    await db.delete(creatorProfile)
  })

  it('returns only available ledgers for the authenticated creator', async () => {
    await db.insert(creatorProfile).values({
      id: 'creator_1',
      userId: 'user_1',
      displayName: 'Studio',
      country: 'TW',
    })
    await db.insert(creatorPayoutAccount).values({
      id: 'acct_1',
      creatorId: 'creator_1',
      legalName: 'Creator Legal Name',
      bankCode: '004',
      bankName: 'Taiwan Bank',
      accountNumber: '123456789012',
      accountLast4: '9012',
    })
    await db.insert(creatorPayoutLedger).values({
      id: 'ledger_1',
      creatorId: 'creator_1',
      month: '2026-03',
      grossAmountMinor: 2000,
      platformFeeMinor: 600,
      creatorShareMinor: 1400,
      transferFeeMinor: 30,
      netAmountMinor: 1370,
    })

    const overview = await repo.getCreatorPayoutOverview(db, { userId: 'user_1' })

    expect(overview.creator.id).toBe('creator_1')
    expect(overview.account.accountLast4).toBe('9012')
    expect(overview.availableLedgers).toHaveLength(1)
  })
})
```

- [ ] **Step 3.2: Run integration test to verify failure**

Run:

```bash
bun run --cwd apps/server test:integration -- payout.repository.int.test.ts
```

Expected: FAIL because `payout.repository.ts` does not exist.

- [ ] **Step 3.3: Implement repository methods**

Create `apps/server/src/services/sticker-market/payout.repository.ts` with these exported methods:

```ts
import { and, eq, inArray } from 'drizzle-orm'
import { creatorProfile } from '@vine/db/schema-public'
import {
  creatorPayoutAccount,
  creatorPayoutBatch,
  creatorPayoutLedger,
  creatorPayoutRequest,
} from '@vine/db/schema-private'

export function createPayoutRepository() {
  return {
    async getCreatorPayoutOverview(db: any, input: { userId: string }) {
      const [creator] = await db
        .select()
        .from(creatorProfile)
        .where(eq(creatorProfile.userId, input.userId))
        .limit(1)
      if (!creator) {
        return { creator: undefined, account: undefined, availableLedgers: [], history: [] }
      }
      const [account] = await db
        .select()
        .from(creatorPayoutAccount)
        .where(
          and(
            eq(creatorPayoutAccount.creatorId, creator.id),
            eq(creatorPayoutAccount.status, 'active'),
          ),
        )
        .limit(1)
      const availableLedgers = await db
        .select()
        .from(creatorPayoutLedger)
        .where(
          and(
            eq(creatorPayoutLedger.creatorId, creator.id),
            eq(creatorPayoutLedger.status, 'available'),
          ),
        )
      const history = await db
        .select()
        .from(creatorPayoutRequest)
        .where(eq(creatorPayoutRequest.creatorId, creator.id))
      return { creator, account, availableLedgers, history }
    },

    async createRequestForLedgers(db: any, input: any) {
      const [request] = await db
        .insert(creatorPayoutRequest)
        .values({
          id: input.id,
          creatorId: input.creatorId,
          payoutAccountId: input.payoutAccountId,
          ledgerIdsJson: JSON.stringify(input.ledgerIds),
          grossAmountMinor: input.grossAmountMinor,
          taxWithholdingMinor: input.taxWithholdingMinor,
          transferFeeMinor: input.transferFeeMinor,
          netAmountMinor: input.netAmountMinor,
          status: 'requested',
          requestedAt: input.now,
          updatedAt: input.now,
        })
        .returning()
      await db
        .update(creatorPayoutLedger)
        .set({ status: 'requested', updatedAt: input.now })
        .where(inArray(creatorPayoutLedger.id, input.ledgerIds))
      return request
    },

    async replaceActivePayoutAccount(db: any, input: any) {
      await db
        .update(creatorPayoutAccount)
        .set({ status: 'disabled', updatedAt: input.now })
        .where(
          and(
            eq(creatorPayoutAccount.creatorId, input.creatorId),
            eq(creatorPayoutAccount.status, 'active'),
          ),
        )
      const [account] = await db
        .insert(creatorPayoutAccount)
        .values({
          id: input.id,
          creatorId: input.creatorId,
          legalName: input.legalName,
          bankCode: input.bankCode,
          bankName: input.bankName,
          branchName: input.branchName,
          accountNumber: input.accountNumber,
          accountLast4: input.accountLast4,
          currency: 'TWD',
          status: 'active',
          createdAt: input.now,
          updatedAt: input.now,
        })
        .returning()
      return account
    },

    listPendingRequests(db: any, input: { limit: number }) {
      return db
        .select()
        .from(creatorPayoutRequest)
        .where(eq(creatorPayoutRequest.status, 'requested'))
        .limit(input.limit)
    },

    async approveRequest(db: any, input: any) {
      const [request] = await db
        .update(creatorPayoutRequest)
        .set({
          status: 'approved',
          reviewedAt: input.now,
          reviewedByUserId: input.actorUserId,
          updatedAt: input.now,
        })
        .where(eq(creatorPayoutRequest.id, input.requestId))
        .returning()
      return request
    },

    async rejectRequest(db: any, input: any) {
      const [request] = await db
        .update(creatorPayoutRequest)
        .set({
          status: 'rejected',
          rejectReason: input.reason,
          reviewedAt: input.now,
          reviewedByUserId: input.actorUserId,
          updatedAt: input.now,
        })
        .where(eq(creatorPayoutRequest.id, input.requestId))
        .returning()
      return request
    },

    async createBatchFromApprovedRequests(db: any, input: any) {
      const [batch] = await db
        .insert(creatorPayoutBatch)
        .values({
          id: input.id,
          createdByUserId: input.actorUserId,
          createdAt: input.now,
          updatedAt: input.now,
        })
        .returning()
      await db
        .update(creatorPayoutRequest)
        .set({ batchId: batch.id, status: 'exported', updatedAt: input.now })
        .where(
          and(
            inArray(creatorPayoutRequest.id, input.requestIds),
            eq(creatorPayoutRequest.status, 'approved'),
          ),
        )
      const requests = await db
        .select()
        .from(creatorPayoutRequest)
        .where(inArray(creatorPayoutRequest.id, input.requestIds))
      const ledgerIds = requests.flatMap((request: any) => parseLedgerIds(request.ledgerIdsJson))
      if (ledgerIds.length > 0) {
        await db
          .update(creatorPayoutLedger)
          .set({ status: 'locked', updatedAt: input.now })
          .where(inArray(creatorPayoutLedger.id, ledgerIds))
      }
      return batch
    },

    async exportBatchRows(db: any, input: { batchId: string }) {
      const rows = await db
        .select({
          batchId: creatorPayoutRequest.batchId,
          payoutRequestId: creatorPayoutRequest.id,
          creatorId: creatorPayoutRequest.creatorId,
          creatorDisplayName: creatorProfile.displayName,
          legalName: creatorPayoutAccount.legalName,
          bankCode: creatorPayoutAccount.bankCode,
          bankName: creatorPayoutAccount.bankName,
          branchName: creatorPayoutAccount.branchName,
          accountNumber: creatorPayoutAccount.accountNumber,
          accountLast4: creatorPayoutAccount.accountLast4,
          currency: creatorPayoutRequest.currency,
          grossAmountMinor: creatorPayoutRequest.grossAmountMinor,
          taxWithholdingMinor: creatorPayoutRequest.taxWithholdingMinor,
          transferFeeMinor: creatorPayoutRequest.transferFeeMinor,
          netAmountMinor: creatorPayoutRequest.netAmountMinor,
        })
        .from(creatorPayoutRequest)
        .innerJoin(creatorProfile, eq(creatorPayoutRequest.creatorId, creatorProfile.id))
        .innerJoin(
          creatorPayoutAccount,
          eq(creatorPayoutRequest.payoutAccountId, creatorPayoutAccount.id),
        )
        .where(eq(creatorPayoutRequest.batchId, input.batchId))

      return rows.map((row: any) => ({
        ...row,
        batchId: row.batchId ?? input.batchId,
        memo: `Vine payout ${row.payoutRequestId}`,
      }))
    },

    async markRequestPaid(db: any, input: any) {
      const [request] = await db
        .update(creatorPayoutRequest)
        .set({
          status: 'paid',
          bankTransactionId: input.bankTransactionId,
          paidAt: input.paidAt,
          updatedAt: input.now,
        })
        .where(
          and(
            eq(creatorPayoutRequest.id, input.requestId),
            eq(creatorPayoutRequest.status, 'exported'),
          ),
        )
        .returning()
      if (!request) return undefined
      const ledgerIds = parseLedgerIds(request.ledgerIdsJson)
      if (ledgerIds.length > 0) {
        await db
          .update(creatorPayoutLedger)
          .set({ status: 'paid', updatedAt: input.now })
          .where(inArray(creatorPayoutLedger.id, ledgerIds))
      }
      return request
    },

    async markRequestFailed(db: any, input: any) {
      const [request] = await db
        .update(creatorPayoutRequest)
        .set({
          status: 'failed',
          failureReason: input.reason,
          updatedAt: input.now,
        })
        .where(
          and(
            eq(creatorPayoutRequest.id, input.requestId),
            eq(creatorPayoutRequest.status, 'exported'),
          ),
        )
        .returning()
      if (!request) return undefined
      const ledgerIds = parseLedgerIds(request.ledgerIdsJson)
      if (ledgerIds.length > 0) {
        await db
          .update(creatorPayoutLedger)
          .set({ status: 'available', updatedAt: input.now })
          .where(inArray(creatorPayoutLedger.id, ledgerIds))
      }
      return request
    },
  }
}

function parseLedgerIds(value: string | null | undefined) {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string' && item.length > 0)
      : []
  } catch {
    return []
  }
}
```

- [ ] **Step 3.4: Wire service factory**

Modify `apps/server/src/services/sticker-market/index.ts`:

```ts
import { createPayoutRepository } from './payout.repository'
import { createPayoutService } from './payout.service'
```

Inside `createStickerMarketServices`:

```ts
const payoutRepo = createPayoutRepository()
```

Return:

```ts
payout: createPayoutService({
  db: deps.db,
  repo: payoutRepo,
  createId: () => randomUUID(),
  now: () => new Date(),
}),
```

- [ ] **Step 3.5: Verify repository tests pass**

Run:

```bash
bun run --cwd apps/server test:integration -- payout.repository.int.test.ts
bun run --cwd apps/server test:unit -- payout.service.test.ts
```

Expected: both commands pass.

- [ ] **Step 3.6: Commit repository**

```bash
git add apps/server/src/services/sticker-market/payout.repository.ts apps/server/src/services/sticker-market/payout.repository.int.test.ts apps/server/src/services/sticker-market/index.ts
git commit -m "feat(creator-market): add manual payout repository"
```

---

## Task 4: ConnectRPC Contracts And Handlers

**Files:**
- Modify: `packages/proto/proto/stickerMarket/v1/stickerMarket.proto`
- Generated: `packages/proto/gen/stickerMarket/v1/stickerMarket_pb.ts`
- Modify: `apps/server/src/connect/stickerMarketCreator.ts`
- Modify: `apps/server/src/connect/stickerMarketAdmin.ts`
- Modify: `apps/server/src/index.ts`
- Test: `apps/server/src/connect/stickerMarketAdmin.test.ts`

- [ ] **Step 4.1: Extend proto services**

Add to `StickerMarketCreatorService`:

```proto
  rpc GetCreatorPayoutOverview(GetCreatorPayoutOverviewRequest) returns (GetCreatorPayoutOverviewResponse);
  rpc UpsertCreatorPayoutAccount(UpsertCreatorPayoutAccountRequest) returns (UpsertCreatorPayoutAccountResponse);
  rpc RequestCreatorPayout(RequestCreatorPayoutRequest) returns (RequestCreatorPayoutResponse);
```

Add to `StickerMarketAdminService`:

```proto
  rpc ListPayoutRequests(ListPayoutRequestsRequest) returns (ListPayoutRequestsResponse);
  rpc ApprovePayoutRequest(ApprovePayoutRequestRequest) returns (ApprovePayoutRequestResponse);
  rpc RejectPayoutRequest(RejectPayoutRequestRequest) returns (RejectPayoutRequestResponse);
  rpc CreatePayoutBatch(CreatePayoutBatchRequest) returns (CreatePayoutBatchResponse);
  rpc ExportPayoutBatch(ExportPayoutBatchRequest) returns (ExportPayoutBatchResponse);
  rpc MarkPayoutPaid(MarkPayoutPaidRequest) returns (MarkPayoutPaidResponse);
  rpc MarkPayoutFailed(MarkPayoutFailedRequest) returns (MarkPayoutFailedResponse);
```

Append messages:

```proto
message CreatorPayoutBankAccountSummary {
  string id = 1;
  string bank_name = 2;
  string account_last4 = 3;
}

message CreatorPayoutHistoryRow {
  string id = 1;
  string status = 2;
  int32 net_amount_minor = 3;
  string currency = 4;
  string requested_at = 5;
  string paid_at = 6;
  string failure_reason = 7;
  string reject_reason = 8;
}

message GetCreatorPayoutOverviewRequest {}
message GetCreatorPayoutOverviewResponse {
  int32 available_net_amount_minor = 1;
  string currency = 2;
  CreatorPayoutBankAccountSummary bank_account = 3;
  repeated CreatorPayoutHistoryRow history = 4;
}

message UpsertCreatorPayoutAccountRequest {
  string legal_name = 1;
  string bank_code = 2;
  string bank_name = 3;
  string branch_name = 4;
  string account_number = 5;
  string account_number_confirmation = 6;
}

message UpsertCreatorPayoutAccountResponse {
  CreatorPayoutBankAccountSummary bank_account = 1;
}

message RequestCreatorPayoutRequest {}
message RequestCreatorPayoutResponse {
  string payout_request_id = 1;
  string status = 2;
}

message ListPayoutRequestsRequest { int32 limit = 1; }
message ListPayoutRequestsResponse { repeated CreatorPayoutHistoryRow requests = 1; }

message ApprovePayoutRequestRequest { string payout_request_id = 1; }
message ApprovePayoutRequestResponse { string status = 1; }

message RejectPayoutRequestRequest {
  string payout_request_id = 1;
  string reason = 2;
}
message RejectPayoutRequestResponse { string status = 1; }

message CreatePayoutBatchRequest { repeated string payout_request_ids = 1; }
message CreatePayoutBatchResponse { string batch_id = 1; }

message ExportPayoutBatchRequest { string batch_id = 1; }
message ExportPayoutBatchResponse {
  string file_name = 1;
  string content_type = 2;
  string csv = 3;
}

message MarkPayoutPaidRequest {
  string payout_request_id = 1;
  string bank_transaction_id = 2;
  string paid_at = 3;
}
message MarkPayoutPaidResponse { string status = 1; }

message MarkPayoutFailedRequest {
  string payout_request_id = 1;
  string reason = 2;
}
message MarkPayoutFailedResponse { string status = 1; }
```

- [ ] **Step 4.2: Generate proto**

Run:

```bash
bun turbo proto:generate
```

Expected: generated proto TypeScript updates cleanly.

- [ ] **Step 4.3: Add handler tests for admin auth**

Extend `apps/server/src/connect/stickerMarketAdmin.test.ts` with:

```ts
it('rejects non-admin payout queue access with PermissionDenied', async () => {
  const handler = createStickerMarketAdminHandler({
    refund: {} as any,
    reconciliation: {} as any,
    review: {} as any,
    payout: { listPendingRequests: vi.fn() },
  })

  await expect(
    handler.listPayoutRequests({ limit: 10 }, makeAuthCtx({ id: 'user-1' })),
  ).rejects.toMatchObject({ code: Code.PermissionDenied })
})
```

- [ ] **Step 4.4: Implement handlers**

In `apps/server/src/connect/stickerMarketCreator.ts`, add `payout: any` to deps and add handlers:

```ts
async getCreatorPayoutOverview(_req: any, ctx: HandlerContext) {
  const auth = requireAuthData(ctx)
  return deps.payout.getCreatorPayoutOverview({ userId: auth.id })
},
async requestCreatorPayout(_req: any, ctx: HandlerContext) {
  const auth = requireAuthData(ctx)
  const request = await deps.payout.requestCreatorPayout({ userId: auth.id })
  return { payoutRequestId: request.id, status: request.status }
},
async upsertCreatorPayoutAccount(req: any, ctx: HandlerContext) {
  const auth = requireAuthData(ctx)
  const bankAccount = await deps.payout.upsertCreatorPayoutAccount({
    userId: auth.id,
    legalName: req.legalName,
    bankCode: req.bankCode,
    bankName: req.bankName,
    branchName: req.branchName,
    accountNumber: req.accountNumber,
    accountNumberConfirmation: req.accountNumberConfirmation,
  })
  return { bankAccount }
},
```

In `apps/server/src/connect/stickerMarketAdmin.ts`, add `payout: any` to deps and admin handlers that call `requireAdmin(ctx)` before every payout method.

- [ ] **Step 4.5: Wire deps**

Modify `apps/server/src/index.ts` so both handler dependency objects receive:

```ts
payout: stickerMarket.payout,
```

- [ ] **Step 4.6: Verify Connect tests**

Run:

```bash
bun run --cwd apps/server test:unit -- stickerMarketAdmin.test.ts
bun run --cwd apps/server typecheck
```

Expected: both commands pass.

- [ ] **Step 4.7: Commit RPC layer**

```bash
git add packages/proto/proto/stickerMarket/v1/stickerMarket.proto packages/proto/gen/stickerMarket/v1/stickerMarket_pb.ts apps/server/src/connect/stickerMarketCreator.ts apps/server/src/connect/stickerMarketAdmin.ts apps/server/src/connect/stickerMarketAdmin.test.ts apps/server/src/index.ts
git commit -m "feat(creator-market): expose manual payout rpc"
```

---

## Task 5: Creator Payout Page

**Files:**
- Create: `apps/web/app/(app)/creator/payouts.tsx`
- Create: `apps/web/src/features/sticker-market/creator/CreatorPayoutPage.tsx`
- Modify: `apps/web/src/features/sticker-market/creator/client.ts`
- Modify: `apps/web/src/features/sticker-market/creator/CreatorShell.tsx`

- [ ] **Step 5.1: Add client helpers**

In `apps/web/src/features/sticker-market/creator/client.ts`, add:

```ts
export function creatorPayoutOverviewQueryKey() {
  return ['sticker-market', 'creator-payout-overview'] as const
}

export function creatorPayoutAccountMutationKey() {
  return ['sticker-market', 'creator-payout-account'] as const
}
```

- [ ] **Step 5.2: Add route**

Create `apps/web/app/(app)/creator/payouts.tsx`:

```tsx
import { CreatorPayoutPage } from '~/features/sticker-market/creator/CreatorPayoutPage'

export default CreatorPayoutRoute

function CreatorPayoutRoute() {
  return <CreatorPayoutPage />
}
```

- [ ] **Step 5.3: Add page component**

Create `apps/web/src/features/sticker-market/creator/CreatorPayoutPage.tsx` using `useTanQuery`, `useTanMutation`, `YStack`, `XStack`, `Text`, and `Button` from existing project UI patterns. It must render:

```tsx
const statusText: Record<string, string> = {
  requested: '審核中',
  approved: '已核准',
  exported: '已排入匯款批次',
  paid: '已匯款',
  rejected: '退件',
  failed: '匯款失敗',
}
```

The request button text must be:

```tsx
`申請人工匯款 ${formatTwdMinor(overview.data?.availableNetAmountMinor ?? 0)}`
```

The bank account display must use:

```tsx
`${overview.data.bankAccount.bankName} ···· ${overview.data.bankAccount.accountLast4}`
```

The page must include an inline bank account form shown when no account exists or when the creator presses `修改收款資訊`. Use local component state for these fields:

```ts
type PayoutAccountForm = {
  legalName: string
  bankCode: string
  bankName: string
  branchName: string
  accountNumber: string
  accountNumberConfirmation: string
}
```

Submit the form with:

```ts
await stickerMarketCreatorClient.upsertCreatorPayoutAccount(form)
```

After success, invalidate `creatorPayoutOverviewQueryKey()` and clear `accountNumber` / `accountNumberConfirmation` from component state. Do not display the full account number after save.

- [ ] **Step 5.4: Add creator nav link**

In `CreatorShell.tsx`, add a link to `/creator/payouts` with label `收款申請`.

- [ ] **Step 5.5: Verify web typecheck**

Run:

```bash
bun run --cwd apps/web typecheck
```

Expected: PASS.

- [ ] **Step 5.6: Commit creator UI**

```bash
git add apps/web/app/'(app)'/creator/payouts.tsx apps/web/src/features/sticker-market/creator/CreatorPayoutPage.tsx apps/web/src/features/sticker-market/creator/client.ts apps/web/src/features/sticker-market/creator/CreatorShell.tsx
git commit -m "feat(creator-market): add creator manual payout page"
```

---

## Task 6: Admin Payout Batch UI

**Files:**
- Create: `apps/web/app/(app)/admin/payouts/index.tsx`
- Create: `apps/web/src/features/sticker-market/admin/AdminPayoutsPage.tsx`
- Modify: `apps/web/src/features/sticker-market/admin/client.ts`

- [ ] **Step 6.1: Add route**

Create `apps/web/app/(app)/admin/payouts/index.tsx`:

```tsx
import { AdminPayoutsPage } from '~/features/sticker-market/admin/AdminPayoutsPage'

export default AdminPayoutsRoute

function AdminPayoutsRoute() {
  return <AdminPayoutsPage />
}
```

- [ ] **Step 6.2: Build admin page**

Create `AdminPayoutsPage.tsx` with these controls:

- Pending request list from `listPayoutRequests({ limit: 100 })`.
- Per-row `核准` button calling `approvePayoutRequest`.
- Per-row `退件` button calling `rejectPayoutRequest` with an operator-entered reason.
- `建立匯款批次` button calling `createPayoutBatch`.
- `下載 CSV` button calling `exportPayoutBatch`; save returned CSV as `vine-payout-<batchId>.csv`.
- `標記已匯款` and `標記匯款失敗` actions for exported requests.

Use CSV download in the browser:

```ts
function downloadCsv(fileName: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}
```

- [ ] **Step 6.3: Verify web typecheck**

Run:

```bash
bun run --cwd apps/web typecheck
```

Expected: PASS.

- [ ] **Step 6.4: Commit admin UI**

```bash
git add apps/web/app/'(app)'/admin/payouts/index.tsx apps/web/src/features/sticker-market/admin/AdminPayoutsPage.tsx apps/web/src/features/sticker-market/admin/client.ts
git commit -m "feat(creator-market): add admin manual payout batch UI"
```

---

## Task 7: Final Verification

**Files:**
- All files touched by Tasks 1-6.

- [ ] **Step 7.1: Run focused server tests**

```bash
bun run --cwd apps/server test:unit -- payout.service.test.ts stickerMarketAdmin.test.ts
bun run --cwd apps/server test:integration -- payout.repository.int.test.ts
```

Expected: both commands pass.

- [ ] **Step 7.2: Run typechecks**

```bash
bun run --cwd packages/db typecheck
bun run --cwd apps/server typecheck
bun run --cwd apps/web typecheck
```

Expected: all commands pass.

- [ ] **Step 7.3: Run repo-level validation**

```bash
bun run check:all
```

Expected: command exits 0.

- [ ] **Step 7.4: Manual QA**

Use Docker Compose per `AGENTS.md`, sign in as a creator, and verify:

- Creator sees `/creator/payouts`.
- Creator sees only bank name and last four digits.
- Creator can request payout only when available net amount is at least `NT$300`.
- Admin can approve request, create batch, download CSV, and mark paid.
- CSV includes full account number and never appears in creator UI.

- [ ] **Step 7.5: Commit verification fixes**

If verification required fixes:

```bash
git status --short
git add packages/db/src/schema-private.ts packages/db/src/migrations/20260426000001_creator_manual_payout.ts
git add packages/proto/proto/stickerMarket/v1/stickerMarket.proto packages/proto/gen/stickerMarket/v1/stickerMarket_pb.ts
git add apps/server/src/services/sticker-market/payout.types.ts apps/server/src/services/sticker-market/payout.repository.ts apps/server/src/services/sticker-market/payout.repository.int.test.ts apps/server/src/services/sticker-market/payout.service.ts apps/server/src/services/sticker-market/payout.service.test.ts apps/server/src/services/sticker-market/index.ts
git add apps/server/src/connect/stickerMarketCreator.ts apps/server/src/connect/stickerMarketAdmin.ts apps/server/src/connect/stickerMarketAdmin.test.ts apps/server/src/index.ts
git add apps/web/app/'(app)'/creator/payouts.tsx apps/web/app/'(app)'/admin/payouts/index.tsx apps/web/src/features/sticker-market/creator/CreatorPayoutPage.tsx apps/web/src/features/sticker-market/creator/client.ts apps/web/src/features/sticker-market/creator/CreatorShell.tsx apps/web/src/features/sticker-market/admin/AdminPayoutsPage.tsx apps/web/src/features/sticker-market/admin/client.ts
git commit -m "fix(creator-market): stabilize manual payout flow"
```

If no fixes were required, do not create an empty commit.

---

## Self-Review

- Spec coverage: covers manual payout ledger, creator request flow, admin review/batch/export/result entry, bank account privacy, and future executor boundary.
- Scope boundary: does not implement automatic Stripe payouts, PayPal payouts, live bank status polling, or automatic retry.
- Residual design decision: CSV is the Phase 2.5 export format. Native `.xlsx` is out of scope unless operations later requires it.
