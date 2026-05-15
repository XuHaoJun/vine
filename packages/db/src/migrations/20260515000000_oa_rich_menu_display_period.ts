import type { PoolClient } from 'pg'

const sql = `
ALTER TABLE "oaRichMenu" ADD COLUMN "displayStartsAt" timestamp;
--> statement-breakpoint
ALTER TABLE "oaRichMenu" ADD COLUMN "displayEndsAt" timestamp;
--> statement-breakpoint
ALTER TABLE "oaRichMenu" ADD COLUMN "displayScheduleRevision" integer DEFAULT 0 NOT NULL;
`

export async function up(client: PoolClient): Promise<void> {
  await client.query(sql)
}

export async function down(client: PoolClient): Promise<void> {
  await client.query(`
    ALTER TABLE "oaRichMenu" DROP COLUMN IF EXISTS "displayScheduleRevision";
    ALTER TABLE "oaRichMenu" DROP COLUMN IF EXISTS "displayEndsAt";
    ALTER TABLE "oaRichMenu" DROP COLUMN IF EXISTS "displayStartsAt";
  `)
}
