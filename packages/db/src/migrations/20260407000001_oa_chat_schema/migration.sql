ALTER TABLE "chatMember" ALTER COLUMN "userId" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "chatMember" DROP CONSTRAINT IF EXISTS "chatMember_chatId_userId_unique";--> statement-breakpoint
CREATE INDEX "chatMember_oaId_idx" ON "chatMember" ("oaId");--> statement-breakpoint
ALTER TABLE "chatMember" ADD CONSTRAINT "chatMember_user_or_oa_check" CHECK ("userId" IS NOT NULL OR "oaId" IS NOT NULL);--> statement-breakpoint
ALTER TABLE "chatMember" ADD CONSTRAINT "chatMember_user_oa_mutual_exclusion_check" CHECK ("userId" IS NULL OR "oaId" IS NULL);--> statement-breakpoint
ALTER TABLE "message" ALTER COLUMN "senderId" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "message" ADD COLUMN "senderType" text NOT NULL;--> statement-breakpoint
CREATE INDEX "message_oaId_idx" ON "message" ("oaId");--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_sender_user_check" CHECK (("senderType" = 'user' AND "senderId" IS NOT NULL) OR ("senderType" = 'oa' AND "oaId" IS NOT NULL));
