import { getRawWhere } from 'on-zero'
import { describe, expect, it, vi } from 'vitest'
import {
  managerOwnedOaContactProfilePermission,
  mutate as profileMutate,
} from '../models/oaContactProfile'
import {
  managerOwnedOaContactTagPermission,
  mutate as tagMutate,
} from '../models/oaContactTag'
import {
  managerOwnedOaContactTagAssignmentPermission,
  mutate as assignmentMutate,
} from '../models/oaContactTagAssignment'
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
      oaContactProfile: {
        insert: vi.fn().mockResolvedValue(undefined),
        update: vi.fn().mockResolvedValue(undefined),
      },
      oaContactTag: {
        insert: vi.fn().mockResolvedValue(undefined),
        update: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined),
      },
      oaContactTagAssignment: {
        insert: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined),
      },
    },
  }
}

const authData: AuthData = { id: 'manager-1', role: undefined }

describe('manager OA CRM permissions', () => {
  it('oaContactProfile requires OA provider ownership', () => {
    const permission = recordPermission(managerOwnedOaContactProfilePermission)
    expect(permission).toContain('"ownerId","manager-1"')
    expect(permission).not.toContain('"userId","manager-1"')
  })

  it('oaContactTag requires OA provider ownership', () => {
    const permission = recordPermission(managerOwnedOaContactTagPermission)
    expect(permission).toContain('"ownerId","manager-1"')
    expect(permission).not.toContain('"userId","manager-1"')
  })

  it('oaContactTagAssignment requires OA provider ownership', () => {
    const permission = recordPermission(managerOwnedOaContactTagAssignmentPermission)
    expect(permission).toContain('"ownerId","manager-1"')
    expect(permission).not.toContain('"userId","manager-1"')
  })
})

describe('saveNote', () => {
  it('rejects unauthenticated user', async () => {
    const tx = makeTx()
    await expect(
      (profileMutate as any).saveNote(
        { authData: null, tx },
        {
          id: 'profile-1',
          oaId: 'oa-1',
          userId: 'user-1',
          noteText: 'hello',
          updatedAt: '2026-01-01',
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
      (profileMutate as any).saveNote(
        { authData, tx },
        {
          id: 'profile-1',
          oaId: 'oa-1',
          userId: 'user-1',
          noteText: 'hello',
          updatedAt: '2026-01-01',
        },
      ),
    ).rejects.toThrow('Unauthorized')
  })

  it('rejects non-friend contact', async () => {
    const tx = makeTx({
      officialAccount: [{ id: 'oa-1', providerId: 'prov-1' }],
      oaProvider: [{ id: 'prov-1', ownerId: 'manager-1' }],
      oaFriendship: [],
    })
    await expect(
      (profileMutate as any).saveNote(
        { authData, tx },
        {
          id: 'profile-1',
          oaId: 'oa-1',
          userId: 'user-1',
          noteText: 'hello',
          updatedAt: '2026-01-01',
        },
      ),
    ).rejects.toThrow('Contact not found')
  })

  it('inserts new profile note when none exists', async () => {
    const tx = makeTx({
      officialAccount: [{ id: 'oa-1', providerId: 'prov-1' }],
      oaProvider: [{ id: 'prov-1', ownerId: 'manager-1' }],
      oaFriendship: [{ oaId: 'oa-1', userId: 'user-1', status: 'friend' }],
      oaContactProfile: [],
    })
    await (profileMutate as any).saveNote(
      { authData, tx },
      {
        id: 'profile-1',
        oaId: 'oa-1',
        userId: 'user-1',
        noteText: '  hello  ',
        updatedAt: '2026-01-01',
      },
    )
    expect(tx.mutate.oaContactProfile.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        oaId: 'oa-1',
        userId: 'user-1',
        id: 'profile-1',
        noteText: 'hello',
      }),
    )
  })

  it('updates existing profile note', async () => {
    const tx = makeTx({
      officialAccount: [{ id: 'oa-1', providerId: 'prov-1' }],
      oaProvider: [{ id: 'prov-1', ownerId: 'manager-1' }],
      oaFriendship: [{ oaId: 'oa-1', userId: 'user-1', status: 'friend' }],
      oaContactProfile: [
        { id: 'profile-1', oaId: 'oa-1', userId: 'user-1', noteText: 'old' },
      ],
    })
    await (profileMutate as any).saveNote(
      { authData, tx },
      {
        id: 'profile-new',
        oaId: 'oa-1',
        userId: 'user-1',
        noteText: '  updated  ',
        updatedAt: '2026-01-01',
      },
    )
    expect(tx.mutate.oaContactProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'profile-1',
        noteText: 'updated',
      }),
    )
  })
})

describe('tag mutations', () => {
  it('rejects unauthenticated create', async () => {
    const tx = makeTx()
    await expect(
      (tagMutate as any).create(
        { authData: null, tx },
        {
          id: 'tag-1',
          oaId: 'oa-1',
          name: 'VIP',
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
        },
      ),
    ).rejects.toThrow('Unauthorized')
  })

  it('rejects non-owner create', async () => {
    const tx = makeTx({
      officialAccount: [{ id: 'oa-1', providerId: 'prov-1' }],
      oaProvider: [{ id: 'prov-1', ownerId: 'other-manager' }],
    })
    await expect(
      (tagMutate as any).create(
        { authData, tx },
        {
          id: 'tag-1',
          oaId: 'oa-1',
          name: 'VIP',
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
        },
      ),
    ).rejects.toThrow('Unauthorized')
  })

  it('creates trimmed tag', async () => {
    const tx = makeTx({
      officialAccount: [{ id: 'oa-1', providerId: 'prov-1' }],
      oaProvider: [{ id: 'prov-1', ownerId: 'manager-1' }],
      oaContactTag: [],
    })
    await (tagMutate as any).create(
      { authData, tx },
      {
        id: 'tag-1',
        oaId: 'oa-1',
        name: '  VIP  ',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
    )
    expect(tx.mutate.oaContactTag.insert).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'VIP' }),
    )
  })

  it('rejects blank tag name', async () => {
    const tx = makeTx({
      officialAccount: [{ id: 'oa-1', providerId: 'prov-1' }],
      oaProvider: [{ id: 'prov-1', ownerId: 'manager-1' }],
    })
    await expect(
      (tagMutate as any).create(
        { authData, tx },
        {
          id: 'tag-1',
          oaId: 'oa-1',
          name: '   ',
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
        },
      ),
    ).rejects.toThrow('Tag name is required')
  })

  it('rejects duplicate tag name on create', async () => {
    const tx = makeTx({
      officialAccount: [{ id: 'oa-1', providerId: 'prov-1' }],
      oaProvider: [{ id: 'prov-1', ownerId: 'manager-1' }],
      oaContactTag: [{ id: 'existing', oaId: 'oa-1', name: 'VIP' }],
    })
    await expect(
      (tagMutate as any).create(
        { authData, tx },
        {
          id: 'tag-1',
          oaId: 'oa-1',
          name: 'VIP',
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
        },
      ),
    ).rejects.toThrow('Tag name already exists')
  })

  it('rejects duplicate tag name on rename', async () => {
    const tx = makeTx({
      officialAccount: [{ id: 'oa-1', providerId: 'prov-1' }],
      oaProvider: [{ id: 'prov-1', ownerId: 'manager-1' }],
      oaContactTag: [
        { id: 'tag-1', oaId: 'oa-1', name: 'Old' },
        { id: 'tag-2', oaId: 'oa-1', name: 'VIP' },
      ],
    })
    await expect(
      (tagMutate as any).rename(
        { authData, tx },
        { id: 'tag-1', oaId: 'oa-1', name: 'VIP', updatedAt: '2026-01-01' },
      ),
    ).rejects.toThrow('Tag name already exists')
  })

  it('rejects unauthorized rename', async () => {
    const tx = makeTx({
      officialAccount: [{ id: 'oa-1', providerId: 'prov-1' }],
      oaProvider: [{ id: 'prov-1', ownerId: 'other-manager' }],
    })
    await expect(
      (tagMutate as any).rename(
        { authData, tx },
        { id: 'tag-1', oaId: 'oa-1', name: 'New', updatedAt: '2026-01-01' },
      ),
    ).rejects.toThrow('Unauthorized')
  })

  it('rejects unauthorized deletion', async () => {
    const tx = makeTx({
      officialAccount: [{ id: 'oa-1', providerId: 'prov-1' }],
      oaProvider: [{ id: 'prov-1', ownerId: 'other-manager' }],
    })
    await expect(
      (tagMutate as any).deleteTag({ authData, tx }, { id: 'tag-1', oaId: 'oa-1' }),
    ).rejects.toThrow('Unauthorized')
  })
})

describe('assignment mutations', () => {
  it('rejects non-owner assignment', async () => {
    const tx = makeTx({
      officialAccount: [{ id: 'oa-1', providerId: 'prov-1' }],
      oaProvider: [{ id: 'prov-1', ownerId: 'other-manager' }],
    })
    await expect(
      (assignmentMutate as any).assign(
        { authData, tx },
        {
          id: 'assign-1',
          oaId: 'oa-1',
          userId: 'user-1',
          tagId: 'tag-1',
          createdAt: '2026-01-01',
        },
      ),
    ).rejects.toThrow('Unauthorized')
  })

  it('assigns tag to contact', async () => {
    const tx = makeTx({
      officialAccount: [{ id: 'oa-1', providerId: 'prov-1' }],
      oaProvider: [{ id: 'prov-1', ownerId: 'manager-1' }],
      oaFriendship: [{ oaId: 'oa-1', userId: 'user-1', status: 'friend' }],
      oaContactTag: [{ id: 'tag-1', oaId: 'oa-1', name: 'VIP' }],
      oaContactTagAssignment: [],
    })
    await (assignmentMutate as any).assign(
      { authData, tx },
      {
        id: 'assign-1',
        oaId: 'oa-1',
        userId: 'user-1',
        tagId: 'tag-1',
        createdAt: '2026-01-01',
      },
    )
    expect(tx.mutate.oaContactTagAssignment.insert).toHaveBeenCalledWith(
      expect.objectContaining({ oaId: 'oa-1', userId: 'user-1', tagId: 'tag-1' }),
    )
  })

  it('rejects assignment for a non-friend contact', async () => {
    const tx = makeTx({
      officialAccount: [{ id: 'oa-1', providerId: 'prov-1' }],
      oaProvider: [{ id: 'prov-1', ownerId: 'manager-1' }],
      oaFriendship: [],
      oaContactTag: [{ id: 'tag-1', oaId: 'oa-1', name: 'VIP' }],
      oaContactTagAssignment: [],
    })
    await expect(
      (assignmentMutate as any).assign(
        { authData, tx },
        {
          id: 'assign-1',
          oaId: 'oa-1',
          userId: 'user-1',
          tagId: 'tag-1',
          createdAt: '2026-01-01',
        },
      ),
    ).rejects.toThrow('Contact not found')
    expect(tx.mutate.oaContactTagAssignment.insert).not.toHaveBeenCalled()
  })

  it('rejects assignment with a tag from another OA', async () => {
    const tx = makeTx({
      officialAccount: [{ id: 'oa-1', providerId: 'prov-1' }],
      oaProvider: [{ id: 'prov-1', ownerId: 'manager-1' }],
      oaFriendship: [{ oaId: 'oa-1', userId: 'user-1', status: 'friend' }],
      oaContactTag: [{ id: 'tag-1', oaId: 'oa-2', name: 'VIP' }],
      oaContactTagAssignment: [],
    })
    await expect(
      (assignmentMutate as any).assign(
        { authData, tx },
        {
          id: 'assign-1',
          oaId: 'oa-1',
          userId: 'user-1',
          tagId: 'tag-1',
          createdAt: '2026-01-01',
        },
      ),
    ).rejects.toThrow('Tag not found')
    expect(tx.mutate.oaContactTagAssignment.insert).not.toHaveBeenCalled()
  })

  it('does not duplicate existing assignment', async () => {
    const tx = makeTx({
      officialAccount: [{ id: 'oa-1', providerId: 'prov-1' }],
      oaProvider: [{ id: 'prov-1', ownerId: 'manager-1' }],
      oaFriendship: [{ oaId: 'oa-1', userId: 'user-1', status: 'friend' }],
      oaContactTag: [{ id: 'tag-1', oaId: 'oa-1', name: 'VIP' }],
      oaContactTagAssignment: [
        { id: 'existing', oaId: 'oa-1', userId: 'user-1', tagId: 'tag-1' },
      ],
    })
    await (assignmentMutate as any).assign(
      { authData, tx },
      {
        id: 'assign-1',
        oaId: 'oa-1',
        userId: 'user-1',
        tagId: 'tag-1',
        createdAt: '2026-01-01',
      },
    )
    expect(tx.mutate.oaContactTagAssignment.insert).not.toHaveBeenCalled()
  })

  it('removes assignment', async () => {
    const tx = makeTx({
      officialAccount: [{ id: 'oa-1', providerId: 'prov-1' }],
      oaProvider: [{ id: 'prov-1', ownerId: 'manager-1' }],
      oaContactTagAssignment: [
        { id: 'assign-1', oaId: 'oa-1', userId: 'user-1', tagId: 'tag-1' },
      ],
    })
    await (assignmentMutate as any).remove(
      { authData, tx },
      { oaId: 'oa-1', userId: 'user-1', tagId: 'tag-1' },
    )
    expect(tx.mutate.oaContactTagAssignment.delete).toHaveBeenCalledWith({
      id: 'assign-1',
    })
  })

  it('rejects non-owner removal', async () => {
    const tx = makeTx({
      officialAccount: [{ id: 'oa-1', providerId: 'prov-1' }],
      oaProvider: [{ id: 'prov-1', ownerId: 'other-manager' }],
    })
    await expect(
      (assignmentMutate as any).remove(
        { authData, tx },
        { oaId: 'oa-1', userId: 'user-1', tagId: 'tag-1' },
      ),
    ).rejects.toThrow('Unauthorized')
  })
})
