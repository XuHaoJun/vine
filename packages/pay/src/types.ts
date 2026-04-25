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

export type PaymentsServiceDeps = {
  connector: 'ecpay'
  ecpay: EcpayCredentials
  libPath?: string
}

export type PaymentsService = {
  createCharge(input: CreateChargeInput): Promise<CreateChargeResult>
  handleWebhook(input: HandleWebhookInput): Promise<HandleWebhookResult>
  // FUTURE(refund): refund(chargeId: string, amount?: Money): Promise<RefundResult>
  //   當用戶退款或 entitlement grant 失敗需要補償時啟用
  // FUTURE(sync): getCharge(merchantTransactionId: string): Promise<ChargeStatus>
  //   對帳 / reconciliation 用
}
