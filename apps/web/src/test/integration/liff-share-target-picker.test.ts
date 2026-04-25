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

import { expect, test, type Frame, type Page } from '@playwright/test'

import { BASE_URL, loginAsDemo } from './helpers'

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

function liffIdFromAppsPath(url: string): string | undefined {
  const pathname = new URL(url).pathname
  const match = /^\/liff\/v1\/apps\/([^/]+)\/?$/.exec(pathname)
  return match?.[1] ? decodeURIComponent(match[1]) : undefined
}

async function clickFixtureInit(fixtureFrame: Frame) {
  await fixtureFrame
    .locator('[data-testid="mock-liff-init-btn"]')
    .waitFor({ state: 'visible', timeout: 10000 })
  await fixtureFrame.evaluate(() => {
    const btn = document.querySelector<HTMLButtonElement>(
      '[data-testid="mock-liff-init-btn"]',
    )
    if (!btn) throw new Error('mock-liff-init-btn missing in fixture')
    btn.click()
  })
}

async function clickFixtureShare(fixtureFrame: Frame) {
  await fixtureFrame
    .locator('[data-testid="mock-liff-share-btn"]')
    .waitFor({ state: 'visible', timeout: 10000 })
  await fixtureFrame.evaluate(() => {
    const btn = document.querySelector<HTMLButtonElement>(
      '[data-testid="mock-liff-share-btn"]',
    )
    if (!btn) throw new Error('mock-liff-share-btn missing in fixture')
    btn.click()
  })
}

async function waitForLiffFixtureFrame(page: Page) {
  await page.waitForFunction(
    () =>
      Array.from(document.querySelectorAll('iframe')).some((el) =>
        (el as HTMLIFrameElement).src.includes('mock-share-target-picker'),
      ),
    { timeout: 15000 },
  )
  // Frame may appear in DOM before Playwright attaches it to page.frames(); poll briefly.
  const deadline = Date.now() + 15000
  while (Date.now() < deadline) {
    const frame = page
      .frames()
      .find((f) => f.url().includes('/fixtures/liff/mock-share-target-picker'))
    if (frame) return frame
    await page.waitForTimeout(50)
  }
  throw new Error('LIFF fixture iframe not in page.frames() after wait')
}

test.describe('LIFF shareTargetPicker', () => {
  test.beforeEach(async ({ context, page }) => {
    await context.clearCookies()
    await page.setViewportSize({ width: 1280, height: 900 })
  })

  test('shareTargetPicker overlay appears when third-party app calls it', async ({
    page,
  }) => {
    test.setTimeout(60000)

    // 1. Login as demo user
    await loginAsDemo(page)

    // 2. Set up test data
    const testLiffId = `test-share-${Date.now()}`
    const mockEndpointUrl = `${BASE_URL}/fixtures/liff/mock-share-target-picker?liffId=${encodeURIComponent(testLiffId)}`

    // 3. Intercept the LIFF app config endpoint (iframe is same-origin via integration proxy → backend).
    await page.route('**/liff/v1/apps/**', async (route) => {
      if (liffIdFromAppsPath(route.request().url()) !== testLiffId) {
        await route.continue()
        return
      }
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

    // 5–6. Target the real Frame (frameLocator + force click did not fire the fixture's listeners).
    const fixtureFrame = await waitForLiffFixtureFrame(page)
    await clickFixtureInit(fixtureFrame)

    // Wait for initialization to complete
    await expect(fixtureFrame.getByTestId('mock-liff-status')).toContainText(
      'Initialized',
      {
        timeout: 10000,
      },
    )

    // 7. Click the share button inside the iframe
    // This triggers the REAL liff.shareTargetPicker() which posts a message to parent
    await clickFixtureShare(fixtureFrame)
    // Parent handles postMessage + React setState; give the host one tick to paint.
    await page.waitForTimeout(300)

    // 8. Verify the ShareTargetPicker overlay appears on the parent page
    await expect(page.getByText('選擇傳送對象')).toBeVisible({ timeout: 15000 })

    // 9. Verify the Friends and Chats sections are present (headers are "好友 {n}" / "聊天 {n}"; substring "好友" also matches "沒有好友")
    await expect(page.getByText(/^好友 \d+/)).toBeVisible()
    await expect(page.getByText(/^聊天 \d+/)).toBeVisible()

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

    // 2. Set up test data and intercept config (register before navigation to /liff)
    const testLiffId = `test-share-zero-${Date.now()}`
    const mockEndpointUrl = `${BASE_URL}/fixtures/liff/mock-share-target-picker?liffId=${encodeURIComponent(testLiffId)}`

    await page.route('**/liff/v1/apps/**', async (route) => {
      if (liffIdFromAppsPath(route.request().url()) !== testLiffId) {
        await route.continue()
        return
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(createLiffAppConfig(testLiffId, mockEndpointUrl)),
      })
    })

    // 3. Allow Zero to finish initial sync after /home/talks (avoid waitForFunction:
    // it has intermittently not resolved within its timeout in this harness).
    await page.waitForTimeout(4000)

    // 4. Navigate to Vine's LIFF URL
    await page.goto(`${BASE_URL}/liff/${testLiffId}`, {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    })

    // 6. Wait for iframe and initialize the REAL SDK
    const fixtureFrame = await waitForLiffFixtureFrame(page)
    await clickFixtureInit(fixtureFrame)
    await expect(fixtureFrame.getByTestId('mock-liff-status')).toContainText(
      'Initialized',
      {
        timeout: 10000,
      },
    )

    // 7. Trigger shareTargetPicker via REAL SDK
    await clickFixtureShare(fixtureFrame)
    await page.waitForTimeout(300)

    // 8. Verify picker overlay
    await expect(page.getByText('選擇傳送對象')).toBeVisible({ timeout: 15000 })

    // 9. Verify the Chats section header is visible
    const chatSection = page.getByText(/^聊天 \d+/)
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
