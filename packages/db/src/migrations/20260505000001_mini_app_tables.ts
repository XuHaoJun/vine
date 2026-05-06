import type { PoolClient } from 'pg'

const sql = `
CREATE TABLE "miniApp" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "providerId" uuid NOT NULL REFERENCES "oaProvider"("id") ON DELETE CASCADE,
  "liffAppId" uuid NOT NULL UNIQUE REFERENCES "oaLiffApp"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "iconUrl" text,
  "description" text,
  "category" text,
  "isPublished" boolean NOT NULL DEFAULT false,
  "publishedAt" timestamptz,
  "createdAt" timestamptz DEFAULT now() NOT NULL,
  "updatedAt" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX "miniApp_providerId_idx" ON "miniApp"("providerId");
CREATE INDEX "miniApp_liffAppId_idx" ON "miniApp"("liffAppId");
CREATE INDEX "miniApp_isPublished_idx" ON "miniApp"("isPublished") WHERE "isPublished" = true;

CREATE TABLE "miniAppOaLink" (
  "miniAppId" uuid NOT NULL REFERENCES "miniApp"("id") ON DELETE CASCADE,
  "oaId" uuid NOT NULL REFERENCES "officialAccount"("id") ON DELETE CASCADE,
  "createdAt" timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY ("miniAppId", "oaId")
);
CREATE INDEX "miniAppOaLink_oaId_idx" ON "miniAppOaLink"("oaId");

CREATE TABLE "miniAppRecent" (
  "userId" text NOT NULL,
  "miniAppId" uuid NOT NULL REFERENCES "miniApp"("id") ON DELETE CASCADE,
  "lastOpenedAt" timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY ("userId", "miniAppId")
);
CREATE INDEX "miniAppRecent_userId_lastOpened_idx" ON "miniAppRecent"("userId", "lastOpenedAt" DESC);
`

export async function up(client: PoolClient): Promise<void> {
  await client.query(sql)
}

export async function down(client: PoolClient): Promise<void> {
  await client.query(`
    DROP TABLE IF EXISTS "miniAppRecent";
    DROP TABLE IF EXISTS "miniAppOaLink";
    DROP TABLE IF EXISTS "miniApp";
  `)
}
