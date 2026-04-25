import type { ChargeStatusResult, EcpayCredentials, GetChargeInput } from '../types'
import { computeCheckMacValue } from '../utils/ecpay-mac'
import { encodeEcpayForm, parseEcpayForm } from './form'
import { getQueryTradeInfoUrl } from './endpoints'

export async function queryEcpayTrade(
  deps: { ecpay: EcpayCredentials; fetch: typeof fetch; now: () => Date },
  input: GetChargeInput,
): Promise<ChargeStatusResult> {
  const params: Record<string, string> = {
    MerchantID: deps.ecpay.merchantId,
    MerchantTradeNo: input.merchantTransactionId,
    TimeStamp: String(Math.floor(deps.now().getTime() / 1000)),
  }
  params['CheckMacValue'] = computeCheckMacValue(
    params,
    deps.ecpay.hashKey,
    deps.ecpay.hashIv,
  )

  const res = await deps.fetch(getQueryTradeInfoUrl(deps.ecpay.mode), {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: encodeEcpayForm(params),
  })
  const raw = parseEcpayForm(await res.text())
  const rawStatus = raw['TradeStatus']

  if (rawStatus === '1') {
    return {
      status: 'paid',
      connectorChargeId: raw['TradeNo'] ?? '',
      amount: {
        minorAmount: Number.parseInt(raw['TradeAmt'] ?? '0', 10),
        currency: 'TWD',
      },
      paidAt: raw['PaymentDate']
        ? new Date(raw['PaymentDate'].replaceAll('/', '-'))
        : undefined,
      rawStatus,
      raw,
    }
  }

  if (rawStatus === '0') {
    return {
      status: 'unpaid',
      reason: raw['TradeStatusDesc'] ?? 'unpaid',
      rawStatus,
      raw,
    }
  }

  if (rawStatus === '10200047') {
    return {
      status: 'not_found',
      reason: raw['TradeStatusDesc'] ?? 'order not found',
      rawStatus,
      raw,
    }
  }

  return {
    status: 'unknown',
    reason: raw['TradeStatusDesc'] ?? raw['RtnMsg'] ?? 'unknown query status',
    rawStatus,
    raw,
  }
}
