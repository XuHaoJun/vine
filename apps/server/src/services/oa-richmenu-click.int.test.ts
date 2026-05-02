import { randomUUID } from 'crypto'
import { describe, expect, it } from 'vitest'
import { officialAccount, oaProvider, oaRichMenu } from '@vine/db/schema-oa'
import { withRollbackDb } from '../test/integration-db'
import { createOAService } from './oa'

describe('oa rich menu click stats', () => {
  it('records clicks and aggregates them by area', async () => {
    await withRollbackDb(async (db) => {
      const suffix = randomUUID()
      const [provider] = await db
        .insert(oaProvider)
        .values({ name: 'Provider', ownerId: 'owner-1' })
        .returning()
      const [oa] = await db
        .insert(officialAccount)
        .values({
          providerId: provider.id,
          name: 'OA',
          uniqueId: `oa-click-${suffix}`,
          channelSecret: 'secret',
        })
        .returning()
      await db.insert(oaRichMenu).values({
        oaId: oa.id,
        richMenuId: 'rm-1',
        name: 'Menu',
        chatBarText: 'Menu',
        selected: false,
        sizeWidth: 2500,
        sizeHeight: 1686,
        areas: [
          {
            bounds: { x: 0, y: 0, width: 100, height: 100 },
            action: { type: 'message', text: 'a' },
          },
          {
            bounds: { x: 100, y: 0, width: 100, height: 100 },
            action: { type: 'message', text: 'b' },
          },
        ],
      })

      const oaService = createOAService({ db, database: {} as any })
      await oaService.addRichMenuClick({ oaId: oa.id, richMenuId: 'rm-1', areaIndex: 0 })
      await oaService.addRichMenuClick({ oaId: oa.id, richMenuId: 'rm-1', areaIndex: 0 })
      await oaService.addRichMenuClick({ oaId: oa.id, richMenuId: 'rm-1', areaIndex: 1 })

      const stats = await oaService.getRichMenuClickStats(oa.id, 'rm-1')
      expect(stats).toEqual(
        expect.arrayContaining([
          { areaIndex: 0, clickCount: 2 },
          { areaIndex: 1, clickCount: 1 },
        ]),
      )
    })
  })
})
