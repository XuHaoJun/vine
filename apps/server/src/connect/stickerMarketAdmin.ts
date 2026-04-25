import { Code, ConnectError } from '@connectrpc/connect'
import type { HandlerContext } from '@connectrpc/connect'
import { RefundStatus } from '@vine/proto/stickerMarket'
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
