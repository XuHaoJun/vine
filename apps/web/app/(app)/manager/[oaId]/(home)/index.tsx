import { useActiveParams } from 'one'
import { ManagerOAHome } from '~/features/oa-manager/home/ManagerOAHome'

export default function ManagerOAHomePage() {
  const params = useActiveParams<{ oaId: string }>()
  return <ManagerOAHome oaId={params.oaId!} />
}
