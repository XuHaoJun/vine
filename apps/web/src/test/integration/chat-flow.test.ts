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

  test('friend requests page loads', async ({ page }) => {
    await loginAsDemo(page)

    await page.goto(`${BASE_URL}/home/talks`, { waitUntil: 'domcontentloaded' })
    await page.waitForURL(/\/home\/talks$/, { timeout: 10000 })

    // Navigate to requests page via the + button
    await page.getByRole('button', { name: '＋' }).click()
    await page.waitForURL(/\/home\/talks\/requests/, { timeout: 10000 })

    // Wait for page to render
    await page.waitForTimeout(1000)

    // The H3 heading renders as a heading role
    await expect(page.getByRole('heading', { name: '好友管理' })).toBeVisible()
  })

  test('user search input is available on requests page', async ({ page }) => {
    await loginAsDemo(page)

    await page.goto(`${BASE_URL}/home/talks`, { waitUntil: 'domcontentloaded' })
    await page.waitForURL(/\/home\/talks$/, { timeout: 10000 })

    // Navigate to requests page via the + button
    await page.getByRole('button', { name: '＋' }).click()
    await page.waitForURL(/\/home\/talks\/requests/, { timeout: 10000 })

    // Wait for page to render
    await page.waitForTimeout(1000)

    // Click search mode button with force to avoid detachment issues
    await page.getByRole('button', { name: '搜尋新好友' }).click({ force: true })
    await page.waitForTimeout(500)

    // Search input should be visible
    const searchInput = page.getByPlaceholder('輸入 username 搜尋')
    await expect(searchInput).toBeVisible()
  })
})
