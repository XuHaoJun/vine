import { useActiveParams } from 'one'
import { ManagerOAChatWorkspace } from '~/features/oa-manager/chat/ManagerOAChatWorkspace'

export default function ManagerOAChatCustomFiltersPage() {
  const params = useActiveParams<{ oaId: string }>()
  return <ManagerOAChatWorkspace oaId={params.oaId!} initialMode="custom-filters" />
}
