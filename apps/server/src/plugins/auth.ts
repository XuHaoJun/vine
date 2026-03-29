import { expo } from '@better-auth/expo'
import { time } from '@take-out/helpers'
import { betterAuth } from 'better-auth'
import { admin, bearer, jwt, magicLink } from 'better-auth/plugins'
import type { FastifyInstance } from 'fastify'
import { getDatabase } from '@vine/db/database'

const DOMAIN = 'takeout.tamagui.dev'
const APP_SCHEME = 'takeout'
const BETTER_AUTH_URL = process.env['BETTER_AUTH_URL'] ?? 'http://localhost:3001'
const DB_CONFIGURED = Boolean(process.env['ZERO_UPSTREAM_DB'])

function createAuthServer() {
  return betterAuth({
    database: getDatabase(),

    session: {
      freshAge: time.minute.days(2),
      storeSessionInDatabase: true,
    },

    emailAndPassword: { enabled: true },

    trustedOrigins: [
      `https://${DOMAIN}`,
      'http://localhost:8081',
      'http://host.docker.internal:8081',
      `${APP_SCHEME}://`,
      BETTER_AUTH_URL,
    ],

    plugins: [
      jwt({
        jwt: { expirationTime: '3y' },
        jwks: { keyPairConfig: { alg: 'EdDSA', crv: 'Ed25519' } },
      }),
      bearer(),
      expo(),
      magicLink({
        sendMagicLink: async ({ email, url }) => {
          console.info('Magic link would be sent to:', email, url)
        },
      }),
      admin(),
    ],

    logger: {
      level: 'warn',
      log(level, message, ...args) {
        console.info(level, message, ...args)
      },
    },

    account: { accountLinking: { allowDifferentEmails: true } },
  })
}

// Lazily initialized — only created when DB is configured
let _authServer: ReturnType<typeof createAuthServer> | null = null

export function getAuthServer() {
  if (!DB_CONFIGURED) return null
  if (!_authServer) {
    _authServer = createAuthServer()
    console.info('[better-auth] server initialized')
  }
  return _authServer
}

// Named export for backward compat with zero plugin
export { getAuthServer as authServer }

function toWebRequest(fastifyReq: {
  method: string
  url: string
  headers: Record<string, string | string[] | undefined>
  body?: unknown
}): Request {
  const url = new URL(fastifyReq.url, BETTER_AUTH_URL)
  const headers = new Headers()
  for (const [key, value] of Object.entries(fastifyReq.headers)) {
    if (value !== undefined) {
      headers.set(key, Array.isArray(value) ? value.join(', ') : value)
    }
  }
  const body =
    fastifyReq.method !== 'GET' && fastifyReq.method !== 'HEAD' && fastifyReq.body != null
      ? JSON.stringify(fastifyReq.body)
      : undefined

  return new Request(url.toString(), {
    method: fastifyReq.method,
    headers,
    body,
  })
}

/** Fastify plugin that mounts Better Auth at /api/auth/* */
export async function authPlugin(fastify: FastifyInstance) {
  if (!DB_CONFIGURED) {
    fastify.route({
      method: ['GET', 'POST'],
      url: '/api/auth/*',
      handler: async (_request, reply) => {
        return reply.status(503).send({ error: 'Database not configured' })
      },
    })
    return
  }

  fastify.route({
    method: ['GET', 'POST'],
    url: '/api/auth/*',
    handler: async (request, reply) => {
      try {
        const server = getAuthServer()!
        const webReq = toWebRequest({
          method: request.method,
          url: request.url,
          headers: request.headers as Record<string, string | string[] | undefined>,
          body: request.body,
        })
        const res = await server.handler(webReq)

        reply.status(res.status)
        res.headers.forEach((value, key) => {
          void reply.header(key, value)
        })
        const body = await res.text()
        return reply.send(body)
      } catch (err) {
        console.error('[auth] handler error', err)
        return reply.status(500).send({ error: 'Auth handler error' })
      }
    },
  })
}
