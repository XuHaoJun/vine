import type { PoolClient } from 'pg'

const sql = `
CREATE TABLE "oaQuota" (
	"oaId" uuid PRIMARY KEY,
	"monthlyLimit" integer NOT NULL DEFAULT 0,
	"currentUsage" integer NOT NULL DEFAULT 0,
	"resetAt" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "oaQuota" ADD CONSTRAINT "oaQuota_oaId_officialAccount_id_fkey" FOREIGN KEY ("oaId") REFERENCES "officialAccount"("id") ON DELETE CASCADE;
`

export async function up(client: PoolClient): Promise<void> {
  await client.query(sql)
}

export async function down(client: PoolClient): Promise<void> {
  await client.query(`DROP TABLE IF EXISTS "oaQuota";`)
}
