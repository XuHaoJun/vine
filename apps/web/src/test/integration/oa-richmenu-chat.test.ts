/**
 * OA Rich Menu Chat Integration Tests
 * Tests rich menu display and interaction in OA chat rooms
 *
 * Note: These tests go through the "官方帳號" (official accounts) tab to find the OA
 * since Zero sync state for OA chats is complex to set up in test environment.
 * We use the OA detail page flow to open an OA chat.
 */

import { expect, test } from '@playwright/test'

import { loginAsTest1 } from './helpers'

const BASE_URL = 'http://localhost:8081'

test('OA chat shows RichMenuBar for OA with rich menu', async ({ page }) => {
  test.setTimeout(60000)

  await loginAsTest1(page)

  await page.goto(`${BASE_URL}/oa/testbot`, { waitUntil: 'domcontentloaded' })
  await page.waitForURL(/\/oa\/testbot$/, { timeout: 10000 })
  await page.waitForTimeout(3000)

  const addFriendBtn = page.getByRole('button', { name: /加入好友|開始聊天/ })
  await addFriendBtn.waitFor({ state: 'visible', timeout: 15000 })
  console.log('Clicking addFriendBtn...')
  await addFriendBtn.click()
  console.log('Clicked, current URL:', page.url())

  await page.waitForURL(/\/home\/talks\/.+/, { timeout: 15000 })
  console.log('Navigated to:', page.url())
  await page.waitForTimeout(5000)

  const inputVisible = await page.locator('[placeholder="Aa"]').isVisible()
  console.log('Input placeholder visible:', inputVisible)

  const richMenuBarExists = await page.locator('text=⌨️').count()
  console.log('RichMenuBar toggle count:', richMenuBarExists)

  // In rich menu mode, the normal text input should be hidden
  const inputPlaceholder = page.locator('[placeholder="Aa"]')
  await expect(inputPlaceholder).toBeHidden({ timeout: 15000 })
})

test('RichMenuBar expand/collapse toggle works', async ({ page }) => {
  test.setTimeout(60000)

  await loginAsTest1(page)

  await page.goto(`${BASE_URL}/oa/testbot`, { waitUntil: 'domcontentloaded' })
  await page.waitForURL(/\/oa\/testbot$/, { timeout: 10000 })
  await page.waitForTimeout(3000)

  const addFriendBtn = page.getByRole('button', { name: /加入好友|開始聊天/ })
  await addFriendBtn.waitFor({ state: 'visible', timeout: 15000 })
  console.log('Clicking addFriendBtn...')
  await addFriendBtn.click()
  console.log('Clicked, current URL:', page.url())

  await page.waitForURL(/\/home\/talks\/.+/, { timeout: 15000 })
  console.log('Navigated to:', page.url())
  await page.waitForTimeout(5000)

  const inputVisible = await page.locator('[placeholder="Aa"]').isVisible()
  console.log('Input placeholder visible:', inputVisible)

  const richMenuBarExists = await page.locator('text=⌨️').count()
  console.log('RichMenuBar toggle count:', richMenuBarExists)

  // In rich menu mode, the normal text input should be hidden
  const inputPlaceholder = page.locator('[placeholder="Aa"]')
  await expect(inputPlaceholder).toBeHidden({ timeout: 15000 })

  // Switch to keyboard mode (the ⌨️ button expands/shows text input)
  const richMenuToggle = page.getByText('⌨️')
  await richMenuToggle.click()

  await page.waitForTimeout(1000)

  await expect(inputPlaceholder).toBeVisible()
})
