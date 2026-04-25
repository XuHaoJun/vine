export function encodeEcpayForm(params: Record<string, string>): string {
  return new URLSearchParams(params).toString()
}

export function parseEcpayForm(body: string): Record<string, string> {
  const parsed = new URLSearchParams(body)
  const result: Record<string, string> = {}
  for (const [key, value] of parsed.entries()) {
    result[key] = value
  }
  return result
}
