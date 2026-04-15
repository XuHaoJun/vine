import type { PoolClient } from 'pg'

const sql = `
CREATE TABLE "loginChannel" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "providerId" uuid NOT NULL REFERENCES "oaProvider"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "channelId" text NOT NULL UNIQUE,
  "channelSecret" text NOT NULL,
  "description" text,
  "createdAt" timestamptz DEFAULT now() NOT NULL,
  "updatedAt" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX "loginChannel_providerId_idx" ON "loginChannel"("providerId");

CREATE TABLE "oaLiffApp" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "loginChannelId" uuid NOT NULL REFERENCES "loginChannel"("id") ON DELETE CASCADE,
  "liffId" text NOT NULL UNIQUE,
  "viewType" text NOT NULL DEFAULT 'full',
  "endpointUrl" text NOT NULL,
  "moduleMode" boolean DEFAULT false,
  "description" text,
  "scopes" text[] DEFAULT '{profile,chat_message.write}',
  "botPrompt" text DEFAULT 'none',
  "qrCode" boolean DEFAULT false,
  "createdAt" timestamptz DEFAULT now() NOT NULL,
  "updatedAt" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX "oaLiffApp_loginChannelId_idx" ON "oaLiffApp"("loginChannelId");
CREATE INDEX "oaLiffApp_liffId_idx" ON "oaLiffApp"("liffId");
`

export async function up(client: PoolClient): Promise<void> {
  await client.query(sql)
}

export async function down(client: PoolClient): Promise<void> {
  await client.query(`
    DROP TABLE IF EXISTS "oaLiffApp";
    DROP TABLE IF EXISTS "loginChannel";
  `)
}