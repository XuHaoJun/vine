import { test, expect, type Page } from '@playwright/test'

import { BASE_URL, INTEGRATION_TEST_PROXY_PORT } from './helpers'

test.describe('Basic Integration Tests', () => {
  let page: Page

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage()
  })

  test.afterAll(async () => {
    await page.close()
  })

  test('server should be running on the integration proxy port', async () => {
    const response = await page.goto(`${BASE_URL}/auth/login`, {
      waitUntil: 'domcontentloaded',
    })
    expect(response?.status()).toBe(200)
    expect(INTEGRATION_TEST_PROXY_PORT).toBeGreaterThan(0)
  })
})
