import { zql } from 'on-zero'
import { managerOwnedOaCampaignPermission } from '../models/oaCampaign'

export const oaCampaignsByOfficialAccountId = (props: {
  oaId: string
  limit?: number
}) => {
  return zql.oaCampaign
    .where(managerOwnedOaCampaignPermission)
    .where('oaId', props.oaId)
    .orderBy('createdAt', 'desc')
    .limit(props.limit ?? 100)
}
