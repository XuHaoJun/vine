export function isoToDatetimeLocal(value: string | undefined) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`
}

export function datetimeLocalToIso(value: string) {
  if (!value.trim()) return undefined
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return undefined
  return date.toISOString()
}

export function validateDisplayPeriodInput(startsAt: string, endsAt: string) {
  const startIso = datetimeLocalToIso(startsAt)
  const endIso = datetimeLocalToIso(endsAt)
  if (startIso && endIso && new Date(endIso).getTime() <= new Date(startIso).getTime()) {
    return {
      success: false as const,
      message: 'End must be after start',
    }
  }
  return {
    success: true as const,
    displayStartsAt: startIso,
    displayEndsAt: endIso,
  }
}

export function formatDisplayPeriodSummary(
  startsAt: string | undefined,
  endsAt: string | undefined,
) {
  const format = (value: string) =>
    new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(value))
  if (startsAt && endsAt) return `${format(startsAt)} - ${format(endsAt)}`
  if (startsAt) return `Starts ${format(startsAt)}`
  if (endsAt) return `Ends ${format(endsAt)}`
  return 'Always eligible'
}

export function managerStatusLabel(status: string | undefined) {
  if (status === 'draft') return 'Draft'
  if (status === 'scheduled') return 'Scheduled'
  if (status === 'active') return 'Active'
  if (status === 'ended') return 'Ended'
  return 'Inactive'
}
