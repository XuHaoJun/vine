import { expect, test } from '@playwright/test'
import { BASE_URL, loginAsDemo } from './helpers'

test.describe('Manager OA home', () => {
  test('owner lands on OA home and can reach chat, rich menus, and campaigns', async ({
    page,
  }) => {
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
    await expect(page.getByRole('link', { name: 'Home' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Chats' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Campaigns' }).first()).toBeVisible()
    await expect(page.getByText('Chat screen', { exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Rich menus' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Audiences' })).toBeVisible()
    await expect(page.getByText('Messaging API')).toBeVisible()
    await expect(page.getByText('Audience filters ready')).toBeVisible()
    await expect(page.getByText('Quota')).toBeVisible()

    const managerHomePath = new URL(page.url()).pathname
    await page.getByRole('link', { name: 'Rich menus' }).click()
    await page.waitForURL(/\/manager\/[^/]+\/richmenu$/, { timeout: 15000 })
    await expect(page.getByRole('button', { name: 'Create new' })).toBeVisible()
    await expect(page.getByText('Current menu')).toBeVisible()

    await page.goto(`${BASE_URL}${managerHomePath}`, { waitUntil: 'domcontentloaded' })
    await page.getByRole('link', { name: 'Campaigns' }).first().click()
    await page.waitForURL(/\/manager\/[^/]+\/campaigns$/, { timeout: 15000 })
    await expect(page.getByRole('button', { name: 'Preview' })).toBeVisible()
    await expect(page.getByText('History')).toBeVisible()

    await page.goto(`${BASE_URL}${managerHomePath}`, { waitUntil: 'domcontentloaded' })
    await page.getByRole('link', { name: 'Chats' }).click()
    await page.waitForURL(/\/manager\/[^/]+\/chat$/, { timeout: 15000 })
    await expect(page.getByPlaceholder('Search chats')).toBeVisible({
      timeout: 10000,
    })
    await expect(page.getByText('Chat screen', { exact: true })).toHaveCount(0)
  })
})
