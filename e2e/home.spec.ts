import { test, expect } from '@playwright/test'

test('home page renders its main heading', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
})
