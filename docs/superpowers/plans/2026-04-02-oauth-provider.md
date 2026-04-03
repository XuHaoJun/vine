# OAuth 2.0 Authorization Server Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add LINE-compatible OAuth 2.0 Authorization Server so third-party apps can integrate "Log in with Vine/LINE" using the real LINE OAuth paths.

**Architecture:** Uses Better Auth's built-in `oidcProvider` plugin (already in `better-auth@1.3.32`). A Drizzle migration adds three OAuth tables. Fastify route aliases proxy LINE's exact paths (`/oauth2/v2.1/*`) to Better Auth's internal endpoints. A consent page at `/auth/consent` handles user approval with LINE's visual design. No new packages except `@fastify/formbody` for form-encoded token requests.

**Tech Stack:** `better-auth/plugins` (`oidcProvider`), `@fastify/formbody`, Tamagui, `react-hook-form`, Playwright (integration tests)

**Debug Notes:** See `docs/oauth-provider-debug-notes-2026-04-03.md` for the condensed debugging timeline, root causes, and test stabilization lessons from implementing this plan.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `packages/db/src/migrations/20260402000000_oidc_provider.ts` | OAuth tables + seed test client |
| Modify | `apps/server/src/plugins/auth.ts` | Add `oidcProvider` plugin + LINE path alias routes |
| Modify | `apps/server/src/index.ts` | Register `@fastify/formbody` |
| Modify | `apps/web/app/(app)/_layout.tsx` | Exclude `/auth/consent` from logged-in redirect |
| Create | `apps/web/app/(app)/auth/consent.tsx` | LINE-styled consent page UI |
| Create | `apps/web/src/test/integration/oauth-consent.test.ts` | Integration tests for consent flow |

---

## Task 1: DB Migration — OAuth Tables

**Files:**
- Create: `packages/db/src/migrations/20260402000000_oidc_provider.ts`

- [ ] **Step 1: Create the migration file**

```ts
import type { PoolClient } from 'pg'

const sql = `
CREATE TABLE "oauthApplication" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL,
  "icon" text,
  "metadata" text,
  "clientId" text NOT NULL UNIQUE,
  "clientSecret" text,
  "redirectUrls" text NOT NULL,
  "type" text NOT NULL,
  "disabled" boolean DEFAULT false,
  "userId" text REFERENCES "user"("id") ON DELETE CASCADE,
  "createdAt" timestamp NOT NULL,
  "updatedAt" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauthAccessToken" (
  "id" text PRIMARY KEY,
  "accessToken" text NOT NULL UNIQUE,
  "refreshToken" text NOT NULL UNIQUE,
  "accessTokenExpiresAt" timestamp NOT NULL,
  "refreshTokenExpiresAt" timestamp NOT NULL,
  "clientId" text NOT NULL REFERENCES "oauthApplication"("clientId") ON DELETE CASCADE,
  "userId" text REFERENCES "user"("id") ON DELETE CASCADE,
  "scopes" text NOT NULL,
  "createdAt" timestamp NOT NULL,
  "updatedAt" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauthConsent" (
  "id" text PRIMARY KEY,
  "clientId" text NOT NULL REFERENCES "oauthApplication"("clientId") ON DELETE CASCADE,
  "userId" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "scopes" text NOT NULL,
  "createdAt" timestamp NOT NULL,
  "updatedAt" timestamp NOT NULL,
  "consentGiven" boolean NOT NULL DEFAULT false
);
--> statement-breakpoint
CREATE INDEX "oauthApplication_userId_idx" ON "oauthApplication" ("userId");
--> statement-breakpoint
CREATE INDEX "oauthAccessToken_clientId_idx" ON "oauthAccessToken" ("clientId");
--> statement-breakpoint
CREATE INDEX "oauthAccessToken_userId_idx" ON "oauthAccessToken" ("userId");
--> statement-breakpoint
CREATE INDEX "oauthConsent_clientId_idx" ON "oauthConsent" ("clientId");
--> statement-breakpoint
CREATE INDEX "oauthConsent_userId_idx" ON "oauthConsent" ("userId");
--> statement-breakpoint
INSERT INTO "oauthApplication" (
  "id", "name", "clientId", "clientSecret", "redirectUrls",
  "type", "disabled", "createdAt", "updatedAt"
) VALUES (
  'vine-dev-client-001',
  'Vine Dev Test App',
  'vine-dev-client',
  'vine-dev-secret',
  'http://localhost:8081/auth/oauth-callback',
  'web',
  false,
  NOW(),
  NOW()
);
`

export async function up(client: PoolClient) {
  await client.query(sql)
}
```

- [ ] **Step 2: Run the migration**

```bash
bun --cwd packages/db run migrate
```

Expected: No errors. Check DB has `oauthApplication`, `oauthAccessToken`, `oauthConsent` tables.

```bash
# Verify tables exist
psql $ZERO_UPSTREAM_DB -c "\dt" | grep oauth
```

Expected output contains: `oauthApplication`, `oauthAccessToken`, `oauthConsent`

- [ ] **Step 3: Commit**

```bash
git add packages/db/src/migrations/20260402000000_oidc_provider.ts
git commit -m "feat: add OAuth 2.0 provider DB migration (oauthApplication, oauthAccessToken, oauthConsent)"
```

---

## Task 2: Server — oidcProvider Plugin + LINE Path Aliases

**Files:**
- Modify: `apps/server/src/plugins/auth.ts`
- Modify: `apps/server/src/index.ts`

Context: `oidcProvider` is already bundled inside `better-auth@1.3.32` — no new package needed for the plugin itself. We need `@fastify/formbody` so Fastify can parse `application/x-www-form-urlencoded` bodies (used by the token endpoint).

- [ ] **Step 1: Install `@fastify/formbody`**

```bash
bun add @fastify/formbody --cwd apps/server
```

- [ ] **Step 2: Register `@fastify/formbody` in `apps/server/src/index.ts`**

Open `apps/server/src/index.ts`. After the `cors` registration block, add:

```ts
import formbody from '@fastify/formbody'
```

Add the registration immediately after the cors registration:

```ts
await app.register(cors, {
  origin: process.env['ALLOWED_ORIGIN'] ?? true,
  credentials: true,
})

await app.register(formbody)   // ← add this line
```

- [ ] **Step 3: Add `oidcProvider` plugin to `apps/server/src/plugins/auth.ts`**

Add the import at the top with the other `better-auth/plugins` imports:

```ts
import { admin, bearer, jwt, magicLink, oidcProvider } from 'better-auth/plugins'
```

Add `oidcProvider` to the `plugins` array inside `betterAuth({...})`:

```ts
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
```

- [ ] **Step 4: Add LINE path alias routes to `authPlugin()`**

Inside `authPlugin()` in `apps/server/src/plugins/auth.ts`, after the existing routes, add:

```ts
// LINE-compatible OAuth path aliases
// Proxies /oauth2/v2.1/* → /api/auth/oauth2/* (inline, no HTTP redirect)
// so POST bodies and headers are preserved.
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
        // Preserve query string from original request
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
```

The `BETTER_AUTH_URL` constant is already declared at the top of the file:
```ts
const BETTER_AUTH_URL = process.env['BETTER_AUTH_URL'] ?? 'http://localhost:3001'
```

- [ ] **Step 5: Verify the server starts without errors**

```bash
bun run dev
```

Expected: Server starts on port 3001, no TypeScript errors, no startup exceptions. You should see the usual startup logs.

Test the discovery endpoint:

```bash
curl http://localhost:3001/api/auth/.well-known/openid-configuration
```

Expected: JSON response with `authorization_endpoint`, `token_endpoint`, `userinfo_endpoint` fields.

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/plugins/auth.ts apps/server/src/index.ts apps/server/package.json bun.lock
git commit -m "feat: add oidcProvider plugin and LINE OAuth path aliases to auth server"
```

---

## Task 3: Fix Auth Guard for Consent Route

**Files:**
- Modify: `apps/web/app/(app)/_layout.tsx`

Context: The current auth guard redirects ALL logged-in users away from `/auth/*` to `/home/feed`. The consent page lives at `/auth/consent` and requires the user to be logged in. We need to exclude it from this redirect.

- [ ] **Step 1: Open `apps/web/app/(app)/_layout.tsx` and update the auth redirect**

Find this block:

```ts
// redirect logged-in users away from auth routes
const isAuthRoute = pathname.startsWith('/auth')
if (state === 'logged-in' && isAuthRoute) {
  return <Redirect href="/home/feed" />
}
```

Replace with:

```ts
// redirect logged-in users away from auth routes (except consent — requires login)
const isAuthRoute = pathname.startsWith('/auth') && pathname !== '/auth/consent'
if (state === 'logged-in' && isAuthRoute) {
  return <Redirect href="/home/feed" />
}
```

- [ ] **Step 2: Verify login still redirects logged-in users to /home/feed**

```bash
bun run dev
```

With dev server running, open `http://localhost:8081/auth/login` while logged in — should redirect to `/home/feed`. Open `http://localhost:8081/auth/consent` while logged in — should NOT redirect (shows consent page or loading state).

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/(app)/_layout.tsx
git commit -m "fix: exclude /auth/consent from logged-in auth redirect guard"
```

---

## Task 4: Consent Page UI

**Files:**
- Create: `apps/web/app/(app)/auth/consent.tsx`

Context: Better Auth redirects to `/auth/consent?consent_code=<code>&client_id=<id>&scope=<scopes>` after validating the OAuth authorization request. The page must:
1. Read those three query params
2. Check auth state — redirect to login if logged out
3. Display app name (from `client_id` for now) and requested scopes
4. POST `{ accept: true/false, consent_code }` to `/api/auth/oauth2/consent`
5. Follow the redirect that Better Auth returns

The `SERVER_URL` constant is at `~/constants/urls`.

- [ ] **Step 1: Create the consent page**

Create `apps/web/app/(app)/auth/consent.tsx`:

```tsx
import { router } from 'one'
import { useState } from 'react'
import { isWeb, SizableText, Spinner, XStack, YStack } from 'tamagui'

import { useAuth } from '~/features/auth/client/authClient'
import { Button } from '~/interface/buttons/Button'
import { LineIcon } from '~/interface/icons/LineIcon'
import { H2 } from '~/interface/text/Headings'
import { showToast } from '~/interface/toast/helpers'
import { SERVER_URL } from '~/constants/urls'

const LINE_GREEN = '#06C755'

const SCOPE_LABELS: Record<string, string> = {
  profile: 'Main profile info',
  openid: 'Your internal identifier',
  email: 'Email address',
}

function getConsentParams() {
  if (!isWeb) return { consentCode: '', clientId: '', scopes: [] as string[] }
  const params = new URLSearchParams(window.location.search)
  return {
    consentCode: params.get('consent_code') ?? '',
    clientId: params.get('client_id') ?? '',
    scopes: (params.get('scope') ?? 'openid profile').split(' ').filter(Boolean),
  }
}

export const ConsentPage = () => {
  const { state } = useAuth()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { consentCode, clientId, scopes } = getConsentParams()

  if (!isWeb) return null

  if (state === 'loading') return null

  if (state === 'logged-out') {
    const returnUrl = `/auth/consent${window.location.search}`
    router.replace(`/auth/login?redirect=${encodeURIComponent(returnUrl)}`)
    return null
  }

  const postConsent = async (accept: boolean) => {
    setIsSubmitting(true)
    try {
      const res = await fetch(`${SERVER_URL}/api/auth/oauth2/consent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ accept, consent_code: consentCode }),
      })
      // Better Auth redirects to client's redirect_uri with code or error
      if (res.redirected || res.ok) {
        window.location.href = res.url
        return
      }
      const text = await res.text()
      showToast(text || 'Something went wrong', { type: 'error' })
    } catch {
      showToast('Network error', { type: 'error' })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <YStack
      flex={1}
      justify="center"
      items="center"
      bg="$background"
      $platform-web={{ minHeight: '100vh' }}
    >
      <YStack
        width="100%"
        items="center"
        gap="$5"
        p="$6"
        maxW={380}
      >
        {/* App icon + name */}
        <YStack items="center" gap="$2">
          <YStack
            width={64}
            height={64}
            borderRadius={32}
            bg="$color3"
            justify="center"
            items="center"
          >
            <LineIcon size={36} fill={LINE_GREEN} />
          </YStack>
          <H2 text="center">{clientId}</H2>
          <SizableText size="$3" color="$color10" text="center">
            Provider: Vine
          </SizableText>
        </YStack>

        {/* Permissions */}
        <YStack width="100%" gap="$3">
          <SizableText size="$4" fontWeight="600">
            Grant the following permissions to this service.
          </SizableText>

          {scopes.map((scope) => (
            <XStack
              key={scope}
              width="100%"
              justify="space-between"
              items="center"
              py="$2"
              borderBottomWidth={1}
              borderColor="$borderColor"
            >
              <YStack gap="$1">
                <SizableText size="$3" fontWeight="500">
                  {SCOPE_LABELS[scope] ?? scope}
                </SizableText>
                <SizableText size="$2" color="$color10">
                  (Required)
                </SizableText>
              </YStack>
              {/* Non-interactive green toggle indicator */}
              <XStack
                width={44}
                height={24}
                borderRadius={12}
                bg={LINE_GREEN}
                justify="flex-end"
                items="center"
                pr="$1"
              >
                <YStack width={18} height={18} borderRadius={9} bg="white" />
              </XStack>
            </XStack>
          ))}
        </YStack>

        {/* Actions */}
        <YStack width="100%" gap="$3">
          <Button
            size="$5"
            width="100%"
            disabled={isSubmitting}
            onPress={() => postConsent(true)}
            bg={LINE_GREEN}
            color="white"
            hoverStyle={{ bg: LINE_GREEN, opacity: 0.9 }}
            pressStyle={{ bg: LINE_GREEN, opacity: 0.7 }}
          >
            {isSubmitting ? <Spinner size="small" color="white" /> : 'Allow'}
          </Button>

          <Button
            variant="transparent"
            size="$4"
            width="100%"
            disabled={isSubmitting}
            onPress={() => postConsent(false)}
          >
            <SizableText size="$3" color="$color10">
              Cancel
            </SizableText>
          </Button>
        </YStack>
      </YStack>
    </YStack>
  )
}
```

- [ ] **Step 2: Register the consent screen in the auth stack layout**

Open `apps/web/app/(app)/auth/_layout.tsx`. The native Stack needs a screen for consent:

```tsx
import { Slot, Stack } from 'one'

export function AuthAndOnboardingLayout() {
  return (
    <>
      {process.env.VITE_PLATFORM === 'web' ? (
        <Slot />
      ) : (
        <Stack screenOptions={{ headerShown: false }} initialRouteName="login">
          <Stack.Screen name="login" />
          <Stack.Screen name="login/password" />
          <Stack.Screen name="signup/[method]" />
          <Stack.Screen name="consent" />
        </Stack>
      )}
    </>
  )
}
```

- [ ] **Step 3: Verify the consent page renders**

With dev server running (`bun run dev`):

```
http://localhost:8081/auth/consent?consent_code=test&client_id=vine-dev-client&scope=profile+openid
```

Expected while logged in: Consent page renders with "vine-dev-client" as app name, "Main profile info" and "Your internal identifier" permission rows with green toggles, green "Allow" button, grey "Cancel" text below.

Expected while logged out: Redirects to `/auth/login?redirect=...`.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/(app)/auth/consent.tsx apps/web/app/(app)/auth/_layout.tsx
git commit -m "feat: add LINE-styled OAuth consent page"
```

---

## Task 5: Integration Tests

**Files:**
- Create: `apps/web/src/test/integration/oauth-consent.test.ts`

Context: The test client seeded in Task 1 has:
- `clientId`: `vine-dev-client`
- `clientSecret`: `vine-dev-secret`
- `redirectUrls`: `http://localhost:8081/auth/oauth-callback`

The test needs a logged-in user. Use the demo user (`DEMO_EMAIL` env var, default `demo@takeout.tamagui.dev`) via the demo login button at `[data-testid="login-as-demo"]`.

The full authorization URL:
```
http://localhost:8081/oauth2/v2.1/authorize
  ?client_id=vine-dev-client
  &redirect_uri=http://localhost:8081/auth/oauth-callback
  &response_type=code
  &scope=profile+openid
  &state=test-state-123
  &code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM
  &code_challenge_method=S256
```

Note: The `code_challenge` above is a valid S256 challenge for code verifier `dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk`.

- [ ] **Step 1: Write the integration test**

Create `apps/web/src/test/integration/oauth-consent.test.ts`:

```ts
/**
 * OAuth Consent Flow Integration Tests
 * Tests the LINE-compatible OAuth 2.0 authorization flow.
 */

import { test, expect } from '@playwright/test'

const AUTH_URL =
  'http://localhost:8081/oauth2/v2.1/authorize' +
  '?client_id=vine-dev-client' +
  '&redirect_uri=http://localhost:8081/auth/oauth-callback' +
  '&response_type=code' +
  '&scope=profile+openid' +
  '&state=test-state-123' +
  '&code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM' +
  '&code_challenge_method=S256'

async function loginAsDemo(page: import('@playwright/test').Page) {
  await page.goto('http://localhost:8081/auth/login', { waitUntil: 'domcontentloaded' })
  await page.locator('[data-testid="login-as-demo"]').click()
  await page.waitForURL('**/home/feed', { timeout: 10000 })
}

test.beforeEach(async ({ context }) => {
  await context.clearCookies()
})

test('authorization endpoint redirects logged-out user to login page', async ({ page }) => {
  test.setTimeout(15000)

  await page.goto(AUTH_URL, { waitUntil: 'domcontentloaded', timeout: 10000 })

  // Should redirect to login (not consent) since user is not logged in
  await expect(page).toHaveURL(/\/auth\/login/, { timeout: 8000 })
})

test('consent page renders for logged-in user', async ({ page }) => {
  test.setTimeout(30000)

  await loginAsDemo(page)

  await page.goto(AUTH_URL, { waitUntil: 'domcontentloaded', timeout: 10000 })

  // Should end up on consent page
  await expect(page).toHaveURL(/\/auth\/consent/, { timeout: 8000 })

  // App identifier shown
  await expect(page.getByText('vine-dev-client')).toBeVisible({ timeout: 5000 })

  // Scope permissions shown
  await expect(page.getByText('Main profile info')).toBeVisible()
  await expect(page.getByText('Your internal identifier')).toBeVisible()

  // Action buttons present
  await expect(page.getByRole('button', { name: 'Allow' })).toBeVisible()
  await expect(page.getByText('Cancel')).toBeVisible()
})

test('clicking Allow redirects to redirect_uri with authorization code', async ({ page }) => {
  test.setTimeout(30000)

  await loginAsDemo(page)

  await page.goto(AUTH_URL, { waitUntil: 'domcontentloaded', timeout: 10000 })
  await expect(page).toHaveURL(/\/auth\/consent/, { timeout: 8000 })

  // Track navigation after Allow
  const navigationPromise = page.waitForURL(
    '**/auth/oauth-callback**',
    { timeout: 10000 }
  )

  await page.getByRole('button', { name: 'Allow' }).click()

  await navigationPromise

  // Redirect_uri receives authorization code and state
  const url = new URL(page.url())
  expect(url.searchParams.get('code')).toBeTruthy()
  expect(url.searchParams.get('state')).toBe('test-state-123')
})

test('clicking Cancel redirects to redirect_uri with access_denied error', async ({ page }) => {
  test.setTimeout(30000)

  await loginAsDemo(page)

  await page.goto(AUTH_URL, { waitUntil: 'domcontentloaded', timeout: 10000 })
  await expect(page).toHaveURL(/\/auth\/consent/, { timeout: 8000 })

  const navigationPromise = page.waitForURL(
    '**/auth/oauth-callback**',
    { timeout: 10000 }
  )

  await page.getByText('Cancel').click()

  await navigationPromise

  const url = new URL(page.url())
  expect(url.searchParams.get('error')).toBe('access_denied')
})

test('LINE discovery endpoint returns OIDC metadata', async ({ request }) => {
  test.setTimeout(10000)

  const res = await request.get('http://localhost:3001/api/auth/.well-known/openid-configuration')
  expect(res.status()).toBe(200)

  const body = await res.json()
  expect(body.authorization_endpoint).toContain('/oauth2/authorize')
  expect(body.token_endpoint).toContain('/oauth2/token')
  expect(body.userinfo_endpoint).toContain('/oauth2/userinfo')
})
```

- [ ] **Step 2: Run the integration tests**

```bash
bun --cwd apps/web run test:integration -- oauth-consent
```

Expected: All 5 tests pass. If the demo user doesn't exist yet, run the app once and create it via `bun run dev`, or check that the demo migration seeded it.

If tests for Allow/Cancel fail because `/auth/oauth-callback` is not a real page, that's fine — we're just verifying the redirect happens with the right query params, not that the page renders.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/test/integration/oauth-consent.test.ts
git commit -m "test: add OAuth consent flow integration tests"
```

---

## Post-Implementation Verification

After all tasks are committed, run the full test suite:

```bash
bun run test
```

Then manually verify the end-to-end flow:

1. Open `http://localhost:8081/oauth2/v2.1/authorize?client_id=vine-dev-client&redirect_uri=http://localhost:8081/auth/oauth-callback&response_type=code&scope=profile+openid&state=abc123&code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM&code_challenge_method=S256`
2. Log in if prompted
3. Consent page appears with "vine-dev-client", scope permissions, Allow/Cancel
4. Click Allow → redirected to `http://localhost:8081/auth/oauth-callback?code=<auth_code>&state=abc123`
5. Exchange the code:

```bash
curl -X POST http://localhost:3001/oauth2/v2.1/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=authorization_code&code=<auth_code>&redirect_uri=http://localhost:8081/auth/oauth-callback&client_id=vine-dev-client&client_secret=vine-dev-secret&code_verifier=dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
```

Expected: JSON with `access_token`, `token_type: "Bearer"`, `expires_in`, `scope`.

6. Fetch user info:

```bash
curl http://localhost:3001/oauth2/v2.1/userinfo \
  -H "Authorization: Bearer <access_token>"
```

Expected: JSON with `sub` (user ID), `name`, and email fields.
