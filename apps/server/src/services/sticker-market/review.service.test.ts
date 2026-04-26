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
    expect(packageRepo.approve).toHaveBeenCalledWith(
      {},
      {
        packageId: 'pkg_1',
        actorUserId: 'admin_1',
        eventId: 'evt_1',
        now: '2026-04-25T00:00:00.000Z',
      },
    )
  })

  it('requires entitlement before upserting a user review', async () => {
    const service = createReviewService({
      db: {},
      packageRepo: {
        findById: vi.fn().mockResolvedValue({
          id: 'pkg_1',
          status: 'on_sale',
          creatorId: 'creator_1',
        }),
      } as any,
      reviewRepo: {
        findEntitlement: vi.fn().mockResolvedValue(undefined),
        upsert: vi.fn(),
      } as any,
      now: () => new Date('2026-04-25T00:00:00Z'),
      createId: () => 'rev_1',
    })

    await expect(
      service.upsertReview({
        userId: 'user_1',
        packageId: 'pkg_1',
        rating: 5,
        body: 'nice',
      }),
    ).rejects.toThrow('package ownership required')
  })

  it('rejects creator self-review', async () => {
    const reviewRepo = {
      findEntitlement: vi.fn().mockResolvedValue({ id: 'ent_1' }),
      upsert: vi.fn(),
    }
    const service = createReviewService({
      db: {},
      packageRepo: {
        findById: vi.fn().mockResolvedValue({
          id: 'pkg_1',
          status: 'on_sale',
          creatorId: 'creator_1',
        }),
      } as any,
      creatorRepo: {
        findByUserId: vi.fn().mockResolvedValue({ id: 'creator_1', userId: 'user_1' }),
      } as any,
      reviewRepo: reviewRepo as any,
      now: () => new Date('2026-04-25T00:00:00Z'),
      createId: () => 'rev_1',
    })

    await expect(
      service.upsertReview({
        userId: 'user_1',
        packageId: 'pkg_1',
        rating: 5,
        body: 'nice',
      }),
    ).rejects.toThrow('creator cannot review own package')
    expect(reviewRepo.upsert).not.toHaveBeenCalled()
  })

  it('rejects long review bodies', async () => {
    const service = createReviewService({
      db: {},
      packageRepo: {
        findById: vi.fn().mockResolvedValue({
          id: 'pkg_1',
          status: 'on_sale',
          creatorId: 'creator_1',
        }),
      } as any,
      reviewRepo: {
        findEntitlement: vi.fn().mockResolvedValue({ id: 'ent_1' }),
        upsert: vi.fn(),
      } as any,
      now: () => new Date('2026-04-25T00:00:00Z'),
      createId: () => 'rev_1',
    })

    await expect(
      service.upsertReview({
        userId: 'user_1',
        packageId: 'pkg_1',
        rating: 5,
        body: 'x'.repeat(281),
      }),
    ).rejects.toThrow('280 characters')
  })
})
