import { expect, test } from '@playwright/test'
import { BASE_URL, loginAsDemo, loginAsTest2 } from './helpers'

test.describe('Manager OA chat', () => {
  test.describe.configure({ mode: 'serial' })

  let managerChatPath: string | undefined

  test('owner can view unread OA chat and send a reply', async ({ page }) => {
    test.setTimeout(60000)

    await loginAsDemo(page)
    await page.goto(`${BASE_URL}/manager`, { waitUntil: 'domcontentloaded' })
    await page.waitForURL(/\/manager$/, { timeout: 10000 })

    await expect(page.getByText('Test Bot')).toBeVisible({ timeout: 10000 })

    const testBotRow = page.getByText('@testbot').locator('xpath=../..')
    await testBotRow.getByRole('button', { name: 'Manage' }).click()
    await page.waitForURL(/\/manager\/[^/]+$/, { timeout: 15000 })
    await page.getByText('Chats', { exact: true }).click()
    await page.waitForURL(/\/manager\/.+\/chat$/, { timeout: 15000 })
    managerChatPath = new URL(page.url()).pathname

    await page.waitForTimeout(2000)

    await expect(page.getByPlaceholder('Search chats')).toBeVisible({
      timeout: 10000,
    })

    await expect(
      page.getByRole('button', { name: /Open chat with Test One/ }),
    ).toBeVisible({ timeout: 20000 })
    await expect(
      page.getByText('Hello manager, I need help', { exact: false }),
    ).toBeVisible({
      timeout: 20000,
    })
    await expect(page.locator('[data-testid="unread-dot"]')).toBeVisible({
      timeout: 10000,
    })

    await page.getByRole('button', { name: /Open chat with Test One/ }).click()
    await page.waitForURL(/\/manager\/.+\/chat\/.+/, { timeout: 15000 })

    await expect(page.getByText('Hello manager, I need help')).toBeVisible()
    await expect(page.getByText('Test One', { exact: false }).first()).toBeVisible()

    await page.getByPlaceholder('Aa').fill('Thanks for reaching out')
    await page.getByRole('button', { name: 'Send' }).click()

    await expect(page.getByText('Thanks for reaching out').last()).toBeVisible({
      timeout: 10000,
    })

    // Contact list mode
    await page.getByRole('button', { name: 'Show Contacts' }).click()

    await expect(page.getByPlaceholder('Search contacts')).toBeVisible({
      timeout: 10000,
    })
    await expect(page.getByText('Contact list')).toBeVisible()
    await expect(page.getByRole('button', { name: /Open contact Test One/ })).toBeVisible(
      { timeout: 20000 },
    )

    await page.getByRole('button', { name: /Open contact Test One/ }).click()

    await expect(page.getByText('Contact ID')).toBeVisible()
    await expect(page.getByText('Friendship')).toBeVisible()
    await expect(page.getByText('Last interaction')).toBeVisible()
    await expect(page.getByText('Chat status')).toBeVisible()

    await page.getByPlaceholder('New tag').fill('Priority')
    await page.getByRole('button', { name: 'Create' }).click()
    await expect(page.getByText('Tag created')).toBeVisible({ timeout: 10000 })

    await page.getByRole('button', { name: 'Add Priority' }).click()
    await expect(page.getByText('Priority').first()).toBeVisible({ timeout: 10000 })

    await page.getByPlaceholder('Add a private note').fill('Follow up about onboarding')
    await page.getByRole('button', { name: 'Save note' }).click()
    await expect(page.getByText('Note saved')).toBeVisible({ timeout: 10000 })

    await page.getByRole('button', { name: 'Show Chats' }).click()
    await expect(page.getByText('Priority').first()).toBeVisible({ timeout: 10000 })

    await page.getByRole('button', { name: 'Show Contacts' }).click()
    await expect(page.getByText('Follow up about onboarding')).toBeVisible({
      timeout: 10000,
    })

    await page.getByRole('button', { name: 'Remove' }).first().click()
    await expect(page.getByRole('button', { name: 'Add Priority' })).toBeVisible({
      timeout: 10000,
    })

    await page.getByRole('button', { name: 'Delete' }).first().click()
    await expect(page.getByText('Delete tag?')).toBeVisible()
    await page.getByRole('button', { name: 'Confirm' }).click()
    await expect(page.getByText('Tag deleted')).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('button', { name: 'Add Priority' })).toHaveCount(0)
  })

  test('non-owner cannot see manager OA chat data', async ({ page }) => {
    test.setTimeout(60000)

    await loginAsTest2(page)
    await page.goto(`${BASE_URL}/manager`, {
      waitUntil: 'domcontentloaded',
    })
    await page.waitForURL(/\/manager$/, { timeout: 10000 })

    await expect(page.getByText('LINE Official Account Manager')).toBeVisible({
      timeout: 10000,
    })
    await expect(page.getByText('Test Bot')).toHaveCount(0)

    expect(managerChatPath).toBeDefined()
    await page.goto(`${BASE_URL}${managerChatPath}`, {
      waitUntil: 'domcontentloaded',
    })

    await expect(page.getByText('Contact list')).toHaveCount(0)
    await expect(page.getByText('Contact ID')).toHaveCount(0)

    await expect(page.getByText('Hello manager, I need help')).toHaveCount(0)
    await expect(page.getByText('Test One', { exact: false })).toHaveCount(0)

    await expect(page.getByText('Priority')).toHaveCount(0)
    await expect(page.getByText('Follow up about onboarding')).toHaveCount(0)
    await expect(page.getByPlaceholder('New tag')).toHaveCount(0)
    await expect(page.getByPlaceholder('Add a private note')).toHaveCount(0)
  })
})
