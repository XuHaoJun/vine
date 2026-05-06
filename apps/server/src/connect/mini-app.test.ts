import { describe, expect, it, vi } from 'vitest'
import { miniAppImpl } from './mini-app'

function fakeService() {
  return {
    createMiniApp: vi.fn().mockResolvedValue({
      id: 'ma-1',
      providerId: 'prov-1',
      liffAppId: 'liff-app-1',
      name: 'Pizza',
      iconUrl: null,
      description: null,
      category: null,
      isPublished: false,
      publishedAt: null,
      createdAt: '2026-05-05T00:00:00Z',
      updatedAt: '2026-05-05T00:00:00Z',
    }),
    getMiniApp: vi.fn().mockResolvedValue({
      id: 'ma-1',
      providerId: 'prov-1',
      liffAppId: 'liff-app-db-1',
      name: 'Pizza',
      iconUrl: null,
      description: null,
      category: null,
      isPublished: false,
      publishedAt: null,
      createdAt: '2026-05-05T00:00:00Z',
      updatedAt: '2026-05-05T00:00:00Z',
    }),
    getMiniAppByLiffAppId: vi.fn().mockResolvedValue(null),
    listMiniApps: vi.fn().mockResolvedValue([]),
    updateMiniApp: vi.fn(),
    publishMiniApp: vi.fn(),
    unpublishMiniApp: vi.fn(),
    deleteMiniApp: vi.fn(),
    linkOa: vi.fn(),
    unlinkOa: vi.fn(),
    listLinkedOaIds: vi.fn().mockResolvedValue([]),
    listMiniAppsLinkedToOa: vi.fn(),
    getMiniAppByLoginChannelId: vi.fn(),
    recordRecent: vi.fn(),
    listRecent: vi.fn().mockResolvedValue([]),
    listForUserOas: vi.fn().mockResolvedValue([]),
    listPublished: vi.fn().mockResolvedValue({ items: [], total: 0 }),
  }
}

function fakeOaService(ownerId = 'u-1') {
  return {
    getProvider: vi.fn().mockResolvedValue({ id: 'prov-1', ownerId }),
    getOfficialAccount: vi.fn().mockResolvedValue({ id: 'oa-1', providerId: 'prov-1' }),
  }
}

function fakeLiffService(providerId = 'prov-1') {
  return {
    getLiffAppByDbId: vi.fn().mockResolvedValue({
      id: 'liff-app-db-1',
      liffId: '1234567890-abcd',
      loginChannelId: 'login-channel-1',
    }),
    getLoginChannel: vi.fn().mockResolvedValue({ id: 'login-channel-1', providerId }),
  }
}

function fakeAuth() {
  return {} as any
}

function fakeTemplateService() {
  return {
    listTemplates: vi.fn().mockResolvedValue([]),
    createTemplate: vi.fn(),
    getTemplate: vi.fn().mockResolvedValue(null),
    getTemplateByName: vi.fn().mockResolvedValue(null),
    updateTemplate: vi.fn().mockResolvedValue(null),
    deleteTemplate: vi.fn(),
  } as any
}

function fakeServiceMessageService() {
  return {
    sendServiceMessage: vi.fn().mockResolvedValue({ messageId: 'mid-1', chatId: 'c-1' }),
    ensureFriendshipAndChat: vi.fn(),
    checkRateLimit: vi.fn(),
  } as any
}

function fakeCtx(authData: { id: string } | null) {
  return { values: { get: () => authData } } as any
}

function createImpl(overrides: Record<string, unknown> = {}) {
  return miniAppImpl({
    miniApp: fakeService(),
    template: fakeTemplateService(),
    serviceMessage: fakeServiceMessageService(),
    oa: fakeOaService(),
    liff: fakeLiffService(),
    auth: fakeAuth(),
    ...overrides,
  } as any)
}

describe('miniAppImpl', () => {
  it('createMiniApp rejects empty providerId', async () => {
    const impl = createImpl()
    await expect(
      impl.createMiniApp(
        { providerId: '', liffAppId: 'l', name: 'n' } as any,
        fakeCtx({ id: 'u' }),
      ),
    ).rejects.toThrow(/providerId/)
  })

  it('createMiniApp rejects empty liffAppId', async () => {
    const impl = createImpl()
    await expect(
      impl.createMiniApp(
        { providerId: 'p', liffAppId: '', name: 'n' } as any,
        fakeCtx({ id: 'u' }),
      ),
    ).rejects.toThrow(/liffAppId/)
  })

  it('createMiniApp returns proto-shaped MiniApp', async () => {
    const impl = createImpl()
    const res = await impl.createMiniApp(
      { providerId: 'prov-1', liffAppId: 'liff-app-1', name: 'Pizza' } as any,
      fakeCtx({ id: 'u-1' }),
    )
    expect(res.miniApp?.name).toBe('Pizza')
    expect(res.miniApp?.isPublished).toBe(false)
    expect(res.miniApp?.linkedOaIds).toEqual([])
    expect(res.miniApp?.liffId).toBe('1234567890-abcd')
  })

  it('rejects listing mini apps for a provider owned by another user', async () => {
    const impl = createImpl({ oa: fakeOaService('other-user') })

    await expect(
      impl.listMiniApps({ providerId: 'prov-1' } as any, fakeCtx({ id: 'u-1' })),
    ).rejects.toThrow(/Forbidden/)
  })

  it('rejects updating a mini app owned by another user', async () => {
    const impl = createImpl({ oa: fakeOaService('other-user') })

    await expect(
      impl.updateMiniApp({ id: 'ma-1', name: 'New name' } as any, fakeCtx({ id: 'u-1' })),
    ).rejects.toThrow(/Forbidden/)
  })

  it('rejects linking an OA owned by another user', async () => {
    const impl = createImpl({ oa: fakeOaService('other-user') })

    await expect(
      impl.linkOa({ miniAppId: 'ma-1', oaId: 'oa-1' } as any, fakeCtx({ id: 'u-1' })),
    ).rejects.toThrow(/Forbidden/)
  })

  it('allows published listing without auth context', async () => {
    const impl = createImpl()

    await expect(
      impl.listPublished({ limit: 50, offset: 0 } as any, fakeCtx(null)),
    ).resolves.toEqual({ miniApps: [], total: 0 })
  })
})
