import { useActiveParams } from 'one'
import { ManagerOACampaignsPage } from '~/features/oa-manager/campaign/ManagerOACampaignsPage'

export default function ManagerOACampaignsRoute() {
  const params = useActiveParams<{ oaId: string }>()
  return <ManagerOACampaignsPage oaId={params.oaId!} />
}
