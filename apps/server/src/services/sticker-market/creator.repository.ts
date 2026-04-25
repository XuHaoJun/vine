import { eq } from 'drizzle-orm'
import { creatorProfile } from '@vine/db/schema-public'

export type CreatorProfileRow = typeof creatorProfile.$inferSelect

export function createCreatorRepository() {
  return {
    async findByUserId(db: any, userId: string): Promise<CreatorProfileRow | undefined> {
      const [row] = await db
        .select()
        .from(creatorProfile)
        .where(eq(creatorProfile.userId, userId))
        .limit(1)
      return row
    },

    async upsert(db: any, input: {
      id: string
      userId: string
      displayName: string
      country: string
      bio: string
      now: string
    }): Promise<CreatorProfileRow> {
      const [row] = await db
        .insert(creatorProfile)
        .values({
          id: input.id,
          userId: input.userId,
          displayName: input.displayName,
          country: input.country,
          bio: input.bio,
          kycTier: 'tier1',
          status: 'active',
          createdAt: input.now,
          updatedAt: input.now,
        })
        .onConflictDoUpdate({
          target: creatorProfile.userId,
          set: {
            displayName: input.displayName,
            country: input.country,
            bio: input.bio,
            updatedAt: input.now,
          },
        })
        .returning()
      return row
    },
  }
}
