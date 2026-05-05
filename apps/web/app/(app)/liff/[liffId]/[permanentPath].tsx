import { useActiveParams } from 'one'

import { LiffPermanentRouteEntry } from '~/features/liff/LiffPermanentRouteEntry'

// Keep this explicit one-segment permanent-link route next to the catch-all
// `[...liffPath]` route for now. One generates a `/liff/*` route for the
// catch-all page, but `one serve` does not include that wildcard in its static
// routeMap, so direct-loading `/liff/:liffId/foo` can 404 before React has a
// chance to boot and render the LIFF iframe. This route generates
// `/liff/:liffId/:permanentPath` in routeMap and covers the direct-load path
// used by the M4 LIFF integration test. When One's static serve routeMap
// handles catch-all routes correctly, remove this file and let
// `[...liffPath].tsx` own permanent-link paths again.
export default function LiffPermanentPathPage() {
  const params = useActiveParams<{ liffId: string; permanentPath: string }>()

  return (
    <LiffPermanentRouteEntry
      liffId={params.liffId}
      permanentPath={`/${params.permanentPath}`}
    />
  )
}
