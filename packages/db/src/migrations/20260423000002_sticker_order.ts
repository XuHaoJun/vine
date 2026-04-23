import type { PoolClient } from 'pg'

const sql = `
CREATE TABLE "stickerOrder" (
	"id" text PRIMARY KEY,
	"userId" text NOT NULL,
	"packageId" text NOT NULL,
	"amountMinor" integer NOT NULL,
	"currency" text NOT NULL,
	"status" text NOT NULL DEFAULT 'created',
	"connectorName" text NOT NULL,
	"connectorChargeId" text,
	"paidAt" timestamp,
	"failureReason" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "stickerOrder_userId_idx" ON "stickerOrder" ("userId");
--> statement-breakpoint
CREATE INDEX "stickerOrder_status_idx" ON "stickerOrder" ("status");
`

export async function up(client: PoolClient): Promise<void> {
  await client.query(sql)
}

export async function down(client: PoolClient): Promise<void> {
  await client.query(`DROP TABLE IF EXISTS "stickerOrder";`)
}
