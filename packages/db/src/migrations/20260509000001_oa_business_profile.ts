import type { PoolClient } from 'pg'

const sql = `
CREATE TABLE "oaBusinessProfile" (
  "oaId" uuid PRIMARY KEY REFERENCES "officialAccount"("id") ON DELETE CASCADE,
  "displayName" text NOT NULL,
  "uniqueId" text NOT NULL,
  "statusMessage" text NOT NULL DEFAULT '',
  "profileImageUrl" text,
  "coverImageUrl" text,
  "showFollowerCount" boolean NOT NULL DEFAULT false,
  "footerButtonColor" text NOT NULL DEFAULT '#06c755',
  "splashLabels" text[] NOT NULL DEFAULT '{}',
  "buttons" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "address" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "phoneNumber" text,
  "paymentMethods" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "businessHours" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "websites" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "visibilitySettings" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "announcements" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "mixedMediaFeed" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "socialMedia" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "basicInfoBlock" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "blockOrder" text[] NOT NULL DEFAULT '{}',
  "publishedAt" timestamptz,
  "createdAt" timestamptz DEFAULT now() NOT NULL,
  "updatedAt" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX "oaBusinessProfile_uniqueId_idx" ON "oaBusinessProfile"("uniqueId");

CREATE TABLE "oaBusinessProfileDraft" (
  "oaId" uuid PRIMARY KEY REFERENCES "officialAccount"("id") ON DELETE CASCADE,
  "displayName" text NOT NULL,
  "uniqueId" text NOT NULL,
  "statusMessage" text NOT NULL DEFAULT '',
  "profileImageUrl" text,
  "coverImageUrl" text,
  "showFollowerCount" boolean NOT NULL DEFAULT false,
  "footerButtonColor" text NOT NULL DEFAULT '#06c755',
  "splashLabels" text[] NOT NULL DEFAULT '{}',
  "buttons" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "address" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "phoneNumber" text,
  "paymentMethods" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "businessHours" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "websites" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "visibilitySettings" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "announcements" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "mixedMediaFeed" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "socialMedia" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "basicInfoBlock" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "blockOrder" text[] NOT NULL DEFAULT '{}',
  "serverRevision" integer NOT NULL DEFAULT 1,
  "lastSavedAt" timestamptz,
  "createdAt" timestamptz DEFAULT now() NOT NULL,
  "updatedAt" timestamptz DEFAULT now() NOT NULL
);
`

export async function up(client: PoolClient): Promise<void> {
  await client.query(sql)
}

export async function down(client: PoolClient): Promise<void> {
  await client.query(`
    DROP TABLE IF EXISTS "oaBusinessProfileDraft";
    DROP TABLE IF EXISTS "oaBusinessProfile";
  `)
}
