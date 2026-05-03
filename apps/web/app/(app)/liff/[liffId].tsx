import { useActiveParams } from 'one'
import { LiffRouteShell } from '~/features/liff/liffRuntime'

export default function LiffPage() {
  const params = useActiveParams<{ liffId: string }>()
  const { liffId } = params
  if (!liffId) return null
  return <LiffRouteShell liffId={liffId} />
}
