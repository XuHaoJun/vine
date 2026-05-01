import type { PoolClient } from 'pg'

const sql = `
CREATE TABLE "oaMessageRequest" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "oaId" uuid NOT NULL,
  "requestType" text NOT NULL,
  "retryKey" text,
  "requestHash" text NOT NULL,
  "acceptedRequestId" text NOT NULL,
  "status" text DEFAULT 'accepted' NOT NULL,
  "messagesJson" jsonb NOT NULL,
  "targetJson" jsonb,
  "errorCode" text,
  "errorMessage" text,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL,
  "completedAt" timestamp,
  "expiresAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "oaMessageDelivery" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "requestId" uuid NOT NULL,
  "oaId" uuid NOT NULL,
  "userId" text NOT NULL,
  "chatId" text,
  "status" text DEFAULT 'pending' NOT NULL,
  "messageIdsJson" jsonb NOT NULL,
  "attemptCount" integer DEFAULT 0 NOT NULL,
  "lastErrorCode" text,
  "lastErrorMessage" text,
  "lockedAt" timestamp,
  "lockedBy" text,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL,
  "deliveredAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "oaRetryKey" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "oaId" uuid NOT NULL,
  "retryKey" text NOT NULL,
  "requestId" uuid NOT NULL,
  "requestHash" text NOT NULL,
  "acceptedRequestId" text NOT NULL,
  "expiresAt" timestamp NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "oaMessageRequest_oaId_type_createdAt_idx" ON "oaMessageRequest" ("oaId", "requestType", "createdAt");
--> statement-breakpoint
CREATE UNIQUE INDEX "oaMessageRequest_acceptedRequestId_idx" ON "oaMessageRequest" ("acceptedRequestId");
--> statement-breakpoint
CREATE INDEX "oaMessageRequest_status_idx" ON "oaMessageRequest" ("status");
--> statement-breakpoint
CREATE UNIQUE INDEX "oaMessageDelivery_request_user_idx" ON "oaMessageDelivery" ("requestId", "userId");
--> statement-breakpoint
CREATE INDEX "oaMessageDelivery_status_lockedAt_idx" ON "oaMessageDelivery" ("status", "lockedAt");
--> statement-breakpoint
CREATE INDEX "oaMessageDelivery_oaId_userId_idx" ON "oaMessageDelivery" ("oaId", "userId");
--> statement-breakpoint
CREATE INDEX "oaMessageDelivery_requestId_idx" ON "oaMessageDelivery" ("requestId");
--> statement-breakpoint
CREATE UNIQUE INDEX "oaRetryKey_oaId_retryKey_idx" ON "oaRetryKey" ("oaId", "retryKey");
--> statement-breakpoint
CREATE INDEX "oaRetryKey_expiresAt_idx" ON "oaRetryKey" ("expiresAt");
--> statement-breakpoint
ALTER TABLE "oaMessageRequest" ADD CONSTRAINT "oaMessageRequest_oaId_officialAccount_id_fkey" FOREIGN KEY ("oaId") REFERENCES "officialAccount"("id") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "oaMessageDelivery" ADD CONSTRAINT "oaMessageDelivery_requestId_oaMessageRequest_id_fkey" FOREIGN KEY ("requestId") REFERENCES "oaMessageRequest"("id") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "oaMessageDelivery" ADD CONSTRAINT "oaMessageDelivery_oaId_officialAccount_id_fkey" FOREIGN KEY ("oaId") REFERENCES "officialAccount"("id") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "oaRetryKey" ADD CONSTRAINT "oaRetryKey_oaId_officialAccount_id_fkey" FOREIGN KEY ("oaId") REFERENCES "officialAccount"("id") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "oaRetryKey" ADD CONSTRAINT "oaRetryKey_requestId_oaMessageRequest_id_fkey" FOREIGN KEY ("requestId") REFERENCES "oaMessageRequest"("id") ON DELETE CASCADE;
`

export async function up(client: PoolClient): Promise<void> {
  await client.query(sql)
}

export async function down(client: PoolClient): Promise<void> {
  await client.query(`
    DROP TABLE IF EXISTS "oaRetryKey";
    DROP TABLE IF EXISTS "oaMessageDelivery";
    DROP TABLE IF EXISTS "oaMessageRequest";
  `)
}
