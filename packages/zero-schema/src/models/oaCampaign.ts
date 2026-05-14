import { json, number, string, table } from '@rocicorp/zero'
import { mutations, serverWhere } from 'on-zero'
import type { AudienceQueryJson } from '../audience/query'
import type { TableInsertRow } from 'on-zero'

export type OaCampaign = TableInsertRow<typeof schema>

export const schema = table('oaCampaign')
  .columns({
    id: string(),
    oaId: string(),
    name: string(),
    messageType: string(),
    messageText: string(),
    audienceFilterId: string().optional(),
    inlineAudienceQueryJson: json<AudienceQueryJson & Record<string, any>>().optional(),
    messageRequestId: string().optional(),
    status: string(),
    recipientSnapshotCount: number(),
    successCount: number(),
    failedCount: number(),
    quotaUsed: number(),
    createdByManagerId: string(),
    createdAt: number(),
    updatedAt: number(),
    queuedAt: number().optional(),
    sentAt: number().optional(),
  })
  .primaryKey('id')

export const managerOwnedOaCampaignPermission = serverWhere('oaCampaign', (eb, auth) => {
  const userId = auth?.id || ''
  return eb.exists('oa', (oaQ) =>
    oaQ.whereExists('provider', (providerQ) => providerQ.where('ownerId', userId)),
  )
})

async function rejectCampaignMutation(): Promise<void> {
  throw new Error('Use campaign service actions')
}

export const mutate = mutations(schema, managerOwnedOaCampaignPermission, {
  insert: rejectCampaignMutation,
  upsert: rejectCampaignMutation,
  update: rejectCampaignMutation,
  delete: rejectCampaignMutation,
})
