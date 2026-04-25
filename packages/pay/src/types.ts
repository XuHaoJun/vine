export type Currency = 'TWD' | 'USD'

export type Money = {
  minorAmount: number
  currency: Currency
}

export type CreateChargeInput = {
  merchantTransactionId: string
  amount: Money
  description: string
  returnUrl: string
  orderResultUrl: string
  clientBackUrl?: string
  idempotencyKey: string
  testMode?: {
    simulatePaid?: boolean
  }
}

export type ChargeAction =
  | { type: 'redirect_form_post'; targetUrl: string; formFields: Record<string, string> }
  | { type: 'redirect_url'; url: string }

export type CreateChargeResult = {
  status: 'pending_action'
  action: ChargeAction
  connectorName: 'ecpay'
}

export type WebhookEvent =
  | {
      kind: 'charge.succeeded'
      merchantTransactionId: string
      connectorChargeId: string
      amount: Money
      paidAt: Date
    }
  | {
      kind: 'charge.failed'
      merchantTransactionId: string
      reason: string
    }
  | { kind: 'unknown'; raw: unknown }

export type HandleWebhookInput = {
  rawBody: Buffer
  headers: Record<string, string | string[] | undefined>
  contentType: string
}

export type HandleWebhookResult =
  | {
      verified: true
      event: WebhookEvent
      ackReply: { status: number; body: string }
    }
  | {
      verified: false
      reason: string
      ackReply: { status: number; body: string }
    }

export type EcpayCredentials = {
  merchantId: string
  hashKey: string
  hashIv: string
  mode: 'stage' | 'prod'
}

export type RefundChargeInput = {
  merchantTransactionId: string
  connectorChargeId: string
  amount: Money
  reason: string
  testMode?: boolean
}

export type RefundChargeResult =
  | {
      status: 'succeeded'
      connectorRefundId: string | undefined
      refundedAt: Date
      simulated: boolean
      raw: Record<string, string>
    }
  | {
      status: 'failed'
      reason: string
      raw: Record<string, string> | undefined
    }

export type GetChargeInput = {
  merchantTransactionId: string
}

export type ChargeStatusResult =
  | {
      status: 'paid'
      connectorChargeId: string
      amount: Money
      paidAt: Date | undefined
      rawStatus: string
      raw: Record<string, string>
    }
  | {
      status: 'unpaid' | 'failed' | 'not_found' | 'unknown'
      reason: string
      rawStatus: string | undefined
      raw: Record<string, string> | undefined
    }

export type PaymentsServiceDeps = {
  connector: 'ecpay'
  ecpay: EcpayCredentials
  libPath?: string
  fetch?: typeof fetch
  now?: () => Date
}

export type PaymentsService = {
  createCharge(input: CreateChargeInput): Promise<CreateChargeResult>
  handleWebhook(input: HandleWebhookInput): Promise<HandleWebhookResult>
  refundCharge(input: RefundChargeInput): Promise<RefundChargeResult>
  getCharge(input: GetChargeInput): Promise<ChargeStatusResult>
}
