import { randomUUID } from 'node:crypto'
import { createCreatorRepository } from './creator.repository'
import { createSubmissionService } from './submission.service'
import { createReviewService } from './review.service'
import { storeStickerAssets } from './asset-storage'
import { validateStickerZip } from './asset-validator'
import { createPackageRepository } from './package.repository'
import { createSalesReportRepository } from './sales-report.repository'
import { createSalesReportService } from './sales-report.service'
import { createPayoutRepository } from './payout.repository'
import { createPayoutService } from './payout.service'
import { createDiscoveryRepository } from './discovery.repository'
import { createDiscoveryService } from './discovery.service'
import { createFeaturedShelfRepository } from './featured-shelf.repository'
import { createFeaturedShelfService } from './featured-shelf.service'
import { createFollowRepository } from './follow.repository'
import { createFollowService } from './follow.service'
import { createReviewRepository } from './review.repository'
import { createLaunchNotificationService } from './launch-notification.service'
import { createCurrencyDisplayService } from './currency-display.service'

export function createStickerMarketServices(deps: { db: any; uploadRoot: string }) {
  const creatorRepo = createCreatorRepository()
  const packageRepo = createPackageRepository()
  const salesReportRepo = createSalesReportRepository()
  const payoutRepo = createPayoutRepository()
  const discoveryRepo = createDiscoveryRepository()
  const featuredShelfRepo = createFeaturedShelfRepository()
  const followRepo = createFollowRepository()
  const reviewRepo = createReviewRepository()

  const currencyDisplay = createCurrencyDisplayService({
    db: deps.db,
    discoveryRepo,
  })

  const launchNotification = createLaunchNotificationService({
    db: deps.db,
    now: () => new Date(),
    createId: () => randomUUID(),
  })

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
    discoveryRepo,
    featuredShelfRepo,
    followRepo,
    reviewRepo,
    submission: createSubmissionService({
      ...common,
      validateStickerZip,
      storeStickerAssets,
      launchNotification,
    }),
    review: createReviewService({ ...common, reviewRepo, launchNotification }),
    salesReport: createSalesReportService({
      db: deps.db,
      creatorRepo,
      salesReportRepo,
    }),
    payout: createPayoutService({
      db: deps.db,
      repo: payoutRepo,
      createId: () => randomUUID(),
      now: () => new Date(),
    }),
    currencyDisplay,
    discovery: createDiscoveryService({
      db: deps.db,
      discoveryRepo,
      featuredShelfRepo,
      currencyDisplay,
      creatorRepo,
    }),
    featuredShelf: createFeaturedShelfService({
      db: deps.db,
      featuredShelfRepo,
      now: () => new Date(),
      createId: () => randomUUID(),
    }),
    follow: createFollowService({
      db: deps.db,
      followRepo,
      creatorRepo,
      now: () => new Date(),
      createId: () => randomUUID(),
    }),
    launchNotification,
  }
}
