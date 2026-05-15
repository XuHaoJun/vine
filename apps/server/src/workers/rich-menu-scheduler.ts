import type { WorkerUtils } from 'graphile-worker'
import type { RichMenuDisplayPeriod } from '../services/oa-richmenu-display'
import { buildRichMenuDisplayJobKeys } from '../services/oa-richmenu-display'

export type RichMenuDisplayScheduler = {
  enqueueDisplayPeriodJobs(input: {
    oaId: string
    richMenuId: string
    displayScheduleRevision: number
    displayPeriod: RichMenuDisplayPeriod
  }): Promise<void>
}

export function createRichMenuDisplayScheduler(
  workerUtils: WorkerUtils,
): RichMenuDisplayScheduler {
  return {
    async enqueueDisplayPeriodJobs(input) {
      const keys = buildRichMenuDisplayJobKeys(input.oaId, input.richMenuId)
      const payload = {
        oaId: input.oaId,
        richMenuId: input.richMenuId,
        displayScheduleRevision: input.displayScheduleRevision,
      }
      if (input.displayPeriod.displayStartsAt) {
        await workerUtils.addJob('oa-rich-menu-display-start', payload, {
          jobKey: keys.start,
          jobKeyMode: 'replace',
          runAt: new Date(input.displayPeriod.displayStartsAt),
          maxAttempts: 3,
        })
      }
      if (input.displayPeriod.displayEndsAt) {
        await workerUtils.addJob('oa-rich-menu-display-end', payload, {
          jobKey: keys.end,
          jobKeyMode: 'replace',
          runAt: new Date(input.displayPeriod.displayEndsAt),
          maxAttempts: 3,
        })
      }
    },
  }
}
