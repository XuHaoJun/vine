import cors from '@fastify/cors'
import { fastifyConnectPlugin } from '@connectrpc/connect-fastify'
import Fastify from 'fastify'

import { greeterRoutes } from './connect/routes'
import { authPlugin } from './plugins/auth'
import { zeroPlugin } from './plugins/zero'

const app = Fastify({ logger: true })

await app.register(cors, {
  origin: process.env['ALLOWED_ORIGIN'] ?? true,
  credentials: true,
})

// ConnectRPC routes (GreeterService, etc.)
await app.register(fastifyConnectPlugin, {
  routes: greeterRoutes,
})

// Better Auth endpoints (/api/auth/*)
await app.register(authPlugin)

// Zero sync endpoints (/api/zero/*)
await app.register(zeroPlugin)

app.get('/healthz', async () => ({ ok: true }))

const port = Number(process.env['PORT'] ?? 3001)
await app.listen({ port, host: '0.0.0.0' })
console.info(`[server] listening on http://localhost:${port}`)
