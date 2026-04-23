import { describe, it, expect } from 'vitest'
import { createPaymentsService } from './service'
import { signFormBody } from './test-utils/ecpay-mac'

const STAGE_CREDS = {
  merchantId: '3002607',
  hashKey: 'pwFHCqoQZGmho4w6',
  hashIv: 'EkRm7iFT261dpevs',
  mode: 'stage' as const,
}

describe('handleWebhook', () => {
  it('verified=true with charge.succeeded for RtnCode=1', async () => {
    const pay = createPaymentsService({ connector: 'ecpay', ecpay: STAGE_CREDS })
    const rawBody = signFormBody(
      {
        MerchantID: '3002607',
        MerchantTradeNo: 'o_test_001',
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
        expect(res.event.merchantTransactionId).toBe('o_test_001')
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
        MerchantTradeNo: 'o_fail_001',
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
