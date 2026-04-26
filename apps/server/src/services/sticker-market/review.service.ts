export function createReviewService(deps: {
  db: any
  packageRepo: any
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
    approve(input: { packageId: string; actorUserId: string }) {
      return deps.packageRepo.approve(deps.db, {
        packageId: input.packageId,
        actorUserId: input.actorUserId,
        eventId: deps.createId(),
        now: deps.now().toISOString(),
      })
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
  }
}
