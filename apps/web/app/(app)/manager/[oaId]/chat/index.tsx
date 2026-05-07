import { useActiveParams } from 'one'

import { ManagerOAChatWorkspace } from '~/features/oa-manager/chat/ManagerOAChatWorkspace'

export default function ManagerOAChatIndexPage() {
  const params = useActiveParams<{ oaId: string }>()
  return <ManagerOAChatWorkspace oaId={params.oaId!} />
}
