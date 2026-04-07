import type { PoolClient } from 'pg'

const sql = `
CREATE TABLE "oaProvider" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" text NOT NULL,
	"ownerId" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "officialAccount" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"providerId" uuid NOT NULL,
	"name" text NOT NULL,
	"uniqueId" text NOT NULL UNIQUE,
	"description" text,
	"imageUrl" text,
	"channelSecret" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oaWebhook" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"oaId" uuid NOT NULL,
	"url" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"lastVerifiedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oaFriendship" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"oaId" uuid NOT NULL,
	"userId" text NOT NULL,
	"status" text DEFAULT 'friend' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oaAccessToken" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"oaId" uuid NOT NULL,
	"token" text NOT NULL,
	"type" text NOT NULL,
	"keyId" text,
	"expiresAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "officialAccount_providerId_idx" ON "officialAccount" ("providerId");
--> statement-breakpoint
CREATE INDEX "officialAccount_uniqueId_idx" ON "officialAccount" ("uniqueId");
--> statement-breakpoint
CREATE INDEX "oaWebhook_oaId_idx" ON "oaWebhook" ("oaId");
--> statement-breakpoint
CREATE INDEX "oaFriendship_oaId_idx" ON "oaFriendship" ("oaId");
--> statement-breakpoint
CREATE INDEX "oaFriendship_userId_idx" ON "oaFriendship" ("userId");
--> statement-breakpoint
CREATE INDEX "oaAccessToken_oaId_idx" ON "oaAccessToken" ("oaId");
--> statement-breakpoint
CREATE INDEX "oaAccessToken_keyId_idx" ON "oaAccessToken" ("keyId");
--> statement-breakpoint
ALTER TABLE "officialAccount" ADD CONSTRAINT "officialAccount_providerId_oaProvider_id_fkey" FOREIGN KEY ("providerId") REFERENCES "oaProvider"("id") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "oaWebhook" ADD CONSTRAINT "oaWebhook_oaId_officialAccount_id_fkey" FOREIGN KEY ("oaId") REFERENCES "officialAccount"("id") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "oaFriendship" ADD CONSTRAINT "oaFriendship_oaId_officialAccount_id_fkey" FOREIGN KEY ("oaId") REFERENCES "officialAccount"("id") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "oaAccessToken" ADD CONSTRAINT "oaAccessToken_oaId_officialAccount_id_fkey" FOREIGN KEY ("oaId") REFERENCES "officialAccount"("id") ON DELETE CASCADE;
`

export async function up(client: PoolClient) {
  await client.query(sql)
}

export async function down(client: PoolClient) {
  await client.query(`
    DROP TABLE IF EXISTS "oaAccessToken";
    DROP TABLE IF EXISTS "oaFriendship";
    DROP TABLE IF EXISTS "oaWebhook";
    DROP TABLE IF EXISTS "officialAccount";
    DROP TABLE IF EXISTS "oaProvider";
  `)
}
