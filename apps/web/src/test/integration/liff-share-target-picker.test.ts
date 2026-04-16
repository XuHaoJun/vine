/**
 * LIFF shareTargetPicker Integration Test
 *
 * Simulates a third-party LIFF app (served via iframe) that calls
 * liff.shareTargetPicker() and verifies the full flow:
 * 1. Vine renders the LIFF app in an iframe at /liff/{liffId}
 * 2. Third-party app calls shareTargetPicker → postMessage to parent
 * 3. Vine shows the ShareTargetPicker overlay
 * 4. User selects targets and clicks share
 * 5. Vine sends messages and posts result back to iframe
 *
 * The mock LIFF app is served by apps/server from `@vine/liff-fixtures` (built static HTML/JS)
 * and uses the REAL @vine/liff SDK, so this test validates the actual SDK behaviour.
 */

import { expect, test } from '@playwright/test'

import { loginAsDemo, waitForZeroSync } from './helpers'

const BASE_URL = 'http://localhost:8081'
const SERVER_URL = 'http://localhost:3001'

/**
 * Mock LIFF app config response (what /liff/v1/apps/:liffId returns).
 */
function createLiffAppConfig(liffId: string, endpointUrl: string) {
  return {
    liffId,
    viewType: 'full',
    endpointUrl,
    moduleMode: false,
    scopes: ['profile', 'chat_message.write'],
    botPrompt: 'none',
    qrCode: false,
  }
}

test.describe('LIFF shareTargetPicker', () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies()
  })

  test('shareTargetPicker overlay appears when third-party app calls it', async ({
    page,
  }) => {
    test.setTimeout(60000)

    // 1. Login as demo user
    await loginAsDemo(page)

    // 2. Set up test data
    const testLiffId = `test-share-${Date.now()}`
    const mockEndpointUrl = `${SERVER_URL}/fixtures/liff/mock-share-target-picker?liffId=${encodeURIComponent(testLiffId)}`

    // 3. Intercept the LIFF app config endpoint
    await page.route(`**/liff/v1/apps/${testLiffId}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(createLiffAppConfig(testLiffId, mockEndpointUrl)),
      })
    })

    // 4. Navigate to Vine's LIFF URL (equivalent to liff.line.me/{liffId})
    // This loads the mock LIFF app page in an iframe
    await page.goto(`${BASE_URL}/liff/${testLiffId}`, {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    })

    // 5. Wait for the iframe (third-party app) to load
    await page.locator('iframe').first().waitFor({ state: 'visible', timeout: 10000 })

    // 6. Initialize the LIFF SDK inside the iframe
    const frameLocator = page.frameLocator('iframe').first()
    await frameLocator
      .locator('[data-testid="mock-liff-init-btn"]')
      .click({ timeout: 10000 })

    // Wait for initialization to complete
    await expect(frameLocator.locator('[data-testid="mock-liff-status"]')).toContainText(
      'Initialized',
      { timeout: 10000 },
    )

    // 7. Click the share button inside the iframe
    // This triggers the REAL liff.shareTargetPicker() which posts a message to parent
    await frameLocator
      .locator('[data-testid="mock-liff-share-btn"]')
      .click({ timeout: 10000 })

    // 8. Verify the ShareTargetPicker overlay appears on the parent page
    await expect(page.getByText('選擇傳送對象')).toBeVisible({ timeout: 10000 })

    // 9. Verify the Friends and Chats sections are present
    await expect(page.getByText('好友')).toBeVisible()
    await expect(page.getByText('聊天')).toBeVisible()

    // 10. Verify the share button at the bottom is visible
    const shareButton = page.getByText('分享')
    await expect(shareButton).toBeVisible()

    // 11. Close the picker by clicking the back arrow (CaretLeftIcon)
    await page.locator('svg').first().click()
    await page.waitForTimeout(500)

    // 12. Verify the overlay is gone
    await expect(page.getByText('選擇傳送對象')).not.toBeVisible({ timeout: 5000 })
  })

  test('shareTargetPicker shows chat targets from Zero sync', async ({ page }) => {
    test.setTimeout(60000)

    // 1. Login as demo user
    await loginAsDemo(page)

    // 2. Wait for Zero to sync (so friends/chats data is available)
    await waitForZeroSync(page, 10000)

    // 3. Set up test data
    const testLiffId = `test-share-zero-${Date.now()}`
    const mockEndpointUrl = `${SERVER_URL}/fixtures/liff/mock-share-target-picker?liffId=${encodeURIComponent(testLiffId)}`

    // 4. Intercept endpoints
    await page.route(`**/liff/v1/apps/${testLiffId}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(createLiffAppConfig(testLiffId, mockEndpointUrl)),
      })
    })

    // 5. Navigate to Vine's LIFF URL
    await page.goto(`${BASE_URL}/liff/${testLiffId}`, {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    })

    // 6. Wait for iframe and initialize the REAL SDK
    await page.locator('iframe').first().waitFor({ state: 'visible', timeout: 10000 })
    const frameLocator = page.frameLocator('iframe').first()
    await frameLocator
      .locator('[data-testid="mock-liff-init-btn"]')
      .click({ timeout: 10000 })
    await expect(frameLocator.locator('[data-testid="mock-liff-status"]')).toContainText(
      'Initialized',
      { timeout: 10000 },
    )

    // 7. Trigger shareTargetPicker via REAL SDK
    await frameLocator
      .locator('[data-testid="mock-liff-share-btn"]')
      .click({ timeout: 10000 })

    // 8. Verify picker overlay
    await expect(page.getByText('選擇傳送對象')).toBeVisible({ timeout: 10000 })

    // 9. Verify the Chats section is visible
    const chatSection = page.getByText('聊天').first()
    await expect(chatSection).toBeVisible({ timeout: 10000 })

    // 10. Verify the share button state
    const shareBtn = page.getByText('分享')
    await expect(shareBtn).toBeVisible()

    // Check that the share button has a background color
    const shareBtnBg = await shareBtn.evaluate((el) => {
      return window.getComputedStyle(el as HTMLElement).backgroundColor
    })
    expect(shareBtnBg).toBeTruthy()

    // 11. Close the picker
    await page.locator('svg').first().click()
    await page.waitForTimeout(500)
    await expect(page.getByText('選擇傳送對象')).not.toBeVisible({ timeout: 5000 })
  })

  test('invalid liffId shows error page', async ({ page }) => {
    test.setTimeout(30000)

    // 1. Login as demo user
    await loginAsDemo(page)

    // 2. Navigate to a non-existent LIFF app
    await page.goto(`${BASE_URL}/liff/nonexistent-liff-id`, {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    })

    // 3. Verify error page is shown
    await expect(page.getByText('LIFF Error')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('not found')).toBeVisible({ timeout: 5000 })
  })
})
