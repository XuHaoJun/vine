import { zql } from 'on-zero'
import { managerOwnedOaContactTagPermission } from '../models/oaContactTag'

export const oaContactTagsByOfficialAccountId = (props: {
  oaId: string
  limit?: number
}) => {
  return zql.oaContactTag
    .where(managerOwnedOaContactTagPermission)
    .where('oaId', props.oaId)
    .related('assignments')
    .orderBy('createdAt', 'desc')
    .limit(props.limit ?? 200)
}
