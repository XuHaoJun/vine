import type { ServiceImpl } from '@connectrpc/connect'
import { Code, ConnectError, ConnectRouter } from '@connectrpc/connect'
import type { AuthServer } from '@take-out/better-auth-utils/server'
import { AccessTokenType, OAService, OAStatus, WebhookStatus } from '@vine/proto/oa'
import type { createOAService } from '../services/oa'

import { requireAuthData, withAuthService } from './auth-context'

type OAHandlerDeps = {
  oa: ReturnType<typeof createOAService>
  auth: AuthServer
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
    case 'pending':
      return WebhookStatus.PENDING
    case 'verified':
      return WebhookStatus.VERIFIED
    case 'failed':
      return WebhookStatus.FAILED
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
      async createOfficialAccount(req, ctx) {
        const auth = requireAuthData(ctx)
        await assertProviderOwnedByUser(deps, req.providerId, auth.id)
        const account = await deps.oa.createOfficialAccount({
          providerId: req.providerId,
          name: req.name,
          oaId: req.oaId,
          description: req.description,
          imageUrl: req.imageUrl,
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
        await assertOfficialAccountOwnedByUser(deps, req.oaId, auth.id)
        const webhook = await deps.oa.setWebhook(req.oaId, req.url)
        return { webhook: toProtoWebhook(webhook) }
      },
      async verifyWebhook(req, ctx) {
        const auth = requireAuthData(ctx)
        await assertOfficialAccountOwnedByUser(deps, req.oaId, auth.id)
        const result = await deps.oa.verifyWebhook(req.oaId)
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
        await assertOfficialAccountOwnedByUser(deps, req.oaId, auth.id)
        const webhook = await deps.oa.getWebhook(req.oaId)
        return { webhook: toProtoWebhook(webhook) }
      },
      async issueAccessToken(req, ctx) {
        const auth = requireAuthData(ctx)
        await assertOfficialAccountOwnedByUser(deps, req.oaId, auth.id)
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
      async listAccessTokens(req, ctx) {
        const auth = requireAuthData(ctx)
        await assertOfficialAccountOwnedByUser(deps, req.oaId, auth.id)
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
        await assertOfficialAccountOwnedByUser(deps, req.oaId, auth.id)
        const result = await deps.oa.revokeAllAccessTokens(req.oaId, req.keyId)
        return { revokedCount: result.revoked_count }
      },
      async searchOfficialAccounts(req, ctx) {
        const auth = requireAuthData(ctx)
        const accounts = await deps.oa.searchOAsForOwner(auth.id, req.query)
        return {
          accounts: accounts.map((a) => ({
            id: a.id,
            name: a.name,
            oaId: a.oaId,
            description: a.description ?? '',
            imageUrl: a.imageUrl ?? '',
          })),
        }
      },
      async recommendOfficialAccounts(req) {
        const limit = req.limit > 0 ? req.limit : 15
        const accounts = await deps.oa.recommendOfficialAccounts(limit)
        return {
          accounts: accounts.map((a) => ({
            id: a.id,
            name: a.name,
            oaId: a.oaId,
            description: a.description ?? '',
            imageUrl: a.imageUrl ?? '',
          })),
        }
      },
      async addOAFriend(req, ctx) {
        const auth = requireAuthData(ctx)
        const result = await deps.oa.addOAFriend(auth.id, req.oaId)
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
            oaId: account.oaId,
            oaName: account.name,
            oaImageUrl: account.imageUrl ?? '',
            status: friendship.status,
            createdAt: friendship.createdAt,
          },
        }
      },
      async removeOAFriend(req, ctx) {
        const auth = requireAuthData(ctx)
        await deps.oa.removeOAFriend(auth.id, req.oaId)
        return {}
      },
      async listMyOAFriends(_req, ctx) {
        const auth = requireAuthData(ctx)
        const friendships = await deps.oa.listMyOAFriends(auth.id)
        return {
          friendships: friendships.map((f) => ({
            id: f.id,
            oaId: f.oaId,
            oaName: f.name,
            oaImageUrl: f.imageUrl ?? '',
            status: f.status,
            createdAt: f.createdAt,
          })),
        }
      },
      async isOAFriend(req, ctx) {
        const auth = requireAuthData(ctx)
        const isFriend = await deps.oa.isOAFriend(auth.id, req.oaId)
        return { isFriend }
      },
    }

    router.service(OAService, withAuthService(OAService, deps.auth, oaServiceImpl))
  }
}
