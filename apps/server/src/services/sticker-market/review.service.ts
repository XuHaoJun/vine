export function createReviewService(deps: {
  db: any
  packageRepo: any
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
      return repo.upsert(deps.db, {
        id: deps.createId(),
        packageId: input.packageId,
        userId: input.userId,
        rating: input.rating,
        body: input.body,
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
