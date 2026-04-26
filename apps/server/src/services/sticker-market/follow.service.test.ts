import { describe, expect, it, vi } from 'vitest'
import { createFollowService } from './follow.service'

describe('createFollowService', () => {
  it('rejects self-follow when the authenticated user owns the creator profile', async () => {
    const followRepo = {
      find: vi.fn(),
      insert: vi.fn(),
      delete: vi.fn(),
    }
    const service = createFollowService({
      db: {},
      followRepo,
      creatorRepo: {
        findById: vi.fn().mockResolvedValue({ id: 'creator_1', userId: 'user_1' }),
      },
      now: () => new Date('2026-04-25T00:00:00Z'),
      createId: () => 'follow_1',
    })

    await expect(service.follow('user_1', 'creator_1')).rejects.toThrow(
      'cannot follow yourself',
    )
    expect(followRepo.insert).not.toHaveBeenCalled()
  })
})
