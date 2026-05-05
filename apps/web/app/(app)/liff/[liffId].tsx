import { useActiveParams, createRoute } from 'one'

import { LiffRouteShell } from '~/features/liff/liffRuntime'

const route = createRoute<'/(app)/liff/[liffId]'>()

export default function LiffPage() {
  const params = useActiveParams<{ liffId: string }>()

  if (!params.liffId) return null

  return <LiffRouteShell liffId={params.liffId} />
}
