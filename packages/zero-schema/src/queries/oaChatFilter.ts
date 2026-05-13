import { zql } from 'on-zero'
import { managerOwnedOaChatFilterPermission } from '../models/oaChatFilter'

export const oaChatFiltersByOfficialAccountId = (props: {
  oaId: string
  limit?: number
}) => {
  return zql.oaChatFilter
    .where(managerOwnedOaChatFilterPermission)
    .where('oaId', props.oaId)
    .orderBy('sortOrder', 'asc')
    .limit(props.limit ?? 20)
}
