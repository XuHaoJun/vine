import { randomUUID } from 'node:crypto'
import { createCreatorRepository } from './creator.repository'
import { createSubmissionService } from './submission.service'
import { createReviewService } from './review.service'
import { storeStickerAssets } from './asset-storage'
import { validateStickerZip } from './asset-validator'
import { createPackageRepository } from './package.repository'

export function createStickerMarketServices(deps: {
  db: any
  uploadRoot: string
}) {
  const creatorRepo = createCreatorRepository()
  const packageRepo = createPackageRepository()
  const common = {
    db: deps.db,
    creatorRepo,
    packageRepo,
    now: () => new Date(),
    createId: () => randomUUID(),
    uploadRoot: deps.uploadRoot,
  }

  return {
    creatorRepo,
    packageRepo,
    submission: createSubmissionService({
      ...common,
      validateStickerZip,
      storeStickerAssets,
    }),
    review: createReviewService(common),
  }
}
