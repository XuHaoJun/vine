export const CREATOR_REVENUE_SHARE_BPS = 7000
const DEFAULT_CURRENCY = 'TWD'

export type SalesReportOrderRow = {
  orderId: string
  packageId: string
  packageName: string
  amountMinor: number
  currency: 'TWD'
  status: 'paid' | 'refund_failed' | 'refund_pending' | 'refunded'
  createdAt: string
}

export type SalesReportSummary = {
  grossSalesMinor: number
  confirmedRevenueMinor: number
  soldCount: number
  refundedCount: number
  refundedMinor: number
  refundPendingCount: number
  refundPendingMinor: number
  currency: 'TWD'
}

export type SalesReportDailyRow = {
  date: string
  grossSalesMinor: number
  confirmedRevenueMinor: number
  soldCount: number
}

export type SalesReportPackageRow = {
  packageId: string
  packageName: string
  grossSalesMinor: number
  confirmedRevenueMinor: number
  soldCount: number
  refundedCount: number
}

export type CreatorSalesReport = {
  month: string
  summary: SalesReportSummary
  dailyRows: SalesReportDailyRow[]
  packageRows: SalesReportPackageRow[]
}

type SalesReportDeps = {
  db: any
  creatorRepo: {
    findByUserId(db: any, userId: string): Promise<{ id: string } | undefined>
  }
  salesReportRepo: {
    listReportableOrders(
      db: any,
      input: { creatorId: string; monthStart: Date; nextMonthStart: Date },
    ): Promise<SalesReportOrderRow[]>
  }
}

export function createSalesReportService(deps: SalesReportDeps) {
  return {
    async getCreatorSalesReport(input: {
      userId: string
      month: string
    }): Promise<CreatorSalesReport> {
      const bounds = parseReportMonth(input.month)
      const emptyReport = createEmptyReport(input.month, bounds.daysInMonth)
      const profile = await deps.creatorRepo.findByUserId(deps.db, input.userId)
      if (!profile) return emptyReport

      const rows = await deps.salesReportRepo.listReportableOrders(deps.db, {
        creatorId: profile.id,
        monthStart: bounds.monthStart,
        nextMonthStart: bounds.nextMonthStart,
      })

      return aggregateReport(input.month, bounds.daysInMonth, rows)
    },
  }
}

export function parseReportMonth(month: string): {
  monthStart: Date
  nextMonthStart: Date
  daysInMonth: number
} {
  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw new Error('invalid report month')
  }

  const [yearText, monthText] = month.split('-')
  const year = Number(yearText)
  const monthIndex = Number(monthText) - 1
  if (!Number.isInteger(year) || monthIndex < 0 || monthIndex > 11) {
    throw new Error('invalid report month')
  }

  const monthStart = new Date(Date.UTC(year, monthIndex, 1))
  const nextMonthStart = new Date(Date.UTC(year, monthIndex + 1, 1))
  const daysInMonth = Math.round(
    (nextMonthStart.getTime() - monthStart.getTime()) / 86_400_000,
  )

  return { monthStart, nextMonthStart, daysInMonth }
}

function aggregateReport(
  month: string,
  daysInMonth: number,
  rows: SalesReportOrderRow[],
): CreatorSalesReport {
  const report = createEmptyReport(month, daysInMonth)
  const packageMap = new Map<string, SalesReportPackageRow>()

  for (const row of rows) {
    const packageRow = getPackageRow(packageMap, row)
    if (row.status === 'refunded') {
      report.summary.refundedCount += 1
      report.summary.refundedMinor += row.amountMinor
      packageRow.refundedCount += 1
      continue
    }
    if (row.status === 'refund_pending') {
      report.summary.refundPendingCount += 1
      report.summary.refundPendingMinor += row.amountMinor
      continue
    }

    report.summary.grossSalesMinor += row.amountMinor
    report.summary.soldCount += 1
    packageRow.grossSalesMinor += row.amountMinor
    packageRow.soldCount += 1

    const dayIndex = Number(row.createdAt.slice(8, 10)) - 1
    const daily = report.dailyRows[dayIndex]
    if (daily) {
      daily.grossSalesMinor += row.amountMinor
      daily.soldCount += 1
    }
  }

  report.summary.confirmedRevenueMinor = revenueShare(report.summary.grossSalesMinor)
  for (const daily of report.dailyRows) {
    daily.confirmedRevenueMinor = revenueShare(daily.grossSalesMinor)
  }
  for (const row of packageMap.values()) {
    row.confirmedRevenueMinor = revenueShare(row.grossSalesMinor)
  }

  report.packageRows = [...packageMap.values()]
    .filter((row) => row.soldCount > 0 || row.refundedCount > 0)
    .sort((a, b) => {
      if (b.grossSalesMinor !== a.grossSalesMinor) {
        return b.grossSalesMinor - a.grossSalesMinor
      }
      if (b.soldCount !== a.soldCount) return b.soldCount - a.soldCount
      return a.packageName.localeCompare(b.packageName)
    })

  return report
}

function createEmptyReport(month: string, daysInMonth: number): CreatorSalesReport {
  return {
    month,
    summary: {
      grossSalesMinor: 0,
      confirmedRevenueMinor: 0,
      soldCount: 0,
      refundedCount: 0,
      refundedMinor: 0,
      refundPendingCount: 0,
      refundPendingMinor: 0,
      currency: DEFAULT_CURRENCY,
    },
    dailyRows: Array.from({ length: daysInMonth }, (_, index) => {
      const day = String(index + 1).padStart(2, '0')
      return {
        date: `${month}-${day}`,
        grossSalesMinor: 0,
        confirmedRevenueMinor: 0,
        soldCount: 0,
      }
    }),
    packageRows: [],
  }
}

function getPackageRow(
  packageMap: Map<string, SalesReportPackageRow>,
  row: SalesReportOrderRow,
): SalesReportPackageRow {
  const existing = packageMap.get(row.packageId)
  if (existing) return existing

  const next = {
    packageId: row.packageId,
    packageName: row.packageName,
    grossSalesMinor: 0,
    confirmedRevenueMinor: 0,
    soldCount: 0,
    refundedCount: 0,
  }
  packageMap.set(row.packageId, next)
  return next
}

function revenueShare(amountMinor: number): number {
  return Math.floor((amountMinor * CREATOR_REVENUE_SHARE_BPS) / 10_000)
}
