import type { PoolClient } from 'pg'

const sql = `-- Idempotent OA chat support (consolidated from former #7 + #8)
ALTER TABLE "chatMember" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "chatMember" DROP CONSTRAINT IF EXISTS "chatMember_chatId_userId_unique";
--> statement-breakpoint
DO \$\$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chatMember' AND column_name = 'oaId' AND data_type = 'text') THEN ALTER TABLE "chatMember" ALTER COLUMN "oaId" TYPE uuid USING "oaId"::uuid; ELSIF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chatMember' AND column_name = 'oaId') THEN ALTER TABLE "chatMember" ADD COLUMN "oaId" uuid REFERENCES "officialAccount"("id"); END IF; END \$\$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chatMember_oaId_idx" ON "chatMember" ("oaId");
--> statement-breakpoint
ALTER TABLE "chatMember" ADD CONSTRAINT "chatMember_user_or_oa_check" CHECK ("userId" IS NOT NULL OR "oaId" IS NOT NULL);
--> statement-breakpoint
ALTER TABLE "chatMember" ADD CONSTRAINT "chatMember_user_oa_mutual_exclusion_check" CHECK ("userId" IS NULL OR "oaId" IS NULL);
--> statement-breakpoint
ALTER TABLE "message" ALTER COLUMN "senderId" DROP NOT NULL;
--> statement-breakpoint
DO \$\$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'message' AND column_name = 'senderType') THEN ALTER TABLE "message" ADD COLUMN "senderType" text NOT NULL DEFAULT 'user'; END IF; END \$\$;
--> statement-breakpoint
DO \$\$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'message' AND column_name = 'oaId' AND data_type = 'text') THEN ALTER TABLE "message" ALTER COLUMN "oaId" TYPE uuid USING "oaId"::uuid; ELSIF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'message' AND column_name = 'oaId') THEN ALTER TABLE "message" ADD COLUMN "oaId" uuid REFERENCES "officialAccount"("id"); END IF; END \$\$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "message_oaId_idx" ON "message" ("oaId");
--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_sender_user_check" CHECK (("senderType" = 'user' AND "senderId" IS NOT NULL) OR ("senderType" = 'oa' AND "oaId" IS NOT NULL));`

export async function up(client: PoolClient) {
  await client.query(sql)
}
