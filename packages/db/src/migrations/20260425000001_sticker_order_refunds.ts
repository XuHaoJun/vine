import type { PoolClient } from 'pg'

const sql = `
ALTER TABLE "stickerOrder" ADD COLUMN "refundId" text;
--> statement-breakpoint
ALTER TABLE "stickerOrder" ADD COLUMN "refundAmountMinor" integer;
--> statement-breakpoint
ALTER TABLE "stickerOrder" ADD COLUMN "refundReason" text;
--> statement-breakpoint
ALTER TABLE "stickerOrder" ADD COLUMN "refundRequestedAt" timestamp;
--> statement-breakpoint
ALTER TABLE "stickerOrder" ADD COLUMN "refundedAt" timestamp;
--> statement-breakpoint
ALTER TABLE "stickerOrder" ADD COLUMN "refundFailureReason" text;
--> statement-breakpoint
ALTER TABLE "stickerOrder" ADD COLUMN "refundRequestedByUserId" text;
--> statement-breakpoint
ALTER TABLE "stickerOrder" ADD COLUMN "lastReconciledAt" timestamp;
--> statement-breakpoint
ALTER TABLE "stickerOrder" ADD COLUMN "lastConnectorStatus" text;
--> statement-breakpoint
ALTER TABLE "stickerOrder" ADD COLUMN "lastReconciliationMismatch" text;
--> statement-breakpoint
CREATE UNIQUE INDEX "stickerOrder_refundId_unique" ON "stickerOrder" ("refundId") WHERE "refundId" IS NOT NULL;
`

export async function up(client: PoolClient): Promise<void> {
  await client.query(sql)
}

export async function down(client: PoolClient): Promise<void> {
  await client.query(`
DROP INDEX IF EXISTS "stickerOrder_refundId_unique";
ALTER TABLE "stickerOrder" DROP COLUMN IF EXISTS "lastReconciliationMismatch";
ALTER TABLE "stickerOrder" DROP COLUMN IF EXISTS "lastConnectorStatus";
ALTER TABLE "stickerOrder" DROP COLUMN IF EXISTS "lastReconciledAt";
ALTER TABLE "stickerOrder" DROP COLUMN IF EXISTS "refundRequestedByUserId";
ALTER TABLE "stickerOrder" DROP COLUMN IF EXISTS "refundFailureReason";
ALTER TABLE "stickerOrder" DROP COLUMN IF EXISTS "refundedAt";
ALTER TABLE "stickerOrder" DROP COLUMN IF EXISTS "refundRequestedAt";
ALTER TABLE "stickerOrder" DROP COLUMN IF EXISTS "refundReason";
ALTER TABLE "stickerOrder" DROP COLUMN IF EXISTS "refundAmountMinor";
ALTER TABLE "stickerOrder" DROP COLUMN IF EXISTS "refundId";
`)
}
