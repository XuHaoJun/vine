import { useEffect, useState } from 'react'
import { isWeb } from 'tamagui'

import { LiffRouteShell } from '~/features/liff/liffRuntime'

type LiffPermanentRouteEntryProps = {
  liffId: string | undefined
  permanentPath: string | undefined
}

export function LiffPermanentRouteEntry({
  liffId,
  permanentPath,
}: LiffPermanentRouteEntryProps) {
  const { hash, search } = useWebLocationParts()

  if (!liffId || !permanentPath) return null

  return (
    <LiffRouteShell
      liffId={liffId}
      permanentPath={permanentPath}
      hash={hash}
      search={search}
    />
  )
}

function useWebLocationParts() {
  const [hash, setHash] = useState<string | undefined>(undefined)
  const [search, setSearch] = useState<string | undefined>(undefined)

  useEffect(() => {
    if (isWeb) {
      setHash(window.location.hash || undefined)
      setSearch(window.location.search || undefined)
    }
  }, [])

  return { hash, search }
}
