import { zql } from 'on-zero'
import { managerOwnedOaFriendshipPermission } from '../models/oaFriendship'

export const oaContactsByOfficialAccountId = (props: {
  oaId: string
  limit?: number
}) => {
  return zql.oaFriendship
    .where(managerOwnedOaFriendshipPermission)
    .where('oaId', props.oaId)
    .where('status', 'friend')
    .related('user')
    .related('profile')
    .related('tagAssignments', (q) => q.related('tag'))
    .orderBy('createdAt', 'desc')
    .limit(props.limit ?? 100)
}
