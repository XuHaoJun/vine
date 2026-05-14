import { randomUUID } from 'crypto'
import { oaAudienceFilter, oaCampaign } from '@vine/db/schema-oa'
import { oaMessageRequest } from '@vine/db/schema-private'
import { and, eq, or } from 'drizzle-orm'
import type { createOACampaignService } from './oa-campaign'
import type { schema } from '@vine/db'
import { validateAudienceQuery, type AudienceQueryJson } from '@vine/zero-schema'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

type TextMessage = { type: 'text'; text: string }
type CampaignBody = { messages?: unknown[] }
type MulticastBody = CampaignBody & { to?: unknown }
type UploadAudienceGroupBody = {
  description?: unknown
  audiences?: unknown
}
type NarrowcastBody = CampaignBody & {
  recipient?: unknown
  filter?: unknown
  limit?: unknown
}

type FacadeDeps = {
  db: NodePgDatabase<typeof schema>
  campaign: ReturnType<typeof createOACampaignService>
  now?: () => Date
  createId?: () => string
}

type FacadeErrorCode =
  | 'INVALID_REQUEST'
  | 'UNSUPPORTED_MESSAGE_TYPE'
  | 'UNSUPPORTED_AUDIENCE_FILTER'
  | 'AUDIENCE_GROUP_NOT_FOUND'

type FacadeError = { ok: false; code: FacadeErrorCode; message: string }

function readSingleTextMessage(body: CampaignBody): TextMessage | FacadeError {
  if (!Array.isArray(body.messages) || body.messages.length !== 1) {
    return {
      ok: false,
      code: 'UNSUPPORTED_MESSAGE_TYPE',
      message: 'Campaign facade supports exactly one text message',
    }
  }
  const [message] = body.messages
  if (
    typeof message !== 'object' ||
    message === null ||
    (message as { type?: unknown }).type !== 'text' ||
    typeof (message as { text?: unknown }).text !== 'string'
  ) {
    return {
      ok: false,
      code: 'UNSUPPORTED_MESSAGE_TYPE',
      message: 'Campaign facade supports exactly one text message',
    }
  }
  return message as TextMessage
}

function isFacadeError(value: unknown): value is FacadeError {
  return typeof value === 'object' && value !== null && (value as FacadeError).ok === false
}

function compileRecipient(
  recipient: unknown,
  options: { allowAllFriends: boolean },
):
  | { audienceFilterId: string | undefined; query: AudienceQueryJson | undefined }
  | FacadeError {
  if (recipient === undefined || recipient === null) {
    if (!options.allowAllFriends) {
      return {
        ok: false,
        code: 'UNSUPPORTED_AUDIENCE_FILTER',
        message: 'recipient must be an object',
      }
    }
    return { audienceFilterId: undefined, query: { 'friendship.status': 'friend' } }
  }
  if (typeof recipient !== 'object') {
    return {
      ok: false,
      code: 'UNSUPPORTED_AUDIENCE_FILTER',
      message: 'recipient must be an object',
    }
  }
  const value = recipient as Record<string, unknown>
  if (value.type === 'audience' && typeof value.audienceGroupId === 'string') {
    return { audienceFilterId: value.audienceGroupId, query: undefined }
  }
  if (value.type === 'operator') {
    return compileOperator(value)
  }
  if (value.type === 'redelivery') {
    return {
      ok: false,
      code: 'UNSUPPORTED_AUDIENCE_FILTER',
      message: 'recipient.type redelivery is not supported',
    }
  }
  return {
    ok: false,
    code: 'UNSUPPORTED_AUDIENCE_FILTER',
    message: `recipient.type ${String(value.type)} is not supported`,
  }
}

function compileOperator(
  value: Record<string, unknown>,
): { audienceFilterId: undefined; query: AudienceQueryJson } | FacadeError {
  const andList = value.and
  const orList = value.or
  const notValue = value.not
  const providedOperators = [andList !== undefined, orList !== undefined, notValue !== undefined]
    .filter(Boolean).length
  if (providedOperators !== 1) {
    return {
      ok: false,
      code: 'UNSUPPORTED_AUDIENCE_FILTER',
      message: 'operator recipient must include exactly one of and, or, or not',
    }
  }
  if (Array.isArray(andList)) {
    if (andList.length === 0) {
      return {
        ok: false,
        code: 'UNSUPPORTED_AUDIENCE_FILTER',
        message: 'operator.and must be a non-empty array',
      }
    }
    const branches: AudienceQueryJson[] = []
    for (const branch of andList) {
      const compiled = compileRecipient(branch, { allowAllFriends: false })
      if (isFacadeError(compiled)) return compiled
      if (compiled.audienceFilterId) {
        return {
          ok: false,
          code: 'UNSUPPORTED_AUDIENCE_FILTER',
          message: 'audienceGroupId cannot be nested inside operator recipients',
        }
      }
      branches.push(compiled.query ?? {})
    }
    return {
      audienceFilterId: undefined,
      query: { $and: branches },
    }
  }
  if (Array.isArray(orList)) {
    if (orList.length === 0) {
      return {
        ok: false,
        code: 'UNSUPPORTED_AUDIENCE_FILTER',
        message: 'operator.or must be a non-empty array',
      }
    }
    const branches: AudienceQueryJson[] = []
    for (const branch of orList) {
      const compiled = compileRecipient(branch, { allowAllFriends: false })
      if (isFacadeError(compiled)) return compiled
      if (compiled.audienceFilterId) {
        return {
          ok: false,
          code: 'UNSUPPORTED_AUDIENCE_FILTER',
          message: 'audienceGroupId cannot be nested inside operator recipients',
        }
      }
      branches.push(compiled.query ?? {})
    }
    return {
      audienceFilterId: undefined,
      query: { $or: branches },
    }
  }
  if (notValue !== undefined) {
    const compiled = compileRecipient(notValue, { allowAllFriends: false })
    if (isFacadeError(compiled)) return compiled
    if (compiled.audienceFilterId) {
      return {
        ok: false,
        code: 'UNSUPPORTED_AUDIENCE_FILTER',
        message: 'audienceGroupId cannot be nested inside operator recipients',
      }
    }
    return { audienceFilterId: undefined, query: { $not: compiled.query ?? {} } }
  }
  return {
    ok: false,
    code: 'UNSUPPORTED_AUDIENCE_FILTER',
    message: 'operator recipient must include exactly one of and, or, or not',
  }
}

function validateCompiledQuery(query: AudienceQueryJson | undefined): FacadeError | undefined {
  if (!query) return undefined
  const result = validateAudienceQuery(query)
  if (result.ok) return undefined
  return {
    ok: false,
    code: 'UNSUPPORTED_AUDIENCE_FILTER',
    message: result.error,
  }
}

export function createOAMessagingFacadeService(deps: FacadeDeps) {
  const now = deps.now ?? (() => new Date())
  const createId = deps.createId ?? randomUUID

  async function sendCampaign(input: {
    oaId: string
    retryKey: string | undefined
    namePrefix: string
    body: CampaignBody
    audienceFilterId: string | undefined
    inlineAudienceQuery: AudienceQueryJson | undefined
  }) {
    const text = readSingleTextMessage(input.body)
    if (isFacadeError(text)) return text
    return deps.campaign.sendExternalTextCampaign({
      campaignId: createId(),
      oaId: input.oaId,
      retryKey: input.retryKey,
      name: `${input.namePrefix} ${now().toISOString()}`,
      messageText: text.text,
      audienceFilterId: input.audienceFilterId,
      inlineAudienceQuery: input.inlineAudienceQuery,
    })
  }

  async function broadcast(input: {
    oaId: string
    retryKey: string | undefined
    body: CampaignBody
  }) {
    return sendCampaign({
      ...input,
      namePrefix: 'Messaging API broadcast',
      audienceFilterId: undefined,
      inlineAudienceQuery: { 'friendship.status': 'friend' },
    })
  }

  async function multicast(input: {
    oaId: string
    retryKey: string | undefined
    body: MulticastBody
  }) {
    if (!Array.isArray(input.body.to) || input.body.to.length === 0) {
      return { ok: false as const, code: 'INVALID_REQUEST', message: 'to is required' }
    }
    if (!input.body.to.every((userId) => typeof userId === 'string')) {
      return { ok: false as const, code: 'INVALID_REQUEST', message: 'to must contain strings' }
    }
    if (input.body.to.length > 500) {
      return {
        ok: false as const,
        code: 'INVALID_REQUEST',
        message: 'to must contain 500 or fewer user IDs',
      }
    }
    if (new Set(input.body.to).size !== input.body.to.length) {
      return {
        ok: false as const,
        code: 'INVALID_REQUEST',
        message: 'to must not contain duplicate user IDs',
      }
    }
    return sendCampaign({
      oaId: input.oaId,
      retryKey: input.retryKey,
      body: input.body,
      namePrefix: 'Messaging API multicast',
      audienceFilterId: undefined,
      inlineAudienceQuery: { providerUserId: { $in: input.body.to } },
    })
  }

  async function narrowcast(input: {
    oaId: string
    retryKey: string | undefined
    body: NarrowcastBody
  }) {
    if (input.body.filter !== undefined) {
      return {
        ok: false as const,
        code: 'UNSUPPORTED_AUDIENCE_FILTER',
        message: 'narrowcast filter is not supported',
      }
    }
    if (input.body.limit !== undefined) {
      return {
        ok: false as const,
        code: 'UNSUPPORTED_AUDIENCE_FILTER',
        message: 'narrowcast limit is not supported',
      }
    }
    const compiled = compileRecipient(input.body.recipient, { allowAllFriends: true })
    if (isFacadeError(compiled)) return compiled
    const invalidQuery = validateCompiledQuery(compiled.query)
    if (invalidQuery) return invalidQuery
    return sendCampaign({
      oaId: input.oaId,
      retryKey: input.retryKey,
      body: input.body,
      namePrefix: 'Messaging API narrowcast',
      audienceFilterId: compiled.audienceFilterId,
      inlineAudienceQuery: compiled.query,
    })
  }

  async function uploadAudienceGroup(input: {
    oaId: string
    body: UploadAudienceGroupBody
  }) {
    const name =
      typeof input.body.description === 'string' && input.body.description.trim()
        ? input.body.description.trim()
        : `Messaging API audience ${now().toISOString()}`
    const audiences = Array.isArray(input.body.audiences) ? input.body.audiences : []
    const userIds = audiences
      .map((item) =>
        typeof item === 'object' && item !== null ? (item as { id?: unknown }).id : undefined,
      )
      .filter((id): id is string => typeof id === 'string')
    if (userIds.length === 0) {
      return {
        ok: false as const,
        code: 'INVALID_REQUEST',
        message: 'audiences must contain at least one id',
      }
    }
    let filter: { id: string }
    try {
      const [createdFilter] = await deps.db
        .insert(oaAudienceFilter)
        .values({
          id: createId(),
          oaId: input.oaId,
          name,
          queryVersion: 1,
          queryJson: { providerUserId: { $in: [...new Set(userIds)] } },
          createdByManagerId: 'messaging-api',
          createdAt: now().toISOString(),
          updatedAt: now().toISOString(),
        })
        .returning({ id: oaAudienceFilter.id })
      if (!createdFilter) throw new Error('Audience group was not created')
      filter = createdFilter
    } catch (err) {
      if (err instanceof Error && err.message.includes('oaAudienceFilter_oaId_name_unique')) {
        return {
          ok: false as const,
          code: 'INVALID_REQUEST',
          message: 'audience description already exists',
        }
      }
      throw err
    }
    return { ok: true as const, audienceGroupId: filter.id, description: name }
  }

  async function getAudienceGroup(input: { oaId: string; audienceGroupId: string }) {
    const [filter] = await deps.db
      .select()
      .from(oaAudienceFilter)
      .where(
        and(
          eq(oaAudienceFilter.oaId, input.oaId),
          eq(oaAudienceFilter.id, input.audienceGroupId),
        ),
      )
      .limit(1)
    if (!filter) {
      return {
        ok: false as const,
        code: 'AUDIENCE_GROUP_NOT_FOUND',
        message: 'Audience group not found',
      }
    }
    return {
      ok: true as const,
      audienceGroupId: filter.id,
      description: filter.name,
      created: Math.floor(new Date(filter.createdAt).getTime() / 1000),
      permission: 'READ_WRITE',
      createRoute: 'MESSAGING_API',
      audienceCount: null,
    }
  }

  async function getMessageEventInsight(input: { oaId: string; requestId: string }) {
    const [row] = await deps.db
      .select({
        campaignId: oaCampaign.id,
        successCount: oaCampaign.successCount,
        failedCount: oaCampaign.failedCount,
        recipientSnapshotCount: oaCampaign.recipientSnapshotCount,
      })
      .from(oaCampaign)
      .leftJoin(oaMessageRequest, eq(oaMessageRequest.id, oaCampaign.messageRequestId))
      .where(
        and(
          eq(oaCampaign.oaId, input.oaId),
          or(
            eq(oaCampaign.id, input.requestId),
            eq(oaMessageRequest.acceptedRequestId, input.requestId),
          ),
        ),
      )
      .limit(1)
    if (!row) {
      return { ok: false as const, code: 'INVALID_REQUEST', message: 'requestId not found' }
    }
    return {
      ok: true as const,
      overview: {
        requestId: row.campaignId,
        delivered: row.successCount,
        failed: row.failedCount,
        target: row.recipientSnapshotCount,
      },
    }
  }

  return {
    broadcast,
    multicast,
    narrowcast,
    uploadAudienceGroup,
    getAudienceGroup,
    getMessageEventInsight,
  }
}
