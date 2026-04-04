/** Public URL prefix for this stack (see `app/routes.d.ts`). */
export const TALKS_SLOT_BASE_PATH = '/home/talks'

/**
 * Must stay in sync with files under `app/.../talks/` (for `useSlotInitialRouteName` + `parseDynamicRouteParam`).
 */
export const TALKS_STACK_SCREEN_NAMES = ['index', 'requests', '[chatId]'] as const
