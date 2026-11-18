import { expect, test } from './fixtures'

for (const width of [320, 390, 520, 768, 1024, 1280]) {
  test.describe(`at ${width}px`, () => {
    test.use({ viewport: { width, height: 800 } })

    test('has no sideways scroll', async ({ page }) => {
      await page.goto('/')

      const { scrollWidth, innerWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      }))

      expect(scrollWidth).toBeLessThanOrEqual(innerWidth)
    })
  })
}
