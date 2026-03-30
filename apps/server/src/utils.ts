const BASE_URL = process.env['BETTER_AUTH_URL'] ?? 'http://localhost:3001'

export function toWebRequest(fastifyReq: {
  method: string
  url: string
  headers: Record<string, string | string[] | undefined>
  body?: unknown
}): Request {
  const url = new URL(fastifyReq.url, BASE_URL)
  const headers = new Headers()
  for (const [key, value] of Object.entries(fastifyReq.headers)) {
    if (value !== undefined) {
      headers.set(key, Array.isArray(value) ? value.join(', ') : value)
    }
  }
  const body =
    fastifyReq.method !== 'GET' && fastifyReq.method !== 'HEAD' && fastifyReq.body != null
      ? JSON.stringify(fastifyReq.body)
      : undefined

  return new Request(url.toString(), {
    method: fastifyReq.method,
    headers,
    body,
  })
}
