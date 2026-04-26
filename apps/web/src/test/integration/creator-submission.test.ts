import { expect, test } from '@playwright/test'
import { loginAsDemo } from './helpers'

test.describe('creator submission', () => {
  test('creator submits package for review', async ({ page }) => {
    test.setTimeout(45000)

    await loginAsDemo(page)

    // Set up creator profile
    await page.goto('/creator')
    await page.getByPlaceholder('創作者名稱').fill('Test Creator')
    await page.getByPlaceholder('國家或地區').fill('TW')
    await page.getByRole('button', { name: '儲存資料' }).click({ force: true })
    await page.waitForTimeout(1000)

    // Create new package
    await page.goto('/creator/packages/new')
    await page.getByPlaceholder('貼圖組名稱').fill('Playwright Cats')
    await page.getByPlaceholder('描述（最多 100 字）').fill('Cats for integration test')
    await page.getByPlaceholder('價格（最小單位，例如 4500 = NT$45）').fill('4500')
    await page.getByPlaceholder('標籤（以逗號分隔）').fill('cat,test')
    await page.getByPlaceholder('版權聲明').fill('Test Creator')
    await page.getByLabel('我確認這是原創作品或已取得合法授權').check()
    await page.getByRole('button', { name: /下一步/ }).click()

    // Upload valid ZIP and proceed to step 3
    await page.locator('input[type="file"]').setInputFiles(
      'fixtures/sticker-valid-8.zip',
    )
    await expect(page.getByText('確認並提交審核')).toBeVisible()
    await page.getByRole('button', { name: '提交審核' }).click()

    // Should redirect to packages list showing in-review status
    await expect(page.getByText('審核中')).toBeVisible()
  })

  test('invalid zip blocks review submission', async ({ page }) => {
    test.setTimeout(45000)

    await loginAsDemo(page)
    await page.goto('/creator/packages/new')

    // Fill step 1 and proceed
    await page.getByPlaceholder('貼圖組名稱').fill('Invalid Zip Test')
    await page.getByPlaceholder('描述（最多 100 字）').fill('Testing invalid zip')
    await page.getByPlaceholder('價格（最小單位，例如 4500 = NT$45）').fill('4500')
    await page.getByPlaceholder('標籤（以逗號分隔）').fill('invalid,test')
    await page.getByPlaceholder('版權聲明').fill('Test Creator')
    await page.getByLabel('我確認這是原創作品或已取得合法授權').check()
    await page.getByRole('button', { name: /下一步/ }).click()

    // Upload empty/invalid ZIP
    await page.locator('input[type="file"]').setInputFiles(
      'fixtures/sticker-invalid-empty.zip',
    )

    // Error feedback should be visible and user should remain on step 2
    await expect(page.getByText('驗證失敗：')).toBeVisible()
    await expect(page.getByRole('button', { name: '提交審核' })).not.toBeVisible()
  })
})
