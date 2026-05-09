import { randomUUID } from 'node:crypto'
import {
  oaBusinessProfile,
  oaBusinessProfileDraft,
  oaProvider,
  officialAccount,
} from '@vine/db/schema-oa'
import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { withRollbackDb } from '../test/integration-db'
import { createOAService } from './oa'

async function seedOA(db: any) {
  const suffix = randomUUID().slice(0, 8)
  const [provider] = await db
    .insert(oaProvider)
    .values({ name: `Profile Provider ${suffix}`, ownerId: `owner_${suffix}` })
    .returning()
  const [account] = await db
    .insert(officialAccount)
    .values({
      providerId: provider!.id,
      name: 'Profile Bot',
      uniqueId: `profilebot_${suffix}`,
      description: 'Published status',
      imageUrl: 'https://example.test/profile.png',
      channelSecret: 'secret',
      email: `profile_${suffix}@example.test`,
      country: 'TW',
      company: 'Profile Co',
      industry: 'Retail',
    })
    .returning()
  return account!
}

describe('oa business profile draft lifecycle', () => {
  it('creates missing published and draft rows from officialAccount', async () => {
    await withRollbackDb(async (db) => {
      const account = await seedOA(db)
      const oa = createOAService({ db, database: {} as any })

      const state = (await oa.getBusinessProfileEditorState(account.id))!

      expect(state.published.displayName).toBe('Profile Bot')
      expect(state.published.statusMessage).toBe('Published status')
      expect(state.draft.displayName).toBe('Profile Bot')
      expect(state.isDirty).toBe(false)

      const publishedRows = await db
        .select()
        .from(oaBusinessProfile)
        .where(eq(oaBusinessProfile.oaId, account.id))
      const draftRows = await db
        .select()
        .from(oaBusinessProfileDraft)
        .where(eq(oaBusinessProfileDraft.oaId, account.id))

      expect(publishedRows).toHaveLength(1)
      expect(draftRows).toHaveLength(1)
    })
  })

  it('autosaves draft without changing published profile or officialAccount', async () => {
    await withRollbackDb(async (db) => {
      const account = await seedOA(db)
      const oa = createOAService({ db, database: {} as any })

      await oa.getBusinessProfileEditorState(account.id)
      const saved = (await oa.autosaveBusinessProfileDraft(account.id, {
        displayName: 'Draft Name',
        statusMessage: 'Draft status',
      }))!

      expect(saved.draft.displayName).toBe('Draft Name')
      expect(saved.isDirty).toBe(true)

      const [published] = await db
        .select()
        .from(oaBusinessProfile)
        .where(eq(oaBusinessProfile.oaId, account.id))
      const [freshAccount] = await db
        .select()
        .from(officialAccount)
        .where(eq(officialAccount.id, account.id))

      expect(published!.displayName).toBe('Profile Bot')
      expect(freshAccount!.name).toBe('Profile Bot')
    })
  })

  it('publishes draft and syncs officialAccount compatibility fields', async () => {
    await withRollbackDb(async (db) => {
      const account = await seedOA(db)
      const oa = createOAService({ db, database: {} as any })

      await oa.getBusinessProfileEditorState(account.id)
      const saved = (await oa.autosaveBusinessProfileDraft(account.id, {
        displayName: 'Published Name',
        uniqueId: `published_${account.uniqueId}`,
        statusMessage: 'Published new status',
        profileImageUrl: 'https://example.test/new.png',
      }))!

      const published = (await oa.publishBusinessProfile(account.id, saved.draft.serverRevision))!

      expect(published.published.displayName).toBe('Published Name')
      expect(published.isDirty).toBe(false)

      const [freshAccount] = await db
        .select()
        .from(officialAccount)
        .where(eq(officialAccount.id, account.id))
      expect(freshAccount!.name).toBe('Published Name')
      expect(freshAccount!.uniqueId).toBe(`published_${account.uniqueId}`)
      expect(freshAccount!.description).toBe('Published new status')
      expect(freshAccount!.imageUrl).toBe('https://example.test/new.png')
    })
  })

  it('reset restores draft from published profile', async () => {
    await withRollbackDb(async (db) => {
      const account = await seedOA(db)
      const oa = createOAService({ db, database: {} as any })

      await oa.getBusinessProfileEditorState(account.id)
      await oa.autosaveBusinessProfileDraft(account.id, { displayName: 'Draft Name' })
      const reset = (await oa.resetBusinessProfileDraft(account.id))!

      expect(reset.draft.displayName).toBe('Profile Bot')
      expect(reset.isDirty).toBe(false)
    })
  })

  it('autosave rejects a stale clientRevision', async () => {
    await withRollbackDb(async (db) => {
      const account = await seedOA(db)
      const oa = createOAService({ db, database: {} as any })

      await oa.getBusinessProfileEditorState(account.id)
      await oa.autosaveBusinessProfileDraft(account.id, { displayName: 'First' })
      await expect(
        oa.autosaveBusinessProfileDraft(account.id, { displayName: 'Second' }, 0),
      ).rejects.toThrow('draft revision conflict')
    })
  })

  it('publish rejects a stale expectedRevision', async () => {
    await withRollbackDb(async (db) => {
      const account = await seedOA(db)
      const oa = createOAService({ db, database: {} as any })

      await oa.getBusinessProfileEditorState(account.id)
      await oa.autosaveBusinessProfileDraft(account.id, {
        displayName: 'New Name',
        uniqueId: `new_${account.uniqueId}`,
      })
      await expect(
        oa.publishBusinessProfile(account.id, 0),
      ).rejects.toThrow('draft revision conflict')
    })
  })

  it('publish rejects duplicate uniqueId', async () => {
    await withRollbackDb(async (db) => {
      const account1 = await seedOA(db)
      const account2 = await seedOA(db)
      const oa = createOAService({ db, database: {} as any })

      await oa.getBusinessProfileEditorState(account1.id)
      await oa.autosaveBusinessProfileDraft(account1.id, {
        displayName: 'Name',
        uniqueId: account2.uniqueId,
      })

      await expect(
        oa.publishBusinessProfile(account1.id),
      ).rejects.toThrow('uniqueId already exists')
    })
  })

  it('autosave rejects invalid footer color', async () => {
    await withRollbackDb(async (db) => {
      const account = await seedOA(db)
      const oa = createOAService({ db, database: {} as any })

      await oa.getBusinessProfileEditorState(account.id)
      await expect(
        oa.autosaveBusinessProfileDraft(account.id, { footerButtonColor: '#ff0000' }),
      ).rejects.toThrow('Invalid footer button color')
    })
  })

  it('autosave rejects too many splash labels', async () => {
    await withRollbackDb(async (db) => {
      const account = await seedOA(db)
      const oa = createOAService({ db, database: {} as any })

      await oa.getBusinessProfileEditorState(account.id)
      await expect(
        oa.autosaveBusinessProfileDraft(account.id, {
          splashLabels: ['a', 'b', 'c', 'd'],
        }),
      ).rejects.toThrow('Too many splash labels')
    })
  })

  it('autosave rejects invalid blockOrder', async () => {
    await withRollbackDb(async (db) => {
      const account = await seedOA(db)
      const oa = createOAService({ db, database: {} as any })

      await oa.getBusinessProfileEditorState(account.id)
      await expect(
        oa.autosaveBusinessProfileDraft(account.id, {
          blockOrder: ['invalidBlock'],
        }),
      ).rejects.toThrow('Invalid block ID')
    })
  })

  it('autosave rejects empty displayName', async () => {
    await withRollbackDb(async (db) => {
      const account = await seedOA(db)
      const oa = createOAService({ db, database: {} as any })

      await oa.getBusinessProfileEditorState(account.id)
      await expect(
        oa.autosaveBusinessProfileDraft(account.id, { displayName: '  ' }),
      ).rejects.toThrow('displayName must not be empty')
    })
  })

  it('publish rejects empty displayName', async () => {
    await withRollbackDb(async (db) => {
      const account = await seedOA(db)
      const oa = createOAService({ db, database: {} as any })

      await oa.getBusinessProfileEditorState(account.id)

      // Save valid draft first, then corrupt displayName directly in DB
      await oa.autosaveBusinessProfileDraft(account.id, {
        displayName: 'Valid Name',
        uniqueId: `test_${account.uniqueId}`,
      })
      await db
        .update(oaBusinessProfileDraft)
        .set({ displayName: '' } as any)
        .where(eq(oaBusinessProfileDraft.oaId, account.id))

      await expect(
        oa.publishBusinessProfile(account.id),
      ).rejects.toThrow('displayName must not be empty')
    })
  })

  it('publish is atomic: if publish throws, published profile row is unchanged', async () => {
    await withRollbackDb(async (db) => {
      const account = await seedOA(db)
      const oa = createOAService({ db, database: {} as any })

      await oa.getBusinessProfileEditorState(account.id)

      await oa.autosaveBusinessProfileDraft(account.id, {
        displayName: 'Fail Name',
        uniqueId: `fail_${account.uniqueId}`,
        statusMessage: 'Fail status',
      })

      // Seed a second account whose uniqueId we will steal to cause a conflict
      const account2 = await seedOA(db)

      // Change draft uniqueId to point at account2's uniqueId to create conflict
      await oa.autosaveBusinessProfileDraft(account.id, {
        uniqueId: account2.uniqueId,
      })

      // Publish should fail because uniqueId conflicts with account2
      await expect(
        oa.publishBusinessProfile(account.id),
      ).rejects.toThrow('uniqueId already exists')

      // Published profile must remain unchanged (atomic rollback)
      const [published] = await db
        .select()
        .from(oaBusinessProfile)
        .where(eq(oaBusinessProfile.oaId, account.id))
      expect(published!.displayName).toBe('Profile Bot')
      expect(published!.uniqueId).toBe(account.uniqueId)
      expect(published!.statusMessage).toBe('Published status')
    })
  })
})
