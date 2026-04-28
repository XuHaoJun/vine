import { createRoute } from 'one'
import { AdminTrustReportDetail } from '~/features/sticker-market/admin/AdminTrustReportDetail'

const route = createRoute<'/admin/trust-reports/[reportId]'>()

export default function AdminTrustReportDetailRoute() {
  const { reportId } = route.useParams()
  if (!reportId) return null
  return <AdminTrustReportDetail reportId={reportId} />
}
