type LiffAppIdentity = {
  id: string
  liffId: string
}

export function getAvailableLiffAppsForMiniApps<T extends LiffAppIdentity>(
  apps: T[],
  usedLiffAppIds: string[],
): T[] {
  const used = new Set(usedLiffAppIds)
  return apps.filter((app) => !used.has(app.id))
}
