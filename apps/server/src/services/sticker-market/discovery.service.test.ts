import { describe, expect, it, vi } from 'vitest'
import { createDiscoveryService } from './discovery.service'

function makeMockDb() {
  return {} as any
}

function makeDiscoveryRepo() {
  return {
    findOnSalePackages: vi.fn(),
    findBestsellers: vi.fn(),
    findLatestReleases: vi.fn(),
    findPackageWithCreator: vi.fn(),
    findPackagesByCreatorId: vi.fn(),
    countFollowers: vi.fn(),
    checkEntitlement: vi.fn(),
    checkFollow: vi.fn(),
    getRatingSummary: vi.fn(),
    getRecentReviews: vi.fn(),
    getUserReview: vi.fn(),
  }
}

function makeFeaturedShelfRepo() {
  return {
    findActiveShelves: vi.fn(),
    findShelfItems: vi.fn(),
  }
}

function makeCurrencyDisplayService() {
  return {
    getDisplayPrice: vi.fn(),
  }
}

describe('createDiscoveryService', () => {
  describe('getStoreHome', () => {
    it('returns featured shelves with on_sale packages', async () => {
      const db = makeMockDb()
      const discoveryRepo = makeDiscoveryRepo()
      const featuredShelfRepo = makeFeaturedShelfRepo()
      const currencyDisplay = makeCurrencyDisplayService()

      discoveryRepo.findOnSalePackages.mockImplementation(
        (_db: any, ids: string[]) =>
          ids.map((id: string) => ({
            id,
            name: `Package ${id}`,
            priceMinor: 100,
            currency: 'TWD',
            coverDriveKey: 'cover.jpg',
            stickerType: 'static',
            stickerCount: 8,
            status: 'on_sale',
            publishedAt: '2026-04-01T00:00:00Z',
            creatorId: 'creator_1',
          })),
      )

      featuredShelfRepo.findActiveShelves.mockResolvedValue([
        { id: 'shelf_1', slug: 'summer', title: 'Summer Picks', items: [{ packageId: 'pkg_1' }] },
      ])
      featuredShelfRepo.findShelfItems.mockResolvedValue([
        { shelfId: 'shelf_1', packageId: 'pkg_1', position: 0 },
      ])

      discoveryRepo.countFollowers.mockResolvedValue(42)
      discoveryRepo.getRatingSummary.mockResolvedValue({ averageRating: 4.5, reviewCount: 10 })
      discoveryRepo.checkEntitlement.mockResolvedValue(undefined)
      discoveryRepo.checkFollow.mockResolvedValue(undefined)
      discoveryRepo.findBestsellers.mockResolvedValue([])
      discoveryRepo.findLatestReleases.mockResolvedValue([])
      currencyDisplay.getDisplayPrice.mockResolvedValue({ priceMinor: 100, currency: 'TWD' })
      const creatorRepo = {
        findById: vi.fn().mockResolvedValue({ id: 'creator_1', displayName: 'Creator One' }),
      }

      const service = createDiscoveryService({
        db,
        discoveryRepo,
        featuredShelfRepo,
        currencyDisplay,
        creatorRepo: creatorRepo as any,
      })

      const result = await service.getStoreHome()

      expect(result.featuredShelves).toHaveLength(1)
      expect(result.featuredShelves[0].id).toBe('shelf_1')
      expect(result.featuredShelves[0].title).toBe('Summer Picks')
      expect(result.featuredShelves[0].packages).toHaveLength(1)
      expect(result.featuredShelves[0].packages[0].id).toBe('pkg_1')
      expect(result.featuredShelves[0].packages[0].creatorDisplayName).toBe('Creator One')
      expect(creatorRepo.findById).toHaveBeenCalledWith(db, 'creator_1')
      expect(featuredShelfRepo.findActiveShelves).toHaveBeenCalled()
    })

    it('filters out packages that are not on_sale from featured shelves', async () => {
      const db = makeMockDb()
      const discoveryRepo = makeDiscoveryRepo()
      const featuredShelfRepo = makeFeaturedShelfRepo()
      const currencyDisplay = makeCurrencyDisplayService()

      discoveryRepo.findOnSalePackages.mockResolvedValue([
        { id: 'pkg_1', name: 'P1', status: 'on_sale', currency: 'TWD', priceMinor: 100, coverDriveKey: '', stickerType: 'static', stickerCount: 8, publishedAt: '', creatorId: 'c1' },
      ])

      featuredShelfRepo.findActiveShelves.mockResolvedValue([
        { id: 'shelf_1', slug: 's1', title: 'Shelf', items: [{ packageId: 'pkg_1' }, { packageId: 'invalid_pkg' }] },
      ])
      featuredShelfRepo.findShelfItems.mockResolvedValue([
        { shelfId: 'shelf_1', packageId: 'pkg_1', position: 0 },
        { shelfId: 'shelf_1', packageId: 'invalid_pkg', position: 1 },
      ])

      discoveryRepo.countFollowers.mockResolvedValue(0)
      discoveryRepo.getRatingSummary.mockResolvedValue({ averageRating: 0, reviewCount: 0 })
      discoveryRepo.findBestsellers.mockResolvedValue([])
      discoveryRepo.findLatestReleases.mockResolvedValue([])
      currencyDisplay.getDisplayPrice.mockResolvedValue({ priceMinor: 100, currency: 'TWD' })

      const service = createDiscoveryService({ db, discoveryRepo, featuredShelfRepo, currencyDisplay })
      const result = await service.getStoreHome()

      expect(result.featuredShelves[0].packages).toHaveLength(1)
      expect(result.featuredShelves[0].packages[0].id).toBe('pkg_1')
    })

    it('includes bestseller_7d from orders in last 7 days', async () => {
      const db = makeMockDb()
      const discoveryRepo = makeDiscoveryRepo()
      const featuredShelfRepo = makeFeaturedShelfRepo()
      const currencyDisplay = makeCurrencyDisplayService()

      featuredShelfRepo.findActiveShelves.mockResolvedValue([])
      featuredShelfRepo.findShelfItems.mockResolvedValue([])
      discoveryRepo.findOnSalePackages.mockResolvedValue([])

      discoveryRepo.findBestsellers.mockResolvedValue([
        { packageId: 'pkg_1', salesCount: 10, amountMinorSum: 1000 },
      ])

      discoveryRepo.findOnSalePackages.mockImplementation((_db: any, ids: string[]) =>
        ids.length > 0
          ? [{ id: 'pkg_1', name: 'Top Seller', priceMinor: 100, currency: 'TWD', coverDriveKey: '', stickerType: 'static', stickerCount: 8, status: 'on_sale', publishedAt: '', creatorId: 'c1' }]
          : [],
      )

      discoveryRepo.countFollowers.mockResolvedValue(0)
      discoveryRepo.getRatingSummary.mockResolvedValue({ averageRating: 0, reviewCount: 0 })
      discoveryRepo.findLatestReleases.mockResolvedValue([])
      currencyDisplay.getDisplayPrice.mockResolvedValue({ priceMinor: 100, currency: 'TWD' })

      const service = createDiscoveryService({ db, discoveryRepo, featuredShelfRepo, currencyDisplay })
      const result = await service.getStoreHome()

      expect(result.bestseller7d).toBeDefined()
      expect(result.bestseller7d!.id).toBe('bestseller_7d')
      expect(result.bestseller7d!.packages).toHaveLength(1)
      expect(result.bestseller7d!.packages[0].id).toBe('pkg_1')
    })

    it('includes bestseller_30d from orders in last 30 days', async () => {
      const db = makeMockDb()
      const discoveryRepo = makeDiscoveryRepo()
      const featuredShelfRepo = makeFeaturedShelfRepo()
      const currencyDisplay = makeCurrencyDisplayService()

      featuredShelfRepo.findActiveShelves.mockResolvedValue([])
      featuredShelfRepo.findShelfItems.mockResolvedValue([])
      discoveryRepo.findOnSalePackages.mockResolvedValue([])
      discoveryRepo.countFollowers.mockResolvedValue(0)
      discoveryRepo.getRatingSummary.mockResolvedValue({ averageRating: 0, reviewCount: 0 })
      discoveryRepo.findLatestReleases.mockResolvedValue([])
      currencyDisplay.getDisplayPrice.mockResolvedValue({ priceMinor: 100, currency: 'TWD' })

      discoveryRepo.findBestsellers.mockImplementation(
        async (_db: any, _days: number) => {
          if (_days === 30) {
            return [{ packageId: 'pkg_2', salesCount: 5, amountMinorSum: 500 }]
          }
          return []
        },
      )

      discoveryRepo.findOnSalePackages.mockImplementation(
        (_db: any, ids: string[]) =>
          ids.map((id: string) => ({
            id, name: `Pkg ${id}`, priceMinor: 100, currency: 'TWD',
            coverDriveKey: '', stickerType: 'static', stickerCount: 8, status: 'on_sale', publishedAt: '', creatorId: 'c1',
          })),
      )

      const service = createDiscoveryService({ db, discoveryRepo, featuredShelfRepo, currencyDisplay })
      const result = await service.getStoreHome()

      expect(result.bestseller30d).toBeDefined()
      expect(result.bestseller30d!.packages).toHaveLength(1)
      expect(result.bestseller30d!.packages[0].id).toBe('pkg_2')
    })

    it('counts paid and refund_failed orders as sales for bestsellers', async () => {
      const db = makeMockDb()
      const discoveryRepo = makeDiscoveryRepo()
      const featuredShelfRepo = makeFeaturedShelfRepo()
      const currencyDisplay = makeCurrencyDisplayService()

      featuredShelfRepo.findActiveShelves.mockResolvedValue([])
      featuredShelfRepo.findShelfItems.mockResolvedValue([])
      discoveryRepo.findOnSalePackages.mockResolvedValue([])
      discoveryRepo.countFollowers.mockResolvedValue(0)
      discoveryRepo.getRatingSummary.mockResolvedValue({ averageRating: 0, reviewCount: 0 })
      discoveryRepo.findLatestReleases.mockResolvedValue([])
      currencyDisplay.getDisplayPrice.mockResolvedValue({ priceMinor: 100, currency: 'TWD' })

      discoveryRepo.findBestsellers.mockResolvedValue([
        { packageId: 'pkg_1', salesCount: 15, amountMinorSum: 1500 },
      ])

      discoveryRepo.findOnSalePackages.mockImplementation(
        (_db: any, ids: string[]) =>
          ids.map((id: string) => ({
            id, name: `Pkg ${id}`, priceMinor: 100, currency: 'TWD',
            coverDriveKey: '', stickerType: 'static', stickerCount: 8, status: 'on_sale', publishedAt: '', creatorId: 'c1',
          })),
      )

      const service = createDiscoveryService({ db, discoveryRepo, featuredShelfRepo, currencyDisplay })
      const result = await service.getStoreHome()

      expect(result.bestseller7d).toBeDefined()
      expect(result.bestseller7d!.packages).toHaveLength(1)

      expect(discoveryRepo.findBestsellers).toHaveBeenCalledWith(
        db, 7, expect.any(Number),
      )
    })

    it('includes latest releases sorted by publishedAt descending', async () => {
      const db = makeMockDb()
      const discoveryRepo = makeDiscoveryRepo()
      const featuredShelfRepo = makeFeaturedShelfRepo()
      const currencyDisplay = makeCurrencyDisplayService()

      featuredShelfRepo.findActiveShelves.mockResolvedValue([])
      featuredShelfRepo.findShelfItems.mockResolvedValue([])
      discoveryRepo.countFollowers.mockResolvedValue(0)
      discoveryRepo.getRatingSummary.mockResolvedValue({ averageRating: 0, reviewCount: 0 })
      currencyDisplay.getDisplayPrice.mockResolvedValue({ priceMinor: 100, currency: 'TWD' })

      discoveryRepo.findLatestReleases.mockResolvedValue([
        { id: 'pkg_2', name: 'Newer', publishedAt: '2026-04-10T00:00:00Z', priceMinor: 100, currency: 'TWD', coverDriveKey: '', stickerType: 'static', stickerCount: 8, status: 'on_sale', creatorId: 'c1' },
        { id: 'pkg_1', name: 'Older', publishedAt: '2026-04-01T00:00:00Z', priceMinor: 100, currency: 'TWD', coverDriveKey: '', stickerType: 'static', stickerCount: 8, status: 'on_sale', creatorId: 'c1' },
      ])
      discoveryRepo.findBestsellers.mockResolvedValue([])
      discoveryRepo.findOnSalePackages.mockImplementation(
        (_db: any, ids: string[]) =>
          ids.map((id: string) => ({
            id, name: id === 'pkg_2' ? 'Newer' : 'Older', priceMinor: 100, currency: 'TWD',
            coverDriveKey: '', stickerType: 'static', stickerCount: 8, status: 'on_sale',
            publishedAt: id === 'pkg_2' ? '2026-04-10T00:00:00Z' : '2026-04-01T00:00:00Z', creatorId: 'c1',
          })),
      )

      const service = createDiscoveryService({ db, discoveryRepo, featuredShelfRepo, currencyDisplay })
      const result = await service.getStoreHome()

      expect(result.latestReleases).toBeDefined()
      expect(result.latestReleases!.packages).toHaveLength(2)
      expect(result.latestReleases!.packages[0].publishedAt).toBe('2026-04-10T00:00:00Z')
      expect(result.latestReleases!.packages[1].publishedAt).toBe('2026-04-01T00:00:00Z')
    })

    it('falls back to TWD when currency display rate is missing', async () => {
      const db = makeMockDb()
      const discoveryRepo = makeDiscoveryRepo()
      const featuredShelfRepo = makeFeaturedShelfRepo()
      const currencyDisplay = makeCurrencyDisplayService()

      featuredShelfRepo.findActiveShelves.mockResolvedValue([])
      featuredShelfRepo.findShelfItems.mockResolvedValue([])
      discoveryRepo.countFollowers.mockResolvedValue(0)
      discoveryRepo.getRatingSummary.mockResolvedValue({ averageRating: 0, reviewCount: 0 })

      discoveryRepo.findLatestReleases.mockResolvedValue([
        { id: 'pkg_1', name: 'Test', priceMinor: 100, currency: 'TWD', coverDriveKey: '', stickerType: 'static', stickerCount: 8, status: 'on_sale', publishedAt: '2026-04-01T00:00:00Z', creatorId: 'c1' },
      ])
      discoveryRepo.findBestsellers.mockResolvedValue([])
      discoveryRepo.findOnSalePackages.mockImplementation(
        (_db: any, ids: string[]) =>
          ids.map((id: string) => ({
            id, name: 'Test', priceMinor: 100, currency: 'TWD',
            coverDriveKey: '', stickerType: 'static', stickerCount: 8, status: 'on_sale', publishedAt: '2026-04-01T00:00:00Z', creatorId: 'c1',
          })),
      )
      currencyDisplay.getDisplayPrice.mockResolvedValue({ priceMinor: 100, currency: 'TWD' })

      const service = createDiscoveryService({ db, discoveryRepo, featuredShelfRepo, currencyDisplay })
      const result = await service.getStoreHome()

      const pkg = result.latestReleases!.packages[0]
      expect(pkg.displayPriceMinor).toBe(100)
      expect(pkg.displayCurrency).toBe('TWD')
    })
  })

  describe('getPackageDetail', () => {
    it('returns package details with creator profile', async () => {
      const db = makeMockDb()
      const discoveryRepo = makeDiscoveryRepo()
      const featuredShelfRepo = makeFeaturedShelfRepo()
      const currencyDisplay = makeCurrencyDisplayService()

      discoveryRepo.findPackageWithCreator.mockResolvedValue({
        id: 'pkg_1',
        name: 'Test Pack',
        description: 'A test pack',
        priceMinor: 100,
        currency: 'TWD',
        coverDriveKey: 'cover.jpg',
        stickerType: 'static',
        stickerCount: 8,
        status: 'on_sale',
        publishedAt: '2026-04-01T00:00:00Z',
        tags: '["fun","test"]',
        creatorId: 'creator_1',
        creatorDisplayName: 'Test Creator',
        creatorBio: 'Bio',
        creatorAvatarDriveKey: 'avatar.jpg',
      })

      discoveryRepo.getRatingSummary.mockResolvedValue({ averageRating: 4.2, reviewCount: 15 })
      discoveryRepo.getRecentReviews.mockResolvedValue([
        { id: 'rev_1', userId: 'u1', userName: 'User', rating: 5, body: 'Great!', createdAt: '2026-04-15T00:00:00Z' },
      ])
      discoveryRepo.countFollowers.mockResolvedValue(100)
      discoveryRepo.findPackagesByCreatorId.mockResolvedValue([])
      discoveryRepo.checkEntitlement.mockResolvedValue(undefined)
      discoveryRepo.checkFollow.mockResolvedValue(undefined)
      discoveryRepo.getUserReview.mockResolvedValue(undefined)
      currencyDisplay.getDisplayPrice.mockResolvedValue({ priceMinor: 100, currency: 'TWD' })

      const service = createDiscoveryService({ db, discoveryRepo, featuredShelfRepo, currencyDisplay })
      const result = await service.getPackageDetail({ packageId: 'pkg_1' })

      expect(result!.id).toBe('pkg_1')
      expect(result!.name).toBe('Test Pack')
      expect(result!.creator).toBeDefined()
      expect(result!.creator!.displayName).toBe('Test Creator')
      expect(result!.rating).toBeDefined()
      expect(result!.rating!.averageRating).toBe(4.2)
      expect(result!.recentReviews).toHaveLength(1)
      expect(result!.recentReviews[0].body).toBe('Great!')
    })

    it('enriches with owned/follow/review state when userId is provided', async () => {
      const db = makeMockDb()
      const discoveryRepo = makeDiscoveryRepo()
      const featuredShelfRepo = makeFeaturedShelfRepo()
      const currencyDisplay = makeCurrencyDisplayService()

      discoveryRepo.findPackageWithCreator.mockResolvedValue({
        id: 'pkg_1', name: 'Test', description: '', priceMinor: 100,
        currency: 'TWD', coverDriveKey: '', stickerType: 'static', stickerCount: 8,
        status: 'on_sale', publishedAt: '', tags: '[]', creatorId: 'creator_1',
        creatorDisplayName: 'Creator', creatorBio: '', creatorAvatarDriveKey: null,
      })
      discoveryRepo.getRatingSummary.mockResolvedValue({ averageRating: 0, reviewCount: 0 })
      discoveryRepo.getRecentReviews.mockResolvedValue([])
      discoveryRepo.countFollowers.mockResolvedValue(0)
      discoveryRepo.findPackagesByCreatorId.mockResolvedValue([])
      discoveryRepo.checkEntitlement.mockResolvedValue({ id: 'ent_1' } as any)
      discoveryRepo.checkFollow.mockResolvedValue({ id: 'fol_1' } as any)
      discoveryRepo.getUserReview.mockResolvedValue({
        id: 'rev_1', userId: 'user_1', rating: 4, body: 'Nice', createdAt: '2026-04-10T00:00:00Z',
      })
      currencyDisplay.getDisplayPrice.mockResolvedValue({ priceMinor: 100, currency: 'TWD' })

      const service = createDiscoveryService({ db, discoveryRepo, featuredShelfRepo, currencyDisplay })
      const result = await service.getPackageDetail({ packageId: 'pkg_1', userId: 'user_1' })

      expect(result!.owned).toBe(true)
      expect(result!.creator!.followedByMe).toBe(true)
      expect(result!.rating!.currentUserReview).toBeDefined()
      expect(result!.rating!.currentUserReview!.body).toBe('Nice')
    })
  })

  describe('getCreatorPublicProfile', () => {
    it('returns creator profile with follower count and on_sale packages', async () => {
      const db = makeMockDb()
      const discoveryRepo = makeDiscoveryRepo()
      const featuredShelfRepo = makeFeaturedShelfRepo()
      const currencyDisplay = makeCurrencyDisplayService()

      discoveryRepo.findPackageWithCreator.mockImplementation(
        async (_db: any, _pkgId: string) => undefined,
      )
      discoveryRepo.countFollowers.mockResolvedValue(50)
      discoveryRepo.findPackagesByCreatorId.mockResolvedValue([
        { id: 'pkg_1', name: 'P1', status: 'on_sale', priceMinor: 100, currency: 'TWD',
          coverDriveKey: '', stickerType: 'static', stickerCount: 8, publishedAt: '2026-04-01T00:00:00Z', creatorId: 'creator_1' },
      ])
      discoveryRepo.getRatingSummary.mockResolvedValue({ averageRating: 0, reviewCount: 0 })
      discoveryRepo.checkEntitlement.mockResolvedValue(undefined)
      discoveryRepo.checkFollow.mockResolvedValue(undefined)
      discoveryRepo.getRecentReviews.mockResolvedValue([])
      discoveryRepo.getUserReview.mockResolvedValue(undefined)
      currencyDisplay.getDisplayPrice.mockResolvedValue({ priceMinor: 100, currency: 'TWD' })

      const service = createDiscoveryService({
        db, discoveryRepo, featuredShelfRepo, currencyDisplay,
        creatorRepo: {
          findById: vi.fn().mockResolvedValue({ id: 'creator_1', displayName: 'Creator', bio: '', avatarDriveKey: null }),
          findByUserId: vi.fn(),
        } as any,
      })

      const result = await service.getCreatorPublicProfile({ creatorId: 'creator_1' })

      expect(result.profile).toBeDefined()
      expect(result.profile!.followerCount).toBe(50)
      expect(result.packages).toHaveLength(1)
      expect(result.packages[0].id).toBe('pkg_1')
    })
  })

  describe('searchPackages', () => {
    it('returns packages matching title ILIKE query', async () => {
      const db = {
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              orderBy: vi.fn(() => ({
                limit: vi.fn(() => Promise.resolve([])),
              })),
            })),
            then: vi.fn((resolve: any) =>
              resolve([{ c: 0 }]),
            ),
          })),
        })),
      }
      const discoveryRepo = makeDiscoveryRepo()
      const featuredShelfRepo = makeFeaturedShelfRepo()
      const currencyDisplay = makeCurrencyDisplayService()

      discoveryRepo.findOnSalePackages.mockResolvedValue([])
      discoveryRepo.countFollowers.mockResolvedValue(0)
      discoveryRepo.getRatingSummary.mockResolvedValue({ averageRating: 0, reviewCount: 0 })
      discoveryRepo.checkEntitlement.mockResolvedValue(undefined)
      discoveryRepo.checkFollow.mockResolvedValue(undefined)
      discoveryRepo.getRecentReviews.mockResolvedValue([])
      discoveryRepo.getUserReview.mockResolvedValue(undefined)
      featuredShelfRepo.findActiveShelves.mockResolvedValue([])
      currencyDisplay.getDisplayPrice.mockResolvedValue({ priceMinor: 100, currency: 'TWD' })

      const service = createDiscoveryService({ db, discoveryRepo, featuredShelfRepo, currencyDisplay })
      const result = await service.searchPackages({ query: 'test', pageSize: 20, pageToken: '' })

      expect(result.results).toEqual([])
      expect(result.totalCount).toBe(0)
    })

    it('filters by sticker type', async () => {
      const db = {
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              orderBy: vi.fn(() => ({
                limit: vi.fn(() => Promise.resolve([])),
              })),
            })),
            then: vi.fn((resolve: any) =>
              resolve([{ c: 0 }]),
            ),
          })),
        })),
      }
      const discoveryRepo = makeDiscoveryRepo()
      const featuredShelfRepo = makeFeaturedShelfRepo()
      const currencyDisplay = makeCurrencyDisplayService()

      discoveryRepo.findOnSalePackages.mockResolvedValue([])
      discoveryRepo.countFollowers.mockResolvedValue(0)
      discoveryRepo.getRatingSummary.mockResolvedValue({ averageRating: 0, reviewCount: 0 })
      discoveryRepo.checkEntitlement.mockResolvedValue(undefined)
      discoveryRepo.checkFollow.mockResolvedValue(undefined)
      discoveryRepo.getRecentReviews.mockResolvedValue([])
      discoveryRepo.getUserReview.mockResolvedValue(undefined)
      featuredShelfRepo.findActiveShelves.mockResolvedValue([])
      currencyDisplay.getDisplayPrice.mockResolvedValue({ priceMinor: 100, currency: 'TWD' })

      const service = createDiscoveryService({ db, discoveryRepo, featuredShelfRepo, currencyDisplay })
      const result = await service.searchPackages({ stickerType: 'static', pageSize: 20, pageToken: '' })

      expect(result.results).toEqual([])
    })

    it('supports price range filter', async () => {
      const db = {
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              orderBy: vi.fn(() => ({
                limit: vi.fn(() => Promise.resolve([])),
              })),
            })),
            then: vi.fn((resolve: any) =>
              resolve([{ c: 0 }]),
            ),
          })),
        })),
      }
      const discoveryRepo = makeDiscoveryRepo()
      const featuredShelfRepo = makeFeaturedShelfRepo()
      const currencyDisplay = makeCurrencyDisplayService()

      discoveryRepo.findOnSalePackages.mockResolvedValue([])
      discoveryRepo.countFollowers.mockResolvedValue(0)
      discoveryRepo.getRatingSummary.mockResolvedValue({ averageRating: 0, reviewCount: 0 })
      discoveryRepo.checkEntitlement.mockResolvedValue(undefined)
      discoveryRepo.checkFollow.mockResolvedValue(undefined)
      discoveryRepo.getRecentReviews.mockResolvedValue([])
      discoveryRepo.getUserReview.mockResolvedValue(undefined)
      featuredShelfRepo.findActiveShelves.mockResolvedValue([])
      currencyDisplay.getDisplayPrice.mockResolvedValue({ priceMinor: 100, currency: 'TWD' })

      const service = createDiscoveryService({ db, discoveryRepo, featuredShelfRepo, currencyDisplay })
      const result = await service.searchPackages({ priceMin: 50, priceMax: 200, pageSize: 20, pageToken: '' })

      expect(result.results).toEqual([])
    })

    it('supports sort by price ascending', async () => {
      const db = {
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              orderBy: vi.fn(() => ({
                limit: vi.fn(() => Promise.resolve([])),
              })),
            })),
            then: vi.fn((resolve: any) =>
              resolve([{ c: 0 }]),
            ),
          })),
        })),
      }
      const discoveryRepo = makeDiscoveryRepo()
      const featuredShelfRepo = makeFeaturedShelfRepo()
      const currencyDisplay = makeCurrencyDisplayService()

      discoveryRepo.findOnSalePackages.mockResolvedValue([])
      discoveryRepo.countFollowers.mockResolvedValue(0)
      discoveryRepo.getRatingSummary.mockResolvedValue({ averageRating: 0, reviewCount: 0 })
      discoveryRepo.checkEntitlement.mockResolvedValue(undefined)
      discoveryRepo.checkFollow.mockResolvedValue(undefined)
      discoveryRepo.getRecentReviews.mockResolvedValue([])
      discoveryRepo.getUserReview.mockResolvedValue(undefined)
      featuredShelfRepo.findActiveShelves.mockResolvedValue([])
      currencyDisplay.getDisplayPrice.mockResolvedValue({ priceMinor: 100, currency: 'TWD' })

      const service = createDiscoveryService({ db, discoveryRepo, featuredShelfRepo, currencyDisplay })
      const result = await service.searchPackages({ sort: 'price_asc', pageSize: 20, pageToken: '' })

      expect(result.results).toEqual([])
    })
  })
})
