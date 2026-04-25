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

      // Generate short alphanumeric id (≤20 chars for ECPay MerchantTradeNo)
      // Strip dashes from UUID → 32 hex chars, take first 19 and prefix with 'O'
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
