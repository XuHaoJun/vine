import { expo } from '@better-auth/expo'
import { isValidJWT } from '@take-out/better-auth-utils/server'
import { eq } from 'drizzle-orm'
import { time } from '@take-out/helpers'
import { betterAuth } from 'better-auth'
import { admin, bearer, jwt, magicLink, oidcProvider } from 'better-auth/plugins'
import type { FastifyInstance } from 'fastify'
import type { Pool } from 'pg'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { schema } from '@vine/db'
import { user as userTable } from '@vine/db/schema-private'
import { userPublic, userState } from '@vine/db/schema-public'
import { toWebRequest } from '../utils'

const DOMAIN = 'takeout.tamagui.dev'
const APP_SCHEME = 'takeout'
const BETTER_AUTH_URL = process.env['BETTER_AUTH_URL'] ?? 'http://localhost:3001'
const DEMO_EMAIL = process.env['DEMO_EMAIL'] ?? `demo@${DOMAIN}`

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
      console.error(`[afterCreateUser] error`, error)
      throw error
    }
  }

  return betterAuth({
    database,

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
          console.info('Magic link would be sent to:', email, url)
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
        console.info(level, message, ...args)
      },
    },

    account: { accountLinking: { allowDifferentEmails: true } },
  })
}

export { createAuthServer }
export type { AuthDeps }

type AuthPluginDeps = {
  auth: ReturnType<typeof createAuthServer>
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
        console.error('[auth] handler error', err)
        reply.status(500).send({ error: 'Auth handler error' })
      }
    },
  })

  fastify.post('/api/auth/validateToken', async (request, reply) => {
    const body = request.body as { token?: unknown } | null
    if (body && typeof body.token === 'string') {
      try {
        const valid = await isValidJWT(body.token, {})
        return reply.send({ valid })
      } catch (err) {
        console.error('[auth] validateToken error', err)
      }
    }
    reply.send({ valid: false })
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
          if (request.method !== 'GET' && request.method !== 'HEAD' && request.body != null) {
            body = isFormEncoded
              ? new URLSearchParams(request.body as Record<string, string>).toString()
              : JSON.stringify(request.body)
          }

          const url = new URL(authUrl, BETTER_AUTH_URL)
          const originalUrl = new URL(request.url, BETTER_AUTH_URL)
          originalUrl.searchParams.forEach((value, key) => url.searchParams.set(key, value))

          const headers = new Headers()
          for (const [key, value] of Object.entries(request.headers)) {
            if (value !== undefined) {
              headers.set(key, Array.isArray(value) ? value.join(', ') : value)
            }
          }
          if (body !== undefined) {
            headers.set('content-type', isFormEncoded ? 'application/x-www-form-urlencoded' : 'application/json')
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
          console.error('[oauth-alias] handler error', err)
          reply.status(500).send({ error: 'OAuth handler error' })
        }
      },
    })
  }
}
