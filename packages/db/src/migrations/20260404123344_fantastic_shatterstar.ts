import type { PoolClient } from 'pg'

/** Adds OA linkage columns; was only in drizzle-kit folder SQL and never wired to migrate glob. */
const sql = `
ALTER TABLE "chatMember" ADD COLUMN "oaId" text;
ALTER TABLE "message" ADD COLUMN "oaId" text;
`

export async function up(client: PoolClient) {
  await client.query(sql)
}
