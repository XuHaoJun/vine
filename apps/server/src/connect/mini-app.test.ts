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
    getMiniApp: vi.fn().mockResolvedValue(null),
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

describe('miniAppImpl', () => {
  it('createMiniApp rejects empty providerId', async () => {
    const impl = miniAppImpl({ miniApp: fakeService(), template: fakeTemplateService(), serviceMessage: fakeServiceMessageService(), auth: fakeAuth() })
    await expect(
      impl.createMiniApp({ providerId: '', liffAppId: 'l', name: 'n' } as any, fakeCtx({ id: 'u' })),
    ).rejects.toThrow(/providerId/)
  })

  it('createMiniApp rejects empty liffAppId', async () => {
    const impl = miniAppImpl({ miniApp: fakeService(), template: fakeTemplateService(), serviceMessage: fakeServiceMessageService(), auth: fakeAuth() })
    await expect(
      impl.createMiniApp({ providerId: 'p', liffAppId: '', name: 'n' } as any, fakeCtx({ id: 'u' })),
    ).rejects.toThrow(/liffAppId/)
  })

  it('createMiniApp returns proto-shaped MiniApp', async () => {
    const impl = miniAppImpl({ miniApp: fakeService(), template: fakeTemplateService(), serviceMessage: fakeServiceMessageService(), auth: fakeAuth() })
    const res = await impl.createMiniApp(
      { providerId: 'prov-1', liffAppId: 'liff-app-1', name: 'Pizza' } as any,
      fakeCtx({ id: 'u-1' }),
    )
    expect(res.miniApp?.name).toBe('Pizza')
    expect(res.miniApp?.isPublished).toBe(false)
    expect(res.miniApp?.linkedOaIds).toEqual([])
  })
})
