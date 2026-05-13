import { getRawWhere } from 'on-zero'
import { describe, expect, it, vi } from 'vitest'
import {
  managerOwnedOaChatFilterPermission,
  mutate as filterMutate,
} from '../models/oaChatFilter'
import type { AuthData } from '../types'
import type { Where } from 'on-zero'

type RecordedRelation = {
  calls: unknown[]
  where: (field: string, value: unknown) => RecordedRelation
  whereExists: (
    relation: string,
    cb: (q: RecordedRelation) => unknown,
  ) => RecordedRelation
}

function recordPermission(permission: Where) {
  const makeRelation = (): RecordedRelation => {
    const calls: unknown[] = []
    return {
      calls,
      where(field: string, value: unknown) {
        calls.push(['where', field, value])
        return this
      },
      whereExists(relation: string, cb: (q: RecordedRelation) => unknown) {
        const child = makeRelation()
        cb(child)
        calls.push(['whereExists', relation, child.calls])
        return this
      },
    }
  }

  const eb = {
    cmp(field: string, value: unknown) {
      return ['cmp', field, value]
    },
    exists(relation: string, cb: (q: RecordedRelation) => unknown) {
      const child = makeRelation()
      cb(child)
      return ['exists', relation, child.calls]
    },
  }

  const raw = getRawWhere(permission)
  const auth: AuthData = { id: 'manager-1', role: undefined }
  return JSON.stringify(raw?.(eb as any, auth))
}

function makeTx(rows: Record<string, any[]> = {}) {
  const makeQuery = (data: any[], filters: [string, unknown][] = []): any => {
    return {
      where: vi.fn((field: string, value: unknown) =>
        makeQuery(data, [...filters, [field, value]]),
      ),
      run: vi
        .fn()
        .mockResolvedValue(
          data.filter((row) => filters.every(([field, value]) => row[field] === value)),
        ),
    }
  }

  const query: Record<string, any> = {}
  for (const [table, data] of Object.entries(rows)) {
    query[table] = makeQuery(data)
  }
  return {
    query,
    mutate: {
      oaChatFilter: {
        insert: vi.fn().mockResolvedValue(undefined),
        update: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined),
      },
    },
  }
}

const authData: AuthData = { id: 'manager-1', role: undefined }

describe('oaChatFilter permissions', () => {
  it('requires OA provider ownership', () => {
    const permission = recordPermission(managerOwnedOaChatFilterPermission)
    expect(permission).toContain('"ownerId","manager-1"')
    expect(permission).not.toContain('"userId","manager-1"')
  })
})

describe('create filter', () => {
  it('rejects unauthenticated user', async () => {
    const tx = makeTx()
    await expect(
      (filterMutate as any).create(
        { authData: null, tx },
        {
          id: 'filter-1',
          oaId: 'oa-1',
          name: 'VIP',
          matchMode: 'any',
          tagIds: '["tag-1"]',
          sortOrder: 0,
          createdAt: 1000,
          updatedAt: 1000,
        },
      ),
    ).rejects.toThrow('Unauthorized')
  })

  it('rejects non-owner of the OA', async () => {
    const tx = makeTx({
      officialAccount: [{ id: 'oa-1', providerId: 'prov-1' }],
      oaProvider: [{ id: 'prov-1', ownerId: 'other-manager' }],
    })
    await expect(
      (filterMutate as any).create(
        { authData, tx },
        {
          id: 'filter-1',
          oaId: 'oa-1',
          name: 'VIP',
          matchMode: 'any',
          tagIds: '["tag-1"]',
          sortOrder: 0,
          createdAt: 1000,
          updatedAt: 1000,
        },
      ),
    ).rejects.toThrow('Unauthorized')
  })

  it('creates filter with trimmed name', async () => {
    const tx = makeTx({
      officialAccount: [{ id: 'oa-1', providerId: 'prov-1' }],
      oaProvider: [{ id: 'prov-1', ownerId: 'manager-1' }],
      oaChatFilter: [],
    })
    await (filterMutate as any).create(
      { authData, tx },
      {
        id: 'filter-1',
        oaId: 'oa-1',
        name: '  VIP Customers  ',
        matchMode: 'all',
        tagIds: '["tag-1","tag-2"]',
        sortOrder: 0,
        createdAt: 1000,
        updatedAt: 1000,
      },
    )
    expect(tx.mutate.oaChatFilter.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'VIP Customers',
        matchMode: 'all',
        tagIds: '["tag-1","tag-2"]',
      }),
    )
  })

  it('rejects blank filter name', async () => {
    const tx = makeTx({
      officialAccount: [{ id: 'oa-1', providerId: 'prov-1' }],
      oaProvider: [{ id: 'prov-1', ownerId: 'manager-1' }],
      oaChatFilter: [],
    })
    await expect(
      (filterMutate as any).create(
        { authData, tx },
        {
          id: 'filter-1',
          oaId: 'oa-1',
          name: '   ',
          matchMode: 'any',
          tagIds: '[]',
          sortOrder: 0,
          createdAt: 1000,
          updatedAt: 1000,
        },
      ),
    ).rejects.toThrow('Filter name is required')
  })

  it('rejects invalid matchMode', async () => {
    const tx = makeTx({
      officialAccount: [{ id: 'oa-1', providerId: 'prov-1' }],
      oaProvider: [{ id: 'prov-1', ownerId: 'manager-1' }],
      oaChatFilter: [],
    })
    await expect(
      (filterMutate as any).create(
        { authData, tx },
        {
          id: 'filter-1',
          oaId: 'oa-1',
          name: 'Test',
          matchMode: 'invalid',
          tagIds: '[]',
          sortOrder: 0,
          createdAt: 1000,
          updatedAt: 1000,
        },
      ),
    ).rejects.toThrow('matchMode must be "all" or "any"')
  })

  it('rejects invalid tagIds JSON', async () => {
    const tx = makeTx({
      officialAccount: [{ id: 'oa-1', providerId: 'prov-1' }],
      oaProvider: [{ id: 'prov-1', ownerId: 'manager-1' }],
      oaChatFilter: [],
    })
    await expect(
      (filterMutate as any).create(
        { authData, tx },
        {
          id: 'filter-1',
          oaId: 'oa-1',
          name: 'Test',
          matchMode: 'any',
          tagIds: 'not-json',
          sortOrder: 0,
          createdAt: 1000,
          updatedAt: 1000,
        },
      ),
    ).rejects.toThrow('tagIds must be a JSON array')
  })

  it('enforces max 20 filters per OA', async () => {
    const existingFilters = Array.from({ length: 20 }, (_, i) => ({
      id: `filter-${i}`,
      oaId: 'oa-1',
    }))
    const tx = makeTx({
      officialAccount: [{ id: 'oa-1', providerId: 'prov-1' }],
      oaProvider: [{ id: 'prov-1', ownerId: 'manager-1' }],
      oaChatFilter: existingFilters,
    })
    await expect(
      (filterMutate as any).create(
        { authData, tx },
        {
          id: 'filter-new',
          oaId: 'oa-1',
          name: 'Too Many',
          matchMode: 'any',
          tagIds: '[]',
          sortOrder: 20,
          createdAt: 1000,
          updatedAt: 1000,
        },
      ),
    ).rejects.toThrow('Cannot create more than 20 filters')
  })
})

describe('update filter', () => {
  it('updates filter name and tags', async () => {
    const tx = makeTx({
      officialAccount: [{ id: 'oa-1', providerId: 'prov-1' }],
      oaProvider: [{ id: 'prov-1', ownerId: 'manager-1' }],
    })
    await (filterMutate as any).update(
      { authData, tx, can: vi.fn().mockResolvedValue(undefined) },
      {
        id: 'filter-1',
        oaId: 'oa-1',
        name: '  Updated  ',
        matchMode: 'all',
        tagIds: '["tag-3"]',
        sortOrder: 1,
        updatedAt: 2000,
      },
    )
    expect(tx.mutate.oaChatFilter.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'filter-1',
        name: 'Updated',
        matchMode: 'all',
        tagIds: '["tag-3"]',
      }),
    )
  })

  it('rejects non-owner update', async () => {
    const tx = makeTx({
      officialAccount: [{ id: 'oa-1', providerId: 'prov-1' }],
      oaProvider: [{ id: 'prov-1', ownerId: 'other-manager' }],
    })
    await expect(
      (filterMutate as any).update(
        { authData, tx, can: vi.fn().mockResolvedValue(undefined) },
        {
          id: 'filter-1',
          oaId: 'oa-1',
          name: 'Updated',
          matchMode: 'any',
          tagIds: '[]',
          sortOrder: 0,
          updatedAt: 2000,
        },
      ),
    ).rejects.toThrow('Unauthorized')
  })
})

describe('delete filter', () => {
  it('deletes filter', async () => {
    const tx = makeTx({
      officialAccount: [{ id: 'oa-1', providerId: 'prov-1' }],
      oaProvider: [{ id: 'prov-1', ownerId: 'manager-1' }],
    })
    await (filterMutate as any).deleteFilter(
      { authData, tx },
      { id: 'filter-1', oaId: 'oa-1' },
    )
    expect(tx.mutate.oaChatFilter.delete).toHaveBeenCalledWith({ id: 'filter-1' })
  })

  it('rejects non-owner deletion', async () => {
    const tx = makeTx({
      officialAccount: [{ id: 'oa-1', providerId: 'prov-1' }],
      oaProvider: [{ id: 'prov-1', ownerId: 'other-manager' }],
    })
    await expect(
      (filterMutate as any).deleteFilter(
        { authData, tx },
        { id: 'filter-1', oaId: 'oa-1' },
      ),
    ).rejects.toThrow('Unauthorized')
  })
})
