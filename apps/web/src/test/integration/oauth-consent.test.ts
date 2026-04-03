/**
 * OAuth Consent Flow Integration Tests
 * Tests the LINE-compatible OAuth 2.0 authorization flow.
 */

import { test, expect } from '@playwright/test'

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

const CANCEL_AUTH_URL = createAuthUrl({
  // Use a different scope set so this case still requires fresh consent
  // even after the "Allow" test persists consent for profile+openid.
  scope: 'profile openid email',
  state: 'test-state-cancel',
})

async function loginWithFreshUser(page: import('@playwright/test').Page, label: string) {
  const timestamp = Date.now()
  const email = `oauth-${label}-${timestamp}@example.com`
  const password = 'test-password-123'
  const request = page.context().request

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

  return request
}

async function startConsentFlow(
  request: import('@playwright/test').APIRequestContext,
  authUrl: string,
) {
  const authorizeResponse = await request.get(authUrl, {
    failOnStatusCode: false,
    maxRedirects: 0,
  })

  expect(authorizeResponse.status()).toBe(302)

  const location = authorizeResponse.headers()['location']
  expect(location).toBeTruthy()

  const consentUrl = new URL(location ?? '', 'http://localhost:8081')
  expect(consentUrl.pathname).toBe('/auth/consent')

  const consentCode = consentUrl.searchParams.get('consent_code')
  expect(consentCode).toBeTruthy()

  return {
    consentCode: consentCode ?? '',
    clientId: consentUrl.searchParams.get('client_id') ?? '',
    scope: consentUrl.searchParams.get('scope') ?? '',
  }
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

test('clicking Allow redirects to redirect_uri with authorization code', async ({
  page,
}) => {
  test.setTimeout(30000)

  const request = await loginWithFreshUser(page, 'allow')
  const consent = await startConsentFlow(request, ALLOW_AUTH_URL)
  const consentParams = new URLSearchParams({
    consent_code: consent.consentCode,
    client_id: consent.clientId,
    scope: consent.scope,
  })

  const consentResponse = await request.post(
    `http://localhost:3001/api/auth/oauth2/consent?${consentParams.toString()}`,
    {
      headers: { origin: 'http://localhost:8081' },
      data: { accept: true, consent_code: consent.consentCode },
      failOnStatusCode: false,
    },
  )

  expect(consentResponse.ok()).toBeTruthy()

  const body = (await consentResponse.json()) as {
    redirectURI?: string
    redirectUrl?: string
  }
  const redirectTarget = body.redirectURI ?? body.redirectUrl
  expect(redirectTarget).toBeTruthy()

  const redirectUrl = new URL(redirectTarget ?? '')
  expect(redirectUrl.pathname).toBe('/auth/oauth-callback')
  expect(redirectUrl.searchParams.get('code')).toBeTruthy()
  expect(redirectUrl.searchParams.get('state')).toBe('test-state-allow')
})

test('clicking Cancel redirects to redirect_uri with access_denied error', async ({
  page,
}) => {
  test.setTimeout(30000)

  const request = await loginWithFreshUser(page, 'cancel')
  const consent = await startConsentFlow(request, CANCEL_AUTH_URL)
  const consentParams = new URLSearchParams({
    consent_code: consent.consentCode,
    client_id: consent.clientId,
    scope: consent.scope,
  })

  const consentResponse = await request.post(
    `http://localhost:3001/api/auth/oauth2/consent?${consentParams.toString()}`,
    {
      headers: { origin: 'http://localhost:8081' },
      data: { accept: false, consent_code: consent.consentCode },
      failOnStatusCode: false,
    },
  )

  expect(consentResponse.ok()).toBeTruthy()

  const body = (await consentResponse.json()) as {
    redirectURI?: string
    redirectUrl?: string
  }
  const redirectTarget = body.redirectURI ?? body.redirectUrl
  expect(redirectTarget).toBeTruthy()

  const redirectUrl = new URL(redirectTarget ?? '')
  expect(redirectUrl.pathname).toBe('/auth/oauth-callback')
  expect(redirectUrl.searchParams.get('error')).toBe('access_denied')
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
