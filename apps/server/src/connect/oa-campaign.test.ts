import { Code, createContextValues } from '@connectrpc/connect'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { connectAuthDataKey } from './auth-context'
import { oaHandler } from './oa'

vi.mock('@take-out/better-auth-utils/server', () => ({
  getAuthDataFromRequest: vi.fn(),
}))

import { getAuthDataFromRequest } from '@take-out/better-auth-utils/server'
const mockedGetAuthDataFromRequest = vi.mocked(getAuthDataFromRequest)

function makeAuthCtx(userId: string) {
  const values = createContextValues()
  values.set(connectAuthDataKey, { id: userId } as any)
  return {
    values,
    signal: new AbortController().signal,
    timeoutMs: undefined,
    method: {} as any,
    service: {} as any,
    requestMethod: 'POST',
    url: new URL('http://localhost/'),
    peer: { addr: '127.0.0.1' },
    requestHeader: new Headers(),
    responseHeader: new Headers(),
    responseTrailer: new Headers(),
  } as any
}

function makeDeps(ownerId = 'user-1') {
  const capturedImpl: any = {}
  const router = {
    service: (_desc: any, impl: any) => Object.assign(capturedImpl, impl),
  }
  const oa = {
    getOfficialAccount: vi
      .fn()
      .mockResolvedValue({ id: 'oa-1', providerId: 'provider-1' }),
    getProvider: vi.fn().mockResolvedValue({ id: 'provider-1', ownerId }),
  }
  const oaAudience = {
    preview: vi.fn(async () => ({ ok: true, count: 2 })),
  }
  const oaCampaign = {
    sendTextCampaign: vi.fn(async () => ({ ok: true, campaignId: 'campaign-1' })),
    sendRichCampaign: vi.fn(async () => ({ ok: true, campaignId: 'campaign-1' })),
  }

  oaHandler({
    auth: {} as any,
    drive: {} as any,
    webhookDelivery: {} as any,
    oa: oa as any,
    oaAudience: oaAudience as any,
    oaCampaign: oaCampaign as any,
    richMenuDisplayScheduler: {} as any,
  })(router as any)
  return { capturedImpl, oa, oaAudience, oaCampaign }
}

beforeEach(() => {
  mockedGetAuthDataFromRequest.mockReset()
})

describe('OA connect campaign actions', () => {
  it('previews an audience filter after ownership check', async () => {
    const { capturedImpl, oaAudience } = makeDeps()
    mockedGetAuthDataFromRequest.mockResolvedValue({ id: 'user-1' } as any)

    const result = await capturedImpl.previewAudienceFilter(
      {
        officialAccountId: 'oa-1',
        queryJson: JSON.stringify({ 'tags.ids': { $all: ['vip'] } }),
      },
      makeAuthCtx('user-1'),
    )

    expect(result).toEqual({ count: 2 })
    expect(oaAudience.preview).toHaveBeenCalledWith({
      oaId: 'oa-1',
      query: { 'tags.ids': { $all: ['vip'] } },
    })
  })

  it('passes auth id as campaign manager id', async () => {
    const { capturedImpl, oaCampaign } = makeDeps('manager-1')
    mockedGetAuthDataFromRequest.mockResolvedValue({ id: 'manager-1' } as any)

    await expect(
      capturedImpl.sendTextCampaign(
        {
          officialAccountId: 'oa-1',
          campaignId: 'campaign-1',
          name: 'VIP',
          messageText: 'hello',
          audienceFilterId: 'filter-1',
          inlineAudienceQueryJson: JSON.stringify({ 'friendship.status': 'friend' }),
        },
        makeAuthCtx('manager-1'),
      ),
    ).resolves.toEqual({ campaignId: 'campaign-1' })

    expect(oaCampaign.sendTextCampaign).toHaveBeenCalledWith({
      campaignId: 'campaign-1',
      oaId: 'oa-1',
      managerId: 'manager-1',
      name: 'VIP',
      messageText: 'hello',
      audienceFilterId: 'filter-1',
      inlineAudienceQuery: { 'friendship.status': 'friend' },
    })
  })

  it('rejects campaign actions for another provider owner', async () => {
    const { capturedImpl, oaCampaign } = makeDeps('other-user')
    mockedGetAuthDataFromRequest.mockResolvedValue({ id: 'manager-1' } as any)

    await expect(
      capturedImpl.sendTextCampaign(
        {
          officialAccountId: 'oa-1',
          campaignId: 'campaign-1',
          name: 'VIP',
          messageText: 'hello',
        },
        makeAuthCtx('manager-1'),
      ),
    ).rejects.toMatchObject({ code: Code.PermissionDenied })
    expect(oaCampaign.sendTextCampaign).not.toHaveBeenCalled()
  })

  it('maps invalid audience JSON to invalid argument', async () => {
    const { capturedImpl, oaAudience } = makeDeps()
    mockedGetAuthDataFromRequest.mockResolvedValue({ id: 'user-1' } as any)

    await expect(
      capturedImpl.previewAudienceFilter(
        { officialAccountId: 'oa-1', queryJson: '{bad' },
        makeAuthCtx('user-1'),
      ),
    ).rejects.toMatchObject({ code: Code.InvalidArgument })
    expect(oaAudience.preview).not.toHaveBeenCalled()
  })

  it('passes rich campaign payloads to the campaign service', async () => {
    const { capturedImpl, oaCampaign } = makeDeps('manager-1')
    oaCampaign.sendRichCampaign = vi.fn(async () => ({
      ok: true,
      campaignId: 'campaign-1',
    }))
    mockedGetAuthDataFromRequest.mockResolvedValue({ id: 'manager-1' } as any)

    await expect(
      capturedImpl.sendRichCampaign(
        {
          officialAccountId: 'oa-1',
          campaignId: 'campaign-1',
          name: 'Rich',
          messagePayloadJson: JSON.stringify([{ type: 'text', text: 'hello' }]),
          inlineAudienceQueryJson: JSON.stringify({ 'friendship.status': 'friend' }),
        },
        makeAuthCtx('manager-1'),
      ),
    ).resolves.toEqual({ campaignId: 'campaign-1' })

    expect(oaCampaign.sendRichCampaign).toHaveBeenCalledWith({
      campaignId: 'campaign-1',
      oaId: 'oa-1',
      managerId: 'manager-1',
      name: 'Rich',
      messages: [{ type: 'text', text: 'hello' }],
      audienceFilterId: undefined,
      inlineAudienceQuery: { 'friendship.status': 'friend' },
    })
  })

  it('maps invalid rich campaign payloads to invalid argument', async () => {
    const { capturedImpl, oaCampaign } = makeDeps('manager-1')
    oaCampaign.sendRichCampaign = vi.fn(async () => {
      throw new Error('Text message must have a non-empty "text" field')
    })
    mockedGetAuthDataFromRequest.mockResolvedValue({ id: 'manager-1' } as any)

    await expect(
      capturedImpl.sendRichCampaign(
        {
          officialAccountId: 'oa-1',
          campaignId: 'campaign-1',
          name: 'Rich',
          messagePayloadJson: JSON.stringify([{ type: 'text', text: '' }]),
        },
        makeAuthCtx('manager-1'),
      ),
    ).rejects.toMatchObject({ code: Code.InvalidArgument })
  })
})
