import { createPaymentsService } from '@vine/pay'
import { createStickerOrderRepository } from './order.repository'
import { createEntitlementRepository } from './entitlement.repository'

export type PaymentsEnv = {
  PAYMENTS_ECPAY_MODE: 'stage' | 'prod'
  PAYMENTS_ECPAY_MERCHANT_ID: string
  PAYMENTS_ECPAY_HASH_KEY: string
  PAYMENTS_ECPAY_HASH_IV: string
  PAYMENTS_RETURN_URL: string
  PAYMENTS_ORDER_RESULT_URL: string
  PAYMENTS_CLIENT_BACK_URL?: string
}

export function createPayments(env: PaymentsEnv, db: any) {
  const pay = createPaymentsService({
    connector: 'ecpay',
    ecpay: {
      merchantId: env.PAYMENTS_ECPAY_MERCHANT_ID,
      hashKey: env.PAYMENTS_ECPAY_HASH_KEY,
      hashIv: env.PAYMENTS_ECPAY_HASH_IV,
      mode: env.PAYMENTS_ECPAY_MODE,
    },
  })
  const orderRepo = createStickerOrderRepository(db)
  const entitlementRepo = createEntitlementRepository()
  return { pay, orderRepo, entitlementRepo }
}

export { createStickerOrderRepository } from './order.repository'
export { createEntitlementRepository } from './entitlement.repository'
export { registerPaymentsWebhookRoutes } from './webhook.route'
