import { Code, ConnectError } from '@connectrpc/connect'

export function createReviewService(deps: {
  db: any
  packageRepo: any
  creatorRepo?: any
  reviewRepo?: any
  launchNotification?: any
  now: () => Date
  createId: () => string
}) {
  return {
    listQueue(input: { limit: number }) {
      return deps.packageRepo.listReviewQueue(deps.db, input)
    },
    getDetail(input: { packageId: string }) {
      return deps.packageRepo.findByIdWithAssets(deps.db, input.packageId)
    },
    async approve(input: { packageId: string; actorUserId: string }) {
      const pkg = await deps.packageRepo.approve(deps.db, {
        packageId: input.packageId,
        actorUserId: input.actorUserId,
        eventId: deps.createId(),
        now: deps.now().toISOString(),
      })
      if (pkg.status === 'on_sale' && pkg.creatorId && deps.launchNotification) {
        await deps.launchNotification.notifyFollowers(deps.db, {
          packageId: pkg.id,
          creatorId: pkg.creatorId,
        })
      }
      return pkg
    },
    reject(input: {
      packageId: string
      actorUserId: string
      reasonCategory: string
      reasonText: string
      suggestion: string
      problemAssetNumbers: number[]
    }) {
      return deps.packageRepo.reject(deps.db, {
        ...input,
        eventId: deps.createId(),
        now: deps.now().toISOString(),
      })
    },
    async upsertReview(input: {
      userId: string
      packageId: string
      rating: number
      body: string
    }) {
      const repo = deps.reviewRepo
      if (!repo) throw new Error('reviewRepo not configured')
      const pkg = await deps.packageRepo.findById(deps.db, input.packageId)
      if (!pkg || pkg.status !== 'on_sale') {
        throw new ConnectError('package not found or not on sale', Code.NotFound)
      }
      const entitlement = await repo.findEntitlement(deps.db, input.packageId, input.userId)
      if (!entitlement) {
        throw new ConnectError('package ownership required to review', Code.FailedPrecondition)
      }
      if (deps.creatorRepo && pkg.creatorId) {
        const creator = await deps.creatorRepo.findByUserId(deps.db, input.userId)
        if (creator?.id === pkg.creatorId) {
          throw new ConnectError('creator cannot review own package', Code.FailedPrecondition)
        }
      }
      const body = input.body.trim()
      if (body.length > 280) {
        throw new ConnectError('review body must be 280 characters or fewer', Code.InvalidArgument)
      }
      return repo.upsert(deps.db, {
        id: deps.createId(),
        packageId: input.packageId,
        userId: input.userId,
        rating: input.rating,
        body,
        now: deps.now().toISOString(),
      })
    },
    async deleteReview(userId: string, packageId: string) {
      const repo = deps.reviewRepo
      if (!repo) throw new Error('reviewRepo not configured')
      return repo.delete(deps.db, packageId, userId)
    },
  }
}
