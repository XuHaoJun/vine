import { describe, expect, it, vi } from 'vitest'
import { createOAService } from './oa'

function createMockDb() {
  return {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'test-id' }]),
        onConflictDoUpdate: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'test-id' }]),
        }),
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

describe('createOAService — RichMenu', () => {
  it('creates a rich menu with generated ID', async () => {
    const mockDb = createMockDb()
    mockDb.insert.mockReturnValueOnce({
      values: vi.fn().mockReturnValueOnce({
        returning: vi.fn().mockResolvedValue([
          {
            id: 'rm-uuid',
            oaId: 'oa-1',
            richMenuId: 'richmenu-abc123',
            name: 'Test Menu',
            chatBarText: 'Open',
            selected: 'false',
            sizeWidth: '2500',
            sizeHeight: '1686',
            areas: '[]',
            hasImage: 'false',
          },
        ]),
      }),
    })

    const oa = createOAService({ db: mockDb as any, database: {} as any })
    const result = await oa.createRichMenu({
      oaId: 'oa-1',
      name: 'Test Menu',
      chatBarText: 'Open',
      selected: false,
      sizeWidth: 2500,
      sizeHeight: 1686,
      areas: [],
    })

    expect(mockDb.insert).toHaveBeenCalled()
    expect(result.richMenuId).toMatch(/^richmenu-/)
    expect(result.name).toBe('Test Menu')
    expect(result.hasImage).toBe('false')
  })

  it('creates a rich menu with selected=true', async () => {
    const mockDb = createMockDb()
    mockDb.insert.mockReturnValueOnce({
      values: vi.fn().mockReturnValueOnce({
        returning: vi.fn().mockResolvedValue([
          {
            id: 'rm-uuid',
            oaId: 'oa-1',
            richMenuId: 'richmenu-abc',
            name: 'Auto-open Menu',
            chatBarText: 'Tap',
            selected: 'true',
            sizeWidth: '2500',
            sizeHeight: '1686',
            areas: '[]',
            hasImage: 'false',
          },
        ]),
      }),
    })

    const oa = createOAService({ db: mockDb as any, database: {} as any })
    const result = await oa.createRichMenu({
      oaId: 'oa-1',
      name: 'Auto-open Menu',
      chatBarText: 'Tap',
      selected: true,
      sizeWidth: 2500,
      sizeHeight: 1686,
      areas: [],
    })

    expect(result.selected).toBe('true')
  })

  it('gets a rich menu by ID', async () => {
    const mockDb = createMockDb()
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([
            {
              id: 'rm-1',
              oaId: 'oa-1',
              richMenuId: 'richmenu-test',
              name: 'Test',
              chatBarText: 'Open',
            },
          ]),
        }),
      }),
    })

    const oa = createOAService({ db: mockDb as any, database: {} as any })
    const result = await oa.getRichMenu('oa-1', 'richmenu-test')

    expect(result).not.toBeNull()
    expect(result!.richMenuId).toBe('richmenu-test')
  })

  it('returns null for non-existent rich menu', async () => {
    const mockDb = createMockDb()

    const oa = createOAService({ db: mockDb as any, database: {} as any })
    const result = await oa.getRichMenu('oa-1', 'richmenu-notexist')

    expect(result).toBeNull()
  })

  it('gets rich menu list for an OA', async () => {
    const mockDb = createMockDb()
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([
          { id: 'rm-1', oaId: 'oa-1', richMenuId: 'richmenu-a' },
          { id: 'rm-2', oaId: 'oa-1', richMenuId: 'richmenu-b' },
        ]),
      }),
    })

    const oa = createOAService({ db: mockDb as any, database: {} as any })
    const result = await oa.getRichMenuList('oa-1')

    expect(result).toHaveLength(2)
  })

  it('deletes a rich menu', async () => {
    const mockDb = createMockDb()

    const oa = createOAService({ db: mockDb as any, database: {} as any })
    await oa.deleteRichMenu('oa-1', 'richmenu-test')

    expect(mockDb.delete).toHaveBeenCalled()
  })

  it('sets rich menu image flag', async () => {
    const mockDb = createMockDb()

    const oa = createOAService({ db: mockDb as any, database: {} as any })
    await oa.setRichMenuImage('oa-1', 'richmenu-test', true)

    expect(mockDb.update).toHaveBeenCalled()
  })
})

describe('createOAService — DefaultRichMenu', () => {
  it('sets default rich menu', async () => {
    const mockDb = createMockDb()

    const oa = createOAService({ db: mockDb as any, database: {} as any })
    await oa.setDefaultRichMenu('oa-1', 'richmenu-default')

    expect(mockDb.insert).toHaveBeenCalled()
  })

  it('gets default rich menu', async () => {
    const mockDb = createMockDb()
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi
            .fn()
            .mockResolvedValue([{ oaId: 'oa-1', richMenuId: 'richmenu-default' }]),
        }),
      }),
    })

    const oa = createOAService({ db: mockDb as any, database: {} as any })
    const result = await oa.getDefaultRichMenu('oa-1')

    expect(result).not.toBeNull()
    expect(result!.richMenuId).toBe('richmenu-default')
  })

  it('returns null when no default rich menu', async () => {
    const mockDb = createMockDb()

    const oa = createOAService({ db: mockDb as any, database: {} as any })
    const result = await oa.getDefaultRichMenu('oa-1')

    expect(result).toBeNull()
  })

  it('clears default rich menu', async () => {
    const mockDb = createMockDb()

    const oa = createOAService({ db: mockDb as any, database: {} as any })
    await oa.clearDefaultRichMenu('oa-1')

    expect(mockDb.delete).toHaveBeenCalled()
  })
})

describe('createOAService — RichMenuUserLink', () => {
  it('links a rich menu to a user', async () => {
    const mockDb = createMockDb()

    const oa = createOAService({ db: mockDb as any, database: {} as any })
    await oa.linkRichMenuToUser('oa-1', 'U1234567890abcdef', 'richmenu-test')

    expect(mockDb.insert).toHaveBeenCalled()
  })

  it('unlinks a rich menu from a user', async () => {
    const mockDb = createMockDb()

    const oa = createOAService({ db: mockDb as any, database: {} as any })
    await oa.unlinkRichMenuFromUser('oa-1', 'U1234567890abcdef')

    expect(mockDb.delete).toHaveBeenCalled()
  })

  it('gets rich menu ID of a user', async () => {
    const mockDb = createMockDb()
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi
            .fn()
            .mockResolvedValue([
              { oaId: 'oa-1', userId: 'U1234567890abcdef', richMenuId: 'richmenu-test' },
            ]),
        }),
      }),
    })

    const oa = createOAService({ db: mockDb as any, database: {} as any })
    const result = await oa.getRichMenuIdOfUser('oa-1', 'U1234567890abcdef')

    expect(result).not.toBeNull()
    expect(result!.richMenuId).toBe('richmenu-test')
  })

  it('returns null when user has no rich menu', async () => {
    const mockDb = createMockDb()

    const oa = createOAService({ db: mockDb as any, database: {} as any })
    const result = await oa.getRichMenuIdOfUser(
      'oa-1',
      'U00000000000000000000000000000001',
    )

    expect(result).toBeNull()
  })
})

describe('createOAService — RichMenuAlias', () => {
  it('creates a rich menu alias', async () => {
    const mockDb = createMockDb()
    mockDb.insert.mockReturnValueOnce({
      values: vi.fn().mockReturnValueOnce({
        returning: vi.fn().mockResolvedValue([
          {
            id: 'alias-1',
            oaId: 'oa-1',
            richMenuAliasId: 'richmenu-alias-a',
            richMenuId: 'richmenu-test',
          },
        ]),
      }),
    })

    const oa = createOAService({ db: mockDb as any, database: {} as any })
    const result = await oa.createRichMenuAlias({
      oaId: 'oa-1',
      richMenuAliasId: 'richmenu-alias-a',
      richMenuId: 'richmenu-test',
    })

    expect(result.richMenuAliasId).toBe('richmenu-alias-a')
    expect(result.richMenuId).toBe('richmenu-test')
  })

  it('updates a rich menu alias', async () => {
    const mockDb = createMockDb()
    mockDb.update.mockReturnValueOnce({
      set: vi.fn().mockReturnValueOnce({
        where: vi.fn().mockReturnValueOnce({
          returning: vi.fn().mockResolvedValue([
            {
              id: 'alias-1',
              oaId: 'oa-1',
              richMenuAliasId: 'richmenu-alias-a',
              richMenuId: 'richmenu-new',
            },
          ]),
        }),
      }),
    })

    const oa = createOAService({ db: mockDb as any, database: {} as any })
    const result = await oa.updateRichMenuAlias({
      oaId: 'oa-1',
      richMenuAliasId: 'richmenu-alias-a',
      richMenuId: 'richmenu-new',
    })

    expect(result).not.toBeNull()
    expect(result!.richMenuId).toBe('richmenu-new')
  })

  it('deletes a rich menu alias', async () => {
    const mockDb = createMockDb()

    const oa = createOAService({ db: mockDb as any, database: {} as any })
    await oa.deleteRichMenuAlias('oa-1', 'richmenu-alias-a')

    expect(mockDb.delete).toHaveBeenCalled()
  })

  it('gets a rich menu alias by ID', async () => {
    const mockDb = createMockDb()
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([
            {
              id: 'alias-1',
              oaId: 'oa-1',
              richMenuAliasId: 'richmenu-alias-a',
              richMenuId: 'richmenu-test',
            },
          ]),
        }),
      }),
    })

    const oa = createOAService({ db: mockDb as any, database: {} as any })
    const result = await oa.getRichMenuAlias('oa-1', 'richmenu-alias-a')

    expect(result).not.toBeNull()
    expect(result!.richMenuAliasId).toBe('richmenu-alias-a')
  })

  it('returns null for non-existent alias', async () => {
    const mockDb = createMockDb()

    const oa = createOAService({ db: mockDb as any, database: {} as any })
    const result = await oa.getRichMenuAlias('oa-1', 'richmenu-alias-notexist')

    expect(result).toBeNull()
  })

  it('gets rich menu alias list', async () => {
    const mockDb = createMockDb()
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([
          { id: 'a1', richMenuAliasId: 'alias-a', richMenuId: 'rm-1' },
          { id: 'a2', richMenuAliasId: 'alias-b', richMenuId: 'rm-2' },
        ]),
      }),
    })

    const oa = createOAService({ db: mockDb as any, database: {} as any })
    const result = await oa.getRichMenuAliasList('oa-1')

    expect(result).toHaveLength(2)
  })
})
