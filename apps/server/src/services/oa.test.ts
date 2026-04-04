import { describe, expect, it, vi } from 'vitest'
import { createOAService } from './oa'

function createMockDb() {
  return {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'test-provider-id' }]),
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

describe('createOAService — Provider', () => {
  it('creates a provider with owner', async () => {
    const mockDb = createMockDb()
    mockDb.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{
          id: 'test-provider-id',
          name: 'Test Provider',
          ownerId: 'user-123',
          createdAt: '2026-04-04T00:00:00Z',
          updatedAt: '2026-04-04T00:00:00Z',
        }]),
      }),
    })

    const oa = createOAService({ db: mockDb as any, database: {} as any })

    const result = await oa.createProvider({
      name: 'Test Provider',
      ownerId: 'user-123',
    })

    expect(mockDb.insert).toHaveBeenCalled()
    expect(result.name).toBe('Test Provider')
    expect(result.ownerId).toBe('user-123')
  })

  it('gets a provider by id', async () => {
    const mockDb = createMockDb()
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{
            id: 'provider-1',
            name: 'Test',
            ownerId: 'user-123',
            createdAt: '2026-04-04T00:00:00Z',
            updatedAt: '2026-04-04T00:00:00Z',
          }]),
        }),
      }),
    })

    const oa = createOAService({ db: mockDb as any, database: {} as any })
    const result = await oa.getProvider('provider-1')

    expect(result).toBeDefined()
    expect(result!.id).toBe('provider-1')
  })

  it('returns null for non-existent provider', async () => {
    const mockDb = createMockDb()
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    })

    const oa = createOAService({ db: mockDb as any, database: {} as any })
    const result = await oa.getProvider('non-existent')

    expect(result).toBeNull()
  })

  it('updates provider name', async () => {
    const mockDb = createMockDb()
    mockDb.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{
            id: 'provider-1',
            name: 'New Name',
            ownerId: 'user-123',
            createdAt: '2026-04-04T00:00:00Z',
            updatedAt: '2026-04-04T00:00:00Z',
          }]),
        }),
      }),
    })

    const oa = createOAService({ db: mockDb as any, database: {} as any })

    await oa.updateProvider('provider-1', { name: 'New Name' })

    expect(mockDb.update).toHaveBeenCalled()
  })

  it('deletes a provider', async () => {
    const mockDb = createMockDb()
    const oa = createOAService({ db: mockDb as any, database: {} as any })

    await oa.deleteProvider('provider-1')

    expect(mockDb.delete).toHaveBeenCalled()
  })
})
