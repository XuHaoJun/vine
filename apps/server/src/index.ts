import cors from '@fastify/cors'
import formbody from '@fastify/formbody'
import { fastifyConnectPlugin } from '@connectrpc/connect-fastify'
import Fastify from 'fastify'
import { getDatabase } from '@vine/db/database'
import { createDb } from '@vine/db'

import { greeterRoutes } from './connect/routes'
import { createAuthServer, authPlugin } from './plugins/auth'
import { createZeroService, zeroPlugin } from './plugins/zero'

const app = Fastify({ logger: true })

await app.register(cors, {
  origin: process.env['ALLOWED_ORIGIN'] ?? true,
  credentials: true,
})

await app.register(formbody)

// ConnectRPC routes (GreeterService, etc.)
await app.register(fastifyConnectPlugin, {
  routes: greeterRoutes,
})

// Wire services with explicit dependencies
const database = getDatabase()
const db = createDb()

const auth = createAuthServer({ database, db })
const zero = createZeroService({
  auth,
  zeroUpstreamDb: process.env['ZERO_UPSTREAM_DB'] ?? '',
})

// Register plugins with injected dependencies
await authPlugin(app, { auth })
await zeroPlugin(app, { auth, zero })

app.get('/healthz', async () => ({ status: 'ok', timestamp: new Date().toISOString() }))

const port = Number(process.env['PORT'] ?? 3001)
await app.listen({ port, host: '0.0.0.0' })
console.info(`[server] listening on http://localhost:${port}`)
