import type { FastifyInstance } from 'fastify'
import type { PaymentsService } from '@vine/pay'
import type { StickerOrderRepository } from './order.repository'
import type { EntitlementRepository } from './entitlement.repository'
import type { PaymentAlertSink } from './alert-sink'
import { handlePaymentEvent } from './event-handler'

export type WebhookDeps = {
  pay: PaymentsService
  orderRepo: StickerOrderRepository
  entitlementRepo: EntitlementRepository
  db: any
  alerts?: PaymentAlertSink
}

export async function registerPaymentsWebhookRoutes(
  fastify: FastifyInstance,
  deps: WebhookDeps,
): Promise<void> {
  // Encapsulated scope: remove any inherited form-body parser and register our
  // own raw-buffer parser so we can verify the ECPay CheckMacValue signature.
  await fastify.register(async (scope) => {
    scope.removeContentTypeParser('application/x-www-form-urlencoded')
    scope.addContentTypeParser(
      'application/x-www-form-urlencoded',
      { parseAs: 'buffer' },
      (_req, body, done) => done(null, body),
    )

    scope.post('/webhooks/ecpay', async (request, reply) => {
      const rawBody = request.body as Buffer
      const contentType = (request.headers['content-type'] as string) ?? ''

      const result = await deps.pay.handleWebhook({
        rawBody,
        headers: request.headers as Record<string, string | string[] | undefined>,
        contentType,
      })

      if (!result.verified) {
        request.log.warn({ reason: result.reason }, 'ecpay webhook verification failed')
        try {
          await deps.alerts?.notify({
            type: 'payment.webhook_verification_failed',
            severity: 'warning',
            orderId: undefined,
            message: 'ecpay webhook verification failed',
            context: { reason: result.reason },
          })
        } catch {
          // alert failed — still return 400 response
        }
        return reply
          .code(result.ackReply.status)
          .type('text/plain')
          .send(result.ackReply.body)
      }

      try {
        await handlePaymentEvent(deps, result.event, request.log)
      } catch (err) {
        request.log.error({ err, event: result.event }, 'ecpay webhook handler threw')
        // Intentional: still reply 1|OK to avoid ECPay infinite retry
      }

      return reply
        .code(result.ackReply.status)
        .type('text/plain')
        .send(result.ackReply.body)
    })
  })
}
