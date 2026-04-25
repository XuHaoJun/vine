import { describe, expect, it, vi } from 'vitest'
import { createSubmissionService } from './submission.service'

describe('createSubmissionService', () => {
  it('requires a creator profile before creating a draft', async () => {
    const service = createSubmissionService({
      db: {},
      creatorRepo: { findByUserId: vi.fn().mockResolvedValue(undefined) } as any,
      packageRepo: {} as any,
      validateStickerZip: vi.fn() as any,
      storeStickerAssets: vi.fn() as any,
      now: () => new Date('2026-04-25T00:00:00Z'),
      createId: () => 'id_1',
      uploadRoot: '/tmp/vine-test',
    })

    await expect(
      service.createDraft({
        userId: 'user_1',
        name: 'Cats',
        description: 'Daily cats',
        priceMinor: 75,
        stickerCount: 8,
        tagsJson: '["cat"]',
        copyrightText: 'me',
        licenseConfirmed: true,
        autoPublish: true,
      }),
    ).rejects.toThrow('creator profile required')
  })
})
