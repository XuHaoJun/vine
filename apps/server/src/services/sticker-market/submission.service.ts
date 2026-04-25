export function createSubmissionService(deps: {
  db: any
  creatorRepo: any
  packageRepo: any
  validateStickerZip: any
  storeStickerAssets: any
  now: () => Date
  createId: () => string
  uploadRoot: string
}) {
  return {
    async createDraft(input: {
      userId: string
      name: string
      description: string
      priceMinor: number
      stickerCount: number
      tagsJson: string
      copyrightText: string
      licenseConfirmed: boolean
      autoPublish: boolean
    }) {
      const creator = await deps.creatorRepo.findByUserId(deps.db, input.userId)
      if (!creator) throw new Error('creator profile required')
      if (!input.licenseConfirmed) throw new Error('license confirmation required')

      return deps.packageRepo.createDraft(deps.db, {
        id: deps.createId(),
        creatorId: creator.id,
        name: input.name,
        description: input.description,
        priceMinor: input.priceMinor,
        currency: 'TWD',
        stickerCount: input.stickerCount,
        tags: input.tagsJson,
        copyrightText: input.copyrightText,
        licenseConfirmedAt: deps.now().toISOString(),
        autoPublish: input.autoPublish,
        now: deps.now().toISOString(),
      })
    },

    async updateDraft(input: {
      userId: string
      packageId: string
      name: string
      description: string
      priceMinor: number
      stickerCount: number
      tagsJson: string
      copyrightText: string
      licenseConfirmed: boolean
      autoPublish: boolean
    }) {
      const creator = await deps.creatorRepo.findByUserId(deps.db, input.userId)
      if (!creator) throw new Error('creator profile required')
      if (!input.licenseConfirmed) throw new Error('license confirmation required')

      return deps.packageRepo.updateDraft(deps.db, {
        packageId: input.packageId,
        creatorId: creator.id,
        name: input.name,
        description: input.description,
        priceMinor: input.priceMinor,
        stickerCount: input.stickerCount,
        tags: input.tagsJson,
        copyrightText: input.copyrightText,
        licenseConfirmedAt: deps.now().toISOString(),
        autoPublish: input.autoPublish,
        now: deps.now().toISOString(),
      })
    },

    async uploadAssets(input: { userId: string; packageId: string; zipFile: Uint8Array }) {
      const creator = await deps.creatorRepo.findByUserId(deps.db, input.userId)
      if (!creator) throw new Error('creator profile required')
      const pkg = await deps.packageRepo.findOwnedPackage(deps.db, {
        packageId: input.packageId,
        creatorId: creator.id,
      })
      if (!pkg) throw new Error('package not found')
      if (pkg.status !== 'draft' && pkg.status !== 'rejected') {
        throw new Error('package assets are locked')
      }

      const validation = await deps.validateStickerZip({
        zipFile: input.zipFile,
        stickerCount: pkg.stickerCount,
      })
      if (!validation.valid || !validation.files) return validation

      const stored = await deps.storeStickerAssets({
        uploadRoot: deps.uploadRoot,
        packageId: pkg.id,
        cover: validation.files.cover,
        tabIcon: validation.files.tabIcon,
        stickers: validation.files.stickers.map((s: any) => ({
          number: s.number,
          bytes: s.bytes,
        })),
      })
      await deps.packageRepo.replaceAssets(deps.db, {
        packageId: pkg.id,
        coverDriveKey: stored.coverDriveKey,
        tabIconDriveKey: stored.tabIconDriveKey,
        assets: validation.files.stickers.map((s: any) => ({
          id: deps.createId(),
          packageId: pkg.id,
          number: s.number,
          driveKey: stored.stickers.find((x: any) => x.number === s.number).driveKey,
          width: s.width,
          height: s.height,
          sizeBytes: s.sizeBytes,
          mimeType: 'image/png',
          resourceType: 'static',
          keywords: '[]',
        })),
        now: deps.now().toISOString(),
      })
      return validation
    },

    async submitForReview(input: { userId: string; packageId: string }) {
      const creator = await deps.creatorRepo.findByUserId(deps.db, input.userId)
      if (!creator) throw new Error('creator profile required')
      return deps.packageRepo.submitForReview(deps.db, {
        packageId: input.packageId,
        creatorId: creator.id,
        now: deps.now().toISOString(),
        eventId: deps.createId(),
        actorUserId: input.userId,
      })
    },

    async publishApproved(input: { userId: string; packageId: string }) {
      const creator = await deps.creatorRepo.findByUserId(deps.db, input.userId)
      if (!creator) throw new Error('creator profile required')
      return deps.packageRepo.publishApproved(deps.db, {
        packageId: input.packageId,
        creatorId: creator.id,
        now: deps.now().toISOString(),
      })
    },
  }
}
