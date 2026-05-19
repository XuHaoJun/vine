import type { createOAService } from '../services/oa'
import type { RichMenuDisplayJobPayload } from '../services/oa-richmenu-display'
import type { TaskList } from 'graphile-worker'
import type { Logger as PinoLogger } from 'pino'

type RichMenuDisplayTaskDeps = {
  oa: ReturnType<typeof createOAService>
  logger: PinoLogger
}

function isPayload(value: unknown): value is RichMenuDisplayJobPayload {
  const payload = value as RichMenuDisplayJobPayload
  return (
    typeof payload?.oaId === 'string' &&
    typeof payload.richMenuId === 'string' &&
    typeof payload.displayScheduleRevision === 'number'
  )
}

export function createRichMenuDisplayTaskList(deps: RichMenuDisplayTaskDeps): TaskList {
  async function recompute(payload: unknown) {
    if (!isPayload(payload)) {
      deps.logger.warn({ payload }, '[rich-menu-display] invalid payload')
      return
    }
    const menu = await deps.oa.getRichMenu(payload.oaId, payload.richMenuId)
    if (!menu) return
    if (menu.displayScheduleRevision !== payload.displayScheduleRevision) return

    await deps.oa.getRichMenuListForManager(payload.oaId)
  }

  return {
    'oa-rich-menu-display-start': recompute,
    'oa-rich-menu-display-end': recompute,
  }
}
