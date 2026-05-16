export type RichMenuManagerStatus =
  | 'draft'
  | 'inactive'
  | 'scheduled'
  | 'active'
  | 'ended'

export type RichMenuDisplayPeriodInput = {
  displayStartsAt?: string | undefined
  displayEndsAt?: string | undefined
}

export type RichMenuDisplayPeriod = {
  displayStartsAt: string | null
  displayEndsAt: string | null
}

export type RichMenuDisplayJobPayload = {
  oaId: string
  richMenuId: string
  displayScheduleRevision: number
}

function normalizeIso(value: string | undefined) {
  if (value === undefined || value.trim() === '') return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new Error('display period timestamps must be valid ISO 8601 strings')
  }
  return date.toISOString()
}

export function parseDisplayPeriodInput(
  input: RichMenuDisplayPeriodInput,
): RichMenuDisplayPeriod {
  const displayStartsAt = normalizeIso(input.displayStartsAt)
  const displayEndsAt = normalizeIso(input.displayEndsAt)
  if (
    displayStartsAt &&
    displayEndsAt &&
    new Date(displayEndsAt).getTime() <= new Date(displayStartsAt).getTime()
  ) {
    throw new Error('displayEndsAt must be after displayStartsAt')
  }
  return { displayStartsAt, displayEndsAt }
}

export function displayPeriodChanged(
  before: RichMenuDisplayPeriod,
  after: RichMenuDisplayPeriod,
) {
  return (
    before.displayStartsAt !== after.displayStartsAt ||
    before.displayEndsAt !== after.displayEndsAt
  )
}

export function deriveRichMenuManagerStatus(input: {
  isDefault: boolean
  hasImage: boolean
  displayStartsAt: string | null
  displayEndsAt: string | null
  now: string
}): RichMenuManagerStatus {
  if (!input.hasImage) return 'draft'
  if (!input.isDefault) return 'inactive'
  const nowMs = new Date(input.now).getTime()
  if (input.displayStartsAt && new Date(input.displayStartsAt).getTime() > nowMs) {
    return 'scheduled'
  }
  if (input.displayEndsAt && new Date(input.displayEndsAt).getTime() <= nowMs) {
    return 'ended'
  }
  return 'active'
}

export function buildRichMenuDisplayJobKeys(oaId: string, richMenuId: string) {
  return {
    start: `oa-rich-menu:${oaId}:${richMenuId}:display-start`,
    end: `oa-rich-menu:${oaId}:${richMenuId}:display-end`,
  }
}
