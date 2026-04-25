import { describe, expect, it, vi } from 'vitest'
import { createReviewService } from './review.service'

describe('createReviewService', () => {
  it('approves in-review package with auto publish', async () => {
    const packageRepo = {
      approve: vi.fn().mockResolvedValue({ id: 'pkg_1', status: 'on_sale' }),
    }
    const service = createReviewService({
      db: {},
      packageRepo: packageRepo as any,
      now: () => new Date('2026-04-25T00:00:00Z'),
      createId: () => 'evt_1',
    })

    const result = await service.approve({ packageId: 'pkg_1', actorUserId: 'admin_1' })

    expect(result.status).toBe('on_sale')
    expect(packageRepo.approve).toHaveBeenCalledWith({}, {
      packageId: 'pkg_1',
      actorUserId: 'admin_1',
      eventId: 'evt_1',
      now: '2026-04-25T00:00:00.000Z',
    })
  })
})
