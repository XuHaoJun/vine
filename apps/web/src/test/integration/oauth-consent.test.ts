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
