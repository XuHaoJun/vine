/**
 * Flex Simulator Integration Test
 * Tests the Flex Message simulator with JSON editing and preview
 */

import { expect, test, type Page } from '@playwright/test'

import { loginAsDemo } from './helpers'

const BASE_URL = 'http://localhost:8081'

/** Flex bubble render root — scoped so JSON in the editor textarea never matches these locators. */
function flexBubble(page: Page) {
  return page.getByTestId('lf-bubble-root')
}

test.describe('Flex Simulator', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsDemo(page)
    await page.goto(`${BASE_URL}/developers/flex-simulator`, {
      waitUntil: 'domcontentloaded',
    })
  })

  test('flex simulator page loads with JSON editor and preview', async ({ page }) => {
    await expect(page.locator('text=Flex Simulator')).toBeVisible()
    await expect(page.locator('text=JSON Input')).toBeVisible()
    await expect(page.locator('text=Preview')).toBeVisible()
  })

  test('default JSON renders in preview', async ({ page }) => {
    await expect(flexBubble(page).getByText('Hello World')).toBeVisible()
    await expect(
      flexBubble(page).getByText('This is a sample Flex Message.'),
    ).toBeVisible()
  })

  test('invalid JSON shows error message', async ({ page }) => {
    const jsonInput = page.getByRole('textbox').first()
    await jsonInput.fill('{ invalid json }')

    await expect(page.locator('text=JSON parse error')).toBeVisible()
  })

  test('reset button restores default JSON', async ({ page }) => {
    const jsonInput = page.getByRole('textbox').first()
    await jsonInput.fill('{ "test": true }')

    await page.locator('text=Reset').click()

    const jsonValue = await jsonInput.inputValue()
    expect(jsonValue).toContain('Hello World')
    expect(jsonValue).toContain('flex')
  })

  test('valid LINE Flex Message JSON renders correctly', async ({ page }) => {
    const jsonInput = page.getByRole('textbox').first()
    const validJson = JSON.stringify({
      type: 'flex',
      altText: 'Test Message',
      contents: {
        type: 'bubble',
        body: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: 'Custom Text',
              size: 'xl',
              weight: 'bold',
            },
          ],
        },
      },
    })

    await jsonInput.fill(validJson)

    await expect(flexBubble(page).getByText('Custom Text')).toBeVisible()
  })

  test('bubble preview has proper dimensions (height visible above threshold)', async ({
    page,
  }) => {
    const jsonInput = page.getByRole('textbox').first()
    const validJson = JSON.stringify({
      type: 'flex',
      altText: 'Test Message',
      contents: {
        type: 'bubble',
        size: 'mega',
        body: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: 'Tall Content',
              size: 'lg',
            },
            {
              type: 'text',
              text: 'More Content',
              size: 'lg',
            },
            {
              type: 'text',
              text: 'Even More Content',
              size: 'lg',
            },
            {
              type: 'text',
              text: 'Final Content',
              size: 'lg',
            },
          ],
        },
      },
    })

    await jsonInput.fill(validJson)

    await page.waitForTimeout(500)

    // Production CI serves a static build — dev-only `data-one-source` is absent; use stable test ids.
    const bubbleElement = page.getByTestId('lf-bubble-root')
    const bubbleBB = await bubbleElement.boundingBox()
    expect(bubbleBB).not.toBeNull()
    expect(bubbleBB!.width).toBeGreaterThan(0)
    expect(bubbleBB!.height).toBeGreaterThan(0)

    const previewWrapper = page.getByTestId('flex-simulator-preview-frame')
    const wrapperBB = await previewWrapper.boundingBox()
    expect(wrapperBB!.height).toBeGreaterThan(200)
  })
})
