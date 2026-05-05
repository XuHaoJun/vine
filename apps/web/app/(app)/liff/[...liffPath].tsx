import { useActiveParams, createRoute } from 'one'

import { LiffPermanentRouteEntry } from '~/features/liff/LiffPermanentRouteEntry'

const route = createRoute<'/(app)/liff/[...liffPath]'>()

export default function LiffCatchAllPage() {
  const params = useActiveParams<{ liffPath: string[] }>()
  const { liffPath } = params

  if (!liffPath || liffPath.length === 0) return null

  const [liffId, ...rest] = liffPath
  const permanentPath = rest.length > 0 ? '/' + rest.join('/') : undefined

  return <LiffPermanentRouteEntry liffId={liffId} permanentPath={permanentPath} />
}
