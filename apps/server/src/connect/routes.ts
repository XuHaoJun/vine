import { ConnectRouter } from '@connectrpc/connect'
import { greeterHandler } from './greeter'

export function greeterRoutes(router: ConnectRouter) {
  greeterHandler(router)
}
