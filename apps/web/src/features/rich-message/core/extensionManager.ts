import type { RichMessageExtension } from './types'

export function resolveRichMessageExtensions(
  extensions: RichMessageExtension[],
): RichMessageExtension[] {
  const sorted = [...extensions].sort((a, b) => (b.priority ?? 100) - (a.priority ?? 100))
  const seen = new Set<string>()
  for (const extension of sorted) {
    if (seen.has(extension.type)) {
      throw new Error(`Duplicate rich message extension type: ${extension.type}`)
    }
    seen.add(extension.type)
  }
  return sorted
}
