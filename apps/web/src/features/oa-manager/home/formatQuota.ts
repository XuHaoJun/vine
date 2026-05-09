export function formatQuota(summary: {
  quota?: { monthlyLimit?: number; totalUsage: number; remaining?: number }
}) {
  const quota = summary.quota
  if (!quota) return 'No quota data'
  if (!quota.monthlyLimit) return `${quota.totalUsage} used`
  return `${quota.totalUsage}/${quota.monthlyLimit} used`
}
