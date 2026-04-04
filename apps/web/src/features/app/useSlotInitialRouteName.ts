import { useMemo } from 'react'

import {
  getSyncPathnameForSlot,
  isDynamicRouteName,
  matchSlotInitialRouteFromPathname,
  parseDynamicRouteParam,
} from './slot-initial-route'

function isValidDynamicParamValue(value: string | undefined): boolean {
  if (value == null || value === '') {
    return false
  }
  if (value === 'undefined' || value === 'null') {
    return false
  }
  return true
}

/**
 * For stack `_layout.tsx` using `<Slot />`: derive `initialRouteName` from the real URL + this stack’s
 * screen segment names (must match files under that folder: `index`, `requests`, `[chatId]`, …).
 *
 * Pass a **stable** `screenNames` array (e.g. module-level `const`), not an inline literal each render.
 *
 * Never use a dynamic screen as initial route unless the URL has a real segment — otherwise RN
 * serializes `chatId: undefined` as `/home/talks/undefined`.
 */
export function useSlotInitialRouteName(
  basePath: string,
  screenNames: readonly string[],
): string | undefined {
  return useMemo(() => {
    const list = [...screenNames]
    const pathname = getSyncPathnameForSlot()
    const name = matchSlotInitialRouteFromPathname(pathname, basePath, list)
    if (!name) {
      return undefined
    }
    if (isDynamicRouteName(name)) {
      const param = parseDynamicRouteParam(pathname, basePath, list)
      if (!isValidDynamicParamValue(param)) {
        return list.includes('index') ? 'index' : undefined
      }
    }
    return name
  }, [basePath, screenNames])
}
