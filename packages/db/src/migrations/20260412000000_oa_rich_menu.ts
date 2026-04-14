import type { PoolClient } from 'pg'

const sql = `
CREATE TABLE "oaRichMenu" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"oaId" uuid NOT NULL,
	"richMenuId" text NOT NULL,
	"name" text NOT NULL,
	"chatBarText" text NOT NULL,
	"selected" boolean DEFAULT false NOT NULL,
	"sizeWidth" integer NOT NULL,
	"sizeHeight" integer NOT NULL,
	"areas" jsonb DEFAULT '[]' NOT NULL,
	"hasImage" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oaRichMenuAlias" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"oaId" uuid NOT NULL,
	"richMenuAliasId" text NOT NULL,
	"richMenuId" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oaRichMenuUserLink" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"oaId" uuid NOT NULL,
	"userId" text NOT NULL,
	"richMenuId" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oaDefaultRichMenu" (
	"oaId" uuid PRIMARY KEY,
	"richMenuId" text NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "oaRichMenu_oaId_idx" ON "oaRichMenu" ("oaId");
--> statement-breakpoint
CREATE INDEX "oaRichMenu_richMenuId_idx" ON "oaRichMenu" ("richMenuId");
--> statement-breakpoint
CREATE INDEX "oaRichMenuAlias_oaId_idx" ON "oaRichMenuAlias" ("oaId");
--> statement-breakpoint
CREATE UNIQUE INDEX "oaRichMenuAlias_aliasId_oaId_unique" ON "oaRichMenuAlias" ("richMenuAliasId", "oaId");
--> statement-breakpoint
CREATE INDEX "oaRichMenuUserLink_oaId_idx" ON "oaRichMenuUserLink" ("oaId");
--> statement-breakpoint
CREATE INDEX "oaRichMenuUserLink_userId_idx" ON "oaRichMenuUserLink" ("userId");
--> statement-breakpoint
CREATE UNIQUE INDEX "oaRichMenuUserLink_userId_oaId_unique" ON "oaRichMenuUserLink" ("userId", "oaId");
--> statement-breakpoint
ALTER TABLE "oaRichMenu" ADD CONSTRAINT "oaRichMenu_oaId_officialAccount_id_fkey" FOREIGN KEY ("oaId") REFERENCES "officialAccount"("id") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "oaRichMenuAlias" ADD CONSTRAINT "oaRichMenuAlias_oaId_officialAccount_id_fkey" FOREIGN KEY ("oaId") REFERENCES "officialAccount"("id") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "oaRichMenuUserLink" ADD CONSTRAINT "oaRichMenuUserLink_oaId_officialAccount_id_fkey" FOREIGN KEY ("oaId") REFERENCES "officialAccount"("id") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "oaDefaultRichMenu" ADD CONSTRAINT "oaDefaultRichMenu_oaId_officialAccount_id_fkey" FOREIGN KEY ("oaId") REFERENCES "officialAccount"("id") ON DELETE CASCADE;
`

export async function up(client: PoolClient): Promise<void> {
  await client.query(sql)
}

export async function down(client: PoolClient): Promise<void> {
  await client.query(`
    DROP TABLE IF EXISTS "oaDefaultRichMenu";
    DROP TABLE IF EXISTS "oaRichMenuUserLink";
    DROP TABLE IF EXISTS "oaRichMenuAlias";
    DROP TABLE IF EXISTS "oaRichMenu";
  `)
}
