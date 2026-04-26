import { Code, ConnectError } from '@connectrpc/connect'

export function createFollowService(deps: {
  db: any
  followRepo: any
  creatorRepo?: any
  now: () => Date
  createId: () => string
}) {
  return {
    async follow(userId: string, creatorId: string) {
      if (deps.creatorRepo) {
        const creator = await deps.creatorRepo.findById(deps.db, creatorId)
        if (!creator) throw new ConnectError('creator not found', Code.NotFound)
        if (creator.userId === userId) {
          throw new ConnectError('cannot follow yourself', Code.FailedPrecondition)
        }
      }
      const existing = await deps.followRepo.find(deps.db, userId, creatorId)
      if (existing) return

      await deps.followRepo.insert(deps.db, {
        id: deps.createId(),
        userId,
        creatorId,
        now: deps.now().toISOString(),
      })
    },

    async unfollow(userId: string, creatorId: string) {
      const deleted = await deps.followRepo.delete(deps.db, userId, creatorId)
      if (!deleted) {
        throw new ConnectError('not following this creator', Code.NotFound)
      }
    },
  }
}
