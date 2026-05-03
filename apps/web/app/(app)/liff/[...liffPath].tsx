import { useActiveParams, createRoute } from 'one'
import { useEffect, useState } from 'react'
import { isWeb } from 'tamagui'
import { LiffRouteShell } from '~/features/liff/liffRuntime'

const route = createRoute<'/(app)/liff/[...liffPath]'>()

export default function LiffCatchAllPage() {
  const params = useActiveParams<{ liffPath: string[] }>()
  const { liffPath } = params
  const [hash, setHash] = useState<string | undefined>(undefined)

  useEffect(() => {
    if (isWeb) {
      setHash(window.location.hash || undefined)
    }
  }, [])

  if (!liffPath || liffPath.length === 0) return null

  const [liffId, ...rest] = liffPath
  const permanentPath = rest.length > 0 ? '/' + rest.join('/') : undefined

  return <LiffRouteShell liffId={liffId!} permanentPath={permanentPath} hash={hash} />
}
