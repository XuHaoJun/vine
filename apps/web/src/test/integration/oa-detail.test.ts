/**
 * OA Detail Page Integration Tests
 * Tests the /oa/[oaId] route which resolves and displays official accounts
 */

import { expect, test } from '@playwright/test'

import { BASE_URL, loginAsDemo } from './helpers'

test('OA detail page renders for existing OA', async ({ page }) => {
  test.setTimeout(45000)

  await loginAsDemo(page)

  await page.goto(`${BASE_URL}/oa/testbot`, { waitUntil: 'domcontentloaded' })
  await page.waitForURL(/\/oa\/testbot$/, { timeout: 10000 })

  await expect(page.getByText('Test Bot')).toBeVisible({ timeout: 10000 })
  await expect(page.getByText('官方帳號')).toBeVisible()
  await expect(page.getByText('@testbot')).toBeVisible()
})

test('OA detail page shows error for non-existent OA', async ({ page }) => {
  test.setTimeout(45000)

  await loginAsDemo(page)

  await page.goto(`${BASE_URL}/oa/nonexistent_oa_id`, { waitUntil: 'domcontentloaded' })
  await page.waitForURL(/\/oa\/nonexistent_oa_id$/, { timeout: 10000 })

  await expect(page.getByText('找不到此官方帳號')).toBeVisible({ timeout: 10000 })
  await expect(page.getByText('請確認 QR Code 或連結是否正確')).toBeVisible()
})
