import type { HandlerContext } from '@connectrpc/connect'
import { Code, ConnectError } from '@connectrpc/connect'
import { StickerMarketDiscoveryService } from '@vine/proto/stickerMarket'
import type { DriveService } from '@vine/drive'
import type { AuthServer } from '@take-out/better-auth-utils/server'
import { tryGetAuthData } from './auth-context'

export type StickerMarketDiscoveryHandlerDeps = {
  db: any
  drive: DriveService
  auth: AuthServer
  discovery: any
}

export function createStickerMarketDiscoveryHandler(
  deps: StickerMarketDiscoveryHandlerDeps,
) {
  async function resolveCoverUrls(cards: any[]): Promise<any[]> {
    return Promise.all(
      cards.map(async (p: any) => ({
        ...p,
        coverUrl: p.coverDriveKey ? await deps.drive.getUrl(p.coverDriveKey) : '',
      })),
    )
  }

  return {
    async getStoreHome(_req: {}, ctx: HandlerContext) {
      const authData = await tryGetAuthData(deps.auth, ctx)
      const result = await deps.discovery.getStoreHome(authData?.id)

      const mapShelf = async (shelf: any) => ({
        id: shelf.id,
        title: shelf.title,
        packages: await resolveCoverUrls(shelf.packages),
      })

      return {
        featuredShelves: await Promise.all(result.featuredShelves.map(mapShelf)),
        bestseller7d: result.bestseller7d
          ? await mapShelf(result.bestseller7d)
          : undefined,
        bestseller30d: result.bestseller30d
          ? await mapShelf(result.bestseller30d)
          : undefined,
        latestReleases: result.latestReleases
          ? await mapShelf(result.latestReleases)
          : undefined,
      }
    },

    async searchStickerPackages(req: any, ctx: HandlerContext) {
      const authData = await tryGetAuthData(deps.auth, ctx)
      const result = await deps.discovery.searchPackages({ ...req, userId: authData?.id })
      return {
        results: await resolveCoverUrls(result.results ?? []),
        nextPageToken: result.nextPageToken ?? '',
        totalCount: result.totalCount ?? 0,
      }
    },

    async getStickerPackageDetail(req: { packageId: string }, ctx: HandlerContext) {
      const authData = await tryGetAuthData(deps.auth, ctx)
      const result = await deps.discovery.getPackageDetail({
        packageId: req.packageId,
        userId: authData?.id,
      })

      if (!result) {
        throw new ConnectError('package not found', Code.NotFound)
      }

      const coverUrl = result.coverDriveKey
        ? await deps.drive.getUrl(result.coverDriveKey)
        : ''

      const creator = result.creator
        ? {
            id: result.creator.id,
            displayName: result.creator.displayName,
            bio: result.creator.bio,
            avatarUrl: result.creator.avatarDriveKey
              ? await deps.drive.getUrl(result.creator.avatarDriveKey)
              : '',
            followerCount: result.creator.followerCount,
            followedByMe: result.creator.followedByMe,
          }
        : undefined

      return {
        package: {
          id: result.id,
          name: result.name,
          description: result.description,
          priceMinor: result.priceMinor,
          currency: result.currency,
          coverUrl,
          stickerType: result.stickerType,
          stickerCount: result.stickerCount,
          status: result.status,
          publishedAt: result.publishedAt,
          tags: result.tags,
          owned: result.owned,
          displayPriceMinor: result.displayPriceMinor,
          displayCurrency: result.displayCurrency,
          creator,
          rating: result.rating
            ? {
                averageRating: result.rating.averageRating,
                totalCount: result.rating.totalCount,
                currentUserReview: result.rating.currentUserReview
                  ? {
                      id: result.rating.currentUserReview.id,
                      userId: result.rating.currentUserReview.userId,
                      rating: result.rating.currentUserReview.rating,
                      body: result.rating.currentUserReview.body,
                      createdAt: result.rating.currentUserReview.createdAt,
                    }
                  : undefined,
              }
            : undefined,
          recentReviews: result.recentReviews.map((r: any) => ({
            id: r.id,
            userId: r.userId,
            rating: r.rating,
            body: r.body,
            createdAt: r.createdAt,
          })),
          sameCreatorPackages: await resolveCoverUrls(result.sameCreatorPackages),
        },
      }
    },

    async getCreatorPublicProfile(req: { creatorId: string }, ctx: HandlerContext) {
      const authData = await tryGetAuthData(deps.auth, ctx)
      const result = await deps.discovery.getCreatorPublicProfile({
        creatorId: req.creatorId,
        userId: authData?.id,
      })

      return {
        profile: result.profile
          ? {
              id: result.profile.id,
              displayName: result.profile.displayName,
              bio: result.profile.bio,
              avatarUrl: result.profile.avatarDriveKey
                ? await deps.drive.getUrl(result.profile.avatarDriveKey)
                : '',
              followerCount: result.profile.followerCount,
              followedByMe: result.profile.followedByMe,
            }
          : undefined,
        packages: await resolveCoverUrls(result.packages),
      }
    },
  }
}
