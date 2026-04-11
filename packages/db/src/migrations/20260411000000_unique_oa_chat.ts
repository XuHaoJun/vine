import type { PoolClient } from 'pg'

/**
 * Prevent duplicate chat memberships:
 * - Unique index on (chatId, userId) for user members
 * - Unique index on (chatId, oaId) for OA members
 *
 * Note: cross-chat dedup (one chat per user-OA pair) is enforced in the
 * insertOAChat mutation via tx.query, not at DB level — because the
 * chatMember table splits user/OA across separate rows, making a
 * cross-row unique constraint infeasible without schema changes.
 */
const sql = `
CREATE UNIQUE INDEX IF NOT EXISTS "chatMember_chatId_userId_unique"
  ON "chatMember" ("chatId", "userId")
  WHERE "userId" IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "chatMember_chatId_oaId_unique"
  ON "chatMember" ("chatId", "oaId")
  WHERE "oaId" IS NOT NULL;
`

export async function up(pool: PoolClient): Promise<void> {
  await pool.query(sql)
}
