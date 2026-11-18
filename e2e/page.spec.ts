import { content } from '../lib/content'
import { expect, test } from './fixtures'

const VIEWPORTS = [
  { width: 1280, height: 800 },
  { width: 390, height: 844 },
]

const SECTION_HEADINGS = [
  { id: 'live', heading: content.live.heading },
  { id: 'courts', heading: content.finder.heading },
  { id: 'how', heading: content.how.heading },
  { id: 'waitlist', heading: content.waitlist.heading },
  { id: 'faq', heading: content.faq.heading },
]

const COMP_REGIONS = [
  { name: 'header', selector: 'header' },
  { name: 'hero', selector: 'main > section:first-child' },
  { name: 'how-it-works', selector: '#how' },
  { name: 'faq', selector: '#faq' },
  { name: 'footer', selector: 'footer' },
]

for (const viewport of VIEWPORTS) {
  test.describe(`at ${viewport.width}px`, () => {
    test.use({ viewport })

    test('page loads', async ({ page }, testInfo) => {
      const response = await page.goto('/')

      expect(response?.status()).toBe(200)
      await expect(page).toHaveTitle(content.site.title)
      await expect(page.locator('meta[name="description"]')).toHaveAttribute(
        'content',
        content.site.description,
      )

      const h1 = page.getByRole('heading', { level: 1 })
      await expect(h1).toHaveCount(1)
      await expect(h1).toContainText(content.hero.headline)
      await expect(h1).toContainText(content.hero.headlineAccent)
      await expect(page.getByRole('banner')).toBeVisible()
      await expect(page.getByRole('main')).toBeVisible()
      await expect(page.getByRole('contentinfo')).toBeVisible()

      for (const { id, heading } of SECTION_HEADINGS) {
        await expect(
          page
            .locator(`section#${id}`)
            .getByRole('heading', { level: 2, name: heading }),
        ).toBeVisible()
      }

      await expect(page.locator('#faq details')).toHaveCount(
        content.faq.items.length,
      )

      const targets = await page
        .locator('header a[href^="#"], main a[href^="#"], footer a[href^="#"]')
        .evaluateAll((links) =>
          links.map((link) => link.getAttribute('href') as string),
        )

      expect(targets.length).toBeGreaterThan(0)
      for (const target of new Set(targets)) {
        await expect(page.locator(target)).toHaveCount(1)
      }

      for (const region of COMP_REGIONS) {
        await test.step(`screenshot ${region.name}`, async () => {
          await testInfo.attach(`${region.name}-${viewport.width}`, {
            body: await page.locator(region.selector).screenshot(),
            contentType: 'image/png',
          })
        })
      }
    })
  })
}

for (const javaScriptEnabled of [true, false]) {
  test.describe(`with JavaScript ${javaScriptEnabled ? 'on' : 'off'}`, () => {
    test.use({ javaScriptEnabled })

    test('FAQ items open and close', async ({ page }) => {
      await page.goto('/')
      const [first] = content.faq.items
      const question = page.getByText(first.q, { exact: true })
      const answer = page.getByText(first.a, { exact: true })

      await expect(answer).toBeHidden()
      await question.click()
      await expect(answer).toBeVisible()
      await question.click()
      await expect(answer).toBeHidden()
    })

    test('hero links land on their sections', async ({ page }) => {
      await page.goto('/')

      await page
        .getByRole('main')
        .getByRole('link', { name: content.hero.secondaryCta })
        .click()
      await expect(page).toHaveURL(/#live$/)
      await expect(page.locator('#live')).toBeInViewport()

      await page
        .getByRole('main')
        .getByRole('link', { name: content.hero.primaryCta })
        .click()
      await expect(page).toHaveURL(/#waitlist$/)
      await expect(page.locator('#waitlist')).toBeInViewport()
    })
  })
}
