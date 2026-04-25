import type { EcpayCredentials } from '../types'

const STAGE_PAYMENT_BASE = 'https://payment-stage.ecpay.com.tw'
const PROD_PAYMENT_BASE = 'https://payment.ecpay.com.tw'

export function getEcpayPaymentBase(mode: EcpayCredentials['mode']): string {
  return mode === 'prod' ? PROD_PAYMENT_BASE : STAGE_PAYMENT_BASE
}

export function getAioCheckoutUrl(mode: EcpayCredentials['mode']): string {
  return `${getEcpayPaymentBase(mode)}/Cashier/AioCheckOut/V5`
}

export function getQueryTradeInfoUrl(mode: EcpayCredentials['mode']): string {
  return `${getEcpayPaymentBase(mode)}/Cashier/QueryTradeInfo/V5`
}

export function getCreditDoActionUrl(mode: EcpayCredentials['mode']): string {
  return `${getEcpayPaymentBase(mode)}/CreditDetail/DoAction`
}
