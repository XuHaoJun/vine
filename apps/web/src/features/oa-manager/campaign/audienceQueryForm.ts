import {
  validateAudienceQuery,
  type AudienceQueryJson,
} from '@vine/zero-schema/audience/query'

export const defaultAudienceQuery: AudienceQueryJson = {
  'friendship.status': 'friend',
}

export function parseAudienceQueryText(
  text: string,
): { ok: true; query: AudienceQueryJson } | { ok: false; error: string } {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { ok: false, error: 'Audience query must be valid JSON' }
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, error: 'Audience query must be a JSON object' }
  }

  const query = parsed as AudienceQueryJson
  const result = validateAudienceQuery(query)
  if (!result.ok) return { ok: false, error: result.error }
  return { ok: true, query }
}

export function formatAudienceQuery(query: AudienceQueryJson): string {
  return JSON.stringify(query, null, 2)
}
