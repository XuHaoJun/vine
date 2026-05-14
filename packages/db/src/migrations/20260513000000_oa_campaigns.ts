import type { PoolClient } from 'pg'

export async function up(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE "oaAudienceFilter" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "oaId" uuid NOT NULL,
      "name" text NOT NULL,
      "queryVersion" integer DEFAULT 1 NOT NULL,
      "queryJson" jsonb NOT NULL,
      "createdByManagerId" text NOT NULL,
      "createdAt" timestamp DEFAULT now() NOT NULL,
      "updatedAt" timestamp DEFAULT now() NOT NULL
    );

    CREATE TABLE "oaCampaign" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "oaId" uuid NOT NULL,
      "name" text NOT NULL,
      "messageType" text DEFAULT 'text' NOT NULL,
      "messageText" text NOT NULL,
      "audienceFilterId" uuid,
      "inlineAudienceQueryJson" jsonb,
      "messageRequestId" uuid,
      "status" text DEFAULT 'draft' NOT NULL,
      "recipientSnapshotCount" integer DEFAULT 0 NOT NULL,
      "successCount" integer DEFAULT 0 NOT NULL,
      "failedCount" integer DEFAULT 0 NOT NULL,
      "quotaUsed" integer DEFAULT 0 NOT NULL,
      "createdByManagerId" text NOT NULL,
      "createdAt" timestamp DEFAULT now() NOT NULL,
      "updatedAt" timestamp DEFAULT now() NOT NULL,
      "queuedAt" timestamp,
      "sentAt" timestamp
    );

    CREATE INDEX "oaAudienceFilter_oaId_idx" ON "oaAudienceFilter" ("oaId");
    CREATE UNIQUE INDEX "oaAudienceFilter_oaId_name_unique" ON "oaAudienceFilter" ("oaId", "name");
    CREATE INDEX "oaCampaign_oaId_createdAt_idx" ON "oaCampaign" ("oaId", "createdAt");
    CREATE INDEX "oaCampaign_oaId_status_idx" ON "oaCampaign" ("oaId", "status");
    CREATE INDEX "oaCampaign_messageRequestId_idx" ON "oaCampaign" ("messageRequestId");

    ALTER TABLE "oaAudienceFilter"
      ADD CONSTRAINT "oaAudienceFilter_oaId_officialAccount_id_fkey"
      FOREIGN KEY ("oaId") REFERENCES "officialAccount"("id") ON DELETE CASCADE;

    ALTER TABLE "oaCampaign"
      ADD CONSTRAINT "oaCampaign_oaId_officialAccount_id_fkey"
      FOREIGN KEY ("oaId") REFERENCES "officialAccount"("id") ON DELETE CASCADE;

    ALTER TABLE "oaCampaign"
      ADD CONSTRAINT "oaCampaign_audienceFilterId_oaAudienceFilter_id_fkey"
      FOREIGN KEY ("audienceFilterId") REFERENCES "oaAudienceFilter"("id") ON DELETE SET NULL;
  `)
}

export async function down(client: PoolClient): Promise<void> {
  await client.query(`
    DROP TABLE IF EXISTS "oaCampaign";
    DROP TABLE IF EXISTS "oaAudienceFilter";
  `)
}
