import type { Page } from '@playwright/test'

const DEFAULT_INTEGRATION_TEST_PROXY_PORT = 8081

function getIntegrationTestProxyPort() {
  const parsedPort = Number(process.env.INTEGRATION_TEST_PROXY_PORT)
  if (Number.isInteger(parsedPort) && parsedPort > 0) {
    return parsedPort
  }
  return DEFAULT_INTEGRATION_TEST_PROXY_PORT
}

export const INTEGRATION_TEST_PROXY_PORT = getIntegrationTestProxyPort()
export const BASE_URL = `http://localhost:${INTEGRATION_TEST_PROXY_PORT}`
export const OAUTH_CALLBACK_URL = `${BASE_URL}/auth/oauth-callback`

export async function loginAsDemo(page: Page, pathname = '/') {
  console.info('Navigating to login page...')
  await page.goto(`${BASE_URL}/auth/login`, {
    waitUntil: 'domcontentloaded',
  })

  console.info('Logging in as demo user...')

  // click the demo login button
  const demoButton = page.locator('[data-testid="login-as-demo"]')
  await demoButton.waitFor({ state: 'visible', timeout: 10000 })
  await demoButton.click()

  // Wait for a successful authenticated redirect rather than merely leaving /auth/login.
  try {
    await page.waitForURL(/\/home(\/|$)/, { timeout: 30000 })
  } catch {
    console.error(`❌ Demo login did not reach a /home route`)
    throw new Error(`Demo login failed - did not reach authenticated route`)
  }
  await page.waitForLoadState('domcontentloaded').catch(() => {})

  const currentUrl = page.url()
  console.info(`✅ Logged in as demo user, redirected to: ${currentUrl}`)

  // always navigate directly to /home/talks to bypass any onboarding redirects
  // this is more reliable for CI testing than trying to click skip buttons
  console.info('Navigating to /home/talks...')
  await page.goto(`${BASE_URL}/home/talks`, { waitUntil: 'domcontentloaded' })
  await page.waitForURL(/\/home\/talks$/, { timeout: 10000 })

  // wait for page to stabilize
  await page.waitForTimeout(2000)

  // navigate to desired pathname if different from home/talks
  if (pathname !== '/' && pathname !== '/home' && pathname !== '/home/talks') {
    await page.goto(`${BASE_URL}${pathname}`, {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    })
    await page.waitForURL(
      new RegExp(`${pathname.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`),
      {
        timeout: 10000,
      },
    )
  }
}

export async function loginAsAdmin(page: Page, pathname = '/') {
  console.info('Navigating to login page...')
  await page.goto(`${BASE_URL}/auth/login?showAdmin`, {
    waitUntil: 'domcontentloaded',
  })

  console.info('Logging in as admin...')

  // click the login as admin button
  await page.locator('[data-testid="login-as-admin"]').click()
  await page.waitForTimeout(1000)
  await page.waitForLoadState('networkidle')

  // verify login by checking if we're redirected away from login page
  const currentUrl = page.url()
  if (currentUrl.includes('/auth/login')) {
    console.error(`❌ Still on login page after admin login`)
    throw new Error(`Admin login failed - still on login page`)
  }

  console.info(`✅ Logged in as admin, redirected to: ${currentUrl}`)

  // navigate to desired pathname if different from current
  if (pathname !== '/' || !currentUrl.endsWith(pathname)) {
    await page.goto(`${BASE_URL}${pathname}?showAdmin`, {
      waitUntil: 'networkidle',
    })
  }
}

export async function waitForZeroSync(page: Page, timeout = 5000) {
  // wait for zero to be connected and synced
  await page
    .waitForFunction(
      () => {
        const statusEl = document.querySelector('[data-zero-status]')
        return statusEl?.getAttribute('data-zero-status') === 'connected'
      },
      { timeout },
    )
    .catch(() => {
      console.info('Zero status element not found, continuing anyway')
    })
}

const TEST1_EMAIL = 'test1@example.com'
const TEST1_PASSWORD = 'test@1234'
const TEST2_EMAIL = 'test2@example.com'

async function loginAsUser(page: Page, email: string, pathname = '/') {
  console.info('Navigating to login page...')
  await page.goto(`${BASE_URL}/auth/login`, {
    waitUntil: 'domcontentloaded',
  })

  console.info(`Logging in as ${email}...`)

  await page.getByPlaceholder('Email').fill(email)
  await page.getByPlaceholder('Password').fill(TEST1_PASSWORD)
  await page.getByRole('button', { name: 'Log in' }).click()

  try {
    await page.waitForURL(/\/home(\/|$)/, { timeout: 30000 })
  } catch {
    console.error(`❌ ${email} login did not reach a /home route`)
    throw new Error(`${email} login failed - did not reach authenticated route`)
  }
  await page.waitForLoadState('domcontentloaded').catch(() => {})

  const currentUrl = page.url()
  console.info(`✅ Logged in as ${email}, redirected to: ${currentUrl}`)

  console.info('Navigating to /home/talks...')
  await page.goto(`${BASE_URL}/home/talks`, { waitUntil: 'domcontentloaded' })
  await page.waitForURL(/\/home\/talks$/, { timeout: 10000 })
  await page.waitForTimeout(2000)

  if (pathname !== '/' && pathname !== '/home' && pathname !== '/home/talks') {
    await page.goto(`${BASE_URL}${pathname}`, {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    })
    await page.waitForURL(
      new RegExp(`${pathname.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`),
      { timeout: 10000 },
    )
  }
}

export async function loginAsTest1(page: Page, pathname = '/') {
  return loginAsUser(page, TEST1_EMAIL, pathname)
}

export async function loginAsTest2(page: Page, pathname = '/') {
  return loginAsUser(page, TEST2_EMAIL, pathname)
}
