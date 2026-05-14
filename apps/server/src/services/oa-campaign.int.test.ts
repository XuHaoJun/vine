import { randomUUID } from 'crypto'
import {
  oaAudienceFilter,
  oaCampaign,
  oaContactTag,
  oaContactTagAssignment,
  oaFriendship,
  oaProvider,
  officialAccount,
} from '@vine/db/schema-oa'
import { oaMessageDelivery, oaMessageRequest } from '@vine/db/schema-private'
import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { withRollbackDb } from '../test/integration-db'
import { createOAAudienceService } from './oa-audience'
import { createOACampaignService } from './oa-campaign'
import { createOAMessagingService } from './oa-messaging'

describe('OA campaign service DB integration', () => {
  it('creates campaign summary and durable recipient snapshot rows', async () => {
    await withRollbackDb(async (db) => {
      const suffix = randomUUID()
      const userVip = `user-vip-${suffix}`
      const userRegular = `user-regular-${suffix}`
      const [provider] = await db
        .insert(oaProvider)
        .values({ name: 'Campaign Provider', ownerId: `manager-${suffix}` })
        .returning()
      const [oa] = await db
        .insert(officialAccount)
        .values({
          providerId: provider.id,
          name: 'Campaign Bot',
          uniqueId: `campaign-${suffix}`,
          channelSecret: 'secret',
        })
        .returning()
      await db.insert(oaFriendship).values([
        { oaId: oa.id, userId: userVip, status: 'friend' },
        { oaId: oa.id, userId: userRegular, status: 'friend' },
      ])
      const [tag] = await db
        .insert(oaContactTag)
        .values({ oaId: oa.id, name: 'VIP' })
        .returning()
      await db.insert(oaContactTagAssignment).values({
        oaId: oa.id,
        userId: userVip,
        tagId: tag.id,
      })
      const [filter] = await db
        .insert(oaAudienceFilter)
        .values({
          oaId: oa.id,
          name: 'VIP',
          queryJson: { 'tags.ids': { $all: [tag.id] } },
          createdByManagerId: `manager-${suffix}`,
        })
        .returning()

      const messaging = createOAMessagingService({
        db,
        instanceId: 'test',
        now: () => new Date('2026-05-13T00:00:00.000Z'),
      })
      const service = createOACampaignService({
        db,
        audience: createOAAudienceService({ db }),
        messaging,
        now: () => new Date('2026-05-13T00:00:00.000Z'),
      })
      const campaignId = randomUUID()

      await expect(
        service.sendTextCampaign({
          campaignId,
          oaId: oa.id,
          managerId: `manager-${suffix}`,
          name: 'VIP blast',
          messageText: 'hello',
          audienceFilterId: filter.id,
          inlineAudienceQuery: undefined,
        }),
      ).resolves.toMatchObject({
        ok: true,
        campaignId,
        recipientCount: 1,
      })

      const [campaign] = await db
        .select()
        .from(oaCampaign)
        .where(eq(oaCampaign.id, campaignId))
        .limit(1)
      expect(campaign.recipientSnapshotCount).toBe(1)
      expect(campaign.quotaUsed).toBe(1)
      expect(campaign.status).toBe('queued')
      expect(campaign.messageRequestId).not.toBeNull()

      const [request] = await db
        .select()
        .from(oaMessageRequest)
        .where(eq(oaMessageRequest.id, campaign.messageRequestId))
        .limit(1)
      expect(request.requestType).toBe('campaign')

      const deliveries = await db
        .select()
        .from(oaMessageDelivery)
        .where(eq(oaMessageDelivery.requestId, request.id))
      expect(deliveries).toHaveLength(1)
      expect(deliveries[0].userId).toBe(userVip)
    })
  })
})
