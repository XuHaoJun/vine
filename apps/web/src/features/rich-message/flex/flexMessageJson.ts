export type ParsedFlexMessage = {
  type: 'flex'
  altText: string
  contents: unknown
}

export type ParseFlexMessageJsonResult =
  | { ok: true; message: ParsedFlexMessage }
  | { ok: false; message: string }

export function parseFlexMessageJson(value: string): ParseFlexMessageJsonResult {
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>
    if (parsed.type !== 'flex') {
      return { ok: false, message: 'Flex message JSON must have type "flex".' }
    }
    if (typeof parsed.altText !== 'string' || !parsed.altText.trim()) {
      return { ok: false, message: 'Flex message JSON must include altText.' }
    }
    if (!parsed.contents) {
      return { ok: false, message: 'Flex message JSON must include contents.' }
    }
    return {
      ok: true,
      message: {
        type: 'flex',
        altText: parsed.altText,
        contents: parsed.contents,
      },
    }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Invalid JSON' }
  }
}
