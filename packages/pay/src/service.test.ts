import { describe, it, expect } from 'vitest'
import { createPaymentsService } from './service'
import { signFormBody } from './test-utils/ecpay-mac'
import { ConfigError } from './errors'

const STAGE_CREDS = {
  merchantId: '3002607',
  hashKey: 'pwFHCqoQZGmho4w6',
  hashIv: 'EkRm7iFT261dpevs',
  mode: 'stage' as const,
}

describe('createCharge', () => {
  const baseInput = {
    merchantTransactionId: 'occ001',
    amount: { minorAmount: 75, currency: 'TWD' as const },
    description: '貓咪日常 40 款',
    returnUrl: 'http://localhost:3001/webhooks/ecpay',
    orderResultUrl: 'http://localhost:3000/pay/result',
    idempotencyKey: 'occ001',
  }

  it('returns redirect_form_post action', async () => {
    const pay = createPaymentsService({ connector: 'ecpay', ecpay: STAGE_CREDS })
    const res = await pay.createCharge(baseInput)
    expect(res.status).toBe('pending_action')
    expect(res.action.type).toBe('redirect_form_post')
    if (res.action.type === 'redirect_form_post') {
      expect(res.action.targetUrl).toContain('payment-stage.ecpay.com.tw')
      expect(res.action.formFields.MerchantTradeNo).toBe('occ001')
      expect(res.action.formFields.TotalAmount).toBe('75')
      expect(res.action.formFields.CheckMacValue).toMatch(/^[A-F0-9]{64}$/)
    }
    expect(res.connectorName).toBe('ecpay')
  })

  it('injects SimulatePaid=1 in stage when testMode.simulatePaid', async () => {
    const pay = createPaymentsService({ connector: 'ecpay', ecpay: STAGE_CREDS })
    const res = await pay.createCharge({ ...baseInput, testMode: { simulatePaid: true } })
    if (res.action.type === 'redirect_form_post') {
      expect(res.action.formFields.SimulatePaid).toBe('1')
    }
  })
})

describe('handleWebhook', () => {
  it('verified=true with charge.succeeded for RtnCode=1', async () => {
    const pay = createPaymentsService({ connector: 'ecpay', ecpay: STAGE_CREDS })
    const rawBody = signFormBody(
      {
        MerchantID: '3002607',
        MerchantTradeNo: 'otest001',
        TradeAmt: '75',
        RtnCode: '1',
        RtnMsg: '交易成功',
        TradeNo: '2402230000000001',
        PaymentDate: '2026/04/23 12:34:56',
        PaymentType: 'Credit_CreditCard',
        SimulatePaid: '0',
      },
      STAGE_CREDS.hashKey,
      STAGE_CREDS.hashIv,
    )
    const res = await pay.handleWebhook({
      rawBody,
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      contentType: 'application/x-www-form-urlencoded',
    })
    expect(res.verified).toBe(true)
    if (res.verified) {
      expect(res.event.kind).toBe('charge.succeeded')
      if (res.event.kind === 'charge.succeeded') {
        expect(res.event.merchantTransactionId).toBe('otest001')
        expect(res.event.connectorChargeId).toBe('2402230000000001')
        expect(res.event.amount).toEqual({ minorAmount: 75, currency: 'TWD' })
      }
      expect(res.ackReply.body).toBe('1|OK')
    }
  })

  it('verified=false when CheckMacValue is wrong', async () => {
    const pay = createPaymentsService({ connector: 'ecpay', ecpay: STAGE_CREDS })
    const tampered = Buffer.from('MerchantTradeNo=o_1&TradeAmt=75&RtnCode=1&CheckMacValue=DEADBEEF', 'utf8')
    const res = await pay.handleWebhook({
      rawBody: tampered,
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      contentType: 'application/x-www-form-urlencoded',
    })
    expect(res.verified).toBe(false)
  })

  it('verified=true with charge.failed for RtnCode != 1', async () => {
    const pay = createPaymentsService({ connector: 'ecpay', ecpay: STAGE_CREDS })
    const rawBody = signFormBody(
      {
        MerchantID: '3002607',
        MerchantTradeNo: 'ofail001',
        TradeAmt: '75',
        RtnCode: '10100058',
        RtnMsg: '授權失敗',
        TradeNo: '',
        PaymentDate: '',
        PaymentType: 'Credit_CreditCard',
        SimulatePaid: '0',
      },
      STAGE_CREDS.hashKey,
      STAGE_CREDS.hashIv,
    )
    const res = await pay.handleWebhook({
      rawBody,
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      contentType: 'application/x-www-form-urlencoded',
    })
    expect(res.verified).toBe(true)
    if (res.verified) {
      expect(res.event.kind).toBe('charge.failed')
    }
  })
})

describe('createCharge edge cases', () => {
  const baseInput = {
    merchantTransactionId: 'oec001',
    amount: { minorAmount: 75, currency: 'TWD' as const },
    description: 'test',
    returnUrl: 'http://r',
    orderResultUrl: 'http://o',
    idempotencyKey: 'oec001',
  }

  it('rejects non-TWD', async () => {
    const pay = createPaymentsService({ connector: 'ecpay', ecpay: STAGE_CREDS })
    await expect(
      pay.createCharge({ ...baseInput, amount: { minorAmount: 100, currency: 'USD' as const } }),
    ).rejects.toThrow(ConfigError)
  })

  it('rejects merchantTransactionId > 20 chars', async () => {
    const pay = createPaymentsService({ connector: 'ecpay', ecpay: STAGE_CREDS })
    await expect(
      pay.createCharge({ ...baseInput, merchantTransactionId: 'a'.repeat(21) }),
    ).rejects.toThrow(ConfigError)
  })

  it('rejects non-alphanumeric merchantTransactionId', async () => {
    const pay = createPaymentsService({ connector: 'ecpay', ecpay: STAGE_CREDS })
    await expect(
      pay.createCharge({ ...baseInput, merchantTransactionId: 'order-with-hyphen' }),
    ).rejects.toThrow(ConfigError)
  })

  it('rejects SimulatePaid in prod mode', async () => {
    const pay = createPaymentsService({
      connector: 'ecpay',
      ecpay: { ...STAGE_CREDS, mode: 'prod' },
    })
    await expect(
      pay.createCharge({ ...baseInput, testMode: { simulatePaid: true } }),
    ).rejects.toThrow(ConfigError)
  })
})
