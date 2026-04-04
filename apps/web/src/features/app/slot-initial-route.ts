import * as Linking from 'expo-linking'
import { Platform } from 'react-native'

/**
 * One `QualifiedNavigator` late-mount heuristic only matches literal screen segments, not `[id]` vs a real id.
 * Use with `<Slot initialRouteName={...} />` + optional pathname param fallback on dynamic pages.
 *
 * @see https://github.com/onejs/one/blob/main/packages/one/src/views/Navigator.tsx — `resolvedInitialRouteName`
 */

export function normalizePathname(path: string): string {
  if (!path) return '/'
  const withSlash = path.startsWith('/') ? path : `/${path}`
  return withSlash.replace(/\/+$/, '') || '/'
}

/** Web: current URL. Native: `expo-linking` (same idea as One’s initial URL capture). */
export function getSyncPathnameForSlot(): string {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.location?.pathname) {
      return window.location.pathname
    }
    return ''
  }
  const url = Linking.getLinkingURL()
  if (!url) return ''
  const { path } = Linking.parse(url)
  if (path == null || path === '') return '/'
  return normalizePathname(path)
}

export function isDynamicRouteName(name: string): boolean {
  return name.startsWith('[') && name.endsWith(']')
}

/**
 * Map browser path → React Navigation screen `name` for a stack layout’s direct children.
 * `screenNames` should match file segments (`index`, `requests`, `[chatId]`, …).
 */
export function matchSlotInitialRouteFromPathname(
  pathname: string,
  basePath: string,
  screenNames: string[],
): string | undefined {
  const path = normalizePathname(pathname)
  const base = normalizePathname(basePath)
  if (path !== base && !path.startsWith(`${base}/`)) {
    return undefined
  }
  const rest = path === base ? '' : path.slice(base.length + 1)
  const segments = rest.split('/').filter(Boolean)

  const staticNames = new Set(
    screenNames.filter((n) => !isDynamicRouteName(n) && n !== 'index'),
  )
  const hasIndex = screenNames.includes('index')
  const dynamicScreens = screenNames.filter(isDynamicRouteName)

  if (segments.length === 0) {
    return hasIndex ? 'index' : undefined
  }

  const first = segments[0]!
  if (staticNames.has(first)) {
    return first
  }

  if (segments.length === 1 && dynamicScreens.length > 0) {
    // Literal "undefined" / "null" in the path (e.g. bad navigation) — treat as list, not dynamic.
    if (first === 'undefined' || first === 'null') {
      return hasIndex ? 'index' : undefined
    }
    return dynamicScreens[0]
  }

  return undefined
}

/**
 * When `useParams()` is empty after refresh, recover the first path segment that belongs to a dynamic screen
 * (same `screenNames` list as matching).
 */
export function parseDynamicRouteParam(
  pathname: string,
  basePath: string,
  screenNames: string[],
): string | undefined {
  const screen = matchSlotInitialRouteFromPathname(pathname, basePath, screenNames)
  if (!screen || !isDynamicRouteName(screen)) {
    return undefined
  }
  const path = normalizePathname(pathname)
  const base = normalizePathname(basePath)
  if (!path.startsWith(`${base}/`)) {
    return undefined
  }
  const rest = path.slice(base.length + 1)
  const first = rest.split('/').filter(Boolean)[0]
  if (!first) {
    return undefined
  }
  if (first === 'undefined' || first === 'null') {
    return undefined
  }
  const staticNames = screenNames.filter((n) => !isDynamicRouteName(n) && n !== 'index')
  if (staticNames.includes(first)) {
    return undefined
  }
  return decodeURIComponent(first)
}
