import { describe, expect, it, vi } from 'vitest'
import { createOAAudienceService } from './oa-audience'
import type { AudienceContact } from '@vine/zero-schema'

describe('OA audience service', () => {
  it('rejects invalid queries before reading recipients', async () => {
    const db = { select: vi.fn() } as any
    const service = createOAAudienceService({ db })

    const result = await service.preview({
      oaId: 'oa-1',
      query: { displayName: { $regex: 'bad' } },
    })

    expect(result).toEqual({
      ok: false,
      code: 'INVALID_AUDIENCE_QUERY',
      message: 'Unsupported operator for displayName: $regex',
    })
    expect(db.select).not.toHaveBeenCalled()
  })

  it('loads contacts inside one OA and filters by tag', async () => {
    const contacts: AudienceContact[] = [
      {
        friendship: { status: 'friend' },
        providerUserId: 'user-1',
        displayName: 'Alice',
        tags: { ids: ['vip'], names: ['VIP'] },
        lastInteractionAt: '2026-05-01T00:00:00.000Z',
        chat: { status: 'active', unread: true },
        note: { exists: true },
      },
      {
        friendship: { status: 'friend' },
        providerUserId: 'user-2',
        displayName: 'Bob',
        tags: { ids: [], names: [] },
        lastInteractionAt: null,
        chat: { status: 'no_chat', unread: false },
        note: { exists: false },
      },
    ]
    const loadContactsForTest = vi.fn(async () => contacts)
    const service = createOAAudienceService({
      db: { select: vi.fn() } as any,
      loadContactsForTest,
    })

    const result = await service.resolveRecipients({
      oaId: 'oa-1',
      query: { 'tags.ids': { $all: ['vip'] } },
    })

    expect(loadContactsForTest).toHaveBeenCalledWith('oa-1')
    expect(result).toEqual({ ok: true, userIds: ['user-1'] })
  })

  it('previews recipient count without exposing user ids', async () => {
    const service = createOAAudienceService({
      db: { select: vi.fn() } as any,
      loadContactsForTest: async (): Promise<AudienceContact[]> => [
        {
          friendship: { status: 'friend' },
          providerUserId: 'user-1',
          displayName: 'Alice',
          tags: { ids: ['vip'], names: ['VIP'] },
          lastInteractionAt: '2026-05-01T00:00:00.000Z',
          chat: { status: 'active', unread: true },
          note: { exists: true },
        },
      ],
    })

    await expect(
      service.preview({
        oaId: 'oa-1',
        query: { 'friendship.status': 'friend' },
      }),
    ).resolves.toEqual({ ok: true, count: 1 })
  })
})
