import type { PoolClient } from 'pg'

const sql = `
ALTER TABLE "officialAccount" ADD COLUMN "email" text;
ALTER TABLE "officialAccount" ADD COLUMN "country" text;
ALTER TABLE "officialAccount" ADD COLUMN "company" text;
ALTER TABLE "officialAccount" ADD COLUMN "industry" text;
`

export async function up(client: PoolClient): Promise<void> {
  await client.query(sql)
}

export async function down(client: PoolClient): Promise<void> {
  await client.query(`
    ALTER TABLE "officialAccount" DROP COLUMN IF EXISTS "industry";
    ALTER TABLE "officialAccount" DROP COLUMN IF EXISTS "company";
    ALTER TABLE "officialAccount" DROP COLUMN IF EXISTS "country";
    ALTER TABLE "officialAccount" DROP COLUMN IF EXISTS "email";
  `)
}
