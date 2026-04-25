import { Code, ConnectError } from '@connectrpc/connect'
import type { HandlerContext } from '@connectrpc/connect'
import { RefundStatus, StickerPackageStatus } from '@vine/proto/stickerMarket'
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
