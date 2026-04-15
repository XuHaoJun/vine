import { describe, expect, it, vi } from 'vitest'
import { createLiffService } from './liff'

function createMockDb() {
  return {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([
          {
            id: 'chan-id',
            providerId: 'prov-1',
            name: 'My Login Channel',
            channelId: 'abc123def4',
            channelSecret: 'secret123',
            description: null,
            createdAt: '2026-04-15T00:00:00Z',
            updatedAt: '2026-04-15T00:00:00Z',
          },
        ]),
      }),
    }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) }),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([]),
    }),
  }
}

describe('createLiffService — LoginChannel', () => {
  it('creates a login channel with generated channelId and channelSecret', async () => {
    const mockDb = createMockDb()
    const svc = createLiffService({ db: mockDb as any })
    const result = await svc.createLoginChannel({ providerId: 'prov-1', name: 'My Login Channel' })
    expect(mockDb.insert).toHaveBeenCalled()
    expect(result.name).toBe('My Login Channel')
    expect(result.channelId).toBeTruthy()
    expect(result.channelSecret).toBeTruthy()
  })

  it('returns null when login channel not found', async () => {
    const mockDb = createMockDb()
    const svc = createLiffService({ db: mockDb as any })
    const result = await svc.getLoginChannel('missing-id')
    expect(result).toBeNull()
  })

  it('lists login channels for a provider', async () => {
    const mockDb = createMockDb()
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([
          { id: 'chan-1', providerId: 'prov-1', name: 'Chan A', channelId: 'x', channelSecret: 's', description: null, createdAt: '', updatedAt: '' },
        ]),
      }),
    })
    const svc = createLiffService({ db: mockDb as any })
    const result = await svc.listLoginChannels('prov-1')
    expect(result).toHaveLength(1)
  })
})

describe('createLiffService — LiffApp', () => {
  it('rejects non-https endpoint URL', async () => {
    const mockDb = createMockDb()
    const svc = createLiffService({ db: mockDb as any })
    await expect(
      svc.createLiffApp({
        loginChannelId: 'chan-1',
        channelId: 'abc',
        viewType: 'full',
        endpointUrl: 'http://example.com',
      }),
    ).rejects.toThrow('endpointUrl must use HTTPS')
  })

  it('rejects if login channel already has 30 LIFF apps', async () => {
    const mockDb = createMockDb()
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(Array.from({ length: 30 }, (_, i) => ({ id: `app-${i}` }))),
        }),
      }),
    })
    const svc = createLiffService({ db: mockDb as any })
    await expect(
      svc.createLiffApp({
        loginChannelId: 'chan-1',
        channelId: 'abc',
        viewType: 'full',
        endpointUrl: 'https://example.com',
      }),
    ).rejects.toThrow('maximum 30 LIFF apps')
  })
})
