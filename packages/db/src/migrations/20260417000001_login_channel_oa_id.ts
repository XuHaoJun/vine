import type { PoolClient } from 'pg'

const sql = `
ALTER TABLE "loginChannel" ADD COLUMN "oaId" uuid REFERENCES "officialAccount"("id") ON DELETE SET NULL;
`

export async function up(client: PoolClient): Promise<void> {
  await client.query(sql)
}

export async function down(client: PoolClient): Promise<void> {
  await client.query(`ALTER TABLE "loginChannel" DROP COLUMN IF EXISTS "oaId";`)
}
