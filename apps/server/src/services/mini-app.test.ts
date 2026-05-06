import { describe, expect, it, vi } from 'vitest'
import { createMiniAppService } from './mini-app'

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ma-1',
    providerId: 'prov-1',
    liffAppId: 'liff-app-1',
    name: 'Pizza Order',
    iconUrl: null,
    description: null,
    category: null,
    isPublished: false,
    publishedAt: null,
    createdAt: '2026-05-05T00:00:00Z',
    updatedAt: '2026-05-05T00:00:00Z',
    ...overrides,
  }
}

function createMockDb(initial: Record<string, unknown[]> = {}) {
  const mock = {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([makeRow()]),
        onConflictDoNothing: vi.fn().mockResolvedValue([]),
      }),
    }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(initial.select ?? []),
          orderBy: vi.fn().mockResolvedValue(initial.select ?? []),
        }),
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue(initial.select ?? []),
            then: vi.fn(),
          }),
          then: vi.fn().mockResolvedValue(initial.select ?? []),
        }),
        orderBy: vi.fn().mockResolvedValue(initial.select ?? []),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([makeRow({ name: 'updated' })]),
        }),
      }),
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([]),
    }),
  }
  return mock
}

describe('createMiniAppService', () => {
  it('creates a mini app with required fields', async () => {
    const db = createMockDb()
    const svc = createMiniAppService({ db: db as any })
    const result = await svc.createMiniApp({
      providerId: 'prov-1',
      liffAppId: 'liff-app-1',
      name: 'Pizza Order',
    })
    expect(db.insert).toHaveBeenCalled()
    expect(result.name).toBe('Pizza Order')
    expect(result.isPublished).toBe(false)
  })

  it('publish() rejects when iconUrl is null', async () => {
    const db = createMockDb()
    db.select = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([makeRow({ iconUrl: null })]),
        }),
      }),
    })
    const svc = createMiniAppService({ db: db as any })
    await expect(svc.publishMiniApp('ma-1')).rejects.toThrow(/iconUrl/)
  })

  it('publish() sets publishedAt on first publish and preserves it on re-publish', async () => {
    const db = createMockDb()
    let storedPublishedAt: string | null = null
    db.select = vi
      .fn()
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi
              .fn()
              .mockResolvedValue([makeRow({ iconUrl: 'https://x', isPublished: false })]),
          }),
        }),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi
              .fn()
              .mockResolvedValue([
                makeRow({
                  iconUrl: 'https://x',
                  isPublished: false,
                  publishedAt: '2026-05-05T00:00:00Z',
                }),
              ]),
          }),
        }),
      })
    db.update = vi.fn().mockImplementation(() => ({
      set: vi.fn().mockImplementation((values: { publishedAt?: string }) => {
        if (values.publishedAt) storedPublishedAt = values.publishedAt
        return {
          where: vi.fn().mockReturnValue({
            returning: vi
              .fn()
              .mockResolvedValue([
                makeRow({ isPublished: true, publishedAt: storedPublishedAt }),
              ]),
          }),
        }
      }),
    }))

    const svc = createMiniAppService({ db: db as any })
    const first = await svc.publishMiniApp('ma-1')
    expect(first?.publishedAt).toBeTruthy()
    const re = await svc.publishMiniApp('ma-1')
    expect(re?.publishedAt).toBe('2026-05-05T00:00:00Z')
  })
})
