import { createRoute } from 'one'
import { ReviewResult } from '~/features/sticker-market/creator/ReviewResult'

const route = createRoute<'/creator/packages/[packageId]'>()

export default function CreatorPackageRoute() {
  const { packageId } = route.useParams()
  if (!packageId) return null
  return <ReviewResult packageId={packageId} />
}
