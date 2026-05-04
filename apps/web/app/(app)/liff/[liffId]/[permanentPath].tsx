import { useActiveParams } from 'one'
import { useEffect, useState } from 'react'
import { isWeb } from 'tamagui'

import { LiffRouteShell } from '~/features/liff/liffRuntime'

export default function LiffPermanentPathPage() {
  const params = useActiveParams<{ liffId: string; permanentPath: string }>()
  const [hash, setHash] = useState<string | undefined>(undefined)
  const [search, setSearch] = useState<string | undefined>(undefined)

  useEffect(() => {
    if (isWeb) {
      setHash(window.location.hash || undefined)
      setSearch(window.location.search || undefined)
    }
  }, [])

  if (!params.liffId || !params.permanentPath) return null

  return (
    <LiffRouteShell
      liffId={params.liffId}
      permanentPath={`/${params.permanentPath}`}
      hash={hash}
      search={search}
    />
  )
}
