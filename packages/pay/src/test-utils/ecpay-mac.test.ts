import { describe, it, expect } from 'vitest'
import { computeCheckMacValue, signFormBody } from './ecpay-mac'

const HASH_KEY = 'pwFHCqoQZGmho4w6'
const HASH_IV = 'EkRm7iFT261dpevs'

describe('computeCheckMacValue', () => {
  it('produces known-good MAC for reference example (golden vector from ECPay docs)', () => {
    // Golden vector from docs/ECPay-API-Skill/test-vectors/checkmacvalue.json
    const params = {
      MerchantID: '3002607',
      MerchantTradeNo: 'Test1234567890',
      MerchantTradeDate: '2025/01/01 12:00:00',
      PaymentType: 'aio',
      TotalAmount: '100',
      TradeDesc: '測試',
      ItemName: '測試商品',
      ReturnURL: 'https://example.com/notify',
      ChoosePayment: 'ALL',
      EncryptType: '1',
    }
    const mac = computeCheckMacValue(params, HASH_KEY, HASH_IV)
    expect(mac).toBe('291CBA324D31FB5A4BBBFDF2CFE5D32598524753AFD4959C3BF590C5B2F57FB2')
  })

  it('handles single-quote correctly (PHP urlencode encodes apostrophe as %27)', () => {
    // Golden vector: ItemName="Tom's Shop" → %27 not left as '
    const params = {
      MerchantID: '3002607',
      ItemName: "Tom's Shop",
      TotalAmount: '100',
    }
    const mac = computeCheckMacValue(params, HASH_KEY, HASH_IV)
    expect(mac).toBe('CF0A3D4901D99459D8641516EC57210700E8A5C9AB26B1D021301E9CB93EF78D')
  })

  it('handles tilde correctly (~ must be encoded as %7e not left bare)', () => {
    // Golden vector: ItemName="Test~Product"
    const params = {
      MerchantID: '3002607',
      ItemName: 'Test~Product',
      TotalAmount: '200',
    }
    const mac = computeCheckMacValue(params, HASH_KEY, HASH_IV)
    expect(mac).toBe('CEEAE01D2F9A8E74D4AC0DCE7735B046D73F35A5EC99558A31A2EE03159DA1C9')
  })

  it('encodes space as + not %20', () => {
    // Golden vector: ItemName="My Test Product" — wrong if %20 used
    const params = {
      MerchantID: '3002607',
      ItemName: 'My Test Product',
      TotalAmount: '300',
    }
    const mac = computeCheckMacValue(params, HASH_KEY, HASH_IV)
    expect(mac).toBe('7712A5E6EDC3B57086063C88568084C66CE882A21D40E74DE5ACA3B478C6F316')
  })

  it('matches callback verification golden vector', () => {
    // Golden vector: simulated payment callback
    const params = {
      MerchantID: '3002607',
      MerchantTradeNo: 'Test1234567890',
      RtnCode: '1',
      RtnMsg: 'Succeeded',
      TradeNo: '2301011234567890',
      TradeAmt: '100',
      PaymentDate: '2025/01/01 12:05:00',
      PaymentType: 'Credit_CreditCard',
      TradeDate: '2025/01/01 12:00:00',
      SimulatePaid: '0',
    }
    const mac = computeCheckMacValue(params, HASH_KEY, HASH_IV)
    expect(mac).toBe('2AB536D86AFF8E1086744D59175040A32538C96B1C28C4135B551BD728E913B8')
  })

  it('is deterministic given same inputs', () => {
    const params = { A: '1', B: '2' }
    expect(computeCheckMacValue(params, HASH_KEY, HASH_IV)).toBe(
      computeCheckMacValue(params, HASH_KEY, HASH_IV),
    )
  })

  it('changes when any param changes', () => {
    const a = computeCheckMacValue({ X: '1' }, HASH_KEY, HASH_IV)
    const b = computeCheckMacValue({ X: '2' }, HASH_KEY, HASH_IV)
    expect(a).not.toBe(b)
  })

  it('ignores existing CheckMacValue in params', () => {
    const params = { A: '1' }
    const mac = computeCheckMacValue(params, HASH_KEY, HASH_IV)
    const macWithExisting = computeCheckMacValue(
      { ...params, CheckMacValue: 'OLDJUNK' },
      HASH_KEY,
      HASH_IV,
    )
    expect(mac).toBe(macWithExisting)
  })
})

describe('signFormBody', () => {
  it('returns Buffer with CheckMacValue appended', () => {
    const body = signFormBody({ MerchantTradeNo: 'o_1', TradeAmt: '75' }, HASH_KEY, HASH_IV)
    const decoded = body.toString('utf8')
    expect(decoded).toContain('CheckMacValue=')
    expect(decoded).toContain('MerchantTradeNo=o_1')
  })

  it('produces a CheckMacValue that round-trips through computeCheckMacValue', () => {
    const params = { MerchantID: '3002607', TradeAmt: '75' }
    const body = signFormBody(params, HASH_KEY, HASH_IV)
    const decoded = body.toString('utf8')
    // Parse form body back into params
    const parsed: Record<string, string> = Object.fromEntries(
      decoded.split('&').map((pair) => {
        const [k, v] = pair.split('=')
        return [decodeURIComponent(k), decodeURIComponent(v)]
      }),
    )
    const { CheckMacValue, ...rest } = parsed
    expect(computeCheckMacValue(rest, HASH_KEY, HASH_IV)).toBe(CheckMacValue)
  })
})
