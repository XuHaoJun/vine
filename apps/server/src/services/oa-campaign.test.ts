import { describe, expect, it, vi } from 'vitest'
import { createOACampaignService } from './oa-campaign'

function createDbReturningFilters(rows: any[]) {
  const limit = vi.fn(async () => rows)
  const where = vi.fn(() => ({ limit }))
  const from = vi.fn(() => ({ where }))
  const select = vi.fn(() => ({ from }))
  return { db: { select } as any, select, from, where, limit }
}

describe('OA campaign service', () => {
  it('previews an inline audience filter', async () => {
    const audience = { preview: vi.fn(async () => ({ ok: true, count: 2 })) }
    const service = createOACampaignService({
      db: {} as any,
      audience: audience as any,
      messaging: {} as any,
      now: () => new Date('2026-05-13T00:00:00.000Z'),
    })

    const result = await service.previewAudience({
      oaId: 'oa-1',
      query: { 'tags.ids': { $all: ['vip'] } },
    })

    expect(result).toEqual({ ok: true, count: 2 })
    expect(audience.preview).toHaveBeenCalledWith({
      oaId: 'oa-1',
      query: { 'tags.ids': { $all: ['vip'] } },
    })
  })

  it('rejects empty text campaigns', async () => {
    const service = createOACampaignService({
      db: {} as any,
      audience: {} as any,
      messaging: {} as any,
    })

    await expect(
      service.sendTextCampaign({
        campaignId: 'campaign-1',
        oaId: 'oa-1',
        managerId: 'manager-1',
        name: 'Blank',
        messageText: '   ',
        audienceFilterId: undefined,
        inlineAudienceQuery: { 'friendship.status': 'friend' },
      }),
    ).rejects.toThrow('Campaign text is required')
  })

  it('loads saved filters inside the requested OA', async () => {
    const db = createDbReturningFilters([
      {
        id: 'filter-1',
        oaId: 'oa-1',
        queryJson: { 'tags.ids': { $all: ['vip'] } },
      },
    ])
    const audience = {
      resolveRecipients: vi.fn(async () => ({ ok: true, userIds: ['user-vip'] })),
    }
    const messaging = {
      acceptMessagingExecution: vi.fn(async (input) => {
        const tx = { insert: vi.fn(() => ({ values: vi.fn(async () => undefined) })) }
        await input.onAccepted({
          tx,
          request: { id: 'request-1' },
          recipientCount: 1,
          nowIso: '2026-05-13T00:00:00.000Z',
        })
        return {
          ok: true,
          accepted: { request: { id: 'request-1' } },
          recipientCount: 1,
        }
      }),
    }
    const service = createOACampaignService({
      db: db.db,
      audience: audience as any,
      messaging: messaging as any,
      now: () => new Date('2026-05-13T00:00:00.000Z'),
    })

    const result = await service.sendTextCampaign({
      campaignId: 'campaign-1',
      oaId: 'oa-1',
      managerId: 'manager-1',
      name: '  May VIP  ',
      messageText: 'hello',
      audienceFilterId: 'filter-1',
      inlineAudienceQuery: undefined,
    })

    expect(result).toEqual({
      ok: true,
      campaignId: 'campaign-1',
      messageRequestId: 'request-1',
      recipientCount: 1,
    })
    expect(audience.resolveRecipients).toHaveBeenCalledWith({
      oaId: 'oa-1',
      query: { 'tags.ids': { $all: ['vip'] } },
    })
    expect(messaging.acceptMessagingExecution).toHaveBeenCalledWith(
      expect.objectContaining({
        oaId: 'oa-1',
        requestType: 'campaign',
        target: {
          campaignId: 'campaign-1',
          audienceFilterId: 'filter-1',
          audience: { 'tags.ids': { $all: ['vip'] } },
        },
      }),
    )
  })

  it('rejects saved filters from another OA', async () => {
    const db = createDbReturningFilters([])
    const service = createOACampaignService({
      db: db.db,
      audience: {} as any,
      messaging: {} as any,
    })

    await expect(
      service.sendTextCampaign({
        campaignId: 'campaign-1',
        oaId: 'oa-1',
        managerId: 'manager-1',
        name: 'Mismatched',
        messageText: 'hello',
        audienceFilterId: 'filter-other',
        inlineAudienceQuery: undefined,
      }),
    ).rejects.toThrow('Audience filter not found')
  })
})
