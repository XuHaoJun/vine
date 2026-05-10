import type { PoolClient } from 'pg'

const sql = `
CREATE TABLE "oaContactProfile" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "oaId" uuid NOT NULL REFERENCES "officialAccount"("id") ON DELETE CASCADE,
  "userId" text NOT NULL,
  "noteText" text NOT NULL DEFAULT '',
  "noteUpdatedAt" timestamptz,
  "createdAt" timestamptz DEFAULT now() NOT NULL,
  "updatedAt" timestamptz DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX "oaContactProfile_oaId_userId_unique" ON "oaContactProfile"("oaId", "userId");
CREATE INDEX "oaContactProfile_oaId_idx" ON "oaContactProfile"("oaId");
CREATE INDEX "oaContactProfile_userId_idx" ON "oaContactProfile"("userId");

CREATE TABLE "oaContactTag" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "oaId" uuid NOT NULL REFERENCES "officialAccount"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "color" text,
  "createdAt" timestamptz DEFAULT now() NOT NULL,
  "updatedAt" timestamptz DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX "oaContactTag_oaId_name_unique" ON "oaContactTag"("oaId", "name");
CREATE INDEX "oaContactTag_oaId_idx" ON "oaContactTag"("oaId");

CREATE TABLE "oaContactTagAssignment" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "oaId" uuid NOT NULL REFERENCES "officialAccount"("id") ON DELETE CASCADE,
  "userId" text NOT NULL,
  "tagId" uuid NOT NULL REFERENCES "oaContactTag"("id") ON DELETE CASCADE,
  "createdAt" timestamptz DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX "oaContactTagAssignment_contact_tag_unique" ON "oaContactTagAssignment"("oaId", "userId", "tagId");
CREATE INDEX "oaContactTagAssignment_oaId_userId_idx" ON "oaContactTagAssignment"("oaId", "userId");
CREATE INDEX "oaContactTagAssignment_tagId_idx" ON "oaContactTagAssignment"("tagId");
`

export async function up(client: PoolClient): Promise<void> {
  await client.query(sql)
}

export async function down(client: PoolClient): Promise<void> {
  await client.query(`
    DROP TABLE IF EXISTS "oaContactTagAssignment";
    DROP TABLE IF EXISTS "oaContactTag";
    DROP TABLE IF EXISTS "oaContactProfile";
  `)
}
