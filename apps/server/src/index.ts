import cors from '@fastify/cors'
import formbody from '@fastify/formbody'
import { fastifyConnectPlugin } from '@connectrpc/connect-fastify'
import Fastify from 'fastify'
import { getDatabase } from '@vine/db/database'
import { createDb } from '@vine/db'
import { ensureSeed } from '@vine/db/seed'

import { connectRoutes } from './connect/routes'
import { createAuthServer, authPlugin } from './plugins/auth'
import { createZeroService, zeroPlugin } from './plugins/zero'
import { oaMessagingPlugin } from './plugins/oa-messaging'
import { oaRichMenuPlugin } from './plugins/oa-richmenu'
import { oaWebhookPlugin } from './plugins/oa-webhook'
import { createOAService } from './services/oa'
import { createFsDriveService } from '@vine/drive'

const app = Fastify({ logger: true })

await app.register(cors, {
  origin: process.env['ALLOWED_ORIGIN'] ?? true,
  credentials: true,
})

await app.register(formbody)

// Wire services with explicit dependencies
const database = getDatabase()
const db = createDb()

const oa = createOAService({ db, database })
const auth = createAuthServer({ database, db })
const drive = createFsDriveService({
  basePath: process.env['DRIVE_BASE_PATH'] ?? './uploads',
  baseUrl: process.env['DRIVE_BASE_URL'] ?? 'http://localhost:3001/uploads',
})

// ConnectRPC routes (GreeterService, OAService, etc.)
await app.register(fastifyConnectPlugin, {
  routes: connectRoutes({ oa, auth, drive }),
})

// Seed test data (only in dev with VITE_DEMO_MODE=1)
await ensureSeed(database, db, drive)
const zero = createZeroService({
  auth,
  zeroUpstreamDb: process.env['ZERO_UPSTREAM_DB'] ?? '',
})

// Register plugins with injected dependencies
await authPlugin(app, { auth, db })
await zeroPlugin(app, { auth, zero })
await oaMessagingPlugin(app, { oa, db, drive })
await oaRichMenuPlugin(app, { oa, db, drive })
await oaWebhookPlugin(app, { oa, db })

app.get('/healthz', async () => ({ status: 'ok', timestamp: new Date().toISOString() }))

const port = Number(process.env['PORT'] ?? 3001)
await app.listen({ port, host: '0.0.0.0' })
console.info(`[server] listening on http://localhost:${port}`)
