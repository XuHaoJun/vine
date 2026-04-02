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

test('clicking Allow redirects to redirect_uri with authorization code', async ({ page }) => {
  test.setTimeout(30000)

  await loginAsDemo(page)

  await page.goto(AUTH_URL, { waitUntil: 'domcontentloaded', timeout: 10000 })
  await expect(page).toHaveURL(/\/auth\/consent/, { timeout: 8000 })

  await page.getByRole('button', { name: 'Allow' }).click()

  // Wait for navigation away from consent page
  await page.waitForURL((url) => !url.toString().includes('/auth/consent'), { timeout: 10000 })

  // URL should have changed from consent page
  const currentUrl = page.url()
  expect(currentUrl).not.toContain('/auth/consent')
})

test('clicking Cancel redirects to redirect_uri with access_denied error', async ({ page }) => {
  test.setTimeout(30000)

  await loginAsDemo(page)

  await page.goto(AUTH_URL, { waitUntil: 'domcontentloaded', timeout: 10000 })
  await expect(page).toHaveURL(/\/auth\/consent/, { timeout: 8000 })

  await page.getByText('Cancel').click()

  // Wait for navigation away from consent page
  await page.waitForURL((url) => !url.toString().includes('/auth/consent'), { timeout: 10000 })

  // URL should have changed from consent page
  const currentUrl = page.url()
  expect(currentUrl).not.toContain('/auth/consent')
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
