import type { PoolClient } from 'pg'

const sql = `-- Add requireApproval to chat table
DO $$ BEGIN
  ALTER TABLE "chat" ADD COLUMN "requireApproval" boolean not null default false;
EXCEPTION
  WHEN duplicate_column THEN null;
END $$;
--> statement-breakpoint
-- Add status to chatMember table
DO $$ BEGIN
  ALTER TABLE "chatMember" ADD COLUMN "status" text not null default 'accepted';
EXCEPTION
  WHEN duplicate_column THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "chatMember" ADD CONSTRAINT "chatMember_status_check" CHECK ("status" IN ('pending', 'accepted'));`

export async function up(client: PoolClient) {
  await client.query(sql)
}