import type { PoolClient } from 'pg'

const sql = `
CREATE TABLE "oaChatFilter" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "oaId" uuid NOT NULL REFERENCES "officialAccount"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "matchMode" text NOT NULL DEFAULT 'any',
  "tagIds" text NOT NULL DEFAULT '[]',
  "sortOrder" integer NOT NULL DEFAULT 0,
  "createdAt" timestamptz DEFAULT now() NOT NULL,
  "updatedAt" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX "oaChatFilter_oaId_idx" ON "oaChatFilter"("oaId");
`

export async function up(client: PoolClient): Promise<void> {
  await client.query(sql)
}

export async function down(client: PoolClient): Promise<void> {
  await client.query('DROP TABLE IF EXISTS "oaChatFilter";')
}
