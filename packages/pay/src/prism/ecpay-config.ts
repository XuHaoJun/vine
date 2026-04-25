import { types } from '@xuhaojun/hyperswitch-prism'
import type { EcpayCredentials } from '../types'

const ECPAY_STAGE_URL = 'https://payment-stage.ecpay.com.tw'
const ECPAY_PROD_URL = 'https://payment.ecpay.com.tw'

export function buildEcpayConnectorConfig(
  creds: EcpayCredentials,
): types.IConnectorConfig {
  const baseUrl = creds.mode === 'prod' ? ECPAY_PROD_URL : ECPAY_STAGE_URL

  return {
    connectorConfig: {
      ecpay: {
        apiKey: { value: creds.merchantId },
        hashKey: { value: creds.hashKey },
        hashIv: { value: creds.hashIv },
        baseUrl,
      },
    },
  }
}
