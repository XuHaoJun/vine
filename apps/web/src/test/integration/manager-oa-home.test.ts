import { expect, test } from '@playwright/test'
import { BASE_URL, loginAsDemo } from './helpers'

test.describe('Manager OA home', () => {
  test('owner lands on OA home and can reach chat and rich menus', async ({ page }) => {
    test.setTimeout(60000)

    await loginAsDemo(page)
    await page.goto(`${BASE_URL}/manager`, { waitUntil: 'domcontentloaded' })
    await page.waitForURL(/\/manager$/, { timeout: 10000 })

    const testBotRow = page.getByText('@testbot').locator('xpath=../..')
    await testBotRow.getByRole('button', { name: 'Manage' }).click()
    await page.waitForURL(/\/manager\/[^/]+$/, { timeout: 15000 })

    await expect(page.getByText('Vine Official Account Manager')).toBeVisible({
      timeout: 10000,
    })
    await expect(page.getByText('Home', { exact: true })).toBeVisible()
    await expect(page.getByText('Chats', { exact: true })).toBeVisible()
    await expect(page.getByText('Chat screen', { exact: true })).toBeVisible()
    await expect(page.getByText('Rich menus', { exact: true })).toBeVisible()
    await expect(page.getByText('Messaging API')).toBeVisible()
    await expect(page.getByText('Quota')).toBeVisible()

    const managerHomePath = new URL(page.url()).pathname
    await page.getByText('Rich menus', { exact: true }).last().click()
    await page.waitForURL(/\/manager\/[^/]+\/richmenu$/, { timeout: 15000 })
    await expect(page.getByRole('button', { name: 'Create new' })).toBeVisible()
    await expect(page.getByText('Current menu')).toBeVisible()

    await page.goto(`${BASE_URL}${managerHomePath}`, { waitUntil: 'domcontentloaded' })
    await page.getByText('Chats', { exact: true }).click()
    await page.waitForURL(/\/manager\/[^/]+\/chat$/, { timeout: 15000 })
    await expect(page.getByPlaceholder('Search chats')).toBeVisible({
      timeout: 10000,
    })
    await expect(page.getByText('Chat screen', { exact: true })).toHaveCount(0)
  })
})
