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

  it('blocks review submission until required assets are uploaded', async () => {
    const packageRepo = {
      findOwnedPackage: vi.fn().mockResolvedValue({
        id: 'pkg_1',
        creatorId: 'creator_1',
        status: 'draft',
        stickerCount: 8,
        coverDriveKey: '',
        tabIconDriveKey: '',
      }),
      countAssets: vi.fn().mockResolvedValue(0),
      submitForReview: vi.fn(),
    }
    const service = createSubmissionService({
      db: {},
      creatorRepo: {
        findByUserId: vi.fn().mockResolvedValue({ id: 'creator_1', userId: 'user_1' }),
      } as any,
      packageRepo: packageRepo as any,
      validateStickerZip: vi.fn() as any,
      storeStickerAssets: vi.fn() as any,
      now: () => new Date('2026-04-25T00:00:00Z'),
      createId: () => 'id_1',
      uploadRoot: '/tmp/vine-test',
    })

    await expect(
      service.submitForReview({ userId: 'user_1', packageId: 'pkg_1' }),
    ).rejects.toThrow('package assets incomplete')
    expect(packageRepo.submitForReview).not.toHaveBeenCalled()
  })
})
