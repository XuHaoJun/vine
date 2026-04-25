import type { EcpayCredentials, RefundChargeInput, RefundChargeResult } from '../types'
import { ConfigError } from '../errors'
import { computeCheckMacValue } from '../utils/ecpay-mac'
import { encodeEcpayForm, parseEcpayForm } from './form'
import { getCreditDoActionUrl } from './endpoints'

export async function refundEcpayCharge(
  deps: { ecpay: EcpayCredentials; fetch: typeof fetch; now: () => Date },
  input: RefundChargeInput,
): Promise<RefundChargeResult> {
  if (input.amount.currency !== 'TWD') {
    throw new ConfigError(
      `refundCharge: unsupported currency ${input.amount.currency}, only TWD is supported`,
    )
  }
  if (!input.connectorChargeId) {
    throw new ConfigError('refundCharge: connectorChargeId is required')
  }

  if (deps.ecpay.mode === 'stage' && input.testMode) {
    return {
      status: 'succeeded',
      connectorRefundId: undefined,
      refundedAt: deps.now(),
      simulated: true,
      raw: { simulated: 'true' },
    }
  }

  const params: Record<string, string> = {
    MerchantID: deps.ecpay.merchantId,
    MerchantTradeNo: input.merchantTransactionId,
    TradeNo: input.connectorChargeId,
    Action: 'R',
    TotalAmount: String(input.amount.minorAmount),
  }
  params['CheckMacValue'] = computeCheckMacValue(
    params,
    deps.ecpay.hashKey,
    deps.ecpay.hashIv,
  )

  const res = await deps.fetch(getCreditDoActionUrl(deps.ecpay.mode), {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: encodeEcpayForm(params),
  })
  const raw = parseEcpayForm(await res.text())
  const success = raw['RtnCode'] === '1'

  if (!success) {
    return {
      status: 'failed',
      reason: raw['RtnMsg'] ?? raw['TradeStatusDesc'] ?? 'refund failed',
      raw,
    }
  }

  return {
    status: 'succeeded',
    connectorRefundId: raw['TradeNo'],
    refundedAt: deps.now(),
    simulated: false,
    raw,
  }
}
