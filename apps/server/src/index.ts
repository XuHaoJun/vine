import path from 'node:path'
import { logger } from './lib/logger'
import cors from '@fastify/cors'
import formbody from '@fastify/formbody'
import { fastifyConnectPlugin } from '@connectrpc/connect-fastify'
import Fastify from 'fastify'
import { getDatabase } from '@vine/db/database'
import { createDb } from '@vine/db'
import { ensureSeed } from '@vine/db/seed'

import { connectRoutes } from './connect/routes'
import { createPayments, registerPaymentsWebhookRoutes } from './services/payments'
import { createAuthServer, authPlugin } from './plugins/auth'
import { createZeroService, zeroPlugin } from './plugins/zero'
import { mediaUploadPlugin } from './plugins/media-upload'
import { locationMapPlugin } from './plugins/oa-location-map'
import { oaMessagingPlugin } from './plugins/oa-messaging'
import { oaRichMenuPlugin } from './plugins/oa-richmenu'
import { oaWebhookPlugin } from './plugins/oa-webhook'
import { oaWebhookEndpointPlugin } from './plugins/oa-webhook-endpoint'
import { createOAService } from './services/oa'
import { createOAMessagingService } from './services/oa-messaging'
import { createOAWebhookDeliveryService } from './services/oa-webhook-delivery'
import { createLiffService } from './services/liff'
import { createStickerMarketServices } from './services/sticker-market'
import { liffFixturesPublicPlugin } from './plugins/liff-fixtures-public'
import { liffPublicPlugin } from './plugins/liff-public'
import { createFsDriveService } from '@vine/drive'

const app = Fastify({ logger: true })

await app.register(cors, {
  origin: process.env['ALLOWED_ORIGIN'] ?? true,
  credentials: true,
})

await app.register(formbody)

const driveBasePath = path.resolve(process.env['DRIVE_BASE_PATH'] ?? './uploads')

await app.register(import('@fastify/static'), {
  root: driveBasePath,
  prefix: '/uploads/',
  decorateReply: false,
})

// Wire services with explicit dependencies
const database = getDatabase()
const db = createDb()

const uploadRoot = process.env['UPLOADS_DIR'] ?? 'uploads'
const stickerMarket = createStickerMarketServices({ db, uploadRoot })

if (path.resolve(uploadRoot) !== driveBasePath) {
  const { stickerAssetsPublicPlugin } = await import('./plugins/sticker-assets-public')
  await stickerAssetsPublicPlugin(app, { uploadRoot })
}

const oa = createOAService({ db, database })
const oaMessaging = createOAMessagingService({
  db,
  instanceId: process.env['HOSTNAME'] ?? `server-${process.pid}`,
})
const webhookDelivery = createOAWebhookDeliveryService({ db, oa, logger })
const liff = createLiffService({ db })
const auth = createAuthServer({ database, db })
const drive = createFsDriveService({
  basePath: driveBasePath,
  baseUrl: process.env['DRIVE_BASE_URL'] ?? 'http://localhost:3001/uploads',
})

const paymentsEnv = {
  PAYMENTS_ECPAY_MODE: (process.env['PAYMENTS_ECPAY_MODE'] ?? 'stage') as
    | 'stage'
    | 'prod',
  PAYMENTS_ECPAY_MERCHANT_ID: process.env['PAYMENTS_ECPAY_MERCHANT_ID'] ?? '3002607',
  PAYMENTS_ECPAY_HASH_KEY: process.env['PAYMENTS_ECPAY_HASH_KEY'] ?? 'pwFHCqoQZGmho4w6',
  PAYMENTS_ECPAY_HASH_IV: process.env['PAYMENTS_ECPAY_HASH_IV'] ?? 'EkRm7iFT261dpevs',
  PAYMENTS_RETURN_URL:
    process.env['PAYMENTS_RETURN_URL'] ?? 'http://localhost:3001/webhooks/ecpay',
  PAYMENTS_ORDER_RESULT_URL:
    process.env['PAYMENTS_ORDER_RESULT_URL'] ?? 'http://localhost:3000/pay/result',
  PAYMENTS_CLIENT_BACK_URL: process.env['PAYMENTS_CLIENT_BACK_URL'],
}
const payments = createPayments(paymentsEnv, db, app.log)
await registerPaymentsWebhookRoutes(app, { ...payments, db })

// ConnectRPC routes (GreeterService, OAService, LIFFService, StickerMarketUserService, etc.)
await app.register(fastifyConnectPlugin, {
  routes: connectRoutes({
    oa,
    webhookDelivery,
    liff,
    auth,
    drive,
    stickerMarketUser: {
      db,
      pay: payments.pay,
      mode: paymentsEnv.PAYMENTS_ECPAY_MODE,
      returnUrl: paymentsEnv.PAYMENTS_RETURN_URL,
      orderResultUrl: paymentsEnv.PAYMENTS_ORDER_RESULT_URL,
      clientBackUrl: paymentsEnv.PAYMENTS_CLIENT_BACK_URL,
      follow: stickerMarket.follow,
      review: stickerMarket.review,
      launchNotification: stickerMarket.launchNotification,
      trust: stickerMarket.trust,
    },
    stickerMarketAdmin: {
      refund: payments.refund,
      reconciliation: payments.reconciliation,
      review: stickerMarket.review,
      payout: stickerMarket.payout,
      featuredShelf: stickerMarket.featuredShelf,
      trust: stickerMarket.trust,
    },
    stickerMarketCreator: {
      creatorRepo: stickerMarket.creatorRepo,
      submission: stickerMarket.submission,
      salesReport: stickerMarket.salesReport,
      payout: stickerMarket.payout,
      db,
    },
    stickerMarketDiscovery: {
      db,
      drive,
      auth,
      discovery: stickerMarket.discovery,
    },
  }),
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
await mediaUploadPlugin(app, { auth, drive })
await locationMapPlugin(app, { db, auth })
await oaMessagingPlugin(app, { oa, messaging: oaMessaging, db, drive })
await oaRichMenuPlugin(app, { oa, db, drive })
await oaWebhookPlugin(app, { oa, db, auth, webhookDelivery })
await oaWebhookEndpointPlugin(app, { oa, db })
await liffFixturesPublicPlugin(app)
await liffPublicPlugin(app, { liff, auth, db })

app.get('/healthz', async () => ({ status: 'ok', timestamp: new Date().toISOString() }))

await oaMessaging.processPendingDeliveries({ batchSize: 100, staleAfterMs: 60_000 })

let oaMessagingRecoveryRunning = false
const oaMessagingRecoveryInterval = setInterval(() => {
  if (oaMessagingRecoveryRunning) return
  oaMessagingRecoveryRunning = true
  void oaMessaging
    .processPendingDeliveries({ batchSize: 100, staleAfterMs: 60_000 })
    .catch((err) => logger.error({ err }, '[oa-messaging] recovery failed'))
    .finally(() => {
      oaMessagingRecoveryRunning = false
    })
}, 10_000)

app.addHook('onClose', async () => {
  clearInterval(oaMessagingRecoveryInterval)
})

const cleanupWebhookDeliveries = () =>
  webhookDelivery
    .cleanupExpiredDeliveries({ olderThanDays: 30 })
    .catch((err) => logger.error({ err }, '[oa-webhook] retention cleanup failed'))

void cleanupWebhookDeliveries()
const webhookRetentionInterval = setInterval(
  () => void cleanupWebhookDeliveries(),
  24 * 60 * 60 * 1000,
)
app.addHook('onClose', async () => {
  clearInterval(webhookRetentionInterval)
})

const port = Number(process.env['PORT'] ?? 3001)
await app.listen({ port, host: '0.0.0.0' })
logger.info(`[server] listening on http://localhost:${port}`)
