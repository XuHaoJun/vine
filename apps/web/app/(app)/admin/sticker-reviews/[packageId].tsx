import { createRoute } from 'one'
import { AdminReviewDetail } from '~/features/sticker-market/admin/AdminReviewDetail'

const route = createRoute<'/admin/sticker-reviews/[packageId]'>()

export default function AdminStickerReviewRoute() {
  const { packageId } = route.useParams()
  if (!packageId) return null
  return <AdminReviewDetail packageId={packageId} />
}
