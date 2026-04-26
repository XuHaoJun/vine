import { and, eq } from 'drizzle-orm'
import { stickerPackageReview } from '@vine/db/schema-public'

export type UserReviewRow = {
  id: string
  packageId: string
  userId: string
  rating: number
  body: string
  createdAt: string
  updatedAt: string
}

export function createReviewRepository() {
  return {
    async findByPackageAndUser(
      db: any,
      packageId: string,
      userId: string,
    ): Promise<UserReviewRow | undefined> {
      const [row] = await db
        .select()
        .from(stickerPackageReview)
        .where(
          and(
            eq(stickerPackageReview.packageId, packageId),
            eq(stickerPackageReview.userId, userId),
          ),
        )
        .limit(1)
      return row
    },

    async upsert(
      db: any,
      input: {
        id: string
        packageId: string
        userId: string
        rating: number
        body: string
        now: string
      },
    ): Promise<UserReviewRow> {
      const [row] = await db
        .insert(stickerPackageReview)
        .values({
          id: input.id,
          packageId: input.packageId,
          userId: input.userId,
          rating: input.rating,
          body: input.body,
          status: 'approved',
          createdAt: input.now,
          updatedAt: input.now,
        })
        .onConflictDoUpdate({
          target: [stickerPackageReview.packageId, stickerPackageReview.userId],
          set: {
            rating: input.rating,
            body: input.body,
            updatedAt: input.now,
          },
        })
        .returning()
      return row
    },

    async delete(
      db: any,
      packageId: string,
      userId: string,
    ): Promise<boolean> {
      const result = await db
        .delete(stickerPackageReview)
        .where(
          and(
            eq(stickerPackageReview.packageId, packageId),
            eq(stickerPackageReview.userId, userId),
          ),
        )
      return (result as any).rowCount > 0
    },
  }
}
