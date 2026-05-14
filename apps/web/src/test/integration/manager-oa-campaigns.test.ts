import { expect, test } from '@playwright/test'
import { BASE_URL, loginAsDemo } from './helpers'

test.describe('Manager OA campaigns', () => {
  test('owner can create an audience filter and send a text campaign', async ({ page }) => {
    test.setTimeout(90000)
    const suffix = `${Date.now()}-${test.info().retry}`
    const filterName = `Friends audience ${suffix}`
    const campaignName = `Campaign ${suffix}`

    await loginAsDemo(page)
    await page.goto(`${BASE_URL}/manager`, { waitUntil: 'domcontentloaded' })
    await page.waitForURL(/\/manager$/, { timeout: 10000 })

    const testBotRow = page.getByText('@testbot').locator('xpath=../..')
    await testBotRow.getByRole('button', { name: 'Manage' }).click()
    await page.waitForURL(/\/manager\/[^/]+$/, { timeout: 15000 })
    const managerHomePath = new URL(page.url()).pathname

    await page.goto(`${BASE_URL}${managerHomePath}/campaigns/audiences`, {
      waitUntil: 'domcontentloaded',
    })
    await expect(page.getByText('Audience filters', { exact: true })).toBeVisible({
      timeout: 10000,
    })
    await page.getByPlaceholder('VIP customers').fill(filterName)
    await page
      .getByPlaceholder('Audience query JSON')
      .fill(JSON.stringify({ 'friendship.status': 'friend' }, null, 2))
    await page.getByRole('button', { name: 'Preview' }).click()
    await expect(page.getByText(/\d+ recipients/)).toBeVisible({ timeout: 15000 })
    await page.getByRole('button', { name: 'Create' }).click()
    await expect(page.getByText('Audience filter created', { exact: true })).toBeVisible({
      timeout: 15000,
    })
    await expect(page.getByText(filterName)).toBeVisible({ timeout: 15000 })

    await page.goto(`${BASE_URL}${managerHomePath}/campaigns`, {
      waitUntil: 'domcontentloaded',
    })
    await expect(page.getByPlaceholder('May promotion')).toBeVisible({
      timeout: 10000,
    })
    await page.getByPlaceholder('May promotion').fill(campaignName)
    await page
      .getByPlaceholder('Write the outbound message')
      .fill(`Hello from ${campaignName}`)
    await page.getByRole('button', { name: 'Preview' }).click()
    await expect(page.getByText(/\d+ recipients/)).toBeVisible({ timeout: 15000 })
    await page.getByRole('button', { name: 'Send' }).click()
    await expect(page.getByText('Send campaign?')).toBeVisible()
    await page.getByRole('button', { name: 'Confirm' }).click()
    await expect(page.getByText('Campaign queued', { exact: true })).toBeVisible({
      timeout: 15000,
    })
    await expect(page.getByText(campaignName, { exact: true })).toBeVisible({
      timeout: 15000,
    })
  })
})
