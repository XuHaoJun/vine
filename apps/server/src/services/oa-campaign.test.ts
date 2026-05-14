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

function createExternalCampaignTestDeps(input: {
  accepted: unknown
  userIds?: string[]
}) {
  const messaging = {
    acceptMessagingExecution: vi.fn().mockResolvedValue(input.accepted),
  }
  const audience = {
    resolveRecipients: vi.fn(async () => ({
      ok: true as const,
      userIds: input.userIds ?? ['user-1'],
    })),
  }
  return { messaging, audience }
}

describe('oa campaign external sends', () => {
  it('passes retry keys to campaign messaging execution', async () => {
    const { messaging, audience } = createExternalCampaignTestDeps({
      accepted: {
        ok: true,
        accepted: {
          httpRequestId: 'req_external',
          acceptedRequestId: 'acc_external',
          request: { id: 'request-1' },
        },
        recipientCount: 1,
      },
    })
    const service = createOACampaignService({
      db: {} as any,
      audience: audience as any,
      messaging: messaging as any,
      now: () => new Date('2026-05-14T00:00:00.000Z'),
    })

    const result = await service.sendExternalTextCampaign({
      campaignId: '550e8400-e29b-41d4-a716-446655440001',
      oaId: '550e8400-e29b-41d4-a716-446655440000',
      retryKey: '123e4567-e89b-12d3-a456-426614174000',
      name: 'Messaging API broadcast',
      messageText: 'hello',
      audienceFilterId: undefined,
      inlineAudienceQuery: { 'friendship.status': 'friend' },
    })

    expect(result.ok).toBe(true)
    expect((result as any).accepted?.httpRequestId).toBe('req_external')
    expect(messaging.acceptMessagingExecution).toHaveBeenCalledWith(
      expect.objectContaining({
        requestType: 'campaign',
        retryKey: '123e4567-e89b-12d3-a456-426614174000',
      }),
    )
  })

  it('returns duplicate retry-key results without throwing', async () => {
    const { messaging, audience } = createExternalCampaignTestDeps({
      accepted: {
        ok: false,
        code: 'RETRY_KEY_ACCEPTED',
        httpRequestId: 'req_retry',
        acceptedRequestId: 'acc_original',
      },
    })
    const service = createOACampaignService({
      db: {} as any,
      audience: audience as any,
      messaging: messaging as any,
    })

    await expect(
      service.sendExternalTextCampaign({
        campaignId: '550e8400-e29b-41d4-a716-446655440001',
        oaId: '550e8400-e29b-41d4-a716-446655440000',
        retryKey: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Messaging API broadcast',
        messageText: 'hello',
        audienceFilterId: undefined,
        inlineAudienceQuery: { 'friendship.status': 'friend' },
      }),
    ).resolves.toEqual({
      ok: false,
      code: 'RETRY_KEY_ACCEPTED',
      httpRequestId: 'req_retry',
      acceptedRequestId: 'acc_original',
    })
  })
})
