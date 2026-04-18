import type { PoolClient } from 'pg'

const sql = `-- Add group chat columns to chat table
DO $$ BEGIN
  ALTER TABLE "chat" ADD COLUMN "name" text;
EXCEPTION
  WHEN duplicate_column THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "chat" ADD COLUMN "image" text;
EXCEPTION
  WHEN duplicate_column THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "chat" ADD COLUMN "description" text;
EXCEPTION
  WHEN duplicate_column THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "chat" ADD COLUMN "inviteCode" text unique;
EXCEPTION
  WHEN duplicate_column THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "chat" ADD COLUMN "albumCount" integer not null default 0;
EXCEPTION
  WHEN duplicate_column THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "chat" ADD COLUMN "noteCount" integer not null default 0;
EXCEPTION
  WHEN duplicate_column THEN null;
END $$;
--> statement-breakpoint
-- Add role column to chatMember
DO $$ BEGIN
  ALTER TABLE "chatMember" ADD COLUMN "role" text;
EXCEPTION
  WHEN duplicate_column THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "chatMember" ADD CONSTRAINT "chatMember_role_oa_check" CHECK ("role" IS NULL OR "oaId" IS NULL);`

export async function up(client: PoolClient) {
  await client.query(sql)
}
