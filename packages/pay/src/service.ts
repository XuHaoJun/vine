import { types } from '@xuhaojun/hyperswitch-prism'
import { createPrismClients } from './prism/client'
import type {
  PaymentsService,
  PaymentsServiceDeps,
  HandleWebhookInput,
  HandleWebhookResult,
  WebhookEvent,
  Money,
} from './types'
import { computeCheckMacValue } from './utils/ecpay-mac'

const { PaymentStatus, WebhookEventType } = types

export function createPaymentsService(deps: PaymentsServiceDeps): PaymentsService {
  if (deps.connector !== 'ecpay') {
    throw new Error(`Unsupported connector: ${deps.connector}`)
  }

  const { ecpay, libPath } = deps

  // Lazily create prism clients to avoid loading the .so at module-import time
  let clients: ReturnType<typeof createPrismClients> | undefined
  function getClients() {
    if (!clients) {
      clients = createPrismClients(ecpay, libPath)
    }
    return clients
  }

  return {
    async createCharge() {
      throw new Error('createCharge: not implemented')
    },

    async handleWebhook(input: HandleWebhookInput): Promise<HandleWebhookResult> {
      // Flatten headers to Record<string, string>
      const flatHeaders: Record<string, string> = {}
      for (const [key, value] of Object.entries(input.headers)) {
        if (value === undefined) continue
        flatHeaders[key.toLowerCase()] = Array.isArray(value) ? value[0] : value
      }

      try {
        const { eventClient } = getClients()

        const req: types.IEventServiceHandleRequest = {
          requestDetails: {
            method: types.HttpMethod.HTTP_METHOD_POST,
            headers: flatHeaders,
            body: new Uint8Array(input.rawBody),
          },
          webhookSecrets: {
            secret: ecpay.hashKey,
            additionalSecret: ecpay.hashIv,
          },
        }

        const res = await eventClient.handleEvent(req)
        return normalizeResponse(res, input.rawBody, ecpay.hashKey, ecpay.hashIv)
      } catch (err) {
        console.warn('[pay] prism eventClient.handleEvent failed, falling back to manual ECPay verification', err)
        // Fallback: manual ECPay verification when prism is unavailable
        return manualEcpayWebhook(input.rawBody, ecpay.hashKey, ecpay.hashIv)
      }
    },
  }
}

function normalizeResponse(
  res: types.EventServiceHandleResponse,
  rawBody: Buffer,
  hashKey: string,
  hashIv: string,
): HandleWebhookResult {
  const ackBody = res.eventAckResponse?.body
    ? Buffer.from(res.eventAckResponse.body).toString('utf8')
    : '1|OK'
  const ackStatus = res.eventAckResponse?.statusCode ?? 200

  if (!res.sourceVerified) {
    return {
      verified: false,
      reason: 'source verification failed',
      ackReply: { status: 400, body: ackBody === '1|OK' ? '0|invalid' : ackBody },
    }
  }

  const event = mapEvent(res, rawBody, hashKey, hashIv)

  return {
    verified: true,
    event,
    ackReply: { status: ackStatus, body: ackBody },
  }
}

function mapEvent(
  res: types.EventServiceHandleResponse,
  rawBody: Buffer,
  hashKey: string,
  hashIv: string,
): WebhookEvent {
  const payment = res.eventContent?.paymentsResponse

  // Success event types
  const isSuccessType =
    res.eventType === WebhookEventType.PAYMENT_INTENT_SUCCESS ||
    res.eventType === WebhookEventType.PAYMENT_INTENT_CAPTURE_SUCCESS ||
    res.eventType === WebhookEventType.SOURCE_CHARGEABLE ||
    (payment != null &&
      (payment.status === PaymentStatus.CHARGED ||
        payment.status === PaymentStatus.PARTIAL_CHARGED))

  // Failure event types
  const isFailureType =
    res.eventType === WebhookEventType.PAYMENT_INTENT_FAILURE ||
    res.eventType === WebhookEventType.PAYMENT_INTENT_AUTHORIZATION_FAILURE ||
    res.eventType === WebhookEventType.PAYMENT_INTENT_CAPTURE_FAILURE ||
    (payment != null &&
      (payment.status === PaymentStatus.FAILURE ||
        payment.status === PaymentStatus.AUTHORIZATION_FAILED ||
        payment.status === PaymentStatus.CAPTURE_FAILED))

  if (isSuccessType && payment) {
    const amount: Money = payment.amount
      ? {
          minorAmount: Number(payment.amount.minorAmount),
          currency: (payment.amount.currency === types.Currency.TWD ? 'TWD' : 'USD') as Money['currency'],
        }
      : { minorAmount: 0, currency: 'TWD' }

    const capturedAt = payment.capturedAt ? new Date(Number(payment.capturedAt) * 1000) : new Date()

    return {
      kind: 'charge.succeeded',
      merchantTransactionId: payment.merchantTransactionId ?? '',
      connectorChargeId: payment.connectorTransactionId ?? '',
      amount,
      paidAt: capturedAt,
    }
  }

  if (isFailureType && payment) {
    return {
      kind: 'charge.failed',
      merchantTransactionId: payment.merchantTransactionId ?? '',
      reason: payment.error?.unifiedDetails?.message ?? 'payment failed',
    }
  }

  return { kind: 'unknown', raw: res }
}

/**
 * Manual ECPay webhook fallback — used when prism EventClient is unavailable.
 * Parses the urlencoded body, verifies CheckMacValue, and maps RtnCode.
 */
function manualEcpayWebhook(
  rawBody: Buffer,
  hashKey: string,
  hashIv: string,
): HandleWebhookResult {
  const bodyStr = rawBody.toString('utf8')
  const params: Record<string, string> = {}
  for (const pair of bodyStr.split('&')) {
    const eq = pair.indexOf('=')
    if (eq === -1) continue
    const key = decodeURIComponent(pair.slice(0, eq))
    const val = decodeURIComponent(pair.slice(eq + 1))
    params[key] = val
  }

  const providedMac = params['CheckMacValue'] ?? ''
  const expectedMac = computeCheckMacValue(params, hashKey, hashIv)

  if (providedMac.toUpperCase() !== expectedMac.toUpperCase()) {
    return {
      verified: false,
      reason: 'CheckMacValue mismatch',
      ackReply: { status: 400, body: '0|invalid' },
    }
  }

  const rtnCode = params['RtnCode'] ?? ''
  const merchantTradeNo = params['MerchantTradeNo'] ?? ''
  const tradeNo = params['TradeNo'] ?? ''
  const tradeAmt = parseInt(params['TradeAmt'] ?? '0', 10)
  const rtnMsg = params['RtnMsg'] ?? ''

  let event: WebhookEvent
  if (rtnCode === '1') {
    const paymentDate = params['PaymentDate'] ?? ''
    const paidAt = paymentDate ? new Date(paymentDate.replace(/\//g, '-')) : new Date()
    event = {
      kind: 'charge.succeeded',
      merchantTransactionId: merchantTradeNo,
      connectorChargeId: tradeNo,
      amount: { minorAmount: tradeAmt, currency: 'TWD' },
      paidAt,
    }
  } else {
    event = {
      kind: 'charge.failed',
      merchantTransactionId: merchantTradeNo,
      reason: rtnMsg || `RtnCode=${rtnCode}`,
    }
  }

  return {
    verified: true,
    event,
    ackReply: { status: 200, body: '1|OK' },
  }
}
