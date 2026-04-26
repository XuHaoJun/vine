import { Code, ConnectError } from '@connectrpc/connect'
import type { HandlerContext } from '@connectrpc/connect'
import { and, eq } from 'drizzle-orm'
import { stickerPackage, entitlement } from '@vine/db/schema-public'
import { stickerOrder } from '@vine/db/schema-private'
import type { PaymentsService } from '@vine/pay'
import { OrderStatus } from '@vine/proto/stickerMarket'
import { requireAuthData } from './auth-context'

export type StickerMarketUserHandlerDeps = {
  db: any
  pay: PaymentsService
  mode: 'stage' | 'prod'
  returnUrl: string
  orderResultUrl: string
  clientBackUrl?: string
  follow: any
  review: any
  launchNotification: any
}

export function createStickerMarketUserHandler(deps: StickerMarketUserHandlerDeps) {
  return {
    async createCheckout(
      req: { packageId: string; simulatePaid: boolean },
      ctx: HandlerContext,
    ) {
      const userId = requireAuthData(ctx).id

      if (req.simulatePaid && deps.mode !== 'stage') {
        throw new ConnectError(
          'simulatePaid is only allowed in stage mode',
          Code.InvalidArgument,
        )
      }

      const [pkg] = await deps.db
        .select()
        .from(stickerPackage)
        .where(eq(stickerPackage.id, req.packageId))
        .limit(1)
      if (!pkg)
        throw new ConnectError(`package ${req.packageId} not found`, Code.NotFound)
      if (pkg.status !== 'on_sale') {
        throw new ConnectError('package is not on sale', Code.FailedPrecondition)
      }

      const [existing] = await deps.db
        .select()
        .from(entitlement)
        .where(
          and(eq(entitlement.userId, userId), eq(entitlement.packageId, req.packageId)),
        )
        .limit(1)
      if (existing) {
        throw new ConnectError('already owned', Code.AlreadyExists)
      }

      const orderId = (
        'O' + crypto.randomUUID().replace(/-/g, '').slice(0, 19)
      ).toUpperCase()

      await deps.db.insert(stickerOrder).values({
        id: orderId,
        userId,
        packageId: req.packageId,
        amountMinor: pkg.priceMinor,
        currency: pkg.currency,
        connectorName: 'ecpay',
        status: 'created',
      })

      const charge = await deps.pay.createCharge({
        merchantTransactionId: orderId,
        amount: { minorAmount: pkg.priceMinor, currency: pkg.currency },
        description: pkg.name,
        returnUrl: deps.returnUrl,
        orderResultUrl: (() => {
          const url = new URL(deps.orderResultUrl)
          url.searchParams.set('orderId', orderId)
          return url.toString()
        })(),
        clientBackUrl: deps.clientBackUrl,
        idempotencyKey: orderId,
        testMode: req.simulatePaid ? { simulatePaid: true } : undefined,
      })

      if (charge.action.type !== 'redirect_form_post') {
        throw new ConnectError(
          `unexpected action type ${charge.action.type}`,
          Code.Internal,
        )
      }

      return {
        orderId,
        redirect: {
          targetUrl: charge.action.targetUrl,
          formFields: charge.action.formFields,
        },
      }
    },

    async getOrder(req: { orderId: string }, ctx: HandlerContext) {
      const userId = requireAuthData(ctx).id

      const [order] = await deps.db
        .select()
        .from(stickerOrder)
        .where(eq(stickerOrder.id, req.orderId))
        .limit(1)
      if (!order) throw new ConnectError('order not found', Code.NotFound)
      if (order.userId !== userId)
        throw new ConnectError('forbidden', Code.PermissionDenied)

      return {
        orderId: order.id,
        status: statusToProto(order.status),
        failureReason: order.failureReason ?? '',
        amountMinor: order.amountMinor,
        currency: order.currency,
      }
    },

    async followCreator(req: { creatorId: string }, ctx: HandlerContext) {
      const userId = requireAuthData(ctx).id
      await deps.follow.follow(userId, req.creatorId)
      return {}
    },

    async unfollowCreator(req: { creatorId: string }, ctx: HandlerContext) {
      const userId = requireAuthData(ctx).id
      await deps.follow.unfollow(userId, req.creatorId)
      return {}
    },

    async upsertStickerPackageReview(
      req: { packageId: string; rating: number; body: string },
      ctx: HandlerContext,
    ) {
      const userId = requireAuthData(ctx).id
      if (req.rating < 1 || req.rating > 5) {
        throw new ConnectError('rating must be between 1 and 5', Code.InvalidArgument)
      }
      const review = await deps.review.upsertReview({
        userId,
        packageId: req.packageId,
        rating: req.rating,
        body: req.body ?? '',
      })
      return {
        review: {
          id: review.id,
          userId: review.userId,
          rating: review.rating,
          body: review.body,
          createdAt: review.createdAt,
        },
      }
    },

    async deleteStickerPackageReview(req: { packageId: string }, ctx: HandlerContext) {
      const userId = requireAuthData(ctx).id
      await deps.review.deleteReview(userId, req.packageId)
      return {}
    },

    async listLaunchNotifications(
      req: { pageSize: number; pageToken: string },
      ctx: HandlerContext,
    ) {
      const userId = requireAuthData(ctx).id
      const result = await deps.launchNotification.listNotifications({
        userId,
        pageSize: req.pageSize,
        pageToken: req.pageToken,
      })
      return {
        notifications: result.items,
        nextPageToken: result.nextPageToken,
      }
    },

    async markLaunchNotificationRead(
      req: { notificationId: string },
      ctx: HandlerContext,
    ) {
      const userId = requireAuthData(ctx).id
      await deps.launchNotification.markRead(userId, req.notificationId)
      return {}
    },
  }
}

function statusToProto(
  s: 'created' | 'paid' | 'failed' | 'refund_pending' | 'refunded' | 'refund_failed',
): OrderStatus {
  switch (s) {
    case 'created':
      return OrderStatus.CREATED
    case 'paid':
      return OrderStatus.PAID
    case 'failed':
      return OrderStatus.FAILED
    case 'refund_pending':
      return OrderStatus.REFUND_PENDING
    case 'refunded':
      return OrderStatus.REFUNDED
    case 'refund_failed':
      return OrderStatus.REFUND_FAILED
  }
}
