import { ConnectRouter } from '@connectrpc/connect'
import { GreeterService } from '@vine/proto/greeter-connect'

export function greeterHandler(router: ConnectRouter) {
  router.service(GreeterService, {
    sayHello(req) {
      const name = req.name.trim() || 'World'
      return { message: `Hello, ${name}!` }
    },
  })
}
