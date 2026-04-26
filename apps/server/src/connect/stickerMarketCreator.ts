import { Code, ConnectError } from '@connectrpc/connect'
import type { HandlerContext } from '@connectrpc/connect'
import { StickerPackageStatus } from '@vine/proto/stickerMarket'
import { requireAuthData } from './auth-context'

export type StickerMarketCreatorHandlerDeps = {
  creatorRepo: any
  submission: any
  salesReport: any
  db: any
}

export function createStickerMarketCreatorHandler(deps: StickerMarketCreatorHandlerDeps) {
  return {
    async getCreatorProfile(_req: any, ctx: HandlerContext) {
      const auth = requireAuthData(ctx)
      const profile = await deps.creatorRepo.findByUserId(deps.db, auth.id)
      return { profile: profile ? mapCreatorProfile(profile) : undefined }
    },
    async upsertCreatorProfile(
      req: { displayName: string; country: string; bio: string },
      ctx: HandlerContext,
    ) {
      const auth = requireAuthData(ctx)
      if (!req.displayName.trim()) {
        throw new ConnectError('display name required', Code.InvalidArgument)
      }
      const profile = await deps.creatorRepo.upsert(deps.db, {
        id: crypto.randomUUID(),
        userId: auth.id,
        displayName: req.displayName.trim(),
        country: req.country.trim(),
        bio: req.bio.trim(),
        now: new Date().toISOString(),
      })
      return { profile: mapCreatorProfile(profile) }
    },
    async createStickerPackageDraft(req: any, ctx: HandlerContext) {
      const auth = requireAuthData(ctx)
      const pkg = await deps.submission.createDraft({ userId: auth.id, ...req })
      return { package: mapStickerPackageDraft(pkg) }
    },
    async updateStickerPackageDraft(req: any, ctx: HandlerContext) {
      const auth = requireAuthData(ctx)
      const pkg = await deps.submission.updateDraft({ userId: auth.id, ...req })
      return { package: mapStickerPackageDraft(pkg) }
    },
    async uploadStickerPackageAssets(req: any, ctx: HandlerContext) {
      const auth = requireAuthData(ctx)
      return deps.submission.uploadAssets({
        userId: auth.id,
        packageId: req.packageId,
        zipFile: req.zipFile,
      })
    },
    async submitStickerPackageReview(req: { packageId: string }, ctx: HandlerContext) {
      const auth = requireAuthData(ctx)
      const pkg = await deps.submission.submitForReview({
        userId: auth.id,
        packageId: req.packageId,
      })
      return { package: mapStickerPackageDraft(pkg) }
    },
    async publishApprovedStickerPackage(req: { packageId: string }, ctx: HandlerContext) {
      const auth = requireAuthData(ctx)
      const pkg = await deps.submission.publishApproved({
        userId: auth.id,
        packageId: req.packageId,
      })
      return { package: mapStickerPackageDraft(pkg) }
    },
    async getCreatorSalesReport(req: { month: string }, ctx: HandlerContext) {
      const auth = requireAuthData(ctx)
      try {
        const report = await deps.salesReport.getCreatorSalesReport({
          userId: auth.id,
          month: req.month,
        })
        return mapCreatorSalesReport(report)
      } catch (err) {
        if (err instanceof Error && err.message === 'invalid report month') {
          throw new ConnectError('invalid report month', Code.InvalidArgument)
        }
        throw err
      }
    },
  }
}

function mapCreatorProfile(row: any) {
  return {
    id: row.id,
    userId: row.userId,
    displayName: row.displayName,
    country: row.country,
    bio: row.bio ?? '',
    status: row.status,
  }
}

function mapStickerPackageDraft(row: any) {
  return {
    id: row.id,
    creatorId: row.creatorId ?? '',
    name: row.name,
    description: row.description,
    priceMinor: row.priceMinor,
    currency: row.currency,
    stickerCount: row.stickerCount,
    status: statusToProto(row.status),
    tagsJson: row.tags ?? '[]',
    copyrightText: row.copyrightText ?? '',
    autoPublish: row.autoPublish ?? true,
    coverDriveKey: row.coverDriveKey ?? '',
    tabIconDriveKey: row.tabIconDriveKey ?? '',
    reviewReasonCategory: row.reviewReasonCategory ?? '',
    reviewReasonText: row.reviewReasonText ?? '',
    reviewSuggestion: row.reviewSuggestion ?? '',
    reviewProblemAssetNumbers: parseNumberArray(row.reviewProblemAssetNumbers),
  }
}

function parseNumberArray(value: unknown): number[] {
  if (typeof value !== 'string' || !value) return []
  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is number => Number.isInteger(item))
  } catch {
    return value
      .split(',')
      .map((item) => Number(item.trim()))
      .filter((item) => Number.isInteger(item))
  }
}

function mapCreatorSalesReport(report: any) {
  return {
    month: report.month,
    summary: {
      grossSalesMinor: report.summary.grossSalesMinor,
      confirmedRevenueMinor: report.summary.confirmedRevenueMinor,
      soldCount: report.summary.soldCount,
      refundedCount: report.summary.refundedCount,
      refundedMinor: report.summary.refundedMinor,
      refundPendingCount: report.summary.refundPendingCount,
      refundPendingMinor: report.summary.refundPendingMinor,
      currency: report.summary.currency,
    },
    dailyRows: report.dailyRows.map((row: any) => ({
      date: row.date,
      grossSalesMinor: row.grossSalesMinor,
      confirmedRevenueMinor: row.confirmedRevenueMinor,
      soldCount: row.soldCount,
    })),
    packageRows: report.packageRows.map((row: any) => ({
      packageId: row.packageId,
      packageName: row.packageName,
      grossSalesMinor: row.grossSalesMinor,
      confirmedRevenueMinor: row.confirmedRevenueMinor,
      soldCount: row.soldCount,
      refundedCount: row.refundedCount,
    })),
  }
}

function statusToProto(status: string): StickerPackageStatus {
  switch (status) {
    case 'draft':
      return StickerPackageStatus.DRAFT
    case 'in_review':
      return StickerPackageStatus.IN_REVIEW
    case 'approved':
      return StickerPackageStatus.APPROVED
    case 'rejected':
      return StickerPackageStatus.REJECTED
    case 'on_sale':
      return StickerPackageStatus.ON_SALE
    case 'unlisted':
      return StickerPackageStatus.UNLISTED
    case 'removed':
      return StickerPackageStatus.REMOVED
    default:
      return StickerPackageStatus.UNSPECIFIED
  }
}
