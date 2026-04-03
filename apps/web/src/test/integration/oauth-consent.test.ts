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

async function startConsentFlow(
  page: Page,
  request: APIRequestContext,
  authUrl: string,
  label: string,
) {
  const credentials = await createFreshUser(request, label)

  await page.goto(authUrl, { waitUntil: 'domcontentloaded', timeout: 10000 })
  await expect(page).toHaveURL(/\/auth\/login/, { timeout: 8000 })

  await page.getByPlaceholder('Email').fill(credentials.email)
  await page.getByPlaceholder('Password').fill(credentials.password)
  await page.getByRole('button', { name: 'Log in' }).click()

  await expect(page).toHaveURL(/\/auth\/consent/, { timeout: 10000 })

  return credentials
}

test.beforeEach(async ({ context }) => {
  await context.clearCookies()
})

test('consent page renders app name and scope labels for logged-in user', async ({
  page,
  request,
}) => {
  test.setTimeout(30000)

  await startConsentFlow(page, request, ALLOW_AUTH_URL, 'render')

  // App name from consent-details endpoint (seeded as "Vine Dev Test App")
  await expect(page.getByText('Vine Dev Test App')).toBeVisible({ timeout: 5000 })

  // Scope labels for profile + openid
  await expect(page.getByText('Main profile info')).toBeVisible()
  await expect(page.getByText('Your internal identifier')).toBeVisible()

  // Action buttons
  await expect(page.getByRole('button', { name: 'Allow' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible()
})

test('authorization endpoint redirects logged-out user to login page', async ({
  page,
}) => {
  test.setTimeout(15000)

  await page.goto(ALLOW_AUTH_URL, { waitUntil: 'domcontentloaded', timeout: 10000 })

  // Should redirect to login (not consent) since user is not logged in
  await expect(page).toHaveURL(/\/auth\/login/, { timeout: 8000 })
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

  await page.getByPlaceholder('Email').fill(credentials.email)
  await page.getByPlaceholder('Password').fill(credentials.password)
  await page.getByRole('button', { name: 'Log in' }).click()

  await expect(page).toHaveURL(/\/auth\/consent/, { timeout: 10000 })
  const consentUrl = new URL(page.url())
  expect(consentUrl.searchParams.get('consent_code')).toBe('test-consent')
  await expect(page.getByText('Main profile info')).toBeVisible()
  await expect(page.getByText('Your internal identifier')).toBeVisible()
})

test('clicking Allow redirects to redirect_uri with authorization code', async ({
  page,
  request,
}) => {
  test.setTimeout(30000)

  await startConsentFlow(page, request, ALLOW_AUTH_URL, 'allow')

  await page.getByRole('button', { name: 'Allow' }).click()
  await page.waitForURL('**/auth/oauth-callback**', { timeout: 10000 })

  const redirectUrl = new URL(page.url())
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

  await page.getByRole('button', { name: 'Cancel' }).click()
  await page.waitForURL('**/auth/oauth-callback**', { timeout: 10000 })

  const redirectUrl = new URL(page.url())
  expect(redirectUrl.pathname).toBe('/auth/oauth-callback')
  expect(redirectUrl.searchParams.get('error')).toBe('access_denied')
  expect(redirectUrl.searchParams.get('state')).toBe('test-state-cancel')
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
