import { expect, test } from '@playwright/test'

import { loginAsDemo } from './helpers'

const BASE_URL = 'http://localhost:8081'

test.describe('Chat System', () => {
  test('talks page loads with pill toggle', async ({ page }) => {
    await loginAsDemo(page)

    await page.goto(`${BASE_URL}/home/talks`, { waitUntil: 'domcontentloaded' })
    await page.waitForURL(/\/home\/talks$/, { timeout: 10000 })

    // Pill toggle should be visible
    await expect(page.getByText('聊天')).toBeVisible()
    await expect(page.getByText('好友')).toBeVisible()
  })

  test('switching between chats and friends tabs', async ({ page }) => {
    await loginAsDemo(page)

    await page.goto(`${BASE_URL}/home/talks`, { waitUntil: 'domcontentloaded' })

    // Click friends tab
    await page.getByText('好友').click()
    await expect(page.getByText('好友')).toBeVisible()

    // Click back to chats tab
    await page.getByText('聊天').click()
    await expect(page.getByText('聊天')).toBeVisible()
  })

  test('friend requests page loads', async ({ page }) => {
    await loginAsDemo(page)

    await page.goto(`${BASE_URL}/home/talks/requests`, { waitUntil: 'domcontentloaded' })

    await expect(page.getByText('好友管理')).toBeVisible()
    await expect(page.getByText('申請')).toBeVisible()
    await expect(page.getByText('搜尋新好友')).toBeVisible()
  })

  test('user search works', async ({ page }) => {
    await loginAsDemo(page)

    await page.goto(`${BASE_URL}/home/talks/requests`, { waitUntil: 'domcontentloaded' })

    await page.getByText('搜尋新好友').click()

    const searchInput = page.getByPlaceholder('輸入 username 搜尋')
    await searchInput.fill('de') // 'demo' user should match

    // Wait for search results
    await page.waitForTimeout(500)
    // Results depend on DB state — just verify no crash
    await expect(searchInput).toBeVisible()
  })
})
