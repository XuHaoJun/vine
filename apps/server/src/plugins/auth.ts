import { expo } from '@better-auth/expo'
import { isValidJWT } from '@take-out/better-auth-utils/server'
import { eq, sql } from 'drizzle-orm'
import { time } from '@take-out/helpers'
import { betterAuth } from 'better-auth'
import { admin, bearer, jwt, magicLink, oidcProvider } from 'better-auth/plugins'
import { createRemoteJWKSet, jwtVerify } from 'jose'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import type { Pool } from 'pg'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { schema } from '@vine/db'
import { user as userTable } from '@vine/db/schema-private'
import { userPublic, userState } from '@vine/db/schema-public'
import { toWebRequest } from '../utils'
import { logger } from '../lib/logger'

const DOMAIN = 'takeout.tamagui.dev'
const APP_SCHEME = 'takeout'
const BETTER_AUTH_URL = process.env['BETTER_AUTH_URL'] ?? 'http://localhost:3001'
const DEMO_EMAIL = process.env['DEMO_EMAIL'] ?? `demo@${DOMAIN}`
const DEFAULT_INTEGRATION_TEST_PROXY_PORT = 8081

function getIntegrationTestProxyPort() {
  const parsedPort = Number(process.env['INTEGRATION_TEST_PROXY_PORT'])
  if (Number.isInteger(parsedPort) && parsedPort > 0) {
    return parsedPort
  }
  return DEFAULT_INTEGRATION_TEST_PROXY_PORT
}

const INTEGRATION_TEST_PROXY_PORT = getIntegrationTestProxyPort()

type AuthDeps = {
  database: Pool
  db: NodePgDatabase<typeof schema>
}

function createAuthServer(deps: AuthDeps) {
  const { database, db } = deps

  async function afterCreateUser(user: { id: string; email: string }) {
    try {
      const { id: userId, email } = user

      const existingUser = await db
        .select()
        .from(userPublic)
        .where(eq(userPublic.id, userId))
        .limit(1)

      const [userPrivate] = await db
        .select({
          name: userTable.name,
          username: userTable.username,
          image: userTable.image,
          createdAt: userTable.createdAt,
        })
        .from(userTable)
        .where(eq(userTable.id, userId))

      if (existingUser.length === 1 || !userPrivate) return

      const existingUserState = await db
        .select()
        .from(userState)
        .where(eq(userState.userId, userId))
        .limit(1)

      if (existingUserState.length === 0) {
        await db.insert(userState).values({ userId, darkMode: false })
      }

      const { name, username, image, createdAt } = userPrivate
      await db.insert(userPublic).values({
        id: userId,
        name: name || '',
        username: email === DEMO_EMAIL ? 'demo' : username || '',
        image: image || '',
        joinedAt: createdAt
          ? new Date(createdAt).toISOString()
          : new Date().toISOString(),
      })
    } catch (error) {
      logger.error({ err: error }, `[afterCreateUser] error`)
      throw error
    }
  }

  return betterAuth({
    database,

    session: {
      freshAge: time.minute.days(2),
      storeSessionInDatabase: true,
      // Faster get-session: validate from signed cookie cache before hitting DB (short eventual-consistency window)
      cookieCache: {
        enabled: true,
        maxAge: 300,
      },
    },

    emailAndPassword: { enabled: true },

    trustedOrigins: [
      `https://${DOMAIN}`,
      `http://localhost:${INTEGRATION_TEST_PROXY_PORT}`,
      `http://host.docker.internal:${INTEGRATION_TEST_PROXY_PORT}`,
      `http://localhost:3000`,
      `${APP_SCHEME}://`,
      BETTER_AUTH_URL,
    ],

    databaseHooks: {
      user: {
        create: {
          after: afterCreateUser,
        },
      },
    },

    plugins: [
      jwt({
        jwt: { expirationTime: '3y' },
        jwks: { keyPairConfig: { alg: 'EdDSA', crv: 'Ed25519' } },
      }),
      bearer(),
      expo(),
      magicLink({
        sendMagicLink: async ({ email, url }) => {
          logger.info({ email, url }, 'Magic link would be sent to')
        },
      }),
      admin(),
      oidcProvider({
        loginPage: '/auth/login',
        consentPage: '/auth/consent',
        scopes: ['openid', 'profile', 'email'],
      }),
    ],

    logger: {
      level: 'warn',
      log(level, message, ...args) {
        const entry = args.length > 0 ? { extra: args } : {}
        if (level === 'error') logger.error(entry, message)
        else if (level === 'info') logger.info(entry, message)
        else if (level === 'debug') logger.debug(entry, message)
        else logger.warn(entry, message)
      },
    },

    account: { accountLinking: { allowDifferentEmails: true } },
  })
}

export { createAuthServer }
export type { AuthDeps }

type AuthPluginDeps = {
  auth: ReturnType<typeof createAuthServer>
  db: NodePgDatabase<typeof schema>
}

export async function authPlugin(fastify: FastifyInstance, deps: AuthPluginDeps) {
  fastify.route({
    method: ['GET', 'POST'],
    url: '/api/auth/*',
    handler: async (request, reply) => {
      try {
        const webReq = toWebRequest({
          method: request.method,
          url: request.url,
          headers: request.headers as Record<string, string | string[] | undefined>,
          body: request.body,
        })
        const res = await deps.auth.handler(webReq)

        reply.status(res.status)
        res.headers.forEach((value, key) => {
          void reply.header(key, value)
        })
        const body = await res.text()
        reply.send(body)
      } catch (err) {
        logger.error({ err }, '[auth] handler error')
        reply.status(500).send({ error: 'Auth handler error' })
      }
    },
  })

  fastify.post('/api/auth/validateToken', async (request, reply) => {
    const body = request.body as { token?: unknown } | null
    if (body && typeof body.token === 'string') {
      try {
        const valid = await isValidJWT(body.token, {})
        return await reply.send({ valid })
      } catch (err) {
        logger.error({ err }, '[auth] validateToken error')
        return reply.send({ valid: false })
      }
    }
    return reply.send({ valid: false })
  })

  fastify.get('/api/auth/oauth2/consent-details', async (request, reply) => {
    const { consent_code, client_id, scope } = request.query as {
      consent_code?: string
      client_id?: string
      scope?: string
    }

    let clientId = client_id ?? ''
    let requestedScope = scope ?? ''

    if ((!clientId || !requestedScope) && consent_code) {
      try {
        const parsed = Buffer.from(consent_code, 'base64url').toString('utf-8')
        const consentData = JSON.parse(parsed) as {
          clientId?: string
          scope?: string
        }
        clientId ||= consentData.clientId ?? ''
        requestedScope ||= consentData.scope ?? ''
      } catch {
        // Real consent codes are opaque strings, so decoding may fail.
        // Fall back to the explicit query parameters that the web consent page already has.
      }
    }

    if (!clientId) {
      return reply.status(400).send({ error: 'Missing client_id' })
    }

    let appName = clientId
    if (deps.db) {
      const result = await deps.db.execute(
        sql`SELECT name FROM "oauthApplication" WHERE "clientId" = ${clientId} LIMIT 1`,
      )
      if (result.rows.length > 0) {
        appName = (result.rows[0] as { name?: string }).name || clientId
      }
    }

    return reply.send({
      clientId,
      appName,
      scopes: requestedScope.split(' ').filter(Boolean),
    })
  })

  const LINE_ALIAS_ROUTES: Array<{
    lineUrl: string
    authUrl: string
    methods: ('GET' | 'POST')[]
  }> = [
    {
      lineUrl: '/oauth2/v2.1/authorize',
      authUrl: '/api/auth/oauth2/authorize',
      methods: ['GET', 'POST'],
    },
    {
      lineUrl: '/oauth2/v2.1/token',
      authUrl: '/api/auth/oauth2/token',
      methods: ['POST'],
    },
    {
      lineUrl: '/oauth2/v2.1/userinfo',
      authUrl: '/api/auth/oauth2/userinfo',
      methods: ['GET'],
    },
  ]

  for (const { lineUrl, authUrl, methods } of LINE_ALIAS_ROUTES) {
    fastify.route({
      method: methods,
      url: lineUrl,
      handler: async (request, reply) => {
        try {
          const contentType = (request.headers['content-type'] ?? '') as string
          const isFormEncoded = contentType.includes('application/x-www-form-urlencoded')

          let body: string | undefined
          if (
            request.method !== 'GET' &&
            request.method !== 'HEAD' &&
            request.body != null
          ) {
            body = isFormEncoded
              ? new URLSearchParams(request.body as Record<string, string>).toString()
              : JSON.stringify(request.body)
          }

          const url = new URL(authUrl, BETTER_AUTH_URL)
          const originalUrl = new URL(request.url, BETTER_AUTH_URL)
          originalUrl.searchParams.forEach((value, key) =>
            url.searchParams.set(key, value),
          )

          const headers = new Headers()
          for (const [key, value] of Object.entries(request.headers)) {
            if (value !== undefined) {
              headers.set(key, Array.isArray(value) ? value.join(', ') : value)
            }
          }
          if (body !== undefined) {
            headers.set(
              'content-type',
              isFormEncoded ? 'application/x-www-form-urlencoded' : 'application/json',
            )
          }

          const webReq = new Request(url.toString(), {
            method: request.method,
            headers,
            body,
          })

          const res = await deps.auth.handler(webReq)
          reply.status(res.status)
          res.headers.forEach((value, key) => void reply.header(key, value))
          reply.send(await res.text())
        } catch (err) {
          logger.error({ err }, '[oauth-alias] handler error')
          reply.status(500).send({ error: 'OAuth handler error' })
        }
      },
    })
  }

  // GET /oauth2/v2.1/verify — Verify access token (LINE Login v2.1)
  fastify.get(
    '/oauth2/v2.1/verify',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = request.query as { access_token?: string }
      const accessToken = query.access_token

      if (!accessToken) {
        return reply.code(400).send({
          error: 'invalid_request',
          error_description: 'access_token is required',
        })
      }

      try {
        const result = await deps.db.execute(
          sql`SELECT "clientId", "scopes", "accessTokenExpiresAt" FROM "oauthAccessToken" WHERE "accessToken" = ${accessToken} LIMIT 1`,
        )

        if (result.rows.length === 0) {
          return reply.code(400).send({
            error: 'invalid_request',
            error_description: 'invalid access token',
          })
        }

        const row = result.rows[0] as {
          clientId: string
          scopes: string
          accessTokenExpiresAt: string
        }

        const expiresAt = new Date(row.accessTokenExpiresAt)
        const now = new Date()

        if (expiresAt <= now) {
          return reply.code(400).send({
            error: 'invalid_request',
            error_description: 'access token expired',
          })
        }

        const expiresIn = Math.floor((expiresAt.getTime() - now.getTime()) / 1000)

        return reply.send({
          scope: row.scopes,
          client_id: row.clientId,
          expires_in: expiresIn,
        })
      } catch (err) {
        logger.error({ err }, '[oauth] verify access token error')
        return reply.code(500).send({ error: 'Internal server error' })
      }
    },
  )

  // POST /oauth2/v2.1/verify — Verify ID token (LINE Login v2.1)
  fastify.post(
    '/oauth2/v2.1/verify',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as Record<string, string> | undefined
      const idToken = body?.id_token
      const clientId = body?.client_id
      const nonce = body?.nonce
      const userId = body?.user_id

      if (!idToken) {
        return reply.code(400).send({
          error: 'invalid_request',
          error_description: 'id_token is required',
        })
      }

      if (!clientId) {
        return reply.code(400).send({
          error: 'invalid_request',
          error_description: 'client_id is required',
        })
      }

      try {
        const jwksUrl = new URL('/api/auth/jwks', BETTER_AUTH_URL)
        const jwks = createRemoteJWKSet(jwksUrl)

        const { payload } = await jwtVerify(idToken, jwks)

        if (payload.aud !== clientId) {
          return reply.code(400).send({
            error: 'invalid_request',
            error_description: 'Invalid IdToken Audience.',
          })
        }

        if (nonce && payload.nonce !== nonce) {
          return reply.code(400).send({
            error: 'invalid_request',
            error_description: 'Invalid IdToken Nonce.',
          })
        }

        if (userId && payload.sub !== userId) {
          return reply.code(400).send({
            error: 'invalid_request',
            error_description: 'Invalid IdToken Subject Identifier.',
          })
        }

        const response: Record<string, unknown> = {
          iss: payload.iss,
          sub: payload.sub,
          aud: payload.aud,
          exp: payload.exp,
          iat: payload.iat,
        }

        if (payload.auth_time) response.auth_time = payload.auth_time
        if (payload.nonce) response.nonce = payload.nonce
        if (payload.amr) response.amr = payload.amr
        if (payload.name) response.name = payload.name
        if (payload.picture) response.picture = payload.picture
        if (payload.email) response.email = payload.email

        return reply.send(response)
      } catch (err) {
        logger.error({ err }, '[oauth] verify id token error')

        if (err instanceof Error && err.message.includes('expired')) {
          return reply.code(400).send({
            error: 'invalid_request',
            error_description: 'IdToken expired.',
          })
        }

        return reply.code(400).send({
          error: 'invalid_request',
          error_description: 'Invalid IdToken.',
        })
      }
    },
  )
}
