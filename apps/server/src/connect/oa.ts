import { ConnectRouter } from '@connectrpc/connect'
import { OAService, OAStatus, WebhookStatus, AccessTokenType } from '@vine/proto/oa'
import type { createOAService } from '../services/oa'

type OAHandlerDeps = {
  oa: ReturnType<typeof createOAService>
}

function toProtoProvider(db: Awaited<ReturnType<ReturnType<typeof createOAService>['getProvider']>>) {
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
    case 'active': return OAStatus.OA_STATUS_ACTIVE
    case 'disabled': return OAStatus.OA_STATUS_DISABLED
    default: return OAStatus.OA_STATUS_UNSPECIFIED
  }
}

function protoStatusToDb(status: OAStatus): string | undefined {
  switch (status) {
    case OAStatus.OA_STATUS_ACTIVE: return 'active'
    case OAStatus.OA_STATUS_DISABLED: return 'disabled'
    default: return undefined
  }
}

function toProtoOfficialAccount(db: Awaited<ReturnType<ReturnType<typeof createOAService>['getOfficialAccount']>>) {
  if (!db) return undefined
  return {
    id: db.id,
    providerId: db.providerId,
    name: db.name,
    oaId: db.oaId,
    description: db.description ?? '',
    imageUrl: db.imageUrl ?? '',
    status: dbStatusToProto(db.status),
    createdAt: db.createdAt,
    updatedAt: db.updatedAt,
  }
}

function dbWebhookStatusToProto(status: string): WebhookStatus {
  switch (status) {
    case 'pending': return WebhookStatus.PENDING
    case 'verified': return WebhookStatus.VERIFIED
    case 'failed': return WebhookStatus.FAILED
    default: return WebhookStatus.UNSPECIFIED
  }
}

function toProtoWebhook(db: Awaited<ReturnType<ReturnType<typeof createOAService>['getWebhook']>>) {
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

function dbTokenTypeToProto(type: string): AccessTokenType {
  switch (type) {
    case 'short_lived': return AccessTokenType.SHORT_LIVED
    case 'jwt_v21': return AccessTokenType.JWT_V21
    default: return AccessTokenType.UNSPECIFIED
  }
}

function protoTokenTypeToDb(type: AccessTokenType): 'short_lived' | 'jwt_v21' {
  switch (type) {
    case AccessTokenType.SHORT_LIVED: return 'short_lived'
    case AccessTokenType.JWT_V21: return 'jwt_v21'
    default: return 'short_lived'
  }
}

export function oaHandler(deps: OAHandlerDeps) {
  return (router: ConnectRouter) => {
    router.service(OAService, {
      async createProvider(req) {
        const provider = await deps.oa.createProvider({ name: req.name, ownerId: '' })
        return { provider: toProtoProvider(provider) }
      },
      async getProvider(req) {
        const provider = await deps.oa.getProvider(req.id)
        return { provider: toProtoProvider(provider) }
      },
      async updateProvider(req) {
        const provider = await deps.oa.updateProvider(req.id, { name: req.name })
        return { provider: toProtoProvider(provider) }
      },
      async deleteProvider(req) {
        await deps.oa.deleteProvider(req.id)
        return {}
      },
      async listProviderAccounts(req) {
        const accounts = await deps.oa.listProviderAccounts(req.providerId)
        return { accounts: accounts.map(toProtoOfficialAccount).filter((a): a is NonNullable<typeof a> => a != null) }
      },
      async createOfficialAccount(req) {
        const account = await deps.oa.createOfficialAccount({
          providerId: req.providerId,
          name: req.name,
          oaId: req.oaId,
          description: req.description,
          imageUrl: req.imageUrl,
        })
        return { account: toProtoOfficialAccount(account) }
      },
      async getOfficialAccount(req) {
        const account = await deps.oa.getOfficialAccount(req.id)
        return { account: toProtoOfficialAccount(account) }
      },
      async getOfficialAccountSecret(req) {
        const account = await deps.oa.getOfficialAccount(req.id)
        if (!account) return { secret: { channelSecret: '' } }
        return { secret: { channelSecret: account.channelSecret } }
      },
      async updateOfficialAccount(req) {
        const account = await deps.oa.updateOfficialAccount(req.id, {
          name: req.name,
          description: req.description,
          imageUrl: req.imageUrl,
          status: req.status !== undefined ? protoStatusToDb(req.status) : undefined,
        })
        return { account: toProtoOfficialAccount(account) }
      },
      async deleteOfficialAccount(req) {
        await deps.oa.deleteOfficialAccount(req.id)
        return {}
      },
      async setWebhook(req) {
        const webhook = await deps.oa.setWebhook(req.oaId, req.url)
        return { webhook: toProtoWebhook(webhook) }
      },
      async verifyWebhook(req) {
        const result = await deps.oa.verifyWebhook(req.oaId)
        const statusMap: Record<string, number> = { pending: 1, verified: 2, failed: 3, no_webhook: 0, oa_not_found: 0 }
        return { status: statusMap[result.status] ?? 0 }
      },
      async getWebhook(req) {
        const webhook = await deps.oa.getWebhook(req.oaId)
        return { webhook: toProtoWebhook(webhook) }
      },
      async issueAccessToken(req) {
        const result = await deps.oa.issueAccessToken({
          oaId: req.oaId,
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
      async listAccessTokens(req) {
        const tokens = await deps.oa.listAccessTokens(req.oaId, req.keyId)
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
      async revokeAccessToken(req) {
        await deps.oa.revokeAccessToken(req.tokenId)
        return {}
      },
      async revokeAllAccessTokens(req) {
        const result = await deps.oa.revokeAllAccessTokens(req.oaId, req.keyId)
        return { revokedCount: result.revoked_count }
      },
      async searchOfficialAccounts(req) {
        const accounts = await deps.oa.searchOAs(req.query)
        return { accounts: accounts.map((a) => ({
          id: a.id, name: a.name, oaId: a.oaId,
          description: a.description ?? '', imageUrl: a.imageUrl ?? '',
        }))}
      },
    })
  }
}
