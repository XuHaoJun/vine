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
