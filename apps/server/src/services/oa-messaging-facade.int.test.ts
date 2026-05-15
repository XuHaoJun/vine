import { randomUUID } from 'crypto'
import {
  oaAudienceFilter,
  oaCampaign,
  oaFriendship,
  oaProvider,
  officialAccount,
} from '@vine/db/schema-oa'
import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { withRollbackDb } from '../test/integration-db'
import { createOAAudienceService } from './oa-audience'
import { createOACampaignService } from './oa-campaign'
import { createOAMessagingService } from './oa-messaging'
import { createOAMessagingFacadeService } from './oa-messaging-facade'

async function seedOaWithFriends(db: any, suffix: string, userIds: string[]) {
  const [provider] = await db
    .insert(oaProvider)
    .values({ name: `Phase 3B Provider ${suffix}`, ownerId: `owner-${suffix}` })
    .returning()
  const [oa] = await db
    .insert(officialAccount)
    .values({
      providerId: provider.id,
      name: `Phase 3B OA ${suffix}`,
      uniqueId: `phase-3b-${suffix}`,
      channelSecret: 'secret',
    })
    .returning()
  await db.insert(oaFriendship).values(
    userIds.map((userId) => ({
      oaId: oa.id,
      userId,
      status: 'friend' as const,
    })),
  )
  return oa
}

function createFacade(db: any, ids: string[]) {
  const messaging = createOAMessagingService({
    db,
    instanceId: 'phase-3b-test',
    now: () => new Date('2026-05-14T00:00:00.000Z'),
  })
  const campaign = createOACampaignService({
    db,
    audience: createOAAudienceService({ db }),
    messaging,
    now: () => new Date('2026-05-14T00:00:00.000Z'),
  })
  return createOAMessagingFacadeService({
    db,
    campaign,
    now: () => new Date('2026-05-14T00:00:00.000Z'),
    createId: () => ids.shift() ?? randomUUID(),
  })
}

describe('OA messaging campaign facade DB integration', () => {
  it('creates a campaign and recipient snapshot for external broadcast', async () => {
    await withRollbackDb(async (db) => {
      const suffix = randomUUID()
      const oa = await seedOaWithFriends(db, suffix, [
        `user-1-${suffix}`,
        `user-2-${suffix}`,
      ])
      const campaignId = randomUUID()
      const facade = createFacade(db, [campaignId])

      const result = await facade.broadcast({
        oaId: oa.id,
        retryKey: undefined,
        body: { messages: [{ type: 'text', text: 'hello friends' }] },
      })

      expect(result.ok).toBe(true)
      const [campaign] = await db
        .select()
        .from(oaCampaign)
        .where(eq(oaCampaign.id, campaignId))
        .limit(1)
      expect(campaign.messageText).toBe('hello friends')
      expect(campaign.recipientSnapshotCount).toBe(2)
      expect(campaign.inlineAudienceQueryJson).toEqual({
        'friendship.status': 'friend',
      })
    })
  })

  it('uploads an audience and narrowcasts to the saved filter', async () => {
    await withRollbackDb(async (db) => {
      const suffix = randomUUID()
      const targetUser = `target-${suffix}`
      const oa = await seedOaWithFriends(db, suffix, [targetUser, `other-${suffix}`])
      const filterId = randomUUID()
      const campaignId = randomUUID()
      const facade = createFacade(db, [filterId, campaignId])

      const upload = await facade.uploadAudienceGroup({
        oaId: oa.id,
        body: {
          description: 'Uploaded target',
          audiences: [{ id: targetUser }],
        },
      })
      expect(upload).toEqual({
        ok: true,
        audienceGroupId: filterId,
        description: 'Uploaded target',
      })

      const result = await facade.narrowcast({
        oaId: oa.id,
        retryKey: undefined,
        body: {
          messages: [{ type: 'text', text: 'hello target' }],
          recipient: { type: 'audience', audienceGroupId: filterId },
        },
      })
      expect(result.ok).toBe(true)

      const [filter] = await db
        .select()
        .from(oaAudienceFilter)
        .where(eq(oaAudienceFilter.id, filterId))
        .limit(1)
      expect(filter.queryJson).toEqual({ providerUserId: { $in: [targetUser] } })

      const [campaign] = await db
        .select()
        .from(oaCampaign)
        .where(eq(oaCampaign.id, campaignId))
        .limit(1)
      expect(campaign.audienceFilterId).toBe(filterId)
      expect(campaign.recipientSnapshotCount).toBe(1)
    })
  })
})
