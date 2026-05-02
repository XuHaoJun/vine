import type { PoolClient } from 'pg'

const sql = `
CREATE TABLE "oaRichMenuClick" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"oaId" uuid NOT NULL,
	"richMenuId" text NOT NULL,
	"areaIndex" integer NOT NULL,
	"clickedAt" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "oaRichMenuClick_oaId_richMenuId_idx" ON "oaRichMenuClick" ("oaId", "richMenuId");
--> statement-breakpoint
CREATE INDEX "oaRichMenuClick_oaId_clickedAt_idx" ON "oaRichMenuClick" ("oaId", "clickedAt");
--> statement-breakpoint
ALTER TABLE "oaRichMenuClick" ADD CONSTRAINT "oaRichMenuClick_oaId_officialAccount_id_fkey" FOREIGN KEY ("oaId") REFERENCES "officialAccount"("id") ON DELETE CASCADE;
`

export async function up(client: PoolClient): Promise<void> {
  await client.query(sql)
}

export async function down(client: PoolClient): Promise<void> {
  await client.query(`DROP TABLE IF EXISTS "oaRichMenuClick";`)
}
