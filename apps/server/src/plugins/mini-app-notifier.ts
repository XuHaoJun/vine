import type { FastifyInstance } from 'fastify'
import {
  TemplateValidationError,
  RateLimitError,
  validateParams,
  renderTemplate,
} from '../services/mini-app-service-message'
import type { createMiniAppService } from '../services/mini-app'
import type { createMiniAppTemplateService } from '../services/mini-app-service-message-templates'
import type { createMiniAppServiceMessageService } from '../services/mini-app-service-message'

type Deps = {
  miniApp: ReturnType<typeof createMiniAppService>
  template: ReturnType<typeof createMiniAppTemplateService>
  serviceMessage: ReturnType<typeof createMiniAppServiceMessageService>
  auth: {
    validateLoginChannelAccessToken: (
      token: string,
    ) => Promise<{ loginChannelId: string } | null>
    resolveLiffAccessToken: (token: string) => Promise<{
      userId: string
      liffAppId: string
      loginChannelId: string
    } | null>
  }
}

type Body = {
  liffAccessToken: string
  templateName: string
  params: Record<string, unknown>
}

export async function miniAppNotifierPlugin(
  app: FastifyInstance,
  deps: Deps,
): Promise<void> {
  app.post<{ Body: Body }>(
    '/api/oa/v2/mini-app/notifier/send',
    async (request, reply) => {
      const authHeader = request.headers.authorization ?? ''
      const channelToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
      const channel = channelToken
        ? await deps.auth.validateLoginChannelAccessToken(channelToken)
        : null
      if (!channel) {
        return reply
          .status(401)
          .send({ error: 'Invalid or missing Login Channel access token' })
      }

      // Resolve the LIFF access token
      const liffCtx = await deps.auth.resolveLiffAccessToken(request.body.liffAccessToken)
      if (!liffCtx) {
        return reply.status(401).send({ error: 'Invalid LIFF access token' })
      }

      const m = await deps.miniApp.getMiniAppByLiffAppId(liffCtx.liffAppId)
      if (!m) {
        return reply.status(404).send({ error: 'No Mini App wraps this LIFF app' })
      }

      // Verify the LIFF app's Login Channel matches the channel access token.
      if (liffCtx.loginChannelId !== channel.loginChannelId) {
        return reply
          .status(403)
          .send({ error: 'Channel access token does not match this Mini App' })
      }

      if (!m.isPublished) {
        return reply.status(403).send({ error: 'Mini App is not published' })
      }

      const tpl = await deps.template.getTemplateByName(m.id, request.body.templateName)
      if (!tpl) {
        return reply.status(404).send({ error: 'Template not found for this Mini App' })
      }

      try {
        validateParams(tpl.paramsSchema as any, request.body.params)
      } catch (e) {
        if (e instanceof TemplateValidationError) {
          return reply.status(422).send({ error: e.message })
        }
        throw e
      }

      const rendered = renderTemplate(tpl.flexJson, request.body.params)

      try {
        const result = await deps.serviceMessage.sendServiceMessage({
          miniAppId: m.id,
          userId: liffCtx.userId,
          flexJson: rendered,
        })
        return reply.send({ status: 'sent', messageId: result.messageId })
      } catch (e) {
        if (e instanceof RateLimitError) {
          return reply
            .status(429)
            .send({ error: 'Rate limit exceeded', retryAfterSec: e.retryAfterSec })
        }
        throw e
      }
    },
  )
}
