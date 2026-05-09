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
  const mockProfile = {
    oaId: 'oa-1',
    displayName: 'Test OA',
    uniqueId: 'test_oa',
    statusMessage: 'Hello',
    profileImageUrl: 'https://example.com/profile.jpg',
    coverImageUrl: 'https://example.com/cover.jpg',
    showFollowerCount: true,
    footerButtonColor: '#ff0000',
    splashLabels: ['label1'],
    buttons: { items: [{ label: 'Click', uri: 'https://example.com' }] },
    address: { line1: '123 Main St' },
    phoneNumber: '+81-3-1234-5678',
    paymentMethods: { methods: ['credit_card'] },
    businessHours: { mon: '9:00-17:00' },
    websites: { official: 'https://example.com' },
    visibilitySettings: { searchable: true },
    announcements: { items: [] },
    mixedMediaFeed: { enabled: false },
    socialMedia: { twitter: '@test' },
    basicInfoBlock: { sections: [] },
    blockOrder: ['basic_info', 'address'],
    serverRevision: 5,
    lastSavedAt: '2025-01-01T00:00:00Z',
    publishedAt: '2025-01-01T00:00:00Z',
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  }
  const mockEditorState = {
    account: {
      id: 'oa-1',
      providerId: 'provider-1',
      name: 'Test OA',
      uniqueId: 'test_oa',
      status: 'active',
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
    },
    published: mockProfile,
    draft: mockProfile,
    isDirty: false,
  }
  const oa = {
    getOfficialAccount: vi
      .fn()
      .mockResolvedValue({ id: 'oa-1', providerId: 'provider-1' }),
    getProvider: vi.fn().mockResolvedValue({ id: 'provider-1', ownerId }),
    getBusinessProfileEditorState: vi.fn().mockResolvedValue(mockEditorState),
    autosaveBusinessProfileDraft: vi.fn().mockResolvedValue({
      draft: mockProfile,
      isDirty: true,
    }),
    resetBusinessProfileDraft: vi.fn().mockResolvedValue(mockEditorState),
    publishBusinessProfile: vi.fn().mockResolvedValue(mockEditorState),
  }
  const drive = {
    put: vi.fn(),
    getUrl: vi.fn().mockResolvedValue('https://uploads.example/image.jpg'),
  }
  oaHandler({
    auth: {} as any,
    drive: drive as any,
    webhookDelivery: {} as any,
    oa: oa as any,
  })(router as any)
  return { capturedImpl, oa, drive }
}

beforeEach(() => {
  mockedGetAuthDataFromRequest.mockReset()
})

describe('OA connect business profile', () => {
  it('getBusinessProfileEditorState returns data for owner', async () => {
    const { capturedImpl } = makeDeps('user-1')
    mockedGetAuthDataFromRequest.mockResolvedValue({ id: 'user-1' } as any)

    const result = await capturedImpl.getBusinessProfileEditorState(
      { officialAccountId: 'oa-1' },
      makeAuthCtx('user-1'),
    )

    expect(result.account).toBeDefined()
    expect(result.published).toBeDefined()
    expect(result.draft).toBeDefined()
    expect(result.isDirty).toBe(false)
  })

  it('getBusinessProfileEditorState rejects non-owner', async () => {
    const { capturedImpl, oa } = makeDeps('other-user')
    mockedGetAuthDataFromRequest.mockResolvedValue({ id: 'user-1' } as any)

    await expect(
      capturedImpl.getBusinessProfileEditorState(
        { officialAccountId: 'oa-1' },
        makeAuthCtx('user-1'),
      ),
    ).rejects.toMatchObject({ code: Code.PermissionDenied })
    expect(oa.getBusinessProfileEditorState).not.toHaveBeenCalled()
  })

  it('autosaveBusinessProfileDraft works for owner', async () => {
    const { capturedImpl } = makeDeps('user-1')
    mockedGetAuthDataFromRequest.mockResolvedValue({ id: 'user-1' } as any)

    const result = await capturedImpl.autosaveBusinessProfileDraft(
      { officialAccountId: 'oa-1', patch: { displayName: 'Updated' } },
      makeAuthCtx('user-1'),
    )

    expect(result.draft).toBeDefined()
    expect(result.serverRevision).toBe(5)
    expect(result.isDirty).toBe(true)
  })

  it('autosaveBusinessProfileDraft rejects non-owner', async () => {
    const { capturedImpl, oa } = makeDeps('other-user')
    mockedGetAuthDataFromRequest.mockResolvedValue({ id: 'user-1' } as any)

    await expect(
      capturedImpl.autosaveBusinessProfileDraft(
        { officialAccountId: 'oa-1', patch: {} },
        makeAuthCtx('user-1'),
      ),
    ).rejects.toMatchObject({ code: Code.PermissionDenied })
    expect(oa.autosaveBusinessProfileDraft).not.toHaveBeenCalled()
  })

  it('resetBusinessProfileDraft works for owner', async () => {
    const { capturedImpl } = makeDeps('user-1')
    mockedGetAuthDataFromRequest.mockResolvedValue({ id: 'user-1' } as any)

    const result = await capturedImpl.resetBusinessProfileDraft(
      { officialAccountId: 'oa-1' },
      makeAuthCtx('user-1'),
    )

    expect(result.state).toBeDefined()
    expect(result.state.account).toBeDefined()
  })

  it('resetBusinessProfileDraft rejects non-owner', async () => {
    const { capturedImpl, oa } = makeDeps('other-user')
    mockedGetAuthDataFromRequest.mockResolvedValue({ id: 'user-1' } as any)

    await expect(
      capturedImpl.resetBusinessProfileDraft(
        { officialAccountId: 'oa-1' },
        makeAuthCtx('user-1'),
      ),
    ).rejects.toMatchObject({ code: Code.PermissionDenied })
    expect(oa.resetBusinessProfileDraft).not.toHaveBeenCalled()
  })

  it('publishBusinessProfile works for owner', async () => {
    const { capturedImpl } = makeDeps('user-1')
    mockedGetAuthDataFromRequest.mockResolvedValue({ id: 'user-1' } as any)

    const result = await capturedImpl.publishBusinessProfile(
      { officialAccountId: 'oa-1', expectedRevision: 5 },
      makeAuthCtx('user-1'),
    )

    expect(result.state).toBeDefined()
    expect(result.state.account).toBeDefined()
  })

  it('publishBusinessProfile rejects non-owner', async () => {
    const { capturedImpl, oa } = makeDeps('other-user')
    mockedGetAuthDataFromRequest.mockResolvedValue({ id: 'user-1' } as any)

    await expect(
      capturedImpl.publishBusinessProfile(
        { officialAccountId: 'oa-1' },
        makeAuthCtx('user-1'),
      ),
    ).rejects.toMatchObject({ code: Code.PermissionDenied })
    expect(oa.publishBusinessProfile).not.toHaveBeenCalled()
  })

  it('uploadBusinessProfileImage stores image and updates draft', async () => {
    const { capturedImpl, oa, drive } = makeDeps('user-1')
    mockedGetAuthDataFromRequest.mockResolvedValue({ id: 'user-1' } as any)

    const result = await capturedImpl.uploadBusinessProfileImage(
      {
        officialAccountId: 'oa-1',
        kind: 1,
        image: new Uint8Array([0xff, 0xd8]),
        contentType: 'image/jpeg',
      },
      makeAuthCtx('user-1'),
    )

    expect(drive.put).toHaveBeenCalledWith(
      'oa-profile/oa-1/profile.jpg',
      expect.any(Buffer),
      'image/jpeg',
    )
    expect(drive.getUrl).toHaveBeenCalled()
    expect(oa.autosaveBusinessProfileDraft).toHaveBeenCalledWith('oa-1', {
      profileImageUrl: 'https://uploads.example/image.jpg',
    })
    expect(result.imageUrl).toBe('https://uploads.example/image.jpg')
  })

  it('uploadBusinessProfileImage rejects unsupported type', async () => {
    const { capturedImpl } = makeDeps('user-1')
    mockedGetAuthDataFromRequest.mockResolvedValue({ id: 'user-1' } as any)

    await expect(
      capturedImpl.uploadBusinessProfileImage(
        {
          officialAccountId: 'oa-1',
          kind: 1,
          image: new Uint8Array([0x00]),
          contentType: 'image/gif',
        },
        makeAuthCtx('user-1'),
      ),
    ).rejects.toMatchObject({ code: Code.InvalidArgument })
  })

  it('uploadBusinessProfileImage rejects oversized image', async () => {
    const { capturedImpl } = makeDeps('user-1')
    mockedGetAuthDataFromRequest.mockResolvedValue({ id: 'user-1' } as any)

    const oversized = new Uint8Array(4 * 1024 * 1024)
    await expect(
      capturedImpl.uploadBusinessProfileImage(
        {
          officialAccountId: 'oa-1',
          kind: 1,
          image: oversized,
          contentType: 'image/png',
        },
        makeAuthCtx('user-1'),
      ),
    ).rejects.toMatchObject({ code: Code.InvalidArgument })
  })

  it('removeBusinessProfileImage clears draft image field', async () => {
    const { capturedImpl, oa } = makeDeps('user-1')
    mockedGetAuthDataFromRequest.mockResolvedValue({ id: 'user-1' } as any)

    await capturedImpl.removeBusinessProfileImage(
      { officialAccountId: 'oa-1', kind: 1 },
      makeAuthCtx('user-1'),
    )

    expect(oa.autosaveBusinessProfileDraft).toHaveBeenCalledWith('oa-1', {
      profileImageUrl: null,
    })
  })

  it('removeBusinessProfileImage rejects non-owner', async () => {
    const { capturedImpl, oa } = makeDeps('other-user')
    mockedGetAuthDataFromRequest.mockResolvedValue({ id: 'user-1' } as any)

    await expect(
      capturedImpl.removeBusinessProfileImage(
        { officialAccountId: 'oa-1', kind: 1 },
        makeAuthCtx('user-1'),
      ),
    ).rejects.toMatchObject({ code: Code.PermissionDenied })
    expect(oa.autosaveBusinessProfileDraft).not.toHaveBeenCalled()
  })
})
