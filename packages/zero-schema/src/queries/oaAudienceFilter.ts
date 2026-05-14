import { zql } from 'on-zero'
import { managerOwnedOaAudienceFilterPermission } from '../models/oaAudienceFilter'

export const oaAudienceFiltersByOfficialAccountId = (props: {
  oaId: string
  limit?: number
}) => {
  return zql.oaAudienceFilter
    .where(managerOwnedOaAudienceFilterPermission)
    .where('oaId', props.oaId)
    .orderBy('createdAt', 'desc')
    .limit(props.limit ?? 50)
}
