// Vine hosts the public Official Account API on the same domain as the app.
// Keep every LINE-like public OA endpoint under this base. Do not add root
// `/v2/...` routes unless Vine later gets a dedicated Messaging API domain.
export const OA_API_BASE = '/api/oa/v2' as const

export function oaApiPath(path: `/${string}`): string {
  return `${OA_API_BASE}${path}`
}
