export function resolveLiffPermanentUrl(input: {
  endpointUrl: string
  permanentPath?: string
  search?: string
  hash?: string
}): string {
  const { endpointUrl, permanentPath, search, hash } = input

  if (!permanentPath || permanentPath === '/') {
    const url = new URL(endpointUrl)
    if (search) url.search = search
    if (hash) url.hash = hash
    return url.toString()
  }

  const url = new URL(endpointUrl)
  const base = url.pathname.endsWith('/') ? url.pathname : url.pathname + '/'
  url.pathname = base + permanentPath.slice(1)
  if (search) url.search = search
  if (hash) url.hash = hash
  return url.toString()
}
