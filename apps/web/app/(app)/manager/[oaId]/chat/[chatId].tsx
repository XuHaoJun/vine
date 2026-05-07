import { useActiveParams } from 'one'

import { ManagerOAChatWorkspace } from '~/features/oa-manager/chat/ManagerOAChatWorkspace'

export default function ManagerOAChatDetailPage() {
  const params = useActiveParams<{ oaId: string; chatId: string }>()
  return <ManagerOAChatWorkspace oaId={params.oaId!} chatId={params.chatId!} />
}
