import { expect, test } from '@playwright/test'

import { loginAsDemo } from './helpers'

const BASE_URL = 'http://localhost:8081'

test.describe('Chat System', () => {
  test('talks page loads with LINE-style header tabs', async ({ page }) => {
    await loginAsDemo(page)

    await page.goto(`${BASE_URL}/home/talks`, { waitUntil: 'domcontentloaded' })
    await page.waitForURL(/\/home\/talks$/, { timeout: 10000 })

    // LINE-style text tabs should be visible
    await expect(page.getByText('聊天 ▾')).toBeVisible()
    await expect(page.getByText('好友', { exact: true })).toBeVisible()
  })

  test('switching between chats and friends tabs', async ({ page }) => {
    await loginAsDemo(page)

    await page.goto(`${BASE_URL}/home/talks`, { waitUntil: 'domcontentloaded' })
    await page.waitForURL(/\/home\/talks$/, { timeout: 10000 })

    // Click friends tab
    await page.getByText('好友', { exact: true }).first().click()
    await expect(page.getByText('好友', { exact: true }).first()).toBeVisible()

    // Click back to chats tab
    await page.getByText('聊天 ▾').click()
    await expect(page.getByText('聊天 ▾')).toBeVisible()
  })

  test('create group dialog opens when clicking + button', async ({ page }) => {
    await loginAsDemo(page)

    await page.goto(`${BASE_URL}/home/talks`, { waitUntil: 'domcontentloaded' })
    await page.waitForURL(/\/home\/talks$/, { timeout: 10000 })

    // Open create group dialog via the + button
    await page.getByRole('button', { name: '＋' }).click()

    // Wait for dialog to appear
    await page.waitForTimeout(500)

    // Dialog title should be visible
    await expect(page.getByText('建立群組').first()).toBeVisible()

    // Close button should be visible
    await expect(page.getByRole('button', { name: '✕' })).toBeVisible()
  })

  test('create group dialog has required input fields', async ({ page }) => {
    await loginAsDemo(page)

    await page.goto(`${BASE_URL}/home/talks`, { waitUntil: 'domcontentloaded' })
    await page.waitForURL(/\/home\/talks$/, { timeout: 10000 })

    // Open create group dialog via the + button
    await page.getByRole('button', { name: '＋' }).click()
    await page.waitForTimeout(500)

    // Group name input should be visible
    const groupNameInput = page.getByPlaceholder('輸入群組名稱')
    await expect(groupNameInput).toBeVisible()

    // Create button should be visible (initially disabled without name)
    await expect(page.getByRole('button', { name: '建立群組' })).toBeVisible()
  })
})
