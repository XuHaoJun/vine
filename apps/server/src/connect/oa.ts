import type { ServiceImpl } from '@connectrpc/connect'
import { Code, ConnectError, ConnectRouter } from '@connectrpc/connect'
import type { AuthServer } from '@take-out/better-auth-utils/server'
import { AccessTokenType, OAService, OAStatus, WebhookStatus } from '@vine/proto/oa'
import type { createOAService } from '../services/oa'
import type { DriveService } from '@vine/drive'

import { requireAuthData, withAuthService } from './auth-context'

type OAHandlerDeps = {
  oa: ReturnType<typeof createOAService>
  auth: AuthServer
  drive: DriveService
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

type DbRichMenuRow = {
  richMenuId: string
  name: string
  chatBarText: string
  selected: string
  sizeWidth: string
  sizeHeight: string
  areas: string
  hasImage: string
}

function toRichMenuItem(m: DbRichMenuRow) {
  const areas = (
    JSON.parse(m.areas) as Array<{
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
    selected: m.selected === 'true',
    sizeWidth: Number(m.sizeWidth),
    sizeHeight: Number(m.sizeHeight),
    areas,
    hasImage: m.hasImage === 'true',
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
  if (area.action?.richMenuAliasId) action['richMenuAliasId'] = area.action.richMenuAliasId
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
          uniqueId: req.uniqueId,
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
      async searchOfficialAccounts(req, ctx) {
        const auth = requireAuthData(ctx)
        const accounts = await deps.oa.searchOAsForOwner(auth.id, req.query)
        return {
          accounts: accounts.map((a) => ({
            id: a.id,
            name: a.name,
            uniqueId: a.uniqueId,
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
            uniqueId: a.uniqueId,
            description: a.description ?? '',
            imageUrl: a.imageUrl ?? '',
          })),
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
        return {
          account: {
            id: account.id,
            name: account.name,
            uniqueId: account.uniqueId,
            description: account.description ?? '',
            imageUrl: account.imageUrl ?? '',
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

        const userLink = await deps.oa.getRichMenuIdOfUser(oaId, userId)
        let richMenuId: string | null = null
        if (userLink) {
          richMenuId = userLink.richMenuId
        }

        if (!richMenuId) {
          const defaultMenu = await deps.oa.getDefaultRichMenu(oaId)
          if (defaultMenu) {
            richMenuId = defaultMenu.richMenuId
          }
        }

        if (!richMenuId) {
          return {}
        }

        const menu = await deps.oa.getRichMenu(oaId, richMenuId)
        if (!menu) {
          return {}
        }

        const areas =
          typeof menu.areas === 'string'
            ? (JSON.parse(menu.areas) as Array<{
                bounds: { x: number; y: number; width: number; height: number }
                action: Record<string, string | undefined>
              }>)
            : (menu.areas as Array<{
                bounds: { x: number; y: number; width: number; height: number }
                action: Record<string, string | undefined>
              }>)

        const hasImage =
          typeof menu.hasImage === 'string'
            ? menu.hasImage === 'true'
            : Boolean(menu.hasImage)
        const selected =
          typeof menu.selected === 'string'
            ? menu.selected === 'true'
            : Boolean(menu.selected)
        const sizeWidth =
          typeof menu.sizeWidth === 'string'
            ? parseInt(menu.sizeWidth, 10)
            : menu.sizeWidth
        const sizeHeight =
          typeof menu.sizeHeight === 'string'
            ? parseInt(menu.sizeHeight, 10)
            : menu.sizeHeight

        let imageBytes: Uint8Array | undefined
        let imageContentType: string | undefined
        if (hasImage) {
          const key = `richmenu/${oaId}/${richMenuId}.jpg`
          const exists = await deps.drive.exists(key)
          if (exists) {
            const file = await deps.drive.get(key)
            imageBytes = new Uint8Array(file.content)
            imageContentType = file.mimeType ?? 'image/jpeg'
          }
        }

        return {
          richMenu: {
            richMenuId: menu.richMenuId,
            name: menu.name,
            chatBarText: menu.chatBarText,
            selected,
            sizeWidth,
            sizeHeight,
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
        const menus = await deps.oa.getRichMenuList(req.officialAccountId)
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
        if (menu.hasImage === 'true') {
          const key = `richmenu/${req.officialAccountId}/${req.richMenuId}.jpg`
          const exists = await deps.drive.exists(key)
          if (exists) {
            const file = await deps.drive.get(key)
            imageBytes = new Uint8Array(file.content)
            imageContentType = file.mimeType ?? 'image/jpeg'
          }
        }
        return { menu: toRichMenuItem(menu), image: imageBytes, imageContentType }
      },
      async createRichMenu(req, ctx) {
        const auth = requireAuthData(ctx)
        await assertOfficialAccountOwnedByUser(deps, req.officialAccountId, auth.id)
        const menu = await deps.oa.createRichMenu({
          oaId: req.officialAccountId,
          name: req.name,
          chatBarText: req.chatBarText,
          selected: req.selected,
          sizeWidth: req.sizeWidth,
          sizeHeight: req.sizeHeight,
          areas: req.areas.map(areaToDb),
        })
        return { richMenuId: menu.richMenuId }
      },
      async updateRichMenu(req, ctx) {
        const auth = requireAuthData(ctx)
        await assertOfficialAccountOwnedByUser(deps, req.officialAccountId, auth.id)
        await deps.oa.updateRichMenu(req.officialAccountId, req.richMenuId, {
          name: req.name,
          chatBarText: req.chatBarText,
          selected: req.selected,
          sizeWidth: req.sizeWidth,
          sizeHeight: req.sizeHeight,
          areas: req.areas.map(areaToDb),
        })
        return {}
      },
      async deleteRichMenu(req, ctx) {
        const auth = requireAuthData(ctx)
        await assertOfficialAccountOwnedByUser(deps, req.officialAccountId, auth.id)
        await deps.oa.deleteRichMenu(req.officialAccountId, req.richMenuId)
        const key = `richmenu/${req.officialAccountId}/${req.richMenuId}.jpg`
        const exists = await deps.drive.exists(key)
        if (exists) await deps.drive.delete(key)
        return {}
      },
      async setDefaultRichMenu(req, ctx) {
        const auth = requireAuthData(ctx)
        await assertOfficialAccountOwnedByUser(deps, req.officialAccountId, auth.id)
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
        const key = `richmenu/${req.officialAccountId}/${req.richMenuId}.jpg`
        const buffer = Buffer.from(req.image)
        await deps.drive.put(key, buffer, req.contentType)
        await deps.oa.setRichMenuImage(req.officialAccountId, req.richMenuId, true)
        return {}
      },
    }

    router.service(OAService, withAuthService(OAService, deps.auth, oaServiceImpl))
  }
}
