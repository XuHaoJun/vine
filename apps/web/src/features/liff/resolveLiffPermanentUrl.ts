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

  const base = endpointUrl.endsWith('/') ? endpointUrl : endpointUrl + '/'
  const url = new URL(base)
  url.pathname = url.pathname + permanentPath.slice(1)
  if (search) url.search = search
  if (hash) url.hash = hash
  return url.toString()
}
