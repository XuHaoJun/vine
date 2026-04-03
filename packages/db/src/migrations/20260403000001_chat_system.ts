import type { PoolClient } from 'pg'

const sql = `
CREATE TABLE "friendship" (
  "id" text PRIMARY KEY,
  "requesterId" text NOT NULL,
  "addresseeId" text NOT NULL,
  "status" text NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat" (
  "id" text PRIMARY KEY,
  "type" text NOT NULL,
  "lastMessageId" text,
  "lastMessageAt" timestamp,
  "createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chatMember" (
  "id" text PRIMARY KEY,
  "chatId" text NOT NULL,
  "userId" text NOT NULL,
  "lastReadMessageId" text,
  "lastReadAt" timestamp,
  "joinedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message" (
  "id" text PRIMARY KEY,
  "chatId" text NOT NULL,
  "senderId" text NOT NULL,
  "type" text NOT NULL,
  "text" text,
  "metadata" text,
  "replyToMessageId" text,
  "createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "friendship_requesterId_idx" ON "friendship" ("requesterId");
--> statement-breakpoint
CREATE INDEX "friendship_addresseeId_idx" ON "friendship" ("addresseeId");
--> statement-breakpoint
CREATE INDEX "chatMember_chatId_idx" ON "chatMember" ("chatId");
--> statement-breakpoint
CREATE INDEX "chatMember_userId_idx" ON "chatMember" ("userId");
--> statement-breakpoint
CREATE UNIQUE INDEX "chatMember_chatId_userId_unique" ON "chatMember" ("chatId", "userId");
--> statement-breakpoint
CREATE INDEX "message_chatId_createdAt_idx" ON "message" ("chatId", "createdAt");
`

export async function up(client: PoolClient) {
  await client.query(sql)
}

export async function down(client: PoolClient) {
  await client.query(`
    DROP TABLE IF EXISTS "message";
    DROP TABLE IF EXISTS "chatMember";
    DROP TABLE IF EXISTS "chat";
    DROP TABLE IF EXISTS "friendship";
  `)
}
