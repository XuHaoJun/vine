import { getRawWhere } from 'on-zero'
import { describe, expect, it } from 'vitest'
import { managerOwnedOaFriendshipPermission } from '../models/oaFriendship'
import { oaContactsByOfficialAccountId } from '../queries/oaFriendship'
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

describe('manager OA contact permissions', () => {
  it('requires OA provider ownership for OA contact rows', () => {
    const permission = recordPermission(managerOwnedOaFriendshipPermission)

    expect(permission).toContain('"ownerId","manager-1"')
    expect(permission).not.toContain('"userId","manager-1"')
  })

  it('exports a valid OA contact query builder', () => {
    expect(typeof oaContactsByOfficialAccountId).toBe('function')
    expect(oaContactsByOfficialAccountId.length).toBe(1)
  })
})
