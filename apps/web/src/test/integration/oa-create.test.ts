/**
 * OA Create Integration Test
 * Tests the full OA account creation flow from the manager page
 */

import { expect, test } from '@playwright/test'

import { loginAsDemo } from './helpers'

const BASE_URL = 'http://localhost:8081'

test('create OA account flow', async ({ page }) => {
  test.setTimeout(60000)

  await loginAsDemo(page)

  // navigate to manager page
  await page.goto(`${BASE_URL}/manager`, { waitUntil: 'domcontentloaded' })
  await page.waitForURL(/\/manager$/, { timeout: 10000 })

  // click create new button
  await page.locator('[data-testid="btn-create-new"]').click()
  await page.waitForURL(/\/manager\/create$/, { timeout: 10000 })

  // fill in the form
  const uniqueId = `test-oa-${Date.now()}`
  await page.locator('[data-testid="input-name"]').fill('Test OA Account')
  await page.locator('[data-testid="input-uniqueId"]').fill(uniqueId)
  await page.locator('[data-testid="input-email"]').fill('test@example.com')
  await page.locator('[data-testid="input-country"]').fill('Taiwan')
  await page.locator('[data-testid="input-company"]').fill('Test Company')
  await page.locator('[data-testid="input-industry"]').fill('Technology')

  // submit the form
  await page.locator('[data-testid="btn-create-account"]').click()

  // verify redirect to manager page after successful creation
  await page.waitForURL(/\/manager$/, { timeout: 15000 })

  // verify the new account appears in the list
  await expect(page.getByText('Test OA Account')).toBeVisible({ timeout: 10000 })
  await expect(page.getByText(`@${uniqueId}`)).toBeVisible()
})
