import { useActiveParams, createRoute } from 'one'
import { LiffRouteShell } from '~/features/liff/liffRuntime'

const route = createRoute<'/(app)/liff/[liffId]'>()

export default function LiffPage() {
  const params = useActiveParams<{ liffId: string }>()
  const { liffId } = params
  if (!liffId) return null
  return <LiffRouteShell liffId={liffId} />
}
