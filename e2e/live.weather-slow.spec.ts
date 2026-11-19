import { content } from '../lib/content'
import { expect, test } from './fixtures'

const { live } = content

declare global {
  interface Window {
    __rallyLayoutShift: number
  }
}

test.use({ viewport: { width: 390, height: 844 } })

// The only test in this file: its one navigation is the only cold-cache load,
// and any later load would get cached weather and never show the skeleton.
test('streams the cards behind a stable skeleton', async ({ page }) => {
  await page.addInitScript(() => {
    window.__rallyLayoutShift = 0

    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as (PerformanceEntry & {
        hadRecentInput: boolean
        value: number
      })[]) {
        if (!entry.hadRecentInput) {
          window.__rallyLayoutShift += entry.value
        }
      }
    }).observe({ type: 'layout-shift', buffered: true })
  })

  await page.goto('/#live', { waitUntil: 'commit' })

  const section = page.locator('#live')
  const loading = section.locator('[aria-busy="true"]')
  const shimmer = loading.locator('.rally-live__shimmer').first()

  await expect(loading).toBeVisible()
  await expect(loading.getByText(live.stampLoading)).toBeVisible()
  await expect(
    page.locator('#faq').getByRole('heading', { name: content.faq.heading }),
  ).toBeVisible()
  await expect(
    page
      .locator('#waitlist')
      .getByRole('heading', { name: content.waitlist.heading }),
  ).toBeVisible()
  await expect(loading).toBeVisible()

  await expect(shimmer).toHaveCSS('animation-duration', '1.4s')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(shimmer).toHaveCSS('animation-name', 'none')

  await expect(section.locator('[aria-busy="false"]')).toBeVisible()

  const cards = section.getByRole('article')

  await expect(cards.getByRole('heading', { level: 3 })).toHaveText([
    'Highlands Ranch, CO',
    'Santa Monica, CA',
    'Hoboken, NJ',
  ])
  await expect(cards.nth(0).getByRole('definition')).toHaveText([
    '41°',
    '14 mph',
    '10%',
  ])
  await expect(cards.nth(0).getByText(live.verdicts.breezy)).toBeVisible()
  await expect(cards.nth(1).getByRole('definition')).toHaveText([
    '66°',
    '8 mph',
    '0%',
  ])
  await expect(cards.nth(1).getByText(live.verdicts.playable)).toBeVisible()
  await expect(cards.nth(2).getByRole('definition')).toHaveText([
    '47°',
    '9 mph',
    '70%',
  ])
  await expect(cards.nth(2).getByText(live.verdicts.notToday)).toBeVisible()
  await expect(section.getByText(live.stampJustNow)).toBeVisible()

  expect(
    await page.evaluate(() => window.__rallyLayoutShift),
  ).toBeLessThan(0.1)
})
