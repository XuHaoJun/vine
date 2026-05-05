import type { ServiceImpl } from '@connectrpc/connect'
import { Code, ConnectError, ConnectRouter } from '@connectrpc/connect'
import type { AuthServer } from '@take-out/better-auth-utils/server'
import { MiniAppService } from '@vine/proto/mini-app'
import type { createMiniAppService } from '../services/mini-app'
import type { createMiniAppTemplateService } from '../services/mini-app-service-message-templates'
import type { createMiniAppServiceMessageService } from '../services/mini-app-service-message'
import { validateParams, renderTemplate } from '../services/mini-app-service-message'
import { requireAuthData, withAuthService } from './auth-context'

type MiniAppHandlerDeps = {
  miniApp: ReturnType<typeof createMiniAppService>
  template: ReturnType<typeof createMiniAppTemplateService>
  serviceMessage: ReturnType<typeof createMiniAppServiceMessageService>
  auth: AuthServer
}

async function toProtoMiniApp(
  deps: MiniAppHandlerDeps,
  row: NonNullable<Awaited<ReturnType<typeof deps.miniApp.getMiniApp>>>,
) {
  const linkedOaIds = await deps.miniApp.listLinkedOaIds(row.id)
  return {
    id: row.id,
    providerId: row.providerId,
    liffAppId: row.liffAppId,
    name: row.name,
    iconUrl: row.iconUrl ?? undefined,
    description: row.description ?? undefined,
    category: row.category ?? undefined,
    isPublished: row.isPublished,
    publishedAt: row.publishedAt ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    linkedOaIds,
  }
}

function toProtoTemplate(row: any) {
  return {
    id: row.id,
    miniAppId: row.miniAppId,
    name: row.name,
    kind: row.kind,
    languageTag: row.languageTag,
    flexJson: JSON.stringify(row.flexJson),
    paramsSchema: row.paramsSchema,
    useCase: row.useCase,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export function miniAppImpl(deps: MiniAppHandlerDeps): ServiceImpl<typeof MiniAppService> {
  return {
    async listMiniApps(req, ctx) {
      requireAuthData(ctx)
      if (!req.providerId)
        throw new ConnectError('providerId required', Code.InvalidArgument)
      const rows = await deps.miniApp.listMiniApps(req.providerId)
      const miniApps = await Promise.all(rows.map((r) => toProtoMiniApp(deps, r)))
      return { miniApps }
    },

    async getMiniApp(req, ctx) {
      requireAuthData(ctx)
      if (!req.id) throw new ConnectError('id required', Code.InvalidArgument)
      const row = await deps.miniApp.getMiniApp(req.id)
      if (!row) throw new ConnectError('Mini App not found', Code.NotFound)
      return { miniApp: await toProtoMiniApp(deps, row) }
    },

    async createMiniApp(req, ctx) {
      requireAuthData(ctx)
      if (!req.providerId)
        throw new ConnectError('providerId required', Code.InvalidArgument)
      if (!req.liffAppId)
        throw new ConnectError('liffAppId required', Code.InvalidArgument)
      if (!req.name) throw new ConnectError('name required', Code.InvalidArgument)
      try {
        const existing = await deps.miniApp.getMiniAppByLiffAppId(req.liffAppId)
        if (existing) {
          throw new ConnectError(
            'This LIFF app is already wrapped by another Mini App',
            Code.AlreadyExists,
          )
        }
        const row = await deps.miniApp.createMiniApp({
          providerId: req.providerId,
          liffAppId: req.liffAppId,
          name: req.name,
          iconUrl: req.iconUrl,
          description: req.description,
          category: req.category,
        })
        return { miniApp: await toProtoMiniApp(deps, row) }
      } catch (e) {
        if (e instanceof ConnectError) throw e
        const msg = e instanceof Error ? e.message : 'create failed'
        throw new ConnectError(msg, Code.InvalidArgument)
      }
    },

    async updateMiniApp(req, ctx) {
      requireAuthData(ctx)
      if (!req.id) throw new ConnectError('id required', Code.InvalidArgument)
      const row = await deps.miniApp.updateMiniApp(req.id, {
        name: req.name,
        iconUrl: req.iconUrl,
        description: req.description,
        category: req.category,
      })
      if (!row) throw new ConnectError('Mini App not found', Code.NotFound)
      return { miniApp: await toProtoMiniApp(deps, row) }
    },

    async publishMiniApp(req, ctx) {
      requireAuthData(ctx)
      if (!req.id) throw new ConnectError('id required', Code.InvalidArgument)
      try {
        const row = await deps.miniApp.publishMiniApp(req.id)
        if (!row) throw new ConnectError('Mini App not found', Code.NotFound)
        return { miniApp: await toProtoMiniApp(deps, row) }
      } catch (e) {
        if (e instanceof ConnectError) throw e
        const msg = e instanceof Error ? e.message : 'publish failed'
        throw new ConnectError(msg, Code.FailedPrecondition)
      }
    },

    async unpublishMiniApp(req, ctx) {
      requireAuthData(ctx)
      if (!req.id) throw new ConnectError('id required', Code.InvalidArgument)
      const row = await deps.miniApp.unpublishMiniApp(req.id)
      if (!row) throw new ConnectError('Mini App not found', Code.NotFound)
      return { miniApp: await toProtoMiniApp(deps, row) }
    },

    async deleteMiniApp(req, ctx) {
      requireAuthData(ctx)
      if (!req.id) throw new ConnectError('id required', Code.InvalidArgument)
      await deps.miniApp.deleteMiniApp(req.id)
      return {}
    },

    async linkOa(req, ctx) {
      requireAuthData(ctx)
      if (!req.miniAppId)
        throw new ConnectError('miniAppId required', Code.InvalidArgument)
      if (!req.oaId) throw new ConnectError('oaId required', Code.InvalidArgument)
      await deps.miniApp.linkOa({ miniAppId: req.miniAppId, oaId: req.oaId })
      return {}
    },

    async unlinkOa(req, ctx) {
      requireAuthData(ctx)
      if (!req.miniAppId)
        throw new ConnectError('miniAppId required', Code.InvalidArgument)
      if (!req.oaId) throw new ConnectError('oaId required', Code.InvalidArgument)
      await deps.miniApp.unlinkOa({ miniAppId: req.miniAppId, oaId: req.oaId })
      return {}
    },

    async listPublished(req, ctx) {
      requireAuthData(ctx)
      const limit = Math.min(Math.max(req.limit ?? 50, 1), 100)
      const offset = req.offset ?? 0
      const rows = await deps.miniApp.listPublished({
        category: req.category || undefined,
        searchQuery: req.searchQuery || undefined,
        limit,
        offset,
      })
      const protoRows = await Promise.all(rows.items.map((r) => toProtoMiniApp(deps, r)))
      return { miniApps: protoRows, total: rows.total }
    },

    async listMyGallery(_req, ctx) {
      const auth = requireAuthData(ctx)
      const recents = await deps.miniApp.listRecent(auth.id, 12)
      const recentIds = recents.map((m) => m.id)
      const fromOas = await deps.miniApp.listForUserOas(auth.id, recentIds)
      return {
        recents: await Promise.all(recents.map((r) => toProtoMiniApp(deps, r))),
        fromOas: await Promise.all(fromOas.map((r) => toProtoMiniApp(deps, r))),
      }
    },

    async listLinkedToOa(req, ctx) {
      requireAuthData(ctx)
      if (!req.oaId) throw new ConnectError('oaId required', Code.InvalidArgument)
      const rows = await deps.miniApp.listMiniAppsLinkedToOa(req.oaId)
      const published = rows.filter((r) => r.isPublished)
      return {
        miniApps: await Promise.all(published.map((r) => toProtoMiniApp(deps, r))),
      }
    },

    async listServiceTemplates(req, ctx) {
      requireAuthData(ctx)
      if (!req.miniAppId) throw new ConnectError('miniAppId required', Code.InvalidArgument)
      const rows = await deps.template.listTemplates(req.miniAppId)
      return { templates: rows.map(toProtoTemplate) }
    },

    async createServiceTemplate(req, ctx) {
      requireAuthData(ctx)
      if (!req.miniAppId) throw new ConnectError('miniAppId required', Code.InvalidArgument)
      if (!req.name) throw new ConnectError('name required', Code.InvalidArgument)
      if (!req.kind) throw new ConnectError('kind required', Code.InvalidArgument)
      let flex: unknown
      try { flex = JSON.parse(req.flexJson) } catch { throw new ConnectError('Invalid flexJson', Code.InvalidArgument) }
      try {
        const row = await deps.template.createTemplate({
          miniAppId: req.miniAppId,
          kind: req.kind,
          name: req.name,
          languageTag: req.languageTag || 'en',
          flexJson: flex,
          paramsSchema: req.paramsSchema as any,
          useCase: req.useCase || '',
        })
        return { template: toProtoTemplate(row) }
      } catch (e) {
        throw new ConnectError(
          e instanceof Error ? e.message : 'create failed',
          Code.InvalidArgument,
        )
      }
    },

    async updateServiceTemplate(req, ctx) {
      requireAuthData(ctx)
      if (!req.id) throw new ConnectError('id required', Code.InvalidArgument)
      let flex: unknown | undefined
      if (req.flexJson) {
        try { flex = JSON.parse(req.flexJson) } catch { throw new ConnectError('Invalid flexJson', Code.InvalidArgument) }
      }
      const row = await deps.template.updateTemplate(req.id, {
        flexJson: flex,
        paramsSchema: req.paramsSchema?.length ? (req.paramsSchema as any) : undefined,
        useCase: req.useCase,
        languageTag: req.languageTag,
      })
      if (!row) throw new ConnectError('Template not found', Code.NotFound)
      return { template: toProtoTemplate(row) }
    },

    async deleteServiceTemplate(req, ctx) {
      requireAuthData(ctx)
      if (!req.id) throw new ConnectError('id required', Code.InvalidArgument)
      await deps.template.deleteTemplate(req.id)
      return {}
    },

    async sendTestServiceMessage(req, ctx) {
      const auth = requireAuthData(ctx)
      if (!req.templateId) throw new ConnectError('templateId required', Code.InvalidArgument)
      const tpl = await deps.template.getTemplate(req.templateId)
      if (!tpl) throw new ConnectError('Template not found', Code.NotFound)
      const params = Object.fromEntries(Object.entries(req.params ?? {}))
      try {
        validateParams(tpl.paramsSchema as any, params)
      } catch (e) {
        throw new ConnectError(
          e instanceof Error ? e.message : 'param validation failed',
          Code.InvalidArgument,
        )
      }
      const rendered = renderTemplate(tpl.flexJson, params) as any
      // Mark the test message visually
      if (rendered?.body?.contents) {
        rendered.body.contents.unshift({
          type: 'text',
          text: '[TEST]',
          weight: 'bold',
          color: '#FF6B6B',
        })
      }
      const out = await deps.serviceMessage.sendServiceMessage({
        miniAppId: tpl.miniAppId,
        userId: auth.id,
        flexJson: rendered,
        isTest: true,
      })
      return { messageId: out.messageId, chatId: out.chatId }
    },
  }
}

export function miniAppHandler(deps: MiniAppHandlerDeps) {
  return (router: ConnectRouter) => {
    router.service(MiniAppService, withAuthService(MiniAppService, deps.auth, miniAppImpl(deps)))
  }
}
