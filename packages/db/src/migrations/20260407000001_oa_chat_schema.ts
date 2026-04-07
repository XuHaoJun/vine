import type { PoolClient } from 'pg'

/**
 * Adds OA chat support:
 * - chatMember.userId becomes nullable (OA members use oaId instead)
 * - Removes chatMember unique constraint on (chatId, userId)
 * - Adds oaId index to chatMember
 * - Adds CHECK constraints to chatMember for userId/oaId mutual exclusion
 * - message.senderId becomes nullable
 * - Adds senderType column to message ('user' | 'oa')
 * - Adds oaId index to message
 * - Adds CHECK constraint to message for senderType validation
 */
const sql = `
ALTER TABLE "chatMember" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "chatMember" DROP CONSTRAINT IF EXISTS "chatMember_chatId_userId_unique";
CREATE INDEX "chatMember_oaId_idx" ON "chatMember" ("oaId");
ALTER TABLE "chatMember" ADD CONSTRAINT "chatMember_user_or_oa_check" CHECK ("userId" IS NOT NULL OR "oaId" IS NOT NULL);
ALTER TABLE "chatMember" ADD CONSTRAINT "chatMember_user_oa_mutual_exclusion_check" CHECK ("userId" IS NULL OR "oaId" IS NULL);
ALTER TABLE "message" ALTER COLUMN "senderId" DROP NOT NULL;
ALTER TABLE "message" ADD COLUMN "senderType" text NOT NULL;
CREATE INDEX "message_oaId_idx" ON "message" ("oaId");
ALTER TABLE "message" ADD CONSTRAINT "message_sender_user_check" CHECK (("senderType" = 'user' AND "senderId" IS NOT NULL) OR ("senderType" = 'oa' AND "oaId" IS NOT NULL));
`

export async function up(client: PoolClient) {
  await client.query(sql)
}
