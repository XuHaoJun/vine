import { and, asc, count, desc, eq, gte, lte, sql } from 'drizzle-orm'
import { stickerPackage } from '@vine/db/schema-public'

const BESTSELLER_LIMIT = 20
const LATEST_LIMIT = 20

export type StoreHomeResult = {
  featuredShelves: Array<{
    id: string
    title: string
    packages: PackageCardResult[]
  }>
  bestseller7d: { id: string; title: string; packages: PackageCardResult[] } | undefined
  bestseller30d: { id: string; title: string; packages: PackageCardResult[] } | undefined
  latestReleases: { id: string; title: string; packages: PackageCardResult[] } | undefined
}

export type PackageCardResult = {
  id: string
  name: string
  creatorId: string
  creatorDisplayName: string
  coverDriveKey: string
  stickerType: string
  stickerCount: number
  priceMinor: number
  currency: string
  averageRating: number
  reviewCount: number
  owned: boolean
  displayPriceMinor: number
  displayCurrency: string
  publishedAt: string
}

export type PackageDetailResult = {
  id: string
  name: string
  description: string
  priceMinor: number
  currency: string
  coverDriveKey: string
  stickerType: string
  stickerCount: number
  status: string
  publishedAt: string
  tags: string[]
  owned: boolean
  displayPriceMinor: number
  displayCurrency: string
  creator: {
    id: string
    displayName: string
    bio: string
    avatarDriveKey: string | null
    followerCount: number
    followedByMe: boolean
  } | undefined
  rating: {
    averageRating: number
    totalCount: number
    currentUserReview: {
      id: string
      userId: string
      rating: number
      body: string
      createdAt: string
    } | undefined
  } | undefined
  recentReviews: Array<{
    id: string
    userId: string
    rating: number
    body: string
    createdAt: string
  }>
  sameCreatorPackages: PackageCardResult[]
}

export type CreatorPublicProfileResult = {
  profile: {
    id: string
    displayName: string
    bio: string
    avatarDriveKey: string | null
    followerCount: number
    followedByMe: boolean
  } | undefined
  packages: PackageCardResult[]
}

function buildCard(
  pkg: any,
  rating: { averageRating: number; reviewCount: number },
  displayPrice: { priceMinor: number; currency: string },
  creatorDisplayName: string,
  owned: boolean,
): PackageCardResult {
  return {
    id: pkg.id,
    name: pkg.name,
    creatorId: pkg.creatorId ?? '',
    creatorDisplayName,
    coverDriveKey: pkg.coverDriveKey,
    stickerType: pkg.stickerType,
    stickerCount: pkg.stickerCount,
    priceMinor: pkg.priceMinor,
    currency: pkg.currency,
    averageRating: rating.averageRating,
    reviewCount: rating.reviewCount,
    owned,
    displayPriceMinor: displayPrice.priceMinor,
    displayCurrency: displayPrice.currency,
    publishedAt: pkg.publishedAt ?? '',
  }
}

export function createDiscoveryService(deps: {
  db: any
  discoveryRepo: any
  featuredShelfRepo: any
  currencyDisplay: any
  creatorRepo?: { findByUserId: (db: any, userId: string) => Promise<any>; findById: (db: any, id: string) => Promise<any> }
}) {
  async function enrichPackageCard(
    pkg: any,
    userId: string | undefined,
  ): Promise<PackageCardResult> {
    const [rating, displayPrice] = await Promise.all([
      deps.discoveryRepo.getRatingSummary(deps.db, pkg.id),
      deps.currencyDisplay.getDisplayPrice(pkg.priceMinor, pkg.currency),
    ])
    const owned =
      userId
        ? !!(await deps.discoveryRepo.checkEntitlement(deps.db, userId, pkg.id))
        : false
    return buildCard(pkg, rating, displayPrice, '', owned)
  }

  async function enrichCards(
    packages: any[],
    userId: string | undefined,
    creatorDisplayNames: Record<string, string>,
  ): Promise<PackageCardResult[]> {
    if (packages.length === 0) return []

    const pkgIds = packages.map((p) => p.id)
    const [ratingsMap, displayPricesMap, entitlementsMap] = await Promise.all([
      loadRatings(pkgIds),
      loadDisplayPrices(packages),
      userId ? loadEntitlements(userId, pkgIds) : Promise.resolve(new Map<string, boolean>()),
    ])

    return packages.map((pkg) => {
      const rating = ratingsMap.get(pkg.id) ?? { averageRating: 0, reviewCount: 0 }
      const displayPrice = displayPricesMap.get(pkg.id) ?? { priceMinor: pkg.priceMinor, currency: pkg.currency }
      return buildCard(
        pkg,
        rating,
        displayPrice,
        creatorDisplayNames[pkg.creatorId] ?? '',
        entitlementsMap.has(pkg.id),
      )
    })
  }

  async function loadRatings(pkgIds: string[]): Promise<Map<string, { averageRating: number; reviewCount: number }>> {
    const map = new Map<string, { averageRating: number; reviewCount: number }>()
    const results = await Promise.all(
      pkgIds.map((id: string) =>
        deps.discoveryRepo.getRatingSummary(deps.db, id).then((r: any) => [id, r] as const),
      ),
    )
    for (const [id, r] of results) {
      map.set(id, r)
    }
    return map
  }

  async function loadDisplayPrices(packages: any[]): Promise<Map<string, { priceMinor: number; currency: string }>> {
    const map = new Map<string, { priceMinor: number; currency: string }>()
    const results = await Promise.all(
      packages.map((pkg: any) =>
        deps.currencyDisplay
          .getDisplayPrice(pkg.priceMinor, pkg.currency)
          .then((dp: any) => [pkg.id, dp] as const),
      ),
    )
    for (const [id, dp] of results) {
      map.set(id, dp)
    }
    return map
  }

  async function loadEntitlements(userId: string, pkgIds: string[]): Promise<Map<string, boolean>> {
    const map = new Map<string, boolean>()
    const results = await Promise.all(
      pkgIds.map((id: string) =>
        deps.discoveryRepo
          .checkEntitlement(deps.db, userId, id)
          .then((e: any) => e && map.set(id, true)),
      ),
    )
    return map
  }

  async function loadCreatorNameMap(packages: any[]): Promise<Record<string, string>> {
    const creatorIds = [
      ...new Set(packages.map((p: any) => p.creatorId).filter(Boolean)),
    ] as string[]
    const creatorNameMap: Record<string, string> = {}
    const creatorRepo = deps.creatorRepo
    if (!creatorRepo) return creatorNameMap

    const creatorProfiles = await Promise.all(
      creatorIds.map((id: string) =>
        creatorRepo.findById(deps.db, id).then((p: any) => [id, p] as const),
      ),
    )
    for (const [id, profile] of creatorProfiles) {
      creatorNameMap[id] = profile?.displayName ?? ''
    }
    return creatorNameMap
  }

  async function searchOnSalePackages(
    db: any,
    input: {
      query?: string
      stickerType?: string
      priceMin?: number
      priceMax?: number
      creatorId?: string
      locale?: string
      sort?: string
      pageSize: number
      pageToken?: string
      userId?: string
      ownedOnly?: boolean
    },
  ): Promise<{ rows: any[]; nextCursor: string | undefined; totalCount: number }> {
    const conditions: any[] = [sql`${stickerPackage.status} = 'on_sale'`]

    if (input.query) {
      const like = `%${input.query}%`
      conditions.push(
        sql`(
          ${stickerPackage.name} ILIKE ${like}
          OR ${stickerPackage.description} ILIKE ${like}
          OR ${stickerPackage.tags} ILIKE ${like}
          OR EXISTS (
            SELECT 1 FROM "creatorProfile"
            WHERE "creatorProfile"."id" = ${stickerPackage.creatorId}
              AND "creatorProfile"."displayName" ILIKE ${like}
          )
          OR EXISTS (
            SELECT 1 FROM "stickerAsset"
            WHERE "stickerAsset"."packageId" = ${stickerPackage.id}
              AND "stickerAsset"."keywords" ILIKE ${like}
          )
        )`,
      )
    }
    if (input.stickerType) {
      conditions.push(sql`${stickerPackage.stickerType} = ${input.stickerType}`)
    }
    if (input.creatorId) {
      conditions.push(eq(stickerPackage.creatorId, input.creatorId))
    }
    if (input.locale) {
      conditions.push(eq(stickerPackage.locale, input.locale))
    }
    if (input.ownedOnly && input.userId) {
      conditions.push(
        sql`EXISTS (
          SELECT 1 FROM "entitlement"
          WHERE "entitlement"."packageId" = ${stickerPackage.id}
            AND "entitlement"."userId" = ${input.userId}
        )`,
      )
    }
    if (input.priceMin !== undefined && input.priceMin > 0) {
      conditions.push(gte(stickerPackage.priceMinor, input.priceMin))
    }
    if (input.priceMax !== undefined && input.priceMax > 0) {
      conditions.push(lte(stickerPackage.priceMinor, input.priceMax))
    }

    const totalRows = await db
      .select({ c: count().as('c') })
      .from(stickerPackage)
      .where(and(...conditions))
    const totalCount = Number(totalRows[0]?.c ?? 0)

    let order: any = desc(stickerPackage.publishedAt)
    if (input.sort === 'price_asc') order = asc(stickerPackage.priceMinor)
    else if (input.sort === 'price_desc') order = desc(stickerPackage.priceMinor)
    else if (input.sort === 'name') order = asc(stickerPackage.name)
    else if (input.sort === 'newest') order = desc(stickerPackage.publishedAt)
    else if (input.sort === 'rating') {
      order = desc(sql`(
        SELECT COALESCE(AVG("stickerPackageReview"."rating"), 0)
        FROM "stickerPackageReview"
        WHERE "stickerPackageReview"."packageId" = ${stickerPackage.id}
          AND "stickerPackageReview"."status" = 'approved'
      )`)
    }

    let cursor: { publishedAt: string; id: string } | undefined
    if (input.pageToken) {
      try {
        cursor = JSON.parse(
          Buffer.from(input.pageToken, 'base64url').toString(),
        )
      } catch {
        cursor = undefined
      }
    }

    const qb = db
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
        cursor
          ? and(
              ...conditions,
              sql`(${stickerPackage.publishedAt}, ${stickerPackage.id}) < (${cursor.publishedAt}::timestamp, ${cursor.id})`,
            )
          : and(...conditions),
      )
      .orderBy(order)
      .limit(input.pageSize + 1)

    const rows = await qb
    const hasMore = rows.length > input.pageSize
    const items = rows.slice(0, input.pageSize)

    let nextCursor: string | undefined
    if (hasMore && items.length > 0) {
      const last = items[items.length - 1]
      nextCursor = Buffer.from(
        JSON.stringify({
          publishedAt: last.publishedAt,
          id: last.id,
        }),
      ).toString('base64url')
    }

    return { rows: items, nextCursor, totalCount }
  }

  return {
    async getStoreHome(userId?: string): Promise<StoreHomeResult> {
      const activeShelves = await deps.featuredShelfRepo.findActiveShelves(
        deps.db,
        new Date().toISOString(),
      )

      const [bestsellers7d, bestsellers30d, latestReleases] = await Promise.all([
        deps.discoveryRepo.findBestsellers(deps.db, 7, BESTSELLER_LIMIT),
        deps.discoveryRepo.findBestsellers(deps.db, 30, BESTSELLER_LIMIT),
        deps.discoveryRepo.findLatestReleases(deps.db, LATEST_LIMIT),
      ])

      const featuredPackageIds = [
        ...new Set(activeShelves.flatMap((s: any) => s.items.map((i: any) => i.packageId))),
      ]
      const bestseller7dIds = bestsellers7d.map((b: any) => b.packageId)
      const bestseller30dIds = bestsellers30d.map((b: any) => b.packageId)
      const latestIds = latestReleases.map((p: any) => p.id)

      const allOnSaleIds = [
        ...new Set([...featuredPackageIds, ...bestseller7dIds, ...bestseller30dIds, ...latestIds]),
      ]

      const onSalePackages = await deps.discoveryRepo.findOnSalePackages(deps.db, allOnSaleIds)
      const onSaleMap = new Map(onSalePackages.map((p: any) => [p.id, p]))

      const creatorIds = [...new Set(onSalePackages.map((p: any) => p.creatorId).filter(Boolean))] as string[]
      const creatorProfiles = await Promise.all(
        creatorIds.map((id: string) =>
          deps.creatorRepo
            ? deps.creatorRepo.findById(deps.db, id).then((p: any) => [id, p] as const)
            : Promise.resolve([id, null] as const),
        ),
      )
      const creatorNameMap: Record<string, string> = {}
      for (const [id, profile] of creatorProfiles) {
        creatorNameMap[id] = profile?.displayName ?? ''
      }

      const enrichedCards = await enrichCards(onSalePackages, userId, creatorNameMap)
      const enrichedMap = new Map(enrichedCards.map((c) => [c.id, c]))

      const featuredShelves = activeShelves.map((shelf: any) => {
        const shelfPackageIds = shelf.items
          .map((i: any) => i.packageId)
          .filter((id: string) => onSaleMap.has(id))
        const shelfPackages = shelfPackageIds
          .map((id: string) => enrichedMap.get(id))
          .filter(Boolean) as PackageCardResult[]
        return {
          id: shelf.id,
          title: shelf.title,
          packages: shelfPackages,
        }
      })

      const bestseller7dPackages = bestsellers7d
        .map((b: any) => enrichedMap.get(b.packageId))
        .filter(Boolean) as PackageCardResult[]

      const bestseller30dPackages = bestsellers30d
        .map((b: any) => enrichedMap.get(b.packageId))
        .filter(Boolean) as PackageCardResult[]

      const latestPackages = latestReleases
        .map((p: any) => enrichedMap.get(p.id))
        .filter(Boolean) as PackageCardResult[]

      return {
        featuredShelves,
        bestseller7d: bestseller7dPackages.length > 0
          ? { id: 'bestseller_7d', title: '7-Day Bestsellers', packages: bestseller7dPackages }
          : undefined,
        bestseller30d: bestseller30dPackages.length > 0
          ? { id: 'bestseller_30d', title: '30-Day Bestsellers', packages: bestseller30dPackages }
          : undefined,
        latestReleases: latestPackages.length > 0
          ? { id: 'latest_releases', title: 'Latest Releases', packages: latestPackages }
          : undefined,
      }
    },

    async getPackageDetail(input: {
      packageId: string
      userId?: string
    }): Promise<PackageDetailResult | undefined> {
      const pkg = await deps.discoveryRepo.findPackageWithCreator(
        deps.db,
        input.packageId,
      )
      if (!pkg) return undefined

      const [ratingSummary, recentReviews, followerCount, displayPrice] =
        await Promise.all([
          deps.discoveryRepo.getRatingSummary(deps.db, input.packageId),
          deps.discoveryRepo.getRecentReviews(deps.db, input.packageId, 5),
          deps.discoveryRepo.countFollowers(deps.db, pkg.creatorId),
          deps.currencyDisplay.getDisplayPrice(pkg.priceMinor, pkg.currency),
        ])

      let owned = false
      let followedByMe = false
      let currentUserReview: any = undefined

      if (input.userId) {
        const [ent, fol, urev] = await Promise.all([
          deps.discoveryRepo.checkEntitlement(deps.db, input.userId, input.packageId),
          deps.discoveryRepo.checkFollow(deps.db, input.userId, pkg.creatorId),
          deps.discoveryRepo.getUserReview(deps.db, input.packageId, input.userId),
        ])
        owned = !!ent
        followedByMe = !!fol
        currentUserReview = urev
      }

      const sameCreatorPackages = await deps.discoveryRepo.findPackagesByCreatorId(
        deps.db,
        pkg.creatorId,
      )

      const sameCreatorCards = await enrichCards(
        sameCreatorPackages.filter((p: any) => p.id !== input.packageId),
        input.userId,
        { [pkg.creatorId]: pkg.creatorDisplayName },
      )

      let tags: string[] = []
      try {
        const parsed = JSON.parse(pkg.tags)
        if (Array.isArray(parsed)) tags = parsed
      } catch {
        tags = []
      }

      return {
        id: pkg.id,
        name: pkg.name,
        description: pkg.description ?? '',
        priceMinor: pkg.priceMinor,
        currency: pkg.currency,
        coverDriveKey: pkg.coverDriveKey,
        stickerType: pkg.stickerType,
        stickerCount: pkg.stickerCount,
        status: pkg.status,
        publishedAt: pkg.publishedAt ?? '',
        tags,
        owned,
        displayPriceMinor: displayPrice.priceMinor,
        displayCurrency: displayPrice.currency,
        creator: {
          id: pkg.creatorId ?? '',
          displayName: pkg.creatorDisplayName ?? '',
          bio: pkg.creatorBio ?? '',
          avatarDriveKey: pkg.creatorAvatarDriveKey ?? null,
          followerCount,
          followedByMe,
        },
        rating: {
          averageRating: ratingSummary.averageRating,
          totalCount: ratingSummary.reviewCount,
          currentUserReview,
        },
        recentReviews: recentReviews.map((r: any) => ({
          id: r.id,
          userId: r.userId,
          rating: r.rating,
          body: r.body,
          createdAt: r.createdAt,
        })),
        sameCreatorPackages: sameCreatorCards,
      }
    },

    async searchPackages(input: {
      query?: string
      stickerType?: string
      priceMin?: number
      priceMax?: number
      ownedOnly?: boolean
      creatorId?: string
      locale?: string
      sort?: string
      pageSize: number
      pageToken: string
      userId?: string
    }): Promise<{ results: PackageCardResult[]; nextPageToken: string; totalCount: number }> {
      const pageSize = input.pageSize > 0 && input.pageSize <= 100 ? input.pageSize : 20

      const { rows, nextCursor, totalCount } = await searchOnSalePackages(deps.db, {
        query: input.query,
        stickerType: input.stickerType,
        priceMin: input.priceMin,
        priceMax: input.priceMax,
        creatorId: input.creatorId,
        locale: input.locale,
        sort: input.sort,
        pageSize,
        pageToken: input.pageToken || undefined,
        userId: input.userId,
        ownedOnly: input.ownedOnly,
      })

      const onSalePackages = rows
      const creatorNameMap = await loadCreatorNameMap(onSalePackages)
      const enriched = await enrichCards(onSalePackages, input.userId, creatorNameMap)

      return {
        results: enriched,
        nextPageToken: nextCursor ?? '',
        totalCount,
      }
    },

    async getCreatorPublicProfile(input: {
      creatorId: string
      userId?: string
    }): Promise<CreatorPublicProfileResult> {
      const profile = deps.creatorRepo
        ? await deps.creatorRepo.findById(deps.db, input.creatorId)
        : undefined

      const [followerCount, packages] = await Promise.all([
        deps.discoveryRepo.countFollowers(deps.db, input.creatorId),
        deps.discoveryRepo.findPackagesByCreatorId(deps.db, input.creatorId),
      ])

      let followedByMe = false
      if (input.userId) {
        const fol = await deps.discoveryRepo.checkFollow(
          deps.db,
          input.userId,
          input.creatorId,
        )
        followedByMe = !!fol
      }

      const creatorNameMap: Record<string, string> = {}
      if (profile) {
        creatorNameMap[input.creatorId] = profile.displayName
      }

      const enriched = await enrichCards(packages, input.userId, creatorNameMap)

      return {
        profile: profile
          ? {
              id: profile.id,
              displayName: profile.displayName,
              bio: profile.bio ?? '',
              avatarDriveKey: profile.avatarDriveKey ?? null,
              followerCount,
              followedByMe,
            }
          : undefined,
        packages: enriched,
      }
    },
  }
}
