import type { Page } from '@playwright/test'
import { content } from '../lib/content'
import { expect, test } from './fixtures'

const { card } = content.hero

const VIEWPORTS = [
  { width: 1280, height: 800 },
  { width: 390, height: 844 },
]

const NEARBY_ZONES = [
  'America/Denver',
  'America/Los_Angeles',
  'America/New_York',
] as const

async function expectCard(
  page: Page,
  shown: { badge: string; name: string; line: string },
) {
  await expect(page.getByText(shown.badge, { exact: true })).toBeVisible()
  await expect(page.getByText(shown.name, { exact: true })).toBeVisible()
  await expect(page.getByText(shown.line, { exact: true })).toBeVisible()
}

for (const viewport of VIEWPORTS) {
  test.describe(`hero card at ${viewport.width}px`, () => {
    test.use({ viewport })

    for (const timezoneId of NEARBY_ZONES) {
      test.describe(timezoneId, () => {
        test.use({ timezoneId })

        test('shows the nearby city', async ({ page }) => {
          await page.goto('/')
          await expectCard(page, {
            badge: card.nearYouBadge,
            ...card.byTimeZone[timezoneId],
          })
          await expect(
            page.getByText(card.default.name, { exact: true }),
          ).toHaveCount(0)
        })
      })
    }

    for (const timezoneId of ['Europe/London', 'Asia/Tokyo']) {
      test.describe(timezoneId, () => {
        test.use({ timezoneId })

        test('keeps the default card', async ({ page }) => {
          await page.goto('/')
          await expectCard(page, card.default)
          await expect(
            page.getByText(card.nearYouBadge, { exact: true }),
          ).toHaveCount(0)
        })
      })
    }

    test.describe('with JavaScript off', () => {
      test.use({ javaScriptEnabled: false, timezoneId: 'America/Denver' })

      test('shows the default card', async ({ page }) => {
        await page.goto('/')
        await expectCard(page, card.default)
      })
    })
  })
}
