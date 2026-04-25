export { computeCheckMacValue } from '../utils/ecpay-mac'

import { computeCheckMacValue } from '../utils/ecpay-mac'

/**
 * Produces a valid ECPay form body (with CheckMacValue) for testing webhooks.
 */
export function signFormBody(
  params: Record<string, string>,
  hashKey: string,
  hashIv: string,
): Buffer {
  const mac = computeCheckMacValue(params, hashKey, hashIv)
  const full: Record<string, string> = { ...params, CheckMacValue: mac }
  const body = Object.entries(full)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&')
  return Buffer.from(body, 'utf8')
}
