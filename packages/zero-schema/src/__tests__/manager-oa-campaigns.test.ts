import { getRawWhere } from 'on-zero'
import { describe, expect, it, vi } from 'vitest'
import {
  managerOwnedOaAudienceFilterPermission,
  mutate as audienceFilterMutate,
} from '../models/oaAudienceFilter'
import * as campaignModel from '../models/oaCampaign'
import {
  managerOwnedOaCampaignPermission,
  mutate as campaignMutate,
} from '../models/oaCampaign'
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

function makeQuery(data: any[], filters: [string, unknown][] = []): any {
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

function makeTx(rows: Record<string, any[]> = {}) {
  const query: Record<string, any> = {}
  for (const [table, data] of Object.entries(rows)) {
    query[table] = makeQuery(data)
  }

  return {
    query,
    mutate: {
      oaAudienceFilter: {
        insert: vi.fn().mockResolvedValue(undefined),
        update: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined),
      },
      oaCampaign: {
        insert: vi.fn().mockResolvedValue(undefined),
        update: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined),
        upsert: vi.fn().mockResolvedValue(undefined),
      },
    },
  }
}

const authData: AuthData = { id: 'manager-1', role: undefined }
const validQuery = { 'friendship.status': 'friend' }

describe('manager OA campaign permissions', () => {
  it('requires OA provider ownership for audience filters', () => {
    const permission = recordPermission(managerOwnedOaAudienceFilterPermission)
    expect(permission).toContain('"ownerId","manager-1"')
    expect(permission).not.toContain('"userId","manager-1"')
  })

  it('requires OA provider ownership for campaigns', () => {
    const permission = recordPermission(managerOwnedOaCampaignPermission)
    expect(permission).toContain('"ownerId","manager-1"')
    expect(permission).not.toContain('"userId","manager-1"')
  })
})

describe('create audience filter', () => {
  it('rejects unauthenticated users', async () => {
    const tx = makeTx()
    await expect(
      (audienceFilterMutate as any).create(
        { authData: null, tx },
        {
          id: 'filter-1',
          oaId: 'oa-1',
          name: 'VIP',
          queryJson: validQuery,
          createdAt: 1000,
          updatedAt: 1000,
        },
      ),
    ).rejects.toThrow('Unauthorized')
  })

  it('rejects non-owners', async () => {
    const tx = makeTx({
      officialAccount: [{ id: 'oa-1', providerId: 'provider-1' }],
      oaProvider: [{ id: 'provider-1', ownerId: 'other-manager' }],
      oaAudienceFilter: [],
    })
    await expect(
      (audienceFilterMutate as any).create(
        { authData, tx },
        {
          id: 'filter-1',
          oaId: 'oa-1',
          name: 'VIP',
          queryJson: validQuery,
          createdAt: 1000,
          updatedAt: 1000,
        },
      ),
    ).rejects.toThrow('Unauthorized')
  })

  it('trims name, validates query, and sets server-owned fields', async () => {
    const tx = makeTx({
      officialAccount: [{ id: 'oa-1', providerId: 'provider-1' }],
      oaProvider: [{ id: 'provider-1', ownerId: 'manager-1' }],
      oaAudienceFilter: [],
    })

    await (audienceFilterMutate as any).create(
      { authData, tx },
      {
        id: 'filter-1',
        oaId: 'oa-1',
        name: '  VIP Friends  ',
        queryJson: validQuery,
        createdAt: 1000,
        updatedAt: 1000,
      },
    )

    expect(tx.mutate.oaAudienceFilter.insert).toHaveBeenCalledWith({
      id: 'filter-1',
      oaId: 'oa-1',
      name: 'VIP Friends',
      queryVersion: 1,
      queryJson: validQuery,
      createdByManagerId: 'manager-1',
      createdAt: 1000,
      updatedAt: 1000,
    })
  })

  it('rejects invalid audience queries', async () => {
    const tx = makeTx({
      officialAccount: [{ id: 'oa-1', providerId: 'provider-1' }],
      oaProvider: [{ id: 'provider-1', ownerId: 'manager-1' }],
      oaAudienceFilter: [],
    })

    await expect(
      (audienceFilterMutate as any).create(
        { authData, tx },
        {
          id: 'filter-1',
          oaId: 'oa-1',
          name: 'Invalid',
          queryJson: { displayName: { $regex: 'bad' } },
          createdAt: 1000,
          updatedAt: 1000,
        },
      ),
    ).rejects.toThrow('Unsupported operator for displayName: $regex')
  })

  it('enforces max 50 audience filters per OA', async () => {
    const existingFilters = Array.from({ length: 50 }, (_, i) => ({
      id: `filter-${i}`,
      oaId: 'oa-1',
      name: `Filter ${i}`,
    }))
    const tx = makeTx({
      officialAccount: [{ id: 'oa-1', providerId: 'provider-1' }],
      oaProvider: [{ id: 'provider-1', ownerId: 'manager-1' }],
      oaAudienceFilter: existingFilters,
    })

    await expect(
      (audienceFilterMutate as any).create(
        { authData, tx },
        {
          id: 'filter-new',
          oaId: 'oa-1',
          name: 'Too Many',
          queryJson: validQuery,
          createdAt: 1000,
          updatedAt: 1000,
        },
      ),
    ).rejects.toThrow('Cannot create more than 50 audience filters')
  })

  it('rejects duplicate filter names', async () => {
    const tx = makeTx({
      officialAccount: [{ id: 'oa-1', providerId: 'provider-1' }],
      oaProvider: [{ id: 'provider-1', ownerId: 'manager-1' }],
      oaAudienceFilter: [{ id: 'filter-existing', oaId: 'oa-1', name: 'VIP' }],
    })

    await expect(
      (audienceFilterMutate as any).create(
        { authData, tx },
        {
          id: 'filter-new',
          oaId: 'oa-1',
          name: 'VIP',
          queryJson: validQuery,
          createdAt: 1000,
          updatedAt: 1000,
        },
      ),
    ).rejects.toThrow('Filter name already exists')
  })
})

describe('update audience filter', () => {
  it('updates trimmed name and query', async () => {
    const query = { 'tags.ids': { $all: ['vip'] } }
    const tx = makeTx({
      officialAccount: [{ id: 'oa-1', providerId: 'provider-1' }],
      oaProvider: [{ id: 'provider-1', ownerId: 'manager-1' }],
      oaAudienceFilter: [{ id: 'filter-1', oaId: 'oa-1', name: 'Old' }],
    })

    await (audienceFilterMutate as any).update(
      { authData, tx, can: vi.fn().mockResolvedValue(undefined) },
      {
        id: 'filter-1',
        oaId: 'oa-1',
        name: '  Updated  ',
        queryJson: query,
        updatedAt: 2000,
      },
    )

    expect(tx.mutate.oaAudienceFilter.update).toHaveBeenCalledWith({
      id: 'filter-1',
      name: 'Updated',
      queryJson: query,
      updatedAt: 2000,
    })
  })

  it('rejects duplicate names excluding the current filter', async () => {
    const tx = makeTx({
      officialAccount: [{ id: 'oa-1', providerId: 'provider-1' }],
      oaProvider: [{ id: 'provider-1', ownerId: 'manager-1' }],
      oaAudienceFilter: [
        { id: 'filter-1', oaId: 'oa-1', name: 'Old' },
        { id: 'filter-2', oaId: 'oa-1', name: 'VIP' },
      ],
    })

    await expect(
      (audienceFilterMutate as any).update(
        { authData, tx, can: vi.fn().mockResolvedValue(undefined) },
        {
          id: 'filter-1',
          oaId: 'oa-1',
          name: 'VIP',
          queryJson: validQuery,
          updatedAt: 2000,
        },
      ),
    ).rejects.toThrow('Filter name already exists')
  })

  it('rejects filter/OA mismatches', async () => {
    const tx = makeTx({
      officialAccount: [{ id: 'oa-1', providerId: 'provider-1' }],
      oaProvider: [{ id: 'provider-1', ownerId: 'manager-1' }],
      oaAudienceFilter: [{ id: 'filter-1', oaId: 'oa-2', name: 'Wrong OA' }],
    })

    await expect(
      (audienceFilterMutate as any).update(
        { authData, tx, can: vi.fn().mockResolvedValue(undefined) },
        {
          id: 'filter-1',
          oaId: 'oa-1',
          name: 'VIP',
          queryJson: validQuery,
          updatedAt: 2000,
        },
      ),
    ).rejects.toThrow('Unauthorized')
  })
})

describe('delete audience filter', () => {
  it('rejects filter/OA mismatches', async () => {
    const tx = makeTx({
      officialAccount: [{ id: 'oa-1', providerId: 'provider-1' }],
      oaProvider: [{ id: 'provider-1', ownerId: 'manager-1' }],
      oaAudienceFilter: [{ id: 'filter-1', oaId: 'oa-2', name: 'Wrong OA' }],
    })

    await expect(
      (audienceFilterMutate as any).deleteFilter(
        { authData, tx },
        { id: 'filter-1', oaId: 'oa-1' },
      ),
    ).rejects.toThrow('Unauthorized')
  })

  it('deletes matching filters', async () => {
    const tx = makeTx({
      officialAccount: [{ id: 'oa-1', providerId: 'provider-1' }],
      oaProvider: [{ id: 'provider-1', ownerId: 'manager-1' }],
      oaAudienceFilter: [{ id: 'filter-1', oaId: 'oa-1', name: 'VIP' }],
    })

    await (audienceFilterMutate as any).deleteFilter(
      { authData, tx },
      { id: 'filter-1', oaId: 'oa-1' },
    )

    expect(tx.mutate.oaAudienceFilter.delete).toHaveBeenCalledWith({ id: 'filter-1' })
  })
})

describe('raw audience filter mutations', () => {
  it('rejects raw insert, upsert, and delete actions', async () => {
    const tx = makeTx()
    const ctx = { authData, tx, can: vi.fn().mockResolvedValue(undefined) }

    await expect((audienceFilterMutate as any).insert(ctx, {})).rejects.toThrow(
      'Use audience filter actions',
    )
    await expect((audienceFilterMutate as any).upsert(ctx, {})).rejects.toThrow(
      'Use audience filter actions',
    )
    await expect(
      (audienceFilterMutate as any).delete(ctx, { id: 'filter-1' }),
    ).rejects.toThrow('Use audience filter actions')
  })
})

describe('raw campaign mutations', () => {
  it('rejects raw insert, upsert, update, and delete actions', async () => {
    const tx = makeTx()
    const ctx = { authData, tx, can: vi.fn().mockResolvedValue(undefined) }

    await expect((campaignMutate as any).insert(ctx, {})).rejects.toThrow(
      'Use campaign service actions',
    )
    await expect((campaignMutate as any).upsert(ctx, {})).rejects.toThrow(
      'Use campaign service actions',
    )
    await expect(
      (campaignMutate as any).update(ctx, { id: 'campaign-1' }),
    ).rejects.toThrow('Use campaign service actions')
    await expect(
      (campaignMutate as any).delete(ctx, { id: 'campaign-1' }),
    ).rejects.toThrow('Use campaign service actions')
  })
})

describe('rich campaign schema', () => {
  it('models rich campaign payload fields and deprecated messageText', () => {
    const columns = (campaignModel.schema as any).schema.columns
    expect(columns.messagePayloadJson).toBeTruthy()
    expect(columns.messageSummary).toBeTruthy()
    expect(columns.messageText).toBeTruthy()
  })
})
