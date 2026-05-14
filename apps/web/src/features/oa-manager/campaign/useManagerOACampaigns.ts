import { oaCampaignsByOfficialAccountId } from '@vine/zero-schema/queries/oaCampaign'
import { useMemo } from 'react'
import { oaClient } from '~/features/oa/client'
import { useTanMutation } from '~/query'
import { useZeroQuery } from '~/zero/client'
import type { AudienceQueryJson } from '@vine/zero-schema/audience/query'

export type CampaignItem = {
  id: string
  name: string
  messageText: string
  audienceFilterId: string | null | undefined
  inlineAudienceQueryJson: AudienceQueryJson | null | undefined
  messageRequestId: string | null | undefined
  status: string
  recipientSnapshotCount: number
  successCount: number
  failedCount: number
  quotaUsed: number
  createdAt: number
  updatedAt: number
  queuedAt: number | null | undefined
  sentAt: number | null | undefined
}

export type SendTextCampaignInput = {
  name: string
  messageText: string
  audienceFilterId?: string | undefined
  inlineAudienceQueryJson?: AudienceQueryJson | undefined
}

export function useManagerOACampaigns(oaId: string | undefined) {
  const [rawCampaigns] = useZeroQuery(
    oaCampaignsByOfficialAccountId,
    { oaId: oaId ?? '' },
    { enabled: Boolean(oaId) },
  )

  const campaigns = useMemo<CampaignItem[]>(
    () =>
      (rawCampaigns ?? []).map((campaign) => ({
        id: campaign.id,
        name: campaign.name,
        messageText: campaign.messageText,
        audienceFilterId: campaign.audienceFilterId,
        inlineAudienceQueryJson: campaign.inlineAudienceQueryJson,
        messageRequestId: campaign.messageRequestId,
        status: campaign.status,
        recipientSnapshotCount: campaign.recipientSnapshotCount,
        successCount: campaign.successCount,
        failedCount: campaign.failedCount,
        quotaUsed: campaign.quotaUsed,
        createdAt: campaign.createdAt,
        updatedAt: campaign.updatedAt,
        queuedAt: campaign.queuedAt,
        sentAt: campaign.sentAt,
      })),
    [rawCampaigns],
  )

  const sendTextCampaign = useTanMutation({
    mutationFn: async (input: SendTextCampaignInput) => {
      if (!oaId) throw new Error('Missing official account id')
      const campaignId = crypto.randomUUID()
      return oaClient.sendTextCampaign({
        officialAccountId: oaId,
        campaignId,
        name: input.name,
        messageText: input.messageText,
        audienceFilterId: input.audienceFilterId,
        inlineAudienceQueryJson: input.inlineAudienceQueryJson
          ? JSON.stringify(input.inlineAudienceQueryJson)
          : undefined,
      })
    },
  })

  return { campaigns, sendTextCampaign }
}
