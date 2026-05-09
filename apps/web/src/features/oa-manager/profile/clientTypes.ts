import type { BusinessProfile } from '@vine/proto/oa'

export function parseProfileJson<T>(
  field: { json?: string } | undefined,
  fallback: T,
): T {
  if (!field?.json) return fallback
  try {
    return JSON.parse(field.json) as T
  } catch {
    return fallback
  }
}

export function makeProfileJson(value: unknown) {
  return { json: JSON.stringify(value ?? {}) }
}

export type EditorSection =
  | 'businessProfile'
  | 'announcements'
  | 'mixedMediaFeed'
  | 'socialMedia'
  | 'basicInfo'

export type DraftProfile = BusinessProfile
