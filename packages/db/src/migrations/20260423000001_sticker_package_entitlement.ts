import type { PoolClient } from 'pg'

const sql = `
CREATE TABLE "stickerPackage" (
	"id" text PRIMARY KEY,
	"name" text NOT NULL,
	"description" text NOT NULL DEFAULT '',
	"priceMinor" integer NOT NULL,
	"currency" text NOT NULL,
	"coverDriveKey" text NOT NULL,
	"tabIconDriveKey" text NOT NULL,
	"stickerCount" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "stickerPackage_createdAt_idx" ON "stickerPackage" ("createdAt");
--> statement-breakpoint
CREATE TABLE "entitlement" (
	"id" text PRIMARY KEY,
	"userId" text NOT NULL,
	"packageId" text NOT NULL,
	"grantedByOrderId" text NOT NULL,
	"grantedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "entitlement_userId_idx" ON "entitlement" ("userId");
--> statement-breakpoint
CREATE UNIQUE INDEX "entitlement_userPackage_unique" ON "entitlement" ("userId", "packageId");
`

export async function up(client: PoolClient): Promise<void> {
  await client.query(sql)
}

export async function down(client: PoolClient): Promise<void> {
  await client.query(`DROP TABLE IF EXISTS "entitlement";`)
  await client.query(`DROP TABLE IF EXISTS "stickerPackage";`)
}
