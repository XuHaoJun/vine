import { Code, ConnectError, ConnectRouter } from '@connectrpc/connect'
import {
  AccessTokenType,
  BusinessProfileImageKind,
  OAService,
  OAStatus,
  WebhookStatus,
} from '@vine/proto/oa'
import { logger } from '../lib/logger'
import { requireAuthData, withAuthService } from './auth-context'
import type { createOAService } from '../services/oa'
import type { createOAAudienceService } from '../services/oa-audience'
import type { createOACampaignService } from '../services/oa-campaign'
import type { createOAWebhookDeliveryService } from '../services/oa-webhook-delivery'
import type { ServiceImpl } from '@connectrpc/connect'
import type { AuthServer } from '@take-out/better-auth-utils/server'
import type { DriveService } from '@vine/drive'
import type { RichMenuDisplayScheduler } from '../workers/rich-menu-scheduler'
import { validateRichMenuImageUpload } from '@vine/richmenu-schema'
import {
  displayPeriodChanged,
  parseDisplayPeriodInput,
} from '../services/oa-richmenu-display'

type OAHandlerDeps = {
  oa: ReturnType<typeof createOAService>
  oaAudience: ReturnType<typeof createOAAudienceService>
  oaCampaign: ReturnType<typeof createOACampaignService>
  auth: AuthServer
  drive: DriveService
  webhookDelivery: ReturnType<typeof createOAWebhookDeliveryService>
  richMenuDisplayScheduler: RichMenuDisplayScheduler
}

async function assertProviderOwnedByUser(
  deps: OAHandlerDeps,
  providerId: string,
  userId: string,
) {
  const provider = await deps.oa.getProvider(providerId)
  if (!provider) {
    throw new ConnectError('Provider not found', Code.NotFound)
  }
  if (provider.ownerId !== userId) {
    throw new ConnectError('Forbidden', Code.PermissionDenied)
  }
  return provider
}

async function assertOfficialAccountOwnedByUser(
  deps: OAHandlerDeps,
  officialAccountId: string,
  userId: string,
) {
  const account = await deps.oa.getOfficialAccount(officialAccountId)
  if (!account) {
    throw new ConnectError('Official account not found', Code.NotFound)
  }
  await assertProviderOwnedByUser(deps, account.providerId, userId)
  return account
}

function toProtoProvider(
  db: Awaited<ReturnType<ReturnType<typeof createOAService>['getProvider']>>,
) {
  if (!db) return undefined
  return {
    id: db.id,
    name: db.name,
    ownerId: db.ownerId,
    createdAt: db.createdAt,
    updatedAt: db.updatedAt,
  }
}

function dbStatusToProto(status: string): OAStatus {
  switch (status) {
    case 'active':
      return OAStatus.OA_STATUS_ACTIVE
    case 'disabled':
      return OAStatus.OA_STATUS_DISABLED
    default:
      return OAStatus.OA_STATUS_UNSPECIFIED
  }
}

function protoStatusToDb(status: OAStatus): string | undefined {
  switch (status) {
    case OAStatus.OA_STATUS_ACTIVE:
      return 'active'
    case OAStatus.OA_STATUS_DISABLED:
      return 'disabled'
    case OAStatus.OA_STATUS_UNSPECIFIED:
    default:
      return undefined
  }
}

function toProtoOfficialAccount(
  db: Awaited<ReturnType<ReturnType<typeof createOAService>['getOfficialAccount']>>,
) {
  if (!db) return undefined
  return {
    id: db.id,
    providerId: db.providerId,
    name: db.name,
    uniqueId: db.uniqueId,
    description: db.description ?? '',
    imageUrl: db.imageUrl ?? '',
    status: dbStatusToProto(db.status),
    createdAt: db.createdAt,
    updatedAt: db.updatedAt,
    email: db.email ?? '',
    country: db.country ?? '',
    company: db.company ?? '',
    industry: db.industry ?? '',
  }
}

function dbWebhookStatusToProto(status: string | undefined): WebhookStatus {
  switch (status) {
    case 'pending':
      return WebhookStatus.PENDING
    case 'verified':
      return WebhookStatus.VERIFIED
    case 'failed':
      return WebhookStatus.FAILED
    case undefined:
    default:
      return WebhookStatus.UNSPECIFIED
  }
}

function toProtoWebhook(
  db: Awaited<ReturnType<ReturnType<typeof createOAService>['getWebhook']>>,
) {
  if (!db) return undefined
  return {
    id: db.id,
    oaId: db.oaId,
    url: db.url,
    status: dbWebhookStatusToProto(db.status),
    lastVerifiedAt: db.lastVerifiedAt ?? undefined,
    createdAt: db.createdAt,
  }
}

function parseAudienceQueryJson(value: string) {
  try {
    return JSON.parse(value)
  } catch {
    throw new ConnectError('Invalid audience query JSON', Code.InvalidArgument)
  }
}

function toProtoWebhookSettings(
  db: Awaited<ReturnType<ReturnType<typeof createOAService>['getWebhook']>>,
) {
  return {
    webhook: toProtoWebhook(db),
    useWebhook: db?.useWebhook ?? true,
    webhookRedeliveryEnabled: db?.webhookRedeliveryEnabled ?? false,
    errorStatisticsEnabled: db?.errorStatisticsEnabled ?? false,
    lastVerifyStatusCode: db?.lastVerifyStatusCode ?? undefined,
    lastVerifyReason: db?.lastVerifyReason ?? undefined,
  }
}

function toProtoDeliverySummary(row: any) {
  return {
    id: row.id,
    webhookEventId: row.webhookEventId,
    eventType: row.eventType,
    status: row.status,
    reason: row.reason ?? undefined,
    detail: row.detail ?? undefined,
    responseStatus: row.responseStatus ?? undefined,
    attemptCount: row.attemptCount,
    isRedelivery: row.isRedelivery,
    createdAt: row.createdAt,
    lastAttemptedAt: row.lastAttemptedAt ?? undefined,
    deliveredAt: row.deliveredAt ?? undefined,
  }
}

function toProtoAttempt(row: any) {
  return {
    id: row.id,
    attemptNumber: row.attemptNumber,
    isRedelivery: row.isRedelivery,
    requestUrl: row.requestUrl,
    responseStatus: row.responseStatus ?? undefined,
    responseBodyExcerpt: row.responseBodyExcerpt ?? undefined,
    reason: row.reason ?? undefined,
    detail: row.detail ?? undefined,
    startedAt: row.startedAt,
    completedAt: row.completedAt ?? undefined,
  }
}

type DbRichMenuRow = {
  richMenuId: string
  name: string
  chatBarText: string
  selected: boolean
  sizeWidth: number
  sizeHeight: number
  areas: unknown
  hasImage: boolean
  displayStartsAt?: string | null
  displayEndsAt?: string | null
  managerStatus?: string
  displayScheduleRevision?: number
  clickCount?: number
}

function toRichMenuItem(m: DbRichMenuRow) {
  const areas = (
    m.areas as Array<{
      bounds: { x: number; y: number; width: number; height: number }
      action: Record<string, string | undefined>
    }>
  ).map((a) => ({
    bounds: {
      x: a.bounds.x,
      y: a.bounds.y,
      width: a.bounds.width,
      height: a.bounds.height,
    },
    action: {
      type: a.action['type'] ?? '',
      label: a.action['label'],
      uri: a.action['uri'],
      data: a.action['data'],
      text: a.action['text'],
      richMenuAliasId: a.action['richMenuAliasId'],
      inputOption: a.action['inputOption'],
      displayText: a.action['displayText'],
    },
  }))
  return {
    richMenuId: m.richMenuId,
    name: m.name,
    chatBarText: m.chatBarText,
    selected: m.selected,
    sizeWidth: m.sizeWidth,
    sizeHeight: m.sizeHeight,
    areas,
    hasImage: m.hasImage,
    displayStartsAt: m.displayStartsAt ?? undefined,
    displayEndsAt: m.displayEndsAt ?? undefined,
    managerStatus: m.managerStatus ?? 'inactive',
    displayScheduleRevision: m.displayScheduleRevision ?? 0,
    clickCount: m.clickCount ?? 0,
  }
}

function areaToDb(area: {
  bounds?: { x: number; y: number; width: number; height: number }
  action?: {
    type: string
    label?: string
    uri?: string
    data?: string
    text?: string
    richMenuAliasId?: string
    inputOption?: string
    displayText?: string
  }
}) {
  const action: Record<string, string> = { type: area.action?.type ?? '' }
  if (area.action?.label) action['label'] = area.action.label
  if (area.action?.uri) action['uri'] = area.action.uri
  if (area.action?.data) action['data'] = area.action.data
  if (area.action?.text) action['text'] = area.action.text
  if (area.action?.richMenuAliasId)
    action['richMenuAliasId'] = area.action.richMenuAliasId
  if (area.action?.inputOption) action['inputOption'] = area.action.inputOption
  if (area.action?.displayText) action['displayText'] = area.action.displayText
  return { bounds: area.bounds ?? { x: 0, y: 0, width: 0, height: 0 }, action }
}

function dbTokenTypeToProto(type: string): AccessTokenType {
  switch (type) {
    case 'short_lived':
      return AccessTokenType.SHORT_LIVED
    case 'jwt_v21':
      return AccessTokenType.JWT_V21
    default:
      return AccessTokenType.UNSPECIFIED
  }
}

function protoTokenTypeToDb(type: AccessTokenType): 'short_lived' | 'jwt_v21' {
  switch (type) {
    case AccessTokenType.SHORT_LIVED:
      return 'short_lived'
    case AccessTokenType.JWT_V21:
      return 'jwt_v21'
    case AccessTokenType.UNSPECIFIED:
    default:
      return 'short_lived'
  }
}

function jsonField(value: unknown) {
  return { json: JSON.stringify(value ?? {}) }
}

function parseJsonField(field: { json?: string } | undefined) {
  if (!field?.json) return undefined
  try {
    return JSON.parse(field.json)
  } catch {
    return undefined
  }
}

function toProtoBusinessProfile(db: any) {
  if (!db) return undefined
  return {
    officialAccountId: db.oaId,
    displayName: db.displayName,
    uniqueId: db.uniqueId,
    statusMessage: db.statusMessage ?? '',
    profileImageUrl: db.profileImageUrl ?? '',
    coverImageUrl: db.coverImageUrl ?? '',
    showFollowerCount: db.showFollowerCount,
    footerButtonColor: db.footerButtonColor,
    splashLabels: db.splashLabels ?? [],
    buttons: jsonField(db.buttons),
    address: jsonField(db.address),
    phoneNumber: db.phoneNumber ?? '',
    paymentMethods: jsonField(db.paymentMethods),
    businessHours: jsonField(db.businessHours),
    websites: jsonField(db.websites),
    visibilitySettings: jsonField(db.visibilitySettings),
    announcements: jsonField(db.announcements),
    mixedMediaFeed: jsonField(db.mixedMediaFeed),
    socialMedia: jsonField(db.socialMedia),
    basicInfoBlock: jsonField(db.basicInfoBlock),
    blockOrder: db.blockOrder ?? [],
    serverRevision: db.serverRevision ?? 0,
    lastSavedAt: db.lastSavedAt ?? '',
    publishedAt: db.publishedAt ?? '',
    createdAt: db.createdAt,
    updatedAt: db.updatedAt,
  }
}

function toEditorStateResponse(state: any) {
  return {
    account: toProtoOfficialAccount(state.account),
    published: toProtoBusinessProfile(state.published),
    draft: toProtoBusinessProfile(state.draft),
    isDirty: state.isDirty,
  }
}

function patchFromProto(patch: any) {
  const raw: Record<string, unknown> = {
    displayName: patch.displayName,
    uniqueId: patch.uniqueId,
    statusMessage: patch.statusMessage,
    profileImageUrl: patch.profileImageUrl,
    coverImageUrl: patch.coverImageUrl,
    showFollowerCount: patch.showFollowerCount,
    footerButtonColor: patch.footerButtonColor,
    splashLabels: patch.splashLabels ? patch.splashLabels.values : undefined,
    buttons: parseJsonField(patch.buttons),
    address: parseJsonField(patch.address),
    phoneNumber: patch.phoneNumber,
    paymentMethods: parseJsonField(patch.paymentMethods),
    businessHours: parseJsonField(patch.businessHours),
    websites: parseJsonField(patch.websites),
    visibilitySettings: parseJsonField(patch.visibilitySettings),
    announcements: parseJsonField(patch.announcements),
    mixedMediaFeed: parseJsonField(patch.mixedMediaFeed),
    socialMedia: parseJsonField(patch.socialMedia),
    basicInfoBlock: parseJsonField(patch.basicInfoBlock),
    blockOrder: patch.blockOrder ? patch.blockOrder.values : undefined,
  }
  const clean: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(raw)) {
    if (v !== undefined) clean[k] = v
  }
  return clean
}

export function oaHandler(deps: OAHandlerDeps) {
  return (router: ConnectRouter) => {
    const oaServiceImpl: ServiceImpl<typeof OAService> = {
      async listMyProviders(_req, ctx) {
        const auth = requireAuthData(ctx)
        const providers = await deps.oa.listMyProviders(auth.id)
        return {
          providers: providers
            .map(toProtoProvider)
            .filter((p): p is NonNullable<typeof p> => p != null),
        }
      },
      async createProvider(req, ctx) {
        const auth = requireAuthData(ctx)
        const provider = await deps.oa.createProvider({
          name: req.name,
          ownerId: auth.id,
        })
        return { provider: toProtoProvider(provider) }
      },
      async getProvider(req, ctx) {
        const auth = requireAuthData(ctx)
        const provider = await assertProviderOwnedByUser(deps, req.id, auth.id)
        return { provider: toProtoProvider(provider) }
      },
      async updateProvider(req, ctx) {
        const auth = requireAuthData(ctx)
        await assertProviderOwnedByUser(deps, req.id, auth.id)
        const provider = await deps.oa.updateProvider(req.id, { name: req.name })
        return { provider: toProtoProvider(provider) }
      },
      async deleteProvider(req, ctx) {
        const auth = requireAuthData(ctx)
        await assertProviderOwnedByUser(deps, req.id, auth.id)
        await deps.oa.deleteProvider(req.id)
        return {}
      },
      async listProviderAccounts(req, ctx) {
        const auth = requireAuthData(ctx)
        await assertProviderOwnedByUser(deps, req.providerId, auth.id)
        const accounts = await deps.oa.listProviderAccounts(req.providerId)
        return {
          accounts: accounts
            .map(toProtoOfficialAccount)
            .filter((a): a is NonNullable<typeof a> => a != null),
        }
      },
      async listMyOfficialAccounts(_req, ctx) {
        const auth = requireAuthData(ctx)
        const accounts = await deps.oa.listMyOfficialAccounts(auth.id)
        return {
          accounts: accounts.map((a) => ({
            id: a.id,
            providerId: a.providerId,
            name: a.name,
            uniqueId: a.uniqueId,
            description: a.description ?? '',
            imageUrl: a.imageUrl ?? '',
            status: dbStatusToProto(a.status),
            createdAt: a.createdAt,
            updatedAt: a.updatedAt,
            email: a.email ?? '',
            country: a.country ?? '',
            company: a.company ?? '',
            industry: a.industry ?? '',
          })),
        }
      },
      async createOfficialAccount(req, ctx) {
        const auth = requireAuthData(ctx)
        await assertProviderOwnedByUser(deps, req.providerId, auth.id)
        const account = await deps.oa.createOfficialAccount({
          providerId: req.providerId,
          name: req.name,
          uniqueId: req.uniqueId,
          description: req.description,
          imageUrl: req.imageUrl,
          email: req.email,
          country: req.country,
          company: req.company,
          industry: req.industry,
        })
        return { account: toProtoOfficialAccount(account) }
      },
      async getOfficialAccount(req, ctx) {
        const auth = requireAuthData(ctx)
        const account = await assertOfficialAccountOwnedByUser(deps, req.id, auth.id)
        return { account: toProtoOfficialAccount(account) }
      },
      async getOfficialAccountSecret(req, ctx) {
        const auth = requireAuthData(ctx)
        const account = await assertOfficialAccountOwnedByUser(deps, req.id, auth.id)
        return { secret: { channelSecret: account.channelSecret } }
      },
      async updateOfficialAccount(req, ctx) {
        const auth = requireAuthData(ctx)
        await assertOfficialAccountOwnedByUser(deps, req.id, auth.id)
        const account = await deps.oa.updateOfficialAccount(req.id, {
          name: req.name,
          description: req.description,
          imageUrl: req.imageUrl,
          status: req.status !== undefined ? protoStatusToDb(req.status) : undefined,
        })
        return { account: toProtoOfficialAccount(account) }
      },
      async deleteOfficialAccount(req, ctx) {
        const auth = requireAuthData(ctx)
        await assertOfficialAccountOwnedByUser(deps, req.id, auth.id)
        await deps.oa.deleteOfficialAccount(req.id)
        return {}
      },
      async setWebhook(req, ctx) {
        const auth = requireAuthData(ctx)
        await assertOfficialAccountOwnedByUser(deps, req.officialAccountId, auth.id)
        const webhook = await deps.oa.setWebhook(req.officialAccountId, req.url)
        return { webhook: toProtoWebhook(webhook) }
      },
      async verifyWebhook(req, ctx) {
        const auth = requireAuthData(ctx)
        await assertOfficialAccountOwnedByUser(deps, req.officialAccountId, auth.id)
        const result = await deps.oa.verifyWebhook(req.officialAccountId)
        const statusMap: Record<string, number> = {
          pending: 1,
          verified: 2,
          failed: 3,
          no_webhook: 0,
          oa_not_found: 0,
        }
        return { status: statusMap[result.status] ?? 0 }
      },
      async getWebhook(req, ctx) {
        const auth = requireAuthData(ctx)
        await assertOfficialAccountOwnedByUser(deps, req.officialAccountId, auth.id)
        const webhook = await deps.oa.getWebhook(req.officialAccountId)
        return { webhook: toProtoWebhook(webhook) }
      },
      async getWebhookSettings(req, ctx) {
        const auth = requireAuthData(ctx)
        await assertOfficialAccountOwnedByUser(deps, req.officialAccountId, auth.id)
        const webhook = await deps.oa.getWebhook(req.officialAccountId)
        return { settings: toProtoWebhookSettings(webhook) }
      },
      async updateWebhookSettings(req, ctx) {
        const auth = requireAuthData(ctx)
        await assertOfficialAccountOwnedByUser(deps, req.officialAccountId, auth.id)
        let webhook
        try {
          webhook = await deps.oa.updateWebhookSettings(req.officialAccountId, {
            url: req.url,
            useWebhook: req.useWebhook,
            webhookRedeliveryEnabled: req.webhookRedeliveryEnabled,
            errorStatisticsEnabled: req.errorStatisticsEnabled,
          })
        } catch (error) {
          if (error instanceof Error && error.message.includes('Webhook URL')) {
            throw new ConnectError(error.message, Code.InvalidArgument)
          }
          throw error
        }
        return { settings: toProtoWebhookSettings(webhook) }
      },
      async verifyWebhookEndpoint(req, ctx) {
        const auth = requireAuthData(ctx)
        await assertOfficialAccountOwnedByUser(deps, req.officialAccountId, auth.id)
        let result
        try {
          result = await deps.webhookDelivery.verifyWebhook({
            oaId: req.officialAccountId,
            endpointOverride: req.endpointOverride,
          })
        } catch (error) {
          if (error instanceof Error && error.message.includes('Webhook URL')) {
            throw new ConnectError(error.message, Code.InvalidArgument)
          }
          throw error
        }
        return { result }
      },
      async listWebhookDeliveries(req, ctx) {
        const auth = requireAuthData(ctx)
        await assertOfficialAccountOwnedByUser(deps, req.officialAccountId, auth.id)
        const result = await deps.webhookDelivery.listDeliveries({
          oaId: req.officialAccountId,
          pageSize: req.pageSize > 0 ? req.pageSize : 50,
          cursor: req.cursor,
          statusFilter: req.statusFilter,
        })
        return {
          deliveries: result.deliveries.map(toProtoDeliverySummary),
          nextCursor: result.nextCursor,
        }
      },
      async getWebhookDelivery(req, ctx) {
        const auth = requireAuthData(ctx)
        await assertOfficialAccountOwnedByUser(deps, req.officialAccountId, auth.id)
        const result = await deps.webhookDelivery.getDelivery({
          oaId: req.officialAccountId,
          deliveryId: req.deliveryId,
        })
        if (!result) throw new ConnectError('Webhook delivery not found', Code.NotFound)
        return {
          delivery: toProtoDeliverySummary(result.delivery),
          payloadJson: JSON.stringify(result.delivery.payloadJson, null, 2),
          attempts: result.attempts.map(toProtoAttempt),
        }
      },
      async redeliverWebhook(req, ctx) {
        const auth = requireAuthData(ctx)
        await assertOfficialAccountOwnedByUser(deps, req.officialAccountId, auth.id)
        const result = await deps.webhookDelivery.redeliver({
          oaId: req.officialAccountId,
          deliveryId: req.deliveryId,
        })
        if (result.kind === 'redelivery-disabled') {
          throw new ConnectError(
            'Webhook redelivery is disabled',
            Code.FailedPrecondition,
          )
        }
        if (result.kind === 'delivery-not-found') {
          throw new ConnectError('Webhook delivery not found', Code.NotFound)
        }
        if (result.kind === 'delivery-not-failed') {
          throw new ConnectError(
            'Webhook delivery is not failed',
            Code.FailedPrecondition,
          )
        }
        if (result.kind === 'oa-not-found') {
          throw new ConnectError('Official account not found', Code.NotFound)
        }
        if (result.kind === 'webhook-not-ready') {
          throw new ConnectError(
            'Webhook is not configured or not verified',
            Code.FailedPrecondition,
          )
        }
        if (result.kind === 'delivery-failed') {
          throw new ConnectError(
            `Webhook redelivery failed: ${result.detail}`,
            Code.Internal,
          )
        }
        const refreshed = await deps.webhookDelivery.getDelivery({
          oaId: req.officialAccountId,
          deliveryId: req.deliveryId,
        })
        if (!refreshed)
          throw new ConnectError('Webhook delivery not found', Code.NotFound)
        return { delivery: toProtoDeliverySummary(refreshed.delivery) }
      },
      async sendTestWebhookEvent(req, ctx) {
        const auth = requireAuthData(ctx)
        await assertOfficialAccountOwnedByUser(deps, req.officialAccountId, auth.id)
        const result = await deps.webhookDelivery.sendTestWebhookEvent({
          oaId: req.officialAccountId,
          text: req.text || 'Webhook test from Vine',
        })
        return { result }
      },
      async issueAccessToken(req, ctx) {
        const auth = requireAuthData(ctx)
        await assertOfficialAccountOwnedByUser(deps, req.officialAccountId, auth.id)
        const result = await deps.oa.issueAccessToken({
          oaId: req.officialAccountId,
          type: protoTokenTypeToDb(req.type),
          publicKey: req.publicKey,
        })
        return {
          accessToken: result.access_token,
          expiresIn: result.expires_in,
          tokenType: result.token_type,
          keyId: result.key_id,
        }
      },
      async listAccessTokens(req, ctx) {
        const auth = requireAuthData(ctx)
        await assertOfficialAccountOwnedByUser(deps, req.officialAccountId, auth.id)
        const tokens = await deps.oa.listAccessTokens(req.officialAccountId, req.keyId)
        return {
          tokens: tokens.map((t) => ({
            id: t.id,
            type: dbTokenTypeToProto(t.type),
            keyId: t.keyId ?? undefined,
            expiresAt: t.expiresAt ?? undefined,
            createdAt: t.createdAt,
          })),
        }
      },
      async revokeAccessToken(req, ctx) {
        const auth = requireAuthData(ctx)
        const tokenRow = await deps.oa.getAccessTokenById(req.tokenId)
        if (!tokenRow) {
          throw new ConnectError('Access token not found', Code.NotFound)
        }
        await assertOfficialAccountOwnedByUser(deps, tokenRow.oaId, auth.id)
        await deps.oa.revokeAccessToken(req.tokenId)
        return {}
      },
      async revokeAllAccessTokens(req, ctx) {
        const auth = requireAuthData(ctx)
        await assertOfficialAccountOwnedByUser(deps, req.officialAccountId, auth.id)
        const result = await deps.oa.revokeAllAccessTokens(
          req.officialAccountId,
          req.keyId,
        )
        return { revokedCount: result.revoked_count }
      },
      async getMessagingApiQuotaSummary(req, ctx) {
        const auth = requireAuthData(ctx)
        await assertOfficialAccountOwnedByUser(deps, req.officialAccountId, auth.id)
        const quota = await deps.oa.getQuota(req.officialAccountId)
        return {
          type: quota.type,
          monthlyLimit: quota.value,
          totalUsage: quota.totalUsage,
        }
      },
      async getOfficialAccountManagerSummary(req, ctx) {
        const auth = requireAuthData(ctx)
        await assertOfficialAccountOwnedByUser(deps, req.officialAccountId, auth.id)
        const summary = await deps.oa.getManagerSummary(req.officialAccountId)
        if (!summary) throw new ConnectError('Account not found', Code.NotFound)
        return {
          account: toProtoOfficialAccount(summary.account),
          friendCount: summary.friendCount,
          chat: {
            status: summary.chat.status,
            chatCount: summary.chat.chatCount,
          },
          richMenu: {
            totalCount: summary.richMenu.totalCount,
            defaultRichMenuId: summary.richMenu.defaultRichMenuId,
            defaultRichMenuTitle: summary.richMenu.defaultRichMenuTitle,
          },
          webhook: {
            configured: summary.webhook.configured,
            useWebhook: summary.webhook.useWebhook,
            status: dbWebhookStatusToProto(summary.webhook.status),
            lastVerifiedAt: summary.webhook.lastVerifiedAt,
            lastVerifyReason: summary.webhook.lastVerifyReason,
          },
          quota: {
            type: summary.quota.type,
            monthlyLimit: summary.quota.monthlyLimit,
            totalUsage: summary.quota.totalUsage,
            remaining: summary.quota.remaining,
          },
          setup: {
            profileComplete: summary.setup.profileComplete,
            profileImageAdded: summary.setup.profileImageAdded,
            webhookConfigured: summary.setup.webhookConfigured,
            defaultRichMenuCreated: summary.setup.defaultRichMenuCreated,
            chatInboxAvailable: summary.setup.chatInboxAvailable,
          },
        }
      },
      async searchOfficialAccounts(req, ctx) {
        const auth = requireAuthData(ctx)
        const accounts = await deps.oa.searchOAsForOwner(auth.id, req.query)
        const profileMap = await deps.oa.getPublishedBusinessProfiles(
          accounts.map((a) => a.id),
        )
        return {
          accounts: accounts.map((a) => {
            const profile = profileMap.get(a.id)
            return {
              id: a.id,
              name: profile?.displayName ?? a.name,
              uniqueId: profile?.uniqueId ?? a.uniqueId,
              description: profile?.statusMessage ?? a.description ?? '',
              imageUrl: profile?.profileImageUrl ?? a.imageUrl ?? '',
              coverImageUrl: profile?.coverImageUrl ?? '',
              statusMessage: profile?.statusMessage ?? a.description ?? '',
              showFollowerCount: profile?.showFollowerCount ?? false,
              splashLabels: profile?.splashLabels ?? [],
              footerButtonColor: profile?.footerButtonColor ?? '#06c755',
              buttons: jsonField(profile?.buttons ?? []),
              socialMedia: jsonField(profile?.socialMedia ?? {}),
              basicInfoBlock: jsonField(profile?.basicInfoBlock ?? {}),
            }
          }),
        }
      },
      async recommendOfficialAccounts(req) {
        const limit = req.limit > 0 ? req.limit : 15
        const accounts = await deps.oa.recommendOfficialAccounts(limit)
        const profileMap = await deps.oa.getPublishedBusinessProfiles(
          accounts.map((a) => a.id),
        )
        return {
          accounts: accounts.map((a) => {
            const profile = profileMap.get(a.id)
            return {
              id: a.id,
              name: profile?.displayName ?? a.name,
              uniqueId: profile?.uniqueId ?? a.uniqueId,
              description: profile?.statusMessage ?? a.description ?? '',
              imageUrl: profile?.profileImageUrl ?? a.imageUrl ?? '',
              coverImageUrl: profile?.coverImageUrl ?? '',
              statusMessage: profile?.statusMessage ?? a.description ?? '',
              showFollowerCount: profile?.showFollowerCount ?? false,
              splashLabels: profile?.splashLabels ?? [],
              footerButtonColor: profile?.footerButtonColor ?? '#06c755',
              buttons: jsonField(profile?.buttons ?? []),
              socialMedia: jsonField(profile?.socialMedia ?? {}),
              basicInfoBlock: jsonField(profile?.basicInfoBlock ?? {}),
            }
          }),
        }
      },
      async addOAFriend(req, ctx) {
        const auth = requireAuthData(ctx)
        const result = await deps.oa.addOAFriend(auth.id, req.officialAccountId)
        if (!result.success) {
          if (result.reason === 'oa_not_found') {
            throw new ConnectError('Official account not found', Code.NotFound)
          }
          if (result.reason === 'already_friend') {
            throw new ConnectError('Already friends', Code.AlreadyExists)
          }
        }
        const friendship = result.friendship!
        const account = result.account!
        return {
          friendship: {
            id: friendship.id,
            officialAccountId: account.id,
            oaName: account.name,
            oaImageUrl: account.imageUrl ?? '',
            status: friendship.status,
            createdAt: friendship.createdAt,
          },
        }
      },
      async removeOAFriend(req, ctx) {
        const auth = requireAuthData(ctx)
        await deps.oa.removeOAFriend(auth.id, req.officialAccountId)
        return {}
      },
      async listMyOAFriends(_req, ctx) {
        const auth = requireAuthData(ctx)
        const friendships = await deps.oa.listMyOAFriends(auth.id)
        return {
          friendships: friendships.map((f) => ({
            id: f.id,
            officialAccountId: f.oaId,
            oaName: f.name,
            oaImageUrl: f.imageUrl ?? '',
            status: f.status,
            createdAt: f.createdAt,
          })),
        }
      },
      async isOAFriend(req, ctx) {
        const auth = requireAuthData(ctx)
        const isFriend = await deps.oa.isOAFriend(auth.id, req.officialAccountId)
        return { isFriend }
      },
      async resolveOfficialAccount(req) {
        const account = await deps.oa.findOfficialAccountByUniqueId(req.uniqueId)
        if (!account) {
          throw new ConnectError('Official account not found', Code.NotFound)
        }
        const profile = await deps.oa.getPublishedBusinessProfile(account.id)
        return {
          account: {
            id: account.id,
            name: profile?.displayName ?? account.name,
            uniqueId: profile?.uniqueId ?? account.uniqueId,
            description: profile?.statusMessage ?? account.description ?? '',
            imageUrl: profile?.profileImageUrl ?? account.imageUrl ?? '',
            coverImageUrl: profile?.coverImageUrl ?? '',
            statusMessage: profile?.statusMessage ?? account.description ?? '',
            showFollowerCount: profile?.showFollowerCount ?? false,
            splashLabels: profile?.splashLabels ?? [],
            footerButtonColor: profile?.footerButtonColor ?? '#06c755',
            buttons: jsonField(profile?.buttons ?? []),
            socialMedia: jsonField(profile?.socialMedia ?? {}),
            basicInfoBlock: jsonField(profile?.basicInfoBlock ?? {}),
          },
        }
      },
      async simulatorSendFlexMessage(req, ctx) {
        const auth = requireAuthData(ctx)
        const result = await deps.oa.simulatorSendFlexMessage(auth.id, req.flexJson)
        if (!result.success) {
          if (result.reason === 'not_friend') {
            throw new ConnectError(
              '請先加入 Flex Message sim 為好友',
              Code.FailedPrecondition,
            )
          }
          if (result.reason === 'oa_not_found') {
            throw new ConnectError('Flex Simulator OA not found', Code.Internal)
          }
          throw new ConnectError('Unknown error', Code.Internal)
        }
        return {}
      },
      async getActiveRichMenu(req, ctx) {
        const auth = requireAuthData(ctx)
        const userId = auth.id
        const oaId = req.officialAccountId

        const menu = await deps.oa.getActiveRichMenuForUser({ oaId, userId })
        if (!menu) {
          return {}
        }

        const areas = menu.areas as Array<{
          bounds: { x: number; y: number; width: number; height: number }
          action: Record<string, string | undefined>
        }>

        let imageBytes: Uint8Array | undefined
        let imageContentType: string | undefined
        if (menu.hasImage) {
          const exts = ['jpg', 'png']
          let found = false
          for (const ext of exts) {
            const key = `richmenu/${oaId}/${menu.richMenuId}.${ext}`
            if (await deps.drive.exists(key)) {
              const file = await deps.drive.get(key)
              imageBytes = new Uint8Array(file.content)
              imageContentType = file.mimeType ?? 'image/jpeg'
              found = true
              break
            }
          }
        }

        return {
          richMenu: {
            richMenuId: menu.richMenuId,
            name: menu.name,
            chatBarText: menu.chatBarText,
            selected: menu.selected,
            sizeWidth: menu.sizeWidth,
            sizeHeight: menu.sizeHeight,
            areas: areas.map((a) => ({
              bounds: {
                x: a.bounds.x,
                y: a.bounds.y,
                width: a.bounds.width,
                height: a.bounds.height,
              },
              action: {
                type: a.action.type ?? '',
                label: a.action.label,
                uri: a.action.uri,
                data: a.action.data,
                text: a.action.text,
                richMenuAliasId: a.action.richMenuAliasId,
                inputOption: a.action.inputOption,
                displayText: a.action.displayText,
              },
            })),
          },
          image: imageBytes,
          imageContentType,
        }
      },
      async listRichMenus(req, ctx) {
        const auth = requireAuthData(ctx)
        await assertOfficialAccountOwnedByUser(deps, req.officialAccountId, auth.id)
        const menus = await deps.oa.getRichMenuListForManager(req.officialAccountId)
        const defaultMenu = await deps.oa.getDefaultRichMenu(req.officialAccountId)
        return {
          menus: menus.map(toRichMenuItem),
          defaultRichMenuId: defaultMenu?.richMenuId,
        }
      },
      async getRichMenu(req, ctx) {
        const auth = requireAuthData(ctx)
        await assertOfficialAccountOwnedByUser(deps, req.officialAccountId, auth.id)
        const menu = await deps.oa.getRichMenu(req.officialAccountId, req.richMenuId)
        if (!menu) throw new ConnectError('Rich menu not found', Code.NotFound)
        let imageBytes: Uint8Array | undefined
        let imageContentType: string | undefined
        if (menu.hasImage) {
          for (const ext of ['jpg', 'png'] as const) {
            const key = `richmenu/${req.officialAccountId}/${req.richMenuId}.${ext}`
            if (await deps.drive.exists(key)) {
              const file = await deps.drive.get(key)
              imageBytes = new Uint8Array(file.content)
              imageContentType = file.mimeType ?? (ext === 'png' ? 'image/png' : 'image/jpeg')
              break
            }
          }
        }
        return { menu: toRichMenuItem(menu), image: imageBytes, imageContentType }
      },
      async createRichMenu(req, ctx) {
        const auth = requireAuthData(ctx)
        await assertOfficialAccountOwnedByUser(deps, req.officialAccountId, auth.id)
        let displayPeriod
        try {
          displayPeriod = parseDisplayPeriodInput({
            displayStartsAt: req.displayStartsAt,
            displayEndsAt: req.displayEndsAt,
          })
        } catch (err) {
          throw new ConnectError(
            err instanceof Error ? err.message : 'Invalid display period',
            Code.InvalidArgument,
          )
        }
        const menu = await deps.oa.createRichMenu({
          oaId: req.officialAccountId,
          name: req.name,
          chatBarText: req.chatBarText,
          selected: req.selected,
          sizeWidth: req.sizeWidth,
          sizeHeight: req.sizeHeight,
          areas: req.areas.map(areaToDb),
          displayStartsAt: displayPeriod.displayStartsAt,
          displayEndsAt: displayPeriod.displayEndsAt,
        })
        if (displayPeriod.displayStartsAt || displayPeriod.displayEndsAt) {
          await deps.richMenuDisplayScheduler.enqueueDisplayPeriodJobs({
            oaId: req.officialAccountId,
            richMenuId: menu.richMenuId,
            displayScheduleRevision: menu.displayScheduleRevision,
            displayPeriod,
          })
        }
        return { richMenuId: menu.richMenuId }
      },
      async updateRichMenu(req, ctx) {
        const auth = requireAuthData(ctx)
        await assertOfficialAccountOwnedByUser(deps, req.officialAccountId, auth.id)
        const existing = await deps.oa.getRichMenu(req.officialAccountId, req.richMenuId)
        if (!existing) throw new ConnectError('Rich menu not found', Code.NotFound)

        let displayPeriod
        try {
          displayPeriod = parseDisplayPeriodInput({
            displayStartsAt: req.displayStartsAt,
            displayEndsAt: req.displayEndsAt,
          })
        } catch (err) {
          throw new ConnectError(
            err instanceof Error ? err.message : 'Invalid display period',
            Code.InvalidArgument,
          )
        }

        const incrementDisplayScheduleRevision = displayPeriodChanged(
          {
            displayStartsAt: existing.displayStartsAt,
            displayEndsAt: existing.displayEndsAt,
          },
          displayPeriod,
        )

        const updated = await deps.oa.updateRichMenu(req.officialAccountId, req.richMenuId, {
          name: req.name,
          chatBarText: req.chatBarText,
          selected: req.selected,
          sizeWidth: req.sizeWidth,
          sizeHeight: req.sizeHeight,
          areas: req.areas.map(areaToDb),
          displayStartsAt: displayPeriod.displayStartsAt,
          displayEndsAt: displayPeriod.displayEndsAt,
          incrementDisplayScheduleRevision,
        })

        if (updated && incrementDisplayScheduleRevision) {
          await deps.richMenuDisplayScheduler.enqueueDisplayPeriodJobs({
            oaId: req.officialAccountId,
            richMenuId: req.richMenuId,
            displayScheduleRevision: updated.displayScheduleRevision,
            displayPeriod,
          })
        }
        return {}
      },
      async deleteRichMenu(req, ctx) {
        const auth = requireAuthData(ctx)
        await assertOfficialAccountOwnedByUser(deps, req.officialAccountId, auth.id)
        await deps.oa.deleteRichMenu(req.officialAccountId, req.richMenuId)
        for (const ext of ['jpg', 'png'] as const) {
          const key = `richmenu/${req.officialAccountId}/${req.richMenuId}.${ext}`
          if (await deps.drive.exists(key)) await deps.drive.delete(key)
        }
        return {}
      },
      async setDefaultRichMenu(req, ctx) {
        const auth = requireAuthData(ctx)
        await assertOfficialAccountOwnedByUser(deps, req.officialAccountId, auth.id)
        const menu = await deps.oa.getRichMenu(req.officialAccountId, req.richMenuId)
        if (!menu) throw new ConnectError('Rich menu not found', Code.NotFound)
        if (!menu.hasImage) {
          throw new ConnectError(
            'Upload a rich menu image before setting it as default',
            Code.FailedPrecondition,
          )
        }
        await deps.oa.setDefaultRichMenu(req.officialAccountId, req.richMenuId)
        return {}
      },
      async clearDefaultRichMenu(req, ctx) {
        const auth = requireAuthData(ctx)
        await assertOfficialAccountOwnedByUser(deps, req.officialAccountId, auth.id)
        await deps.oa.clearDefaultRichMenu(req.officialAccountId)
        return {}
      },
      async uploadRichMenuImage(req, ctx) {
        const auth = requireAuthData(ctx)
        await assertOfficialAccountOwnedByUser(deps, req.officialAccountId, auth.id)

        const menu = await deps.oa.getRichMenu(req.officialAccountId, req.richMenuId)
        if (!menu) throw new ConnectError('Rich menu not found', Code.NotFound)

        const buffer = Buffer.from(req.image)
        const validation = validateRichMenuImageUpload({
          contentType: req.contentType,
          bytes: buffer,
          expectedWidth: menu.sizeWidth,
          expectedHeight: menu.sizeHeight,
        })
        if (!validation.success) {
          throw new ConnectError(validation.message, Code.InvalidArgument)
        }

        for (const ext of ['jpg', 'png'] as const) {
          const staleKey = `richmenu/${req.officialAccountId}/${req.richMenuId}.${ext}`
          if (await deps.drive.exists(staleKey)) await deps.drive.delete(staleKey)
        }
        const key = `richmenu/${req.officialAccountId}/${req.richMenuId}.${validation.extension}`

        await deps.drive.put(key, buffer, req.contentType)
        await deps.oa.setRichMenuImage(req.officialAccountId, req.richMenuId, true)
        return {}
      },
      async switchRichMenu(req, ctx) {
        const auth = requireAuthData(ctx)
        const isMember = await deps.oa.isUserChatMember(auth.id, req.chatId)
        if (!isMember) {
          throw new ConnectError(
            'Forbidden: not a member of this chat',
            Code.PermissionDenied,
          )
        }
        const isFriend = await deps.oa.isOAFriend(auth.id, req.officialAccountId)
        if (!isFriend) {
          throw new ConnectError('Forbidden: not an OA friend', Code.PermissionDenied)
        }
        const alias = await deps.oa.getRichMenuAlias(
          req.officialAccountId,
          req.richMenuAliasId,
        )
        if (!alias) {
          return { status: 'RICHMENU_ALIAS_ID_NOTFOUND' }
        }
        const menu = await deps.oa.getRichMenu(req.officialAccountId, alias.richMenuId)
        if (!menu) {
          return { status: 'RICHMENU_NOTFOUND' }
        }
        await deps.oa.linkRichMenuToUser(req.officialAccountId, auth.id, alias.richMenuId)
        // fire-and-forget webhook delivery — do not await
        deps.webhookDelivery
          .deliverRealEvent({
            oaId: req.officialAccountId,
            buildPayload: async () => {
              const replyTokenRecord = await deps.oa.registerReplyToken({
                oaId: req.officialAccountId,
                userId: auth.id,
                chatId: req.chatId,
                messageId: null,
              })
              return deps.oa.buildRichMenuSwitchPostbackEvent({
                oaId: req.officialAccountId,
                userId: auth.id,
                replyToken: replyTokenRecord.token,
                data: req.data,
                newRichMenuAliasId: req.richMenuAliasId,
                status: 'SUCCESS',
              })
            },
          })
          .catch((err: unknown) => {
            logger.error(
              { err, oaId: req.officialAccountId, chatId: req.chatId },
              '[oa] richmenuswitch webhook delivery failed',
            )
          })
        return { status: 'SUCCESS', newRichMenuAliasId: req.richMenuAliasId }
      },
      async listRichMenuAliases(req, ctx) {
        const auth = requireAuthData(ctx)
        await assertOfficialAccountOwnedByUser(deps, req.officialAccountId, auth.id)
        const aliases = await deps.oa.getRichMenuAliasList(req.officialAccountId)
        return {
          aliases: aliases.map((a) => ({
            richMenuAliasId: a.richMenuAliasId,
            richMenuId: a.richMenuId,
            createdAt: a.createdAt,
          })),
        }
      },
      async createRichMenuAlias(req, ctx) {
        const auth = requireAuthData(ctx)
        await assertOfficialAccountOwnedByUser(deps, req.officialAccountId, auth.id)
        if (
          !req.richMenuAliasId ||
          req.richMenuAliasId.length > 32 ||
          !/^[a-zA-Z0-9_-]+$/.test(req.richMenuAliasId)
        ) {
          throw new ConnectError('Invalid richMenuAliasId', Code.InvalidArgument)
        }
        const menu = await deps.oa.getRichMenu(req.officialAccountId, req.richMenuId)
        if (!menu || !menu.hasImage) {
          throw new ConnectError('Rich menu not found', Code.InvalidArgument)
        }
        let alias
        try {
          alias = await deps.oa.createRichMenuAlias({
            oaId: req.officialAccountId,
            richMenuAliasId: req.richMenuAliasId,
            richMenuId: req.richMenuId,
          })
        } catch (err) {
          if ((err as { code?: string }).code === '23505') {
            throw new ConnectError('Rich menu alias already exists', Code.AlreadyExists)
          }
          throw err
        }
        return {
          alias: {
            richMenuAliasId: alias.richMenuAliasId,
            richMenuId: alias.richMenuId,
            createdAt: alias.createdAt,
          },
        }
      },
      async deleteRichMenuAliasManager(req, ctx) {
        const auth = requireAuthData(ctx)
        await assertOfficialAccountOwnedByUser(deps, req.officialAccountId, auth.id)
        const alias = await deps.oa.getRichMenuAlias(
          req.officialAccountId,
          req.richMenuAliasId,
        )
        if (!alias) {
          throw new ConnectError('Rich menu alias not found', Code.NotFound)
        }
        await deps.oa.deleteRichMenuAlias(req.officialAccountId, req.richMenuAliasId)
        return {}
      },
      async listOAUsersWithRichMenus(req, ctx) {
        const auth = requireAuthData(ctx)
        await assertOfficialAccountOwnedByUser(deps, req.officialAccountId, auth.id)
        const users = await deps.oa.listOAUsersWithRichMenus({
          oaId: req.officialAccountId,
          richMenuId: req.richMenuId,
        })
        return {
          users: users.map((u) => ({
            userId: u.userId,
            userName: u.userName ?? undefined,
            userImage: u.userImage ?? undefined,
            assignedRichMenuId: u.assignedRichMenuId ?? undefined,
          })),
        }
      },
      async linkRichMenuToUserManager(req, ctx) {
        const auth = requireAuthData(ctx)
        await assertOfficialAccountOwnedByUser(deps, req.officialAccountId, auth.id)
        const isFriend = await deps.oa.isOAFriend(req.userId, req.officialAccountId)
        if (!isFriend) {
          throw new ConnectError('User is not an OA friend', Code.FailedPrecondition)
        }
        const menu = await deps.oa.getRichMenu(req.officialAccountId, req.richMenuId)
        if (!menu) {
          throw new ConnectError('Rich menu not found', Code.NotFound)
        }
        await deps.oa.linkRichMenuToUser(
          req.officialAccountId,
          req.userId,
          req.richMenuId,
        )
        return {}
      },
      async unlinkRichMenuFromUserManager(req, ctx) {
        const auth = requireAuthData(ctx)
        await assertOfficialAccountOwnedByUser(deps, req.officialAccountId, auth.id)
        await deps.oa.unlinkRichMenuFromUser(req.officialAccountId, req.userId)
        return {}
      },
      async trackRichMenuClick(req, ctx) {
        const auth = requireAuthData(ctx)
        const isFriend = await deps.oa.isOAFriend(auth.id, req.officialAccountId)
        if (!isFriend) {
          throw new ConnectError('Forbidden: not an OA friend', Code.PermissionDenied)
        }
        const menu = await deps.oa.getRichMenu(req.officialAccountId, req.richMenuId)
        if (!menu) {
          throw new ConnectError('Rich menu not found', Code.NotFound)
        }
        const areas = menu.areas as unknown[]
        if (req.areaIndex < 0 || req.areaIndex >= areas.length) {
          throw new ConnectError('Invalid areaIndex', Code.InvalidArgument)
        }
        await deps.oa.addRichMenuClick({
          oaId: req.officialAccountId,
          richMenuId: req.richMenuId,
          areaIndex: req.areaIndex,
        })
        return {}
      },
      async getRichMenuStats(req, ctx) {
        const auth = requireAuthData(ctx)
        await assertOfficialAccountOwnedByUser(deps, req.officialAccountId, auth.id)
        const stats = await deps.oa.getRichMenuClickStats(
          req.officialAccountId,
          req.richMenuId,
        )
        return {
          stats: stats.map((s) => ({
            areaIndex: s.areaIndex,
            clickCount: s.clickCount,
          })),
        }
      },
      async getBusinessProfileEditorState(req, ctx) {
        const auth = requireAuthData(ctx)
        await assertOfficialAccountOwnedByUser(deps, req.officialAccountId, auth.id)
        const state = await deps.oa.getBusinessProfileEditorState(req.officialAccountId)
        if (!state) throw new ConnectError('Official account not found', Code.NotFound)
        return toEditorStateResponse(state)
      },
      async autosaveBusinessProfileDraft(req, ctx) {
        const auth = requireAuthData(ctx)
        await assertOfficialAccountOwnedByUser(deps, req.officialAccountId, auth.id)
        const state = await deps.oa.autosaveBusinessProfileDraft(
          req.officialAccountId,
          patchFromProto(req.patch),
          req.clientRevision,
        )
        if (!state) throw new ConnectError('Official account not found', Code.NotFound)
        return {
          draft: toProtoBusinessProfile(state.draft),
          serverRevision: state.draft.serverRevision,
          savedAt: state.draft.lastSavedAt ?? '',
          isDirty: state.isDirty,
        }
      },
      async resetBusinessProfileDraft(req, ctx) {
        const auth = requireAuthData(ctx)
        await assertOfficialAccountOwnedByUser(deps, req.officialAccountId, auth.id)
        const state = await deps.oa.resetBusinessProfileDraft(req.officialAccountId)
        if (!state) throw new ConnectError('Official account not found', Code.NotFound)
        return { state: toEditorStateResponse(state) }
      },
      async publishBusinessProfile(req, ctx) {
        const auth = requireAuthData(ctx)
        await assertOfficialAccountOwnedByUser(deps, req.officialAccountId, auth.id)
        const state = await deps.oa.publishBusinessProfile(
          req.officialAccountId,
          req.expectedRevision,
        )
        if (!state) throw new ConnectError('Official account not found', Code.NotFound)
        return { state: toEditorStateResponse(state) }
      },
      async uploadBusinessProfileImage(req, ctx) {
        const auth = requireAuthData(ctx)
        await assertOfficialAccountOwnedByUser(deps, req.officialAccountId, auth.id)
        const baseMime = req.contentType.split(';')[0]?.trim() ?? req.contentType
        if (!['image/jpeg', 'image/png'].includes(baseMime)) {
          throw new ConnectError('Unsupported image type', Code.InvalidArgument)
        }
        const isCover = req.kind === BusinessProfileImageKind.COVER
        const maxBytes = isCover ? 10 * 1024 * 1024 : 3 * 1024 * 1024
        if (req.image.length > maxBytes) {
          throw new ConnectError('Image is too large', Code.InvalidArgument)
        }
        const ext = baseMime === 'image/png' ? 'png' : 'jpg'
        const kind = isCover ? 'cover' : 'profile'
        const key = `oa-profile/${req.officialAccountId}/${kind}.${ext}`
        await deps.drive.put(key, Buffer.from(req.image), baseMime)
        const imageUrl = await deps.drive.getUrl(key)
        const patch =
          kind === 'cover' ? { coverImageUrl: imageUrl } : { profileImageUrl: imageUrl }
        const state = await deps.oa.autosaveBusinessProfileDraft(
          req.officialAccountId,
          patch,
        )
        if (!state) throw new ConnectError('Official account not found', Code.NotFound)
        return {
          draft: toProtoBusinessProfile(state.draft),
          imageUrl,
          isDirty: state.isDirty,
        }
      },
      async removeBusinessProfileImage(req, ctx) {
        const auth = requireAuthData(ctx)
        await assertOfficialAccountOwnedByUser(deps, req.officialAccountId, auth.id)
        const patch =
          req.kind === BusinessProfileImageKind.COVER
            ? { coverImageUrl: null }
            : { profileImageUrl: null }
        const state = await deps.oa.autosaveBusinessProfileDraft(
          req.officialAccountId,
          patch,
        )
        if (!state) throw new ConnectError('Official account not found', Code.NotFound)
        return { draft: toProtoBusinessProfile(state.draft), isDirty: state.isDirty }
      },
      async previewAudienceFilter(req, ctx) {
        const auth = requireAuthData(ctx)
        await assertOfficialAccountOwnedByUser(deps, req.officialAccountId, auth.id)

        const query = parseAudienceQueryJson(req.queryJson)
        const result = await deps.oaAudience.preview({
          oaId: req.officialAccountId,
          query,
        })
        if (!result.ok) {
          throw new ConnectError(result.message, Code.InvalidArgument)
        }
        return { count: result.count }
      },
      async sendTextCampaign(req, ctx) {
        const auth = requireAuthData(ctx)
        await assertOfficialAccountOwnedByUser(deps, req.officialAccountId, auth.id)

        const inlineAudienceQuery = req.inlineAudienceQueryJson
          ? parseAudienceQueryJson(req.inlineAudienceQueryJson)
          : undefined

        try {
          const result = await deps.oaCampaign.sendTextCampaign({
            campaignId: req.campaignId,
            oaId: req.officialAccountId,
            managerId: auth.id,
            name: req.name,
            messageText: req.messageText,
            audienceFilterId: req.audienceFilterId,
            inlineAudienceQuery,
          })
          return { campaignId: result.campaignId }
        } catch (err) {
          if (!(err instanceof Error)) throw err
          const msg = err.message
          if (
            msg.startsWith('Campaign name') ||
            msg.startsWith('Campaign text') ||
            msg.startsWith('INVALID_AUDIENCE_QUERY')
          ) {
            throw new ConnectError(msg, Code.InvalidArgument)
          }
          if (msg === 'Audience filter not found') {
            throw new ConnectError(msg, Code.NotFound)
          }
          if (msg === 'QUOTA_EXCEEDED') {
            throw new ConnectError(msg, Code.ResourceExhausted)
          }
          if (msg === 'RETRY_KEY_ACCEPTED' || msg === 'RETRY_KEY_CONFLICT') {
            throw new ConnectError(msg, Code.AlreadyExists)
          }
          throw err
        }
      },
    }

    router.service(OAService, withAuthService(OAService, deps.auth, oaServiceImpl))
  }
}
