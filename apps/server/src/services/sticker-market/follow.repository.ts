import { and, eq } from 'drizzle-orm'
import { creatorFollow } from '@vine/db/schema-public'

export type FollowRow = {
  id: string
  userId: string
  creatorId: string
  createdAt: string
}

export function createFollowRepository() {
  return {
    async insert(
      db: any,
      input: { id: string; userId: string; creatorId: string; now: string },
    ): Promise<void> {
      await db.insert(creatorFollow).values({
        id: input.id,
        userId: input.userId,
        creatorId: input.creatorId,
        createdAt: input.now,
      })
    },

    async delete(db: any, userId: string, creatorId: string): Promise<boolean> {
      const result = await db
        .delete(creatorFollow)
        .where(
          and(eq(creatorFollow.userId, userId), eq(creatorFollow.creatorId, creatorId)),
        )
      return (result as any).rowCount > 0
    },

    async find(
      db: any,
      userId: string,
      creatorId: string,
    ): Promise<FollowRow | undefined> {
      const [row] = await db
        .select()
        .from(creatorFollow)
        .where(
          and(eq(creatorFollow.userId, userId), eq(creatorFollow.creatorId, creatorId)),
        )
        .limit(1)
      return row
    },
  }
}
