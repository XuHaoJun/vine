import { PaymentClient, EventClient } from '@xuhaojun/hyperswitch-prism'
import { buildEcpayConnectorConfig } from './ecpay-config'
import type { EcpayCredentials } from '../types'

export type PrismClients = {
  paymentClient: PaymentClient
  eventClient: EventClient
}

export function createPrismClients(
  creds: EcpayCredentials,
  libPath?: string,
): PrismClients {
  const config = buildEcpayConnectorConfig(creds)
  const paymentClient = new PaymentClient(config, undefined, libPath)
  const eventClient = new EventClient(config, undefined, libPath)
  return { paymentClient, eventClient }
}
