import { randomUUID } from 'crypto'
import {
  officialAccount,
  oaDefaultRichMenu,
  oaProvider,
  oaRichMenu,
  oaRichMenuUserLink,
} from '@vine/db/schema-oa'
import { describe, expect, it } from 'vitest'
import { withRollbackDb } from '../test/integration-db'
import { createOAService } from './oa'

async function seedAccount(db: any) {
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
      uniqueId: `oa-rich-menu-active-${suffix}`,
      channelSecret: 'secret',
    })
    .returning()
  return oa
}

describe('active rich menu resolution', () => {
  it('returns active default inside the display period', async () => {
    await withRollbackDb(async (db) => {
      const oa = await seedAccount(db)
      await db.insert(oaRichMenu).values({
        oaId: oa.id,
        richMenuId: 'rm-active',
        name: 'Active',
        chatBarText: 'Menu',
        selected: false,
        sizeWidth: 2500,
        sizeHeight: 843,
        areas: [],
        hasImage: true,
        displayStartsAt: '2026-01-01T00:00:00.000Z',
        displayEndsAt: '2099-01-01T00:00:00.000Z',
      })
      await db.insert(oaDefaultRichMenu).values({
        oaId: oa.id,
        richMenuId: 'rm-active',
        updatedAt: new Date().toISOString(),
      })

      const service = createOAService({ db, database: {} as any })
      const result = await service.getActiveRichMenuForUser({
        oaId: oa.id,
        userId: 'user-1',
      })
      expect(result?.richMenuId).toBe('rm-active')
    })
  })

  it('does not return default before displayStartsAt', async () => {
    await withRollbackDb(async (db) => {
      const oa = await seedAccount(db)
      await db.insert(oaRichMenu).values({
        oaId: oa.id,
        richMenuId: 'rm-future',
        name: 'Future',
        chatBarText: 'Menu',
        selected: false,
        sizeWidth: 2500,
        sizeHeight: 843,
        areas: [],
        hasImage: true,
        displayStartsAt: '2099-01-01T00:00:00.000Z',
      })
      await db.insert(oaDefaultRichMenu).values({
        oaId: oa.id,
        richMenuId: 'rm-future',
        updatedAt: new Date().toISOString(),
      })

      const service = createOAService({ db, database: {} as any })
      const result = await service.getActiveRichMenuForUser({
        oaId: oa.id,
        userId: 'user-1',
      })
      expect(result).toBeNull()
    })
  })

  it('does not return default after displayEndsAt', async () => {
    await withRollbackDb(async (db) => {
      const oa = await seedAccount(db)
      await db.insert(oaRichMenu).values({
        oaId: oa.id,
        richMenuId: 'rm-ended',
        name: 'Ended',
        chatBarText: 'Menu',
        selected: false,
        sizeWidth: 2500,
        sizeHeight: 843,
        areas: [],
        hasImage: true,
        displayEndsAt: '2026-01-01T00:00:00.000Z',
      })
      await db.insert(oaDefaultRichMenu).values({
        oaId: oa.id,
        richMenuId: 'rm-ended',
        updatedAt: new Date().toISOString(),
      })

      const service = createOAService({ db, database: {} as any })
      const result = await service.getActiveRichMenuForUser({
        oaId: oa.id,
        userId: 'user-1',
      })
      expect(result).toBeNull()
    })
  })

  it('per-user rich menu wins over inactive default', async () => {
    await withRollbackDb(async (db) => {
      const oa = await seedAccount(db)
      await db.insert(oaRichMenu).values([
        {
          oaId: oa.id,
          richMenuId: 'rm-default-future',
          name: 'Future',
          chatBarText: 'Menu',
          selected: false,
          sizeWidth: 2500,
          sizeHeight: 843,
          areas: [],
          hasImage: true,
          displayStartsAt: '2099-01-01T00:00:00.000Z',
        },
        {
          oaId: oa.id,
          richMenuId: 'rm-user',
          name: 'User',
          chatBarText: 'Menu',
          selected: false,
          sizeWidth: 2500,
          sizeHeight: 843,
          areas: [],
          hasImage: true,
        },
      ])
      await db.insert(oaDefaultRichMenu).values({
        oaId: oa.id,
        richMenuId: 'rm-default-future',
        updatedAt: new Date().toISOString(),
      })
      await db.insert(oaRichMenuUserLink).values({
        oaId: oa.id,
        userId: 'user-1',
        richMenuId: 'rm-user',
      })

      const service = createOAService({ db, database: {} as any })
      const result = await service.getActiveRichMenuForUser({
        oaId: oa.id,
        userId: 'user-1',
      })
      expect(result?.richMenuId).toBe('rm-user')
    })
  })

  it('does not return a menu without an image', async () => {
    await withRollbackDb(async (db) => {
      const oa = await seedAccount(db)
      await db.insert(oaRichMenu).values({
        oaId: oa.id,
        richMenuId: 'rm-no-image',
        name: 'No image',
        chatBarText: 'Menu',
        selected: false,
        sizeWidth: 2500,
        sizeHeight: 843,
        areas: [],
        hasImage: false,
      })
      await db.insert(oaDefaultRichMenu).values({
        oaId: oa.id,
        richMenuId: 'rm-no-image',
        updatedAt: new Date().toISOString(),
      })

      const service = createOAService({ db, database: {} as any })
      const result = await service.getActiveRichMenuForUser({
        oaId: oa.id,
        userId: 'user-1',
      })
      expect(result).toBeNull()
    })
  })

  it('does not return default set via external API when display period is in the future', async () => {
    await withRollbackDb(async (db) => {
      const oa = await seedAccount(db)
      await db.insert(oaRichMenu).values({
        oaId: oa.id,
        richMenuId: 'rm-ext-future',
        name: 'External future',
        chatBarText: 'Menu',
        selected: false,
        sizeWidth: 2500,
        sizeHeight: 843,
        areas: [],
        hasImage: true,
        displayStartsAt: '2099-01-01T00:00:00.000Z',
        displayEndsAt: '2099-06-01T00:00:00.000Z',
      })
      await db.insert(oaDefaultRichMenu).values({
        oaId: oa.id,
        richMenuId: 'rm-ext-future',
        updatedAt: new Date().toISOString(),
      })

      const service = createOAService({ db, database: {} as any })
      const result = await service.getActiveRichMenuForUser({
        oaId: oa.id,
        userId: 'user-1',
      })
      expect(result).toBeNull()
    })
  })
})
