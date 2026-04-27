import { Code, ConnectError } from '@connectrpc/connect'
import type { HandlerContext } from '@connectrpc/connect'
import { RefundStatus, StickerPackageStatus, TrustReportStatus } from '@vine/proto/stickerMarket'
import { requireAuthData } from './auth-context'

const DEFAULT_RECONCILE_SINCE_MS = 24 * 60 * 60 * 1000
const DEFAULT_RECONCILE_LIMIT = 100

export type StickerMarketAdminHandlerDeps = {
  refund: {
    refundOrder(input: {
      orderId: string
      reason: 'technical_error' | 'admin_exception'
      requestedByUserId: string | undefined
    }): Promise<any>
  }
  reconciliation: {
    reconcileOrders(input: { since: Date; limit: number; dryRun: boolean }): Promise<any>
  }
  review: {
    listQueue(input: { limit: number }): Promise<any[]>
    getDetail(input: { packageId: string }): Promise<any>
    approve(input: { packageId: string; actorUserId: string }): Promise<any>
    reject(input: {
      packageId: string
      actorUserId: string
      reasonCategory: string
      reasonText: string
      suggestion: string
      problemAssetNumbers: number[]
    }): Promise<any>
  }
  payout: any
  featuredShelf: any
  trust: any
}

function requireAdmin(ctx: HandlerContext) {
  const auth = requireAuthData(ctx)
  if (auth.role !== 'admin') {
    throw new ConnectError('admin required', Code.PermissionDenied)
  }
  return auth
}

export function createStickerMarketAdminHandler(deps: StickerMarketAdminHandlerDeps) {
  return {
    async refundOrder(req: { orderId: string; reason: string }, ctx: HandlerContext) {
      const auth = requireAdmin(ctx)
      const reason =
        req.reason === 'technical_error' ? 'technical_error' : 'admin_exception'
      const result = await deps.refund.refundOrder({
        orderId: req.orderId,
        reason,
        requestedByUserId: auth.id,
      })
      return {
        orderId: req.orderId,
        status: refundStatusToProto(result.status),
        simulated: result.simulated ?? false,
        failureReason: result.failureReason ?? '',
      }
    },

    async reconcileStickerOrders(
      req: { sinceIso: string; limit: number; dryRun: boolean },
      ctx: HandlerContext,
    ) {
      requireAdmin(ctx)
      const since = req.sinceIso
        ? new Date(req.sinceIso)
        : new Date(Date.now() - DEFAULT_RECONCILE_SINCE_MS)
      const result = await deps.reconciliation.reconcileOrders({
        since,
        limit: req.limit > 0 ? req.limit : DEFAULT_RECONCILE_LIMIT,
        dryRun: req.dryRun,
      })
      return {
        checked: result.checked,
        matched: result.checked - (result.mismatches?.length ?? 0),
        mismatches: result.mismatches.map((m: any) => ({
          orderId: m.orderId,
          localStatus: m.localStatus,
          connectorStatus: m.connectorStatus,
          action: m.action,
          reason: m.reason ?? '',
        })),
      }
    },

    async listStickerReviewQueue(req: { limit: number }, ctx: HandlerContext) {
      requireAdmin(ctx)
      const packages = await deps.review.listQueue({
        limit: req.limit > 0 ? req.limit : 50,
      })
      return { packages: packages.map(mapStickerPackageDraft) }
    },

    async getStickerReviewDetail(req: { packageId: string }, ctx: HandlerContext) {
      requireAdmin(ctx)
      const detail = await deps.review.getDetail({ packageId: req.packageId })
      return {
        package: mapStickerPackageDraft(detail.package),
        latestValidation: detail.latestValidation ?? [],
        assets: (detail.assets ?? []).map(mapStickerAsset),
      }
    },

    async approveStickerPackage(req: { packageId: string }, ctx: HandlerContext) {
      const auth = requireAdmin(ctx)
      const pkg = await deps.review.approve({
        packageId: req.packageId,
        actorUserId: auth.id,
      })
      return { package: mapStickerPackageDraft(pkg) }
    },

    async rejectStickerPackage(req: any, ctx: HandlerContext) {
      const auth = requireAdmin(ctx)
      const pkg = await deps.review.reject({
        packageId: req.packageId,
        actorUserId: auth.id,
        reasonCategory: req.reasonCategory,
        reasonText: req.reasonText,
        suggestion: req.suggestion,
        problemAssetNumbers: req.problemAssetNumbers ?? [],
      })
      return { package: mapStickerPackageDraft(pkg) }
    },

    async listPayoutRequests(req: any, ctx: HandlerContext) {
      requireAdmin(ctx)
      const requests = await deps.payout.listPendingRequests({ limit: req.limit ?? 100 })
      return { requests }
    },

    async approvePayoutRequest(req: any, ctx: HandlerContext) {
      const auth = requireAuthData(ctx)
      requireAdmin(ctx)
      const result = await deps.payout.approveRequest({
        actorUserId: auth.id,
        requestId: req.payoutRequestId,
      })
      return { status: result.status }
    },

    async rejectPayoutRequest(req: any, ctx: HandlerContext) {
      const auth = requireAuthData(ctx)
      requireAdmin(ctx)
      const result = await deps.payout.rejectRequest({
        actorUserId: auth.id,
        requestId: req.payoutRequestId,
        reason: req.reason,
      })
      return { status: result.status }
    },

    async createPayoutBatch(req: any, ctx: HandlerContext) {
      const auth = requireAuthData(ctx)
      requireAdmin(ctx)
      const batch = await deps.payout.createBatch({
        actorUserId: auth.id,
        requestIds: req.payoutRequestIds,
      })
      return { batchId: batch.id }
    },

    async exportPayoutBatch(req: any, ctx: HandlerContext) {
      const auth = requireAuthData(ctx)
      requireAdmin(ctx)
      const csv = await deps.payout.exportBatchCsv({
        actorUserId: auth.id,
        batchId: req.batchId,
      })
      return { fileName: `vine-payout-${req.batchId}.csv`, contentType: 'text/csv', csv }
    },

    async markPayoutPaid(req: any, ctx: HandlerContext) {
      const auth = requireAuthData(ctx)
      requireAdmin(ctx)
      const result = await deps.payout.markPaid({
        actorUserId: auth.id,
        requestId: req.payoutRequestId,
        bankTransactionId: req.bankTransactionId,
        paidAt: req.paidAt,
      })
      return { status: result.status }
    },

    async markPayoutFailed(req: any, ctx: HandlerContext) {
      const auth = requireAuthData(ctx)
      requireAdmin(ctx)
      const result = await deps.payout.markFailed({
        actorUserId: auth.id,
        requestId: req.payoutRequestId,
        reason: req.reason,
      })
      return { status: result.status }
    },

    async listFeaturedShelves(_req: any, ctx: HandlerContext) {
      requireAdmin(ctx)
      const shelves = await deps.featuredShelf.listShelves()
      return { shelves: shelves.map(mapFeaturedShelf) }
    },

    async upsertFeaturedShelf(req: any, ctx: HandlerContext) {
      const auth = requireAdmin(ctx)
      const shelf = await deps.featuredShelf.upsertShelf({
        id: req.id || crypto.randomUUID(),
        slug: req.slug,
        title: req.title,
        packageIds: req.packageIds ?? [],
        startsAt: req.startsAt || null,
        endsAt: req.endsAt || null,
        createdByUserId: auth.id,
      })
      return { shelf: mapFeaturedShelf(shelf) }
    },

    async publishFeaturedShelf(req: { id: string }, ctx: HandlerContext) {
      requireAdmin(ctx)
      const shelf = await deps.featuredShelf.publishShelf(req.id)
      return { shelf: mapFeaturedShelf(shelf) }
    },

    async archiveFeaturedShelf(req: { id: string }, ctx: HandlerContext) {
      requireAdmin(ctx)
      const shelf = await deps.featuredShelf.archiveShelf(req.id)
      return { shelf: mapFeaturedShelf(shelf) }
    },

    async listTrustReports(req: any, ctx: HandlerContext) {
      requireAdmin(ctx)
      const reports = await deps.trust.listReports({
        status: trustReportStatusFromProto(req.status),
        limit: req.limit > 0 ? req.limit : 50,
      })
      return { reports: reports.map(mapTrustReportSummary) }
    },

    async getTrustReportDetail(req: { reportId: string }, ctx: HandlerContext) {
      requireAdmin(ctx)
      const detail = await deps.trust.getReportDetail({ reportId: req.reportId })
      return {
        report: mapTrustReportSummary(detail.report),
        package: mapStickerPackageDraft(detail.package),
        creator: mapCreatorProfile(detail.report),
        payoutHold: mapCreatorPayoutHold(detail.report),
        assets: (detail.assets ?? []).map(mapStickerAsset),
        events: (detail.events ?? []).map(mapTrustActionEvent),
      }
    },

    async markTrustReportReviewing(req: any, ctx: HandlerContext) {
      const auth = requireAdmin(ctx)
      const report = await deps.trust.markReviewing({
        reportId: req.reportId,
        actorUserId: auth.id,
        note: req.note ?? '',
      })
      return { report: mapTrustReportSummary(report) }
    },

    async resolveTrustReport(req: any, ctx: HandlerContext) {
      const auth = requireAdmin(ctx)
      const report = await deps.trust.resolveReport({
        reportId: req.reportId,
        actorUserId: auth.id,
        resolutionText: req.resolutionText,
      })
      return { report: mapTrustReportSummary(report) }
    },

    async dismissTrustReport(req: any, ctx: HandlerContext) {
      const auth = requireAdmin(ctx)
      const report = await deps.trust.dismissReport({
        reportId: req.reportId,
        actorUserId: auth.id,
        resolutionText: req.resolutionText,
      })
      return { report: mapTrustReportSummary(report) }
    },

    async forceRemoveStickerPackage(req: any, ctx: HandlerContext) {
      const auth = requireAdmin(ctx)
      const pkg = await deps.trust.forceRemovePackage({
        actorUserId: auth.id,
        packageId: req.packageId,
        reportId: req.reportId || undefined,
        reasonText: req.reasonText,
      })
      return { package: mapStickerPackageDraft(pkg) }
    },

    async restoreStickerPackage(req: any, ctx: HandlerContext) {
      const auth = requireAdmin(ctx)
      const pkg = await deps.trust.restorePackage({
        actorUserId: auth.id,
        packageId: req.packageId,
        reportId: req.reportId || undefined,
        reasonText: req.reasonText,
      })
      return { package: mapStickerPackageDraft(pkg) }
    },

    async holdCreatorPayouts(req: any, ctx: HandlerContext) {
      const auth = requireAdmin(ctx)
      const creator = await deps.trust.holdCreatorPayouts({
        actorUserId: auth.id,
        creatorId: req.creatorId,
        reportId: req.reportId || undefined,
        packageId: req.packageId || undefined,
        reasonText: req.reasonText,
      })
      return { payoutHold: mapCreatorPayoutHold(creator) }
    },

    async clearCreatorPayoutHold(req: any, ctx: HandlerContext) {
      const auth = requireAdmin(ctx)
      const creator = await deps.trust.clearCreatorPayoutHold({
        actorUserId: auth.id,
        creatorId: req.creatorId,
        reportId: req.reportId || undefined,
        packageId: req.packageId || undefined,
        reasonText: req.reasonText,
      })
      return { payoutHold: mapCreatorPayoutHold(creator) }
    },
  }
}

function mapFeaturedShelf(shelf: any) {
  return {
    id: shelf.id,
    slug: shelf.slug,
    title: shelf.title,
    status: shelf.status,
    startsAt: shelf.startsAt ?? '',
    endsAt: shelf.endsAt ?? '',
    createdByUserId: shelf.createdByUserId,
    createdAt: shelf.createdAt,
    updatedAt: shelf.updatedAt,
    items: (shelf.items ?? []).map((item: any) => ({
      id: item.id,
      shelfId: item.shelfId,
      packageId: item.packageId,
      packageName: item.packageName ?? '',
      position: item.position,
    })),
  }
}

function refundStatusToProto(status: string): RefundStatus {
  switch (status) {
    case 'refund_pending':
      return RefundStatus.REFUND_PENDING
    case 'refunded':
      return RefundStatus.REFUNDED
    case 'refund_failed':
      return RefundStatus.REFUND_FAILED
    default:
      return RefundStatus.UNSPECIFIED
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

function mapStickerAsset(row: any) {
  return {
    id: row.id,
    number: row.number,
    driveKey: row.driveKey,
    width: row.width,
    height: row.height,
    sizeBytes: row.sizeBytes,
    mimeType: row.mimeType,
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

function trustReportStatusFromProto(status: TrustReportStatus): string | undefined {
  switch (status) {
    case TrustReportStatus.OPEN:
      return 'open'
    case TrustReportStatus.REVIEWING:
      return 'reviewing'
    case TrustReportStatus.RESOLVED:
      return 'resolved'
    case TrustReportStatus.DISMISSED:
      return 'dismissed'
    default:
      return undefined
  }
}

function mapTrustReportSummary(row: any) {
  return {
    id: row.id,
    packageId: row.packageId,
    packageName: row.packageName ?? '',
    packageStatus: statusToProto(row.packageStatus ?? row.status ?? ''),
    creatorId: row.creatorId ?? '',
    creatorDisplayName: row.creatorDisplayName ?? '',
    reporterUserId: row.reporterUserId ?? '',
    reasonCategory: row.reasonCategory ?? '',
    reasonText: row.reasonText ?? '',
    status: trustReportStatusToProto(row.status),
    createdAt: row.createdAt ?? '',
  }
}

function trustReportStatusToProto(status: string): TrustReportStatus {
  switch (status) {
    case 'open':
      return TrustReportStatus.OPEN
    case 'reviewing':
      return TrustReportStatus.REVIEWING
    case 'resolved':
      return TrustReportStatus.RESOLVED
    case 'dismissed':
      return TrustReportStatus.DISMISSED
    default:
      return TrustReportStatus.UNSPECIFIED
  }
}

function mapCreatorProfile(row: any) {
  return {
    id: row.creatorId ?? row.id ?? '',
    userId: row.creatorUserId ?? row.userId ?? '',
    displayName: row.creatorDisplayName ?? row.displayName ?? '',
    country: row.creatorCountry ?? row.country ?? '',
    bio: row.creatorBio ?? row.bio ?? '',
    status: row.creatorStatus ?? row.status ?? '',
  }
}

function mapCreatorPayoutHold(row: any) {
  return {
    held: Boolean(row.payoutHoldAt),
    heldAt: row.payoutHoldAt ?? '',
    heldByUserId: row.payoutHoldByUserId ?? '',
    reason: row.payoutHoldReason ?? '',
  }
}

function mapTrustActionEvent(row: any) {
  return {
    id: row.id,
    reportId: row.reportId ?? '',
    packageId: row.packageId ?? '',
    creatorId: row.creatorId ?? '',
    actorUserId: row.actorUserId,
    action: row.action,
    reasonText: row.reasonText ?? '',
    metadataJson: row.metadataJson ?? '{}',
    createdAt: row.createdAt,
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
