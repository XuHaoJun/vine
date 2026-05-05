import type { PoolClient } from 'pg'

const sql = `
ALTER TABLE "officialAccount"
  ADD COLUMN "kind" text NOT NULL DEFAULT 'user';

ALTER TABLE "message"
  ADD COLUMN "miniAppId" uuid REFERENCES "miniApp"("id") ON DELETE SET NULL;
CREATE INDEX "message_miniAppId_idx" ON "message"("miniAppId");

CREATE TABLE "miniAppServiceMessageTemplate" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "miniAppId" uuid NOT NULL REFERENCES "miniApp"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "kind" text NOT NULL,
  "languageTag" text NOT NULL,
  "flexJson" jsonb NOT NULL,
  "paramsSchema" jsonb NOT NULL,
  "useCase" text NOT NULL DEFAULT '',
  "createdAt" timestamptz DEFAULT now() NOT NULL,
  "updatedAt" timestamptz DEFAULT now() NOT NULL,
  UNIQUE("miniAppId", "name")
);
CREATE INDEX "miniAppSMT_miniAppId_idx" ON "miniAppServiceMessageTemplate"("miniAppId");

-- Seed the platform-system OA "Mini App 通知"
INSERT INTO "oaProvider" ("id", "name", "ownerId")
VALUES ('00000000-0000-0000-0000-000000000001', 'Vine Platform', 'system')
ON CONFLICT (id) DO NOTHING;

INSERT INTO "officialAccount"
  ("id", "providerId", "name", "uniqueId", "channelSecret", "kind", "status")
VALUES
  ('00000000-0000-0000-0000-000000001001',
   '00000000-0000-0000-0000-000000000001',
   'Mini App 通知', 'mini-app-notice', 'platform-system-no-secret',
   'platform_system', 'active')
ON CONFLICT (id) DO NOTHING;
`

export async function up(client: PoolClient): Promise<void> {
  await client.query(sql)
}

export async function down(client: PoolClient): Promise<void> {
  await client.query(`
    DROP TABLE IF EXISTS "miniAppServiceMessageTemplate";
    ALTER TABLE "message" DROP COLUMN IF EXISTS "miniAppId";
    ALTER TABLE "officialAccount" DROP COLUMN IF EXISTS "kind";
  `)
}
