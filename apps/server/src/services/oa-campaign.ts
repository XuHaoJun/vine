import { oaAudienceFilter, oaCampaign } from '@vine/db/schema-oa'
import { and, eq } from 'drizzle-orm'
import type { createOAAudienceService } from './oa-audience'
import type { createOAMessagingService } from './oa-messaging'
import type { schema } from '@vine/db'
import type { AudienceQueryJson } from '@vine/zero-schema'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import {
  normalizeMessagingApiMessages,
  summarizeMessagingMessages,
} from './oa-message-payload'

type OACampaignDeps = {
  db: NodePgDatabase<typeof schema>
  audience: ReturnType<typeof createOAAudienceService>
  messaging: ReturnType<typeof createOAMessagingService>
  now?: () => Date
}

type SendTextCampaignInput = {
  campaignId: string
  oaId: string
  managerId: string
  name: string
  messageText: string
  audienceFilterId: string | undefined
  inlineAudienceQuery: AudienceQueryJson | undefined
}

type SendRichCampaignInput = {
  campaignId: string
  oaId: string
  managerId: string
  name: string
  messages: unknown[]
  audienceFilterId: string | undefined
  inlineAudienceQuery: AudienceQueryJson | undefined
}

type ExternalTextCampaignInput = Omit<SendTextCampaignInput, 'managerId'> & {
  retryKey: string | undefined
}

function cleanCampaignName(name: string): string {
  const trimmed = name.trim()
  if (trimmed.length === 0) throw new Error('Campaign name is required')
  if (trimmed.length > 100) throw new Error('Campaign name too long (max 100)')
  return trimmed
}

function cleanMessageText(text: string): string {
  const trimmed = text.trim()
  if (trimmed.length === 0) throw new Error('Campaign text is required')
  if (trimmed.length > 5000) {
    throw new Error('Campaign text must not exceed 5000 characters')
  }
  return trimmed
}

export function createOACampaignService(deps: OACampaignDeps) {
  const now = deps.now ?? (() => new Date())

  async function loadAudienceQuery(input: {
    oaId: string
    audienceFilterId: string | undefined
    inlineAudienceQuery: AudienceQueryJson | undefined
  }): Promise<AudienceQueryJson> {
    if (input.inlineAudienceQuery) return input.inlineAudienceQuery
    if (!input.audienceFilterId) return { 'friendship.status': 'friend' }

    const [filter] = await deps.db
      .select()
      .from(oaAudienceFilter)
      .where(
        and(
          eq(oaAudienceFilter.id, input.audienceFilterId),
          eq(oaAudienceFilter.oaId, input.oaId),
        ),
      )
      .limit(1)
    if (!filter) throw new Error('Audience filter not found')
    return filter.queryJson as AudienceQueryJson
  }

  async function previewAudience(input: { oaId: string; query: AudienceQueryJson }) {
    return deps.audience.preview(input)
  }

  async function acceptTextCampaign(
    input: SendTextCampaignInput & { retryKey?: string },
  ) {
    const name = cleanCampaignName(input.name)
    const messageText = cleanMessageText(input.messageText)
    const query = await loadAudienceQuery(input)
    const recipients = await deps.audience.resolveRecipients({
      oaId: input.oaId,
      query,
    })
    if (!recipients.ok) throw new Error(recipients.message)

    let acceptedRequestId = ''
    let acceptedRecipientCount = 0
    const accepted = await deps.messaging.acceptMessagingExecution({
      oaId: input.oaId,
      requestType: 'campaign',
      retryKey: input.retryKey,
      target: {
        campaignId: input.campaignId,
        audienceFilterId: input.audienceFilterId,
        audience: query,
      },
      messages: [{ type: 'text', text: messageText, metadata: null }],
      resolveRecipients: async () => recipients.userIds,
      onAccepted: async ({ tx, request, recipientCount, nowIso }) => {
        acceptedRequestId = request.id
        acceptedRecipientCount = recipientCount
        await tx.insert(oaCampaign).values({
          id: input.campaignId,
          oaId: input.oaId,
          name,
          messageType: 'text',
          messageText,
          audienceFilterId: input.audienceFilterId,
          inlineAudienceQueryJson: input.inlineAudienceQuery ?? null,
          messageRequestId: request.id,
          status: recipientCount === 0 ? 'sent' : 'queued',
          recipientSnapshotCount: recipientCount,
          successCount: 0,
          failedCount: 0,
          quotaUsed: recipientCount,
          createdByManagerId: input.managerId,
          createdAt: nowIso,
          updatedAt: nowIso,
          queuedAt: nowIso,
          sentAt: recipientCount === 0 ? nowIso : null,
        })
      },
    })

    return { accepted, acceptedRequestId, acceptedRecipientCount }
  }

  async function sendTextCampaign(input: SendTextCampaignInput) {
    const { accepted, acceptedRequestId, acceptedRecipientCount } =
      await acceptTextCampaign(input)
    if (!accepted.ok) {
      throw new Error(accepted.code)
    }

    return {
      ok: true as const,
      campaignId: input.campaignId,
      messageRequestId: acceptedRequestId,
      recipientCount: acceptedRecipientCount,
    }
  }

  async function acceptRichCampaign(input: SendRichCampaignInput) {
    const name = cleanCampaignName(input.name)
    const normalized = normalizeMessagingApiMessages(input.messages)
    const summary = summarizeMessagingMessages(input.messages)
    const query = await loadAudienceQuery(input)
    const recipients = await deps.audience.resolveRecipients({
      oaId: input.oaId,
      query,
    })
    if (!recipients.ok) throw new Error(recipients.message)

    let acceptedRequestId = ''
    let acceptedRecipientCount = 0
    const accepted = await deps.messaging.acceptMessagingExecution({
      oaId: input.oaId,
      requestType: 'campaign',
      target: {
        campaignId: input.campaignId,
        audienceFilterId: input.audienceFilterId,
        audience: query,
      },
      messages: normalized,
      resolveRecipients: async () => recipients.userIds,
      onAccepted: async ({ tx, request, recipientCount, nowIso }) => {
        acceptedRequestId = request.id
        acceptedRecipientCount = recipientCount
        await tx.insert(oaCampaign).values({
          id: input.campaignId,
          oaId: input.oaId,
          name,
          messageType: 'rich',
          messageText: null,
          messagePayloadJson: input.messages,
          messageSummary: summary,
          audienceFilterId: input.audienceFilterId,
          inlineAudienceQueryJson: input.inlineAudienceQuery ?? null,
          messageRequestId: request.id,
          status: recipientCount === 0 ? 'sent' : 'queued',
          recipientSnapshotCount: recipientCount,
          successCount: 0,
          failedCount: 0,
          quotaUsed: recipientCount,
          createdByManagerId: input.managerId,
          createdAt: nowIso,
          updatedAt: nowIso,
          queuedAt: nowIso,
          sentAt: recipientCount === 0 ? nowIso : null,
        })
      },
    })

    return { accepted, acceptedRequestId, acceptedRecipientCount }
  }

  async function sendRichCampaign(input: SendRichCampaignInput) {
    const { accepted, acceptedRequestId, acceptedRecipientCount } =
      await acceptRichCampaign(input)
    if (!accepted.ok) {
      throw new Error(accepted.code)
    }

    return {
      ok: true as const,
      campaignId: input.campaignId,
      messageRequestId: acceptedRequestId,
      recipientCount: acceptedRecipientCount,
    }
  }

  async function sendExternalTextCampaign(input: ExternalTextCampaignInput) {
    const { accepted } = await acceptTextCampaign({
      ...input,
      managerId: 'messaging-api',
      retryKey: input.retryKey,
    })
    return accepted
  }

  return { previewAudience, sendTextCampaign, sendRichCampaign, sendExternalTextCampaign }
}
