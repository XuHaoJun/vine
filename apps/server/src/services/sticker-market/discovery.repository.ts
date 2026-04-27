import { and, asc, between, count, desc, eq, gte, inArray, sql, sum } from 'drizzle-orm'
import {
  stickerPackage,
  creatorProfile,
  entitlement,
  creatorFollow,
  stickerPackageReview,
} from '@vine/db/schema-public'
import { stickerOrder, currencyDisplayRate } from '@vine/db/schema-private'

export type OnSalePackageRow = {
  id: string
  name: string
  priceMinor: number
  currency: string
  coverDriveKey: string
  stickerType: string
  stickerCount: number
  status: string
  publishedAt: string | null
  creatorId: string
}

export type PackageWithCreatorRow = OnSalePackageRow & {
  creatorDisplayName: string
  creatorBio: string
  creatorAvatarDriveKey: string | null
}

export type BestsellerRow = {
  packageId: string
  salesCount: number
  amountMinorSum: number
}

export type RatingSummaryRow = {
  averageRating: number
  reviewCount: number
}

export type ReviewRow = {
  id: string
  userId: string
  rating: number
  body: string
  createdAt: string
}

export function createDiscoveryRepository() {
  return {
    async findOnSalePackages(db: any, packageIds: string[]): Promise<OnSalePackageRow[]> {
      if (packageIds.length === 0) return []
      return db
        .select({
          id: stickerPackage.id,
          name: stickerPackage.name,
          priceMinor: stickerPackage.priceMinor,
          currency: stickerPackage.currency,
          coverDriveKey: stickerPackage.coverDriveKey,
          stickerType: stickerPackage.stickerType,
          stickerCount: stickerPackage.stickerCount,
          status: stickerPackage.status,
          publishedAt: stickerPackage.publishedAt,
          creatorId: stickerPackage.creatorId,
        })
        .from(stickerPackage)
        .where(
          and(
            inArray(stickerPackage.id, packageIds),
            eq(stickerPackage.status, 'on_sale'),
          ),
        )
    },

    async findBestsellers(
      db: any,
      days: number,
      limit: number,
    ): Promise<BestsellerRow[]> {
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
      return db
        .select({
          packageId: stickerOrder.packageId,
          salesCount: count().as('sales_count'),
          amountMinorSum: sum(stickerOrder.amountMinor).as('amount_minor_sum'),
        })
        .from(stickerOrder)
        .where(
          and(
            gte(stickerOrder.paidAt, since),
            inArray(stickerOrder.status, ['paid', 'refund_failed']),
          ),
        )
        .groupBy(stickerOrder.packageId)
        .orderBy(desc(sql`sales_count`), desc(sql`amount_minor_sum`))
        .limit(limit)
    },

    async findLatestReleases(db: any, limit: number): Promise<OnSalePackageRow[]> {
      return db
        .select({
          id: stickerPackage.id,
          name: stickerPackage.name,
          priceMinor: stickerPackage.priceMinor,
          currency: stickerPackage.currency,
          coverDriveKey: stickerPackage.coverDriveKey,
          stickerType: stickerPackage.stickerType,
          stickerCount: stickerPackage.stickerCount,
          status: stickerPackage.status,
          publishedAt: stickerPackage.publishedAt,
          creatorId: stickerPackage.creatorId,
        })
        .from(stickerPackage)
        .where(
          and(
            eq(stickerPackage.status, 'on_sale'),
            sql`${stickerPackage.publishedAt} IS NOT NULL`,
          ),
        )
        .orderBy(desc(stickerPackage.publishedAt))
        .limit(limit)
    },

    async findPackageWithCreator(
      db: any,
      packageId: string,
    ): Promise<PackageWithCreatorRow | undefined> {
      const [row] = await db
        .select({
          id: stickerPackage.id,
          name: stickerPackage.name,
          description: stickerPackage.description,
          priceMinor: stickerPackage.priceMinor,
          currency: stickerPackage.currency,
          coverDriveKey: stickerPackage.coverDriveKey,
          stickerType: stickerPackage.stickerType,
          stickerCount: stickerPackage.stickerCount,
          status: stickerPackage.status,
          publishedAt: stickerPackage.publishedAt,
          tags: stickerPackage.tags,
          creatorId: stickerPackage.creatorId,
          creatorDisplayName: creatorProfile.displayName,
          creatorBio: creatorProfile.bio,
          creatorAvatarDriveKey: creatorProfile.avatarDriveKey,
        })
        .from(stickerPackage)
        .leftJoin(creatorProfile, eq(stickerPackage.creatorId, creatorProfile.id))
        .where(
          and(eq(stickerPackage.id, packageId), eq(stickerPackage.status, 'on_sale')),
        )
        .limit(1)
      return row
    },

    async findPackagesByCreatorId(
      db: any,
      creatorId: string,
    ): Promise<OnSalePackageRow[]> {
      return db
        .select({
          id: stickerPackage.id,
          name: stickerPackage.name,
          priceMinor: stickerPackage.priceMinor,
          currency: stickerPackage.currency,
          coverDriveKey: stickerPackage.coverDriveKey,
          stickerType: stickerPackage.stickerType,
          stickerCount: stickerPackage.stickerCount,
          status: stickerPackage.status,
          publishedAt: stickerPackage.publishedAt,
          creatorId: stickerPackage.creatorId,
        })
        .from(stickerPackage)
        .where(
          and(
            eq(stickerPackage.creatorId, creatorId),
            eq(stickerPackage.status, 'on_sale'),
          ),
        )
        .orderBy(desc(stickerPackage.publishedAt))
    },

    async countFollowers(db: any, creatorId: string): Promise<number> {
      const [row] = await db
        .select({ c: count().as('c') })
        .from(creatorFollow)
        .where(eq(creatorFollow.creatorId, creatorId))
      return Number(row?.c ?? 0)
    },

    async checkEntitlement(
      db: any,
      userId: string,
      packageId: string,
    ): Promise<{ id: string } | undefined> {
      const [row] = await db
        .select({ id: entitlement.id })
        .from(entitlement)
        .where(and(eq(entitlement.userId, userId), eq(entitlement.packageId, packageId)))
        .limit(1)
      return row
    },

    async checkFollow(
      db: any,
      userId: string,
      creatorId: string,
    ): Promise<{ id: string } | undefined> {
      const [row] = await db
        .select({ id: creatorFollow.id })
        .from(creatorFollow)
        .where(
          and(eq(creatorFollow.userId, userId), eq(creatorFollow.creatorId, creatorId)),
        )
        .limit(1)
      return row
    },

    async getRatingSummary(db: any, packageId: string): Promise<RatingSummaryRow> {
      const [row] = await db
        .select({
          averageRating: sql<number>`COALESCE(AVG(${stickerPackageReview.rating}), 0)`,
          reviewCount: count().as('review_count'),
        })
        .from(stickerPackageReview)
        .where(
          and(
            eq(stickerPackageReview.packageId, packageId),
            eq(stickerPackageReview.status, 'approved'),
          ),
        )
      return {
        averageRating: Number(row?.averageRating ?? 0),
        reviewCount: Number(row?.reviewCount ?? 0),
      }
    },

    async getRecentReviews(
      db: any,
      packageId: string,
      limit: number,
    ): Promise<ReviewRow[]> {
      return db
        .select({
          id: stickerPackageReview.id,
          userId: stickerPackageReview.userId,
          rating: stickerPackageReview.rating,
          body: stickerPackageReview.body,
          createdAt: stickerPackageReview.createdAt,
        })
        .from(stickerPackageReview)
        .where(
          and(
            eq(stickerPackageReview.packageId, packageId),
            eq(stickerPackageReview.status, 'approved'),
          ),
        )
        .orderBy(desc(stickerPackageReview.createdAt))
        .limit(limit)
    },

    async getUserReview(
      db: any,
      packageId: string,
      userId: string,
    ): Promise<ReviewRow | undefined> {
      const [row] = await db
        .select({
          id: stickerPackageReview.id,
          userId: stickerPackageReview.userId,
          rating: stickerPackageReview.rating,
          body: stickerPackageReview.body,
          createdAt: stickerPackageReview.createdAt,
        })
        .from(stickerPackageReview)
        .where(
          and(
            eq(stickerPackageReview.packageId, packageId),
            eq(stickerPackageReview.userId, userId),
            eq(stickerPackageReview.status, 'approved'),
          ),
        )
        .limit(1)
      return row
    },

    async getCurrencyDisplayRate(
      db: any,
      baseCurrency: string,
      quoteCurrency: string,
    ): Promise<{ rate: string } | undefined> {
      const [row] = await db
        .select({ rate: currencyDisplayRate.rate })
        .from(currencyDisplayRate)
        .where(
          and(
            eq(currencyDisplayRate.baseCurrency, baseCurrency),
            eq(currencyDisplayRate.quoteCurrency, quoteCurrency),
          ),
        )
        .orderBy(desc(currencyDisplayRate.effectiveDate))
        .limit(1)
      return row
    },
  }
}
