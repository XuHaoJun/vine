import { serverWhere, zql } from 'on-zero'

const permission = serverWhere('friendship', (_, auth) => {
  return _.or(
    _.cmp('requesterId', auth?.id || ''),
    _.cmp('addresseeId', auth?.id || ''),
  )
})

export const friendshipsByUserId = (props: { userId: string }) => {
  return zql.friendship
    .where(permission)
    .where((q) =>
      q.or(
        q.cmp('requesterId', props.userId),
        q.cmp('addresseeId', props.userId),
      ),
    )
}

export const friendshipById = (props: { friendshipId: string }) => {
  return zql.friendship.where(permission).where('id', props.friendshipId).one()
}
