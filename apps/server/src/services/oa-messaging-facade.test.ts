import { describe, expect, it, vi } from 'vitest'
import { createOAMessagingFacadeService } from './oa-messaging-facade'

function makeService() {
  const campaign = {
    sendExternalTextCampaign: vi.fn().mockResolvedValue({
      ok: true,
      accepted: {
        httpRequestId: 'req_campaign',
        acceptedRequestId: 'acc_campaign',
        request: { id: 'request-1' },
      },
      recipientCount: 2,
    }),
  }
  const db = {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'filter-1' }]),
      }),
    }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([
            {
              id: 'filter-1',
              oaId: 'oa-1',
              name: 'Imported audience',
              queryVersion: 1,
              queryJson: { providerUserId: { $in: ['user-1'] } },
              createdAt: '2026-05-14T00:00:00.000Z',
              updatedAt: '2026-05-14T00:00:00.000Z',
            },
          ]),
        }),
      }),
    }),
  }
  const service = createOAMessagingFacadeService({
    db: db as any,
    campaign: campaign as any,
    now: () => new Date('2026-05-14T00:00:00.000Z'),
    createId: () => '550e8400-e29b-41d4-a716-446655440001',
  })
  return { service, campaign, db }
}

describe('oa messaging campaign facade', () => {
  it('creates a broadcast campaign for all friends', async () => {
    const { service, campaign } = makeService()

    const result = await service.broadcast({
      oaId: 'oa-1',
      retryKey: undefined,
      body: { messages: [{ type: 'text', text: 'hello' }] },
    })

    expect(result.ok).toBe(true)
    expect(campaign.sendExternalTextCampaign).toHaveBeenCalledWith({
      campaignId: '550e8400-e29b-41d4-a716-446655440001',
      oaId: 'oa-1',
      retryKey: undefined,
      name: 'Messaging API broadcast 2026-05-14T00:00:00.000Z',
      messageText: 'hello',
      audienceFilterId: undefined,
      inlineAudienceQuery: { 'friendship.status': 'friend' },
    })
  })

  it('creates a multicast campaign for explicit recipients', async () => {
    const { service, campaign } = makeService()

    await service.multicast({
      oaId: 'oa-1',
      retryKey: '123e4567-e89b-12d3-a456-426614174000',
      body: { to: ['user-1', 'user-2'], messages: [{ type: 'text', text: 'hello' }] },
    })

    expect(campaign.sendExternalTextCampaign).toHaveBeenCalledWith(
      expect.objectContaining({
        retryKey: '123e4567-e89b-12d3-a456-426614174000',
        inlineAudienceQuery: { providerUserId: { $in: ['user-1', 'user-2'] } },
      }),
    )
  })

  it('rejects unsupported non-text campaign messages', async () => {
    const { service } = makeService()

    await expect(
      service.broadcast({
        oaId: 'oa-1',
        retryKey: undefined,
        body: { messages: [{ type: 'image', originalContentUrl: 'https://example.test/a.jpg' }] },
      }),
    ).resolves.toEqual({
      ok: false,
      code: 'UNSUPPORTED_MESSAGE_TYPE',
      message: 'Campaign facade supports exactly one text message',
    })
  })

  it('creates an uploaded audience filter from user IDs', async () => {
    const { service } = makeService()

    await expect(
      service.uploadAudienceGroup({
        oaId: 'oa-1',
        body: {
          description: 'Imported audience',
          audiences: [{ id: 'user-1' }, { id: 'user-2' }],
        },
      }),
    ).resolves.toEqual({
      ok: true,
      audienceGroupId: 'filter-1',
      description: 'Imported audience',
    })
  })

  it('returns a controlled error for duplicate uploaded audience descriptions', async () => {
    const { service, db } = makeService()
    db.insert.mockReturnValueOnce({
      values: vi.fn().mockReturnValue({
        returning: vi
          .fn()
          .mockRejectedValue(new Error('duplicate key value violates oaAudienceFilter_oaId_name_unique')),
      }),
    })

    await expect(
      service.uploadAudienceGroup({
        oaId: 'oa-1',
        body: {
          description: 'Imported audience',
          audiences: [{ id: 'user-1' }],
        },
      }),
    ).resolves.toEqual({
      ok: false,
      code: 'INVALID_REQUEST',
      message: 'audience description already exists',
    })
  })

  it('compiles narrowcast audienceGroupId references', async () => {
    const { service, campaign } = makeService()

    await service.narrowcast({
      oaId: 'oa-1',
      retryKey: undefined,
      body: {
        messages: [{ type: 'text', text: 'hello' }],
        recipient: { type: 'audience', audienceGroupId: 'filter-1' },
      },
    })

    expect(campaign.sendExternalTextCampaign).toHaveBeenCalledWith(
      expect.objectContaining({
        audienceFilterId: 'filter-1',
        inlineAudienceQuery: undefined,
      }),
    )
  })

  it('rejects unsupported narrowcast redelivery predicates', async () => {
    const { service } = makeService()

    await expect(
      service.narrowcast({
        oaId: 'oa-1',
        retryKey: undefined,
        body: {
          messages: [{ type: 'text', text: 'hello' }],
          recipient: { type: 'redelivery', requestId: 'request-1' },
        },
      }),
    ).resolves.toEqual({
      ok: false,
      code: 'UNSUPPORTED_AUDIENCE_FILTER',
      message: 'recipient.type redelivery is not supported',
    })
  })

  it('treats omitted top-level narrowcast recipient as all friends', async () => {
    const { service, campaign } = makeService()

    await service.narrowcast({
      oaId: 'oa-1',
      retryKey: undefined,
      body: { messages: [{ type: 'text', text: 'hello' }] },
    })

    expect(campaign.sendExternalTextCampaign).toHaveBeenCalledWith(
      expect.objectContaining({
        audienceFilterId: undefined,
        inlineAudienceQuery: { 'friendship.status': 'friend' },
      }),
    )
  })

  it('rejects empty narrowcast operator arrays', async () => {
    const { service } = makeService()

    await expect(
      service.narrowcast({
        oaId: 'oa-1',
        retryKey: undefined,
        body: {
          messages: [{ type: 'text', text: 'hello' }],
          recipient: { type: 'operator', and: [] },
        },
      }),
    ).resolves.toEqual({
      ok: false,
      code: 'UNSUPPORTED_AUDIENCE_FILTER',
      message: 'operator.and must be a non-empty array',
    })
  })

  it('rejects nested null operator branches', async () => {
    const { service } = makeService()

    await expect(
      service.narrowcast({
        oaId: 'oa-1',
        retryKey: undefined,
        body: {
          messages: [{ type: 'text', text: 'hello' }],
          recipient: { type: 'operator', or: [null] },
        },
      }),
    ).resolves.toEqual({
      ok: false,
      code: 'UNSUPPORTED_AUDIENCE_FILTER',
      message: 'recipient must be an object',
    })
  })

  it('rejects operators with more than one logical property', async () => {
    const { service } = makeService()

    await expect(
      service.narrowcast({
        oaId: 'oa-1',
        retryKey: undefined,
        body: {
          messages: [{ type: 'text', text: 'hello' }],
          recipient: {
            type: 'operator',
            and: [{ type: 'audience', audienceGroupId: 'filter-1' }],
            or: [{ type: 'audience', audienceGroupId: 'filter-2' }],
          },
        },
      }),
    ).resolves.toEqual({
      ok: false,
      code: 'UNSUPPORTED_AUDIENCE_FILTER',
      message: 'operator recipient must include exactly one of and, or, or not',
    })
  })
})
