/**
 * Flex Simulator Integration Test
 * Tests the Flex Message simulator with JSON editing and preview
 */

import { expect, test } from '@playwright/test'

import { loginAsDemo } from './helpers'

const BASE_URL = 'http://localhost:8081'

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
    await expect(page.locator('text=Hello World')).toBeVisible()
    await expect(page.locator('text=This is a sample Flex Message.')).toBeVisible()
  })

  test('invalid JSON shows error message', async ({ page }) => {
    const jsonInput = page.locator('textarea').first()
    await jsonInput.fill('{ invalid json }')

    await expect(page.locator('text=JSON parse error')).toBeVisible()
  })

  test('reset button restores default JSON', async ({ page }) => {
    const jsonInput = page.locator('textarea').first()
    await jsonInput.fill('{ "test": true }')

    await page.locator('text=Reset').click()

    const jsonValue = await jsonInput.inputValue()
    expect(jsonValue).toContain('Hello World')
    expect(jsonValue).toContain('flex')
  })

  test('valid LINE Flex Message JSON renders correctly', async ({ page }) => {
    const jsonInput = page.locator('textarea').first()
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

    await expect(page.locator('text=Custom Text')).toBeVisible()
  })
})