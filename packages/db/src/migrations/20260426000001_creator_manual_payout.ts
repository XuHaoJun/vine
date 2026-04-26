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
