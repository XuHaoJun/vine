import type { PoolClient } from 'pg'

const sql = `
CREATE TABLE "chatOaLoading" (
  "id" text PRIMARY KEY NOT NULL,
  "chatId" text NOT NULL,
  "oaId" text NOT NULL,
  "expiresAt" bigint NOT NULL
);
`

export async function up(client: PoolClient): Promise<void> {
  await client.query(sql)
}

export async function down(client: PoolClient): Promise<void> {
  await client.query(`
    DROP TABLE IF EXISTS "chatOaLoading";
  `)
}
