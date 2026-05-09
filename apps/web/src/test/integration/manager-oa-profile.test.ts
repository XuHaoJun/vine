import { expect, test } from '@playwright/test'
import { BASE_URL, loginAsDemo } from './helpers'

test.describe('Manager OA business profile editor', () => {
  test('owner opens profile editor from manager home', async ({ page }) => {
    test.setTimeout(60000)

    await loginAsDemo(page)
    await page.goto(`${BASE_URL}/manager`, { waitUntil: 'domcontentloaded' })

    const testBotRow = page.getByText('@testbot').locator('xpath=../..')
    await testBotRow.getByRole('button', { name: 'Manage' }).click()
    await page.waitForURL(/\/manager\/[^/]+$/, { timeout: 15000 })

    await page.getByRole('button', { name: 'Edit profile' }).click()
    await page.waitForURL(/\/manager\/[^/]+\/account-page\/profile$/, {
      timeout: 15000,
    })

    await expect(page.getByText('Business profile settings')).toBeVisible()
    await expect(page.getByText('Edit business profile')).toBeVisible()
    await expect(page.getByText('Add plug-in')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Publish' })).toBeVisible()
  })
})
