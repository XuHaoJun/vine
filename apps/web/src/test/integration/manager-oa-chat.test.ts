import { expect, test } from '@playwright/test'

import { BASE_URL, loginAsDemo, loginAsTest2 } from './helpers'

test.describe('Manager OA chat', () => {
  test('owner can view unread OA chat and send a reply', async ({
    page,
  }) => {
    test.setTimeout(60000)

    await loginAsDemo(page)
    await page.goto(`${BASE_URL}/manager`, { waitUntil: 'domcontentloaded' })
    await page.waitForURL(/\/manager$/, { timeout: 10000 })

    await page.getByText('Test Bot').first().click()
    await page.waitForURL(/\/manager\/.+/, { timeout: 15000 })
    await page.getByText('Chats', { exact: true }).click()
    await page.waitForURL(/\/manager\/.+\/chat$/, { timeout: 15000 })

    await expect(page.getByText('test1', { exact: false })).toBeVisible({
      timeout: 20000,
    })
    await expect(
      page.getByText('Hello manager, I need help'),
    ).toBeVisible({
      timeout: 20000,
    })
    await expect(page.locator('[data-testid="unread-dot"]')).toBeVisible({
      timeout: 10000,
    })

    await page.getByText('test1', { exact: false }).first().click()
    await page.waitForURL(/\/manager\/.+\/chat\/.+/, { timeout: 15000 })

    await expect(
      page.getByText('Hello manager, I need help'),
    ).toBeVisible()
    await expect(
      page.getByText('test1', { exact: false }).first(),
    ).toBeVisible()

    await page.getByPlaceholder('Aa').fill('Thanks for reaching out')
    await page.getByRole('button', { name: 'Send' }).click()

    await expect(
      page.getByText('Thanks for reaching out'),
    ).toBeVisible({
      timeout: 10000,
    })
  })

  test('non-owner cannot see manager OA chat data', async ({
    page,
  }) => {
    test.setTimeout(60000)

    await loginAsTest2(page)
    await page.goto(`${BASE_URL}/manager`, {
      waitUntil: 'domcontentloaded',
    })
    await page.waitForURL(/\/manager$/, { timeout: 10000 })

    await expect(page.getByText('Test Bot')).toHaveCount(0)
  })
})
