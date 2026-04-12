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

  console.log('DEBUG: Navigating to /oa/testbot...')
  await page.goto(`${BASE_URL}/oa/testbot`, { waitUntil: 'domcontentloaded' })
  console.log('DEBUG: Goto done, URL:', page.url())

  console.log('DEBUG: Waiting for /oa/testbot URL...')
  await page.waitForURL(/\/oa\/testbot$/, { timeout: 10000 })
  console.log('DEBUG: URL matched, URL:', page.url())

  console.log('DEBUG: Waiting for networkidle...')
  await page.waitForLoadState('networkidle')
  console.log('DEBUG: networkidle reached')

  console.log('DEBUG: Looking for addFriendBtn...')
  const addFriendBtn = page.getByRole('button', { name: /加入好友|開始聊天/ })

  // Debug: check what's on the page
  const bodyHTML = await page.locator('body').innerHTML()
  console.log('DEBUG: Body HTML (first 1000):', bodyHTML.substring(0, 1000))

  const buttonCount = await page.getByRole('button').count()
  console.log('DEBUG: Total button count:', buttonCount)

  const allButtonTexts = await page.getByRole('button').allInnerTexts()
  console.log('DEBUG: All button texts:', JSON.stringify(allButtonTexts))

  console.log('DEBUG: Waiting for addFriendBtn to be attached...')
  await addFriendBtn.waitFor({ state: 'attached', timeout: 20000 })
  console.log('DEBUG: addFriendBtn attached, clicking...')
  await addFriendBtn.click()
  console.log('DEBUG: Clicked, URL:', page.url())

  console.log('DEBUG: Waiting for /home/talks/... URL...')
  await page.waitForURL(/\/home\/talks\/.+/, { timeout: 15000 })
  console.log('DEBUG: URL matched, URL:', page.url())

  console.log('DEBUG: Waiting for networkidle...')
  await page.waitForLoadState('networkidle')
  console.log('DEBUG: networkidle reached')

  const inputPlaceholder = page.locator('[placeholder="Aa"]')
  await expect(inputPlaceholder).toBeHidden({ timeout: 15000 })
})

test('RichMenuBar expand/collapse toggle works', async ({ page }) => {
  test.setTimeout(60000)

  await loginAsTest1(page)

  console.log('DEBUG: Navigating to /oa/testbot...')
  await page.goto(`${BASE_URL}/oa/testbot`, { waitUntil: 'domcontentloaded' })
  console.log('DEBUG: Goto done, URL:', page.url())

  console.log('DEBUG: Waiting for /oa/testbot URL...')
  await page.waitForURL(/\/oa\/testbot$/, { timeout: 10000 })
  console.log('DEBUG: URL matched, URL:', page.url())

  console.log('DEBUG: Waiting for networkidle...')
  await page.waitForLoadState('networkidle')
  console.log('DEBUG: networkidle reached')

  console.log('DEBUG: Looking for addFriendBtn...')
  const addFriendBtn = page.getByRole('button', { name: /加入好友|開始聊天/ })

  // Debug: check what's on the page
  const bodyHTML = await page.locator('body').innerHTML()
  console.log('DEBUG: Body HTML (first 1000):', bodyHTML.substring(0, 1000))

  const buttonCount = await page.getByRole('button').count()
  console.log('DEBUG: Total button count:', buttonCount)

  const allButtonTexts = await page.getByRole('button').allInnerTexts()
  console.log('DEBUG: All button texts:', JSON.stringify(allButtonTexts))

  console.log('DEBUG: Waiting for addFriendBtn to be attached...')
  await addFriendBtn.waitFor({ state: 'attached', timeout: 20000 })
  console.log('DEBUG: addFriendBtn attached, clicking...')
  await addFriendBtn.click()
  console.log('DEBUG: Clicked, URL:', page.url())

  console.log('DEBUG: Waiting for /home/talks/... URL...')
  await page.waitForURL(/\/home\/talks\/.+/, { timeout: 15000 })
  console.log('DEBUG: URL matched, URL:', page.url())

  console.log('DEBUG: Waiting for networkidle...')
  await page.waitForLoadState('networkidle')
  console.log('DEBUG: networkidle reached')

  const inputPlaceholder = page.locator('[placeholder="Aa"]')
  await expect(inputPlaceholder).toBeHidden({ timeout: 15000 })

  const richMenuToggle = page.getByText('⌨️')
  await richMenuToggle.click()

  await page.waitForTimeout(1000)

  await expect(inputPlaceholder).toBeVisible()
})
