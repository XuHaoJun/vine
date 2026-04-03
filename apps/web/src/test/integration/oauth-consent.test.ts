/**
 * OAuth Consent Flow Integration Tests
 * Tests the LINE-compatible OAuth 2.0 authorization flow.
 */

import { test, expect } from '@playwright/test'

import type { APIRequestContext, Page } from '@playwright/test'

function createAuthUrl({ scope, state }: { scope: string; state: string }) {
  return (
    'http://localhost:8081/oauth2/v2.1/authorize' +
    '?client_id=vine-dev-client' +
    '&redirect_uri=http://localhost:8081/auth/oauth-callback' +
    '&response_type=code' +
    `&scope=${encodeURIComponent(scope)}` +
    `&state=${encodeURIComponent(state)}` +
    '&code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM' +
    '&code_challenge_method=S256'
  )
}

const ALLOW_AUTH_URL = createAuthUrl({
  scope: 'profile openid',
  state: 'test-state-allow',
})

const TOKEN_ENDPOINT = 'http://localhost:3001/oauth2/v2.1/token'
const USERINFO_ENDPOINT = 'http://localhost:3001/oauth2/v2.1/userinfo'
const CODE_VERIFIER = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'

const CANCEL_AUTH_URL = createAuthUrl({
  // Use a different scope set so this case still requires fresh consent
  // even after the "Allow" test persists consent for profile+openid.
  scope: 'profile openid email',
  state: 'test-state-cancel',
})

async function createFreshUser(request: APIRequestContext, label: string) {
  const timestamp = Date.now()
  const email = `oauth-${label}-${timestamp}@example.com`
  const password = 'test-password-123'

  const signUpResponse = await request.post(
    'http://localhost:3001/api/auth/sign-up/email',
    {
      data: {
        name: `OAuth ${label}`,
        email,
        password,
      },
    },
  )

  expect(signUpResponse.ok()).toBeTruthy()

  return { email, password }
}

async function loginWithCredentials(page: Page, credentials: { email: string; password: string }) {
  await page.getByPlaceholder('Email').fill(credentials.email)
  await page.getByPlaceholder('Password').fill(credentials.password)
  await page.getByRole('button', { name: 'Log in' }).click()
}

async function startConsentFlow(
  page: Page,
  request: APIRequestContext,
  authUrl: string,
  label: string,
) {
  const credentials = await createFreshUser(request, label)

  await page.goto(authUrl, { waitUntil: 'domcontentloaded', timeout: 10000 })
  await expect(page).toHaveURL(/\/auth\/login/, { timeout: 8000 })
  await loginWithCredentials(page, credentials)

  try {
    await expect(page).toHaveURL(/\/auth\/consent/, { timeout: 4000 })
  } catch {
    await page.goto(authUrl, { waitUntil: 'domcontentloaded', timeout: 10000 })
    await expect(page).toHaveURL(/\/auth\/consent/, { timeout: 10000 })
  }

  return {
    credentials,
    consentUrl: new URL(page.url()),
  }
}

async function submitConsentViaPage(page: Page, accept: boolean) {
  return await page.evaluate(async (shouldAccept) => {
    const params = new URLSearchParams(window.location.search)
    const response = await fetch(
      `http://localhost:3001/api/auth/oauth2/consent?${params.toString()}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          accept: shouldAccept,
          consent_code: params.get('consent_code'),
        }),
      },
    )

    const data = (await response.json().catch(() => null)) as
      | { redirectURI?: string; redirectUrl?: string }
      | null

    return {
      ok: response.ok,
      redirectTarget: data?.redirectURI ?? data?.redirectUrl ?? null,
    }
  }, accept)
}

test.beforeEach(async ({ context }) => {
  await context.clearCookies()
})

test('authorization endpoint redirects logged-out user to login page', async ({
  page,
}) => {
  test.setTimeout(15000)

  await page.goto(ALLOW_AUTH_URL, { waitUntil: 'domcontentloaded', timeout: 10000 })

  // Should redirect to login (not consent) since user is not logged in
  await expect(page).toHaveURL(/\/auth\/login/, { timeout: 8000 })
})

test('logged-in user reaches consent page with expected params', async ({
  page,
  request,
}) => {
  test.setTimeout(30000)

  const { consentUrl } = await startConsentFlow(page, request, ALLOW_AUTH_URL, 'render')

  expect(consentUrl.pathname).toBe('/auth/consent')
  expect(consentUrl.searchParams.get('client_id')).toBe('vine-dev-client')
  expect(consentUrl.searchParams.get('consent_code')).toBeTruthy()
  expect(consentUrl.searchParams.get('scope')).toContain('profile')
})

test('login page preserves explicit redirect back to consent', async ({
  page,
  request,
}) => {
  test.setTimeout(30000)

  const credentials = await createFreshUser(request, 'redirect')
  const returnUrl =
    '/auth/consent?consent_code=test-consent&client_id=vine-dev-client&scope=profile+openid'

  await page.goto(
    `http://localhost:8081/auth/login?redirect=${encodeURIComponent(returnUrl)}`,
    {
      waitUntil: 'domcontentloaded',
      timeout: 10000,
    },
  )

  await loginWithCredentials(page, credentials)

  await expect(page).toHaveURL(/\/auth\/consent/, { timeout: 10000 })
  const consentUrl = new URL(page.url())
  expect(consentUrl.searchParams.get('consent_code')).toBe('test-consent')
})

test('clicking Allow redirects to redirect_uri with authorization code', async ({
  page,
  request,
}) => {
  test.setTimeout(30000)

  await startConsentFlow(page, request, ALLOW_AUTH_URL, 'allow')

  const result = await submitConsentViaPage(page, true)
  expect(result.ok).toBeTruthy()
  expect(result.redirectTarget).toBeTruthy()

  const redirectUrl = new URL(result.redirectTarget ?? '')
  expect(redirectUrl.pathname).toBe('/auth/oauth-callback')
  expect(redirectUrl.searchParams.get('code')).toBeTruthy()
  expect(redirectUrl.searchParams.get('state')).toBe('test-state-allow')
})

test('clicking Cancel redirects to redirect_uri with access_denied error', async ({
  page,
  request,
}) => {
  test.setTimeout(30000)

  await startConsentFlow(page, request, CANCEL_AUTH_URL, 'cancel')

  const result = await submitConsentViaPage(page, false)
  expect(result.ok).toBeTruthy()
  expect(result.redirectTarget).toBeTruthy()

  const redirectUrl = new URL(result.redirectTarget ?? '')
  expect(redirectUrl.pathname).toBe('/auth/oauth-callback')
  expect(redirectUrl.searchParams.get('error')).toBe('access_denied')
})

test('authorization code exchanges for token and userinfo', async ({ page, request }) => {
  test.setTimeout(30000)

  await startConsentFlow(page, request, ALLOW_AUTH_URL, 'token')

  const result = await submitConsentViaPage(page, true)
  expect(result.ok).toBeTruthy()
  expect(result.redirectTarget).toBeTruthy()

  const redirectUrl = new URL(result.redirectTarget ?? '')
  const code = redirectUrl.searchParams.get('code')
  expect(code).toBeTruthy()

  const tokenResponse = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: code ?? '',
      redirect_uri: 'http://localhost:8081/auth/oauth-callback',
      client_id: 'vine-dev-client',
      client_secret: 'vine-dev-secret',
      code_verifier: CODE_VERIFIER,
    }),
  })

  expect(tokenResponse.ok).toBeTruthy()

  const tokenBody = (await tokenResponse.json()) as {
    access_token?: string
    token_type?: string
    scope?: string
    id_token?: string
  }
  expect(tokenBody.access_token).toBeTruthy()
  expect(tokenBody.token_type).toBe('Bearer')
  expect(tokenBody.scope).toContain('openid')
  expect(tokenBody.id_token).toBeTruthy()

  const userinfoResponse = await fetch(USERINFO_ENDPOINT, {
    headers: {
      Authorization: `Bearer ${tokenBody.access_token ?? ''}`,
    },
  })

  expect(userinfoResponse.ok).toBeTruthy()

  const userinfoBody = (await userinfoResponse.json()) as {
    sub?: string
    name?: string
  }
  expect(userinfoBody.sub).toBeTruthy()
  expect(userinfoBody.name).toBeTruthy()
})

test('LINE discovery endpoint returns OIDC metadata', async ({ request }) => {
  test.setTimeout(10000)

  const res = await request.get(
    'http://localhost:3001/api/auth/.well-known/openid-configuration',
  )
  expect(res.status()).toBe(200)

  const body = await res.json()
  expect(body.authorization_endpoint).toContain('/oauth2/authorize')
  expect(body.token_endpoint).toContain('/oauth2/token')
  expect(body.userinfo_endpoint).toContain('/oauth2/userinfo')
})
