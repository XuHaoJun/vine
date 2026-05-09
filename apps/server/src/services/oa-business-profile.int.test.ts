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
    .values({ name: `Profile Provider ${suffix}`, ownerId: `owner-${suffix}` })
    .returning()
  const [account] = await db
    .insert(officialAccount)
    .values({
      providerId: provider!.id,
      name: 'Profile Bot',
      uniqueId: `profilebot-${suffix}`,
      description: 'Published status',
      imageUrl: 'https://example.test/profile.png',
      channelSecret: 'secret',
      email: `profile-${suffix}@example.test`,
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

      const state = await oa.getBusinessProfileEditorState(account.id)

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
})
