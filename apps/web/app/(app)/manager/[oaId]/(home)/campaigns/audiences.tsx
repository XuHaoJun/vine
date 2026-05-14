import { useActiveParams } from 'one'
import { ManagerOAAudienceFiltersPage } from '~/features/oa-manager/campaign/ManagerOAAudienceFiltersPage'

export default function ManagerOAAudienceFiltersRoute() {
  const params = useActiveParams<{ oaId: string }>()
  return <ManagerOAAudienceFiltersPage oaId={params.oaId!} />
}
