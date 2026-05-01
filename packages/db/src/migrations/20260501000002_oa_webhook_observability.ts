import type { PoolClient } from 'pg'

const sql = `
ALTER TABLE "oaWebhook" ADD COLUMN IF NOT EXISTS "useWebhook" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "oaWebhook" ADD COLUMN IF NOT EXISTS "webhookRedeliveryEnabled" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "oaWebhook" ADD COLUMN IF NOT EXISTS "errorStatisticsEnabled" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "oaWebhook" ADD COLUMN IF NOT EXISTS "lastVerifyStatusCode" integer;
--> statement-breakpoint
ALTER TABLE "oaWebhook" ADD COLUMN IF NOT EXISTS "lastVerifyReason" text;
--> statement-breakpoint
WITH ranked AS (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "oaId" ORDER BY "createdAt" DESC, "id" DESC) AS rn
  FROM "oaWebhook"
)
DELETE FROM "oaWebhook"
WHERE "id" IN (SELECT "id" FROM ranked WHERE rn > 1);
--> statement-breakpoint
DROP INDEX IF EXISTS "oaWebhook_oaId_idx";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "oaWebhook_oaId_unique_idx" ON "oaWebhook" ("oaId");
--> statement-breakpoint
CREATE TABLE "oaWebhookDelivery" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "oaId" uuid NOT NULL,
  "webhookEventId" text NOT NULL,
  "eventType" text NOT NULL,
  "payloadJson" jsonb NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "reason" text,
  "detail" text,
  "responseStatus" integer,
  "responseBodyExcerpt" text,
  "attemptCount" integer DEFAULT 0 NOT NULL,
  "isRedelivery" boolean DEFAULT false NOT NULL,
  "developerVisible" boolean DEFAULT true NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "lastAttemptedAt" timestamp,
  "deliveredAt" timestamp,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oaWebhookAttempt" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "deliveryId" uuid NOT NULL,
  "oaId" uuid NOT NULL,
  "attemptNumber" integer NOT NULL,
  "isRedelivery" boolean DEFAULT false NOT NULL,
  "requestUrl" text NOT NULL,
  "requestBodyJson" jsonb NOT NULL,
  "responseStatus" integer,
  "responseBodyExcerpt" text,
  "reason" text,
  "detail" text,
  "startedAt" timestamp DEFAULT now() NOT NULL,
  "completedAt" timestamp
);
--> statement-breakpoint
CREATE INDEX "oaWebhookDelivery_oaId_createdAt_idx" ON "oaWebhookDelivery" ("oaId", "createdAt");
--> statement-breakpoint
CREATE INDEX "oaWebhookDelivery_oaId_status_createdAt_idx" ON "oaWebhookDelivery" ("oaId", "status", "createdAt");
--> statement-breakpoint
CREATE UNIQUE INDEX "oaWebhookDelivery_oaId_eventId_idx" ON "oaWebhookDelivery" ("oaId", "webhookEventId");
--> statement-breakpoint
CREATE INDEX "oaWebhookAttempt_delivery_attempt_idx" ON "oaWebhookAttempt" ("deliveryId", "attemptNumber");
--> statement-breakpoint
CREATE INDEX "oaWebhookAttempt_oaId_startedAt_idx" ON "oaWebhookAttempt" ("oaId", "startedAt");
--> statement-breakpoint
ALTER TABLE "oaWebhookDelivery" ADD CONSTRAINT "oaWebhookDelivery_oaId_officialAccount_id_fkey" FOREIGN KEY ("oaId") REFERENCES "officialAccount"("id") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "oaWebhookAttempt" ADD CONSTRAINT "oaWebhookAttempt_deliveryId_oaWebhookDelivery_id_fkey" FOREIGN KEY ("deliveryId") REFERENCES "oaWebhookDelivery"("id") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "oaWebhookAttempt" ADD CONSTRAINT "oaWebhookAttempt_oaId_officialAccount_id_fkey" FOREIGN KEY ("oaId") REFERENCES "officialAccount"("id") ON DELETE CASCADE;
`

export async function up(client: PoolClient): Promise<void> {
  await client.query(sql)
}

export async function down(client: PoolClient): Promise<void> {
  await client.query(`
    DROP TABLE IF EXISTS "oaWebhookAttempt";
    DROP TABLE IF EXISTS "oaWebhookDelivery";
    DROP INDEX IF EXISTS "oaWebhook_oaId_unique_idx";
    CREATE INDEX IF NOT EXISTS "oaWebhook_oaId_idx" ON "oaWebhook" ("oaId");
    ALTER TABLE "oaWebhook" DROP COLUMN IF EXISTS "lastVerifyReason";
    ALTER TABLE "oaWebhook" DROP COLUMN IF EXISTS "lastVerifyStatusCode";
    ALTER TABLE "oaWebhook" DROP COLUMN IF EXISTS "errorStatisticsEnabled";
    ALTER TABLE "oaWebhook" DROP COLUMN IF EXISTS "webhookRedeliveryEnabled";
    ALTER TABLE "oaWebhook" DROP COLUMN IF EXISTS "useWebhook";
  `)
}
