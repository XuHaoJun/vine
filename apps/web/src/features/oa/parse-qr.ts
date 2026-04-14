export function parseOAScanResult(content: string): string {
  const urlMatch = content.match(/vine\.app\/oa\/(.+)/)
  if (urlMatch && urlMatch[1] != null) return decodeURIComponent(urlMatch[1])
  return content
}
