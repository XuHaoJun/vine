import { createRoute } from 'one'
import { BusinessProfileEditor } from '~/features/oa-manager/profile/BusinessProfileEditor'

const route = createRoute<'/(app)/manager/[oaId]/account-page/profile'>()

export default function ManagerAccountPageProfileRoute() {
  const { oaId } = route.useParams()
  return <BusinessProfileEditor oaId={oaId!} />
}
