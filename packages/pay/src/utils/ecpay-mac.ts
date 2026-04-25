import { createHash } from 'crypto'

/**
 * ECPay CheckMacValue algorithm (AIO, SHA256 mode).
 * Ref: docs/ECPay-API-Skill/guides/13-checkmacvalue.md
 */
export function computeCheckMacValue(
  params: Record<string, string>,
  hashKey: string,
  hashIv: string,
): string {
  const sortedKeys = Object.keys(params)
    .filter((k) => k !== 'CheckMacValue')
    .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
  const joined = sortedKeys.map((k) => `${k}=${params[k]}`).join('&')
  const raw = `HashKey=${hashKey}&${joined}&HashIV=${hashIv}`
  const encoded = ecpayUrlEncode(raw)
  return createHash('sha256').update(encoded, 'utf8').digest('hex').toUpperCase()
}

/**
 * ECPay-specific URL encode matching PHP urlencode behavior.
 *
 * Steps (from TypeScript section of guides/13-checkmacvalue.md):
 * 1. encodeURIComponent
 * 2. Replace %20 → +, ~ → %7e, ' → %27
 * 3. toLowerCase
 * 4. Restore .NET-style safe chars: %2d→- %5f→_ %2e→. %21→! %2a→* %28→( %29→)
 */
function ecpayUrlEncode(s: string): string {
  let encoded = encodeURIComponent(s)
    .replace(/%20/g, '+')
    .replace(/~/g, '%7e')
    .replace(/'/g, '%27')
  encoded = encoded.toLowerCase()
  // Restore chars that .NET HttpUtility.UrlEncode leaves unencoded
  encoded = encoded
    .split('%2d')
    .join('-')
    .split('%5f')
    .join('_')
    .split('%2e')
    .join('.')
    .split('%21')
    .join('!')
    .split('%2a')
    .join('*')
    .split('%28')
    .join('(')
    .split('%29')
    .join(')')
  return encoded
}
