import type { Locator, Page } from '@playwright/test'
import { content } from '../lib/content'
import { expect, test } from './fixtures'

const { live } = content

const CITIES = [
  {
    name: 'Highlands Ranch, CO',
    localTime: '5:40 pm local time',
    verdict: live.verdicts.breezy,
    stats: ['41°', '14 mph', '10%'],
    nextOpen: 'Next open: Northridge Park, 6:00 pm',
  },
  {
    name: 'Santa Monica, CA',
    localTime: '4:40 pm local time',
    verdict: live.verdicts.playable,
    stats: ['66°', '8 mph', '0%'],
    nextOpen: 'Next open: Ocean Park, 5:00 pm',
  },
  {
    name: 'Hoboken, NJ',
    localTime: '7:40 pm local time',
    verdict: live.verdicts.notToday,
    stats: ['47°', '9 mph', '70%'],
    nextOpen: 'Next open: Pier A Park, 8:30 pm',
  },
]

function cards(page: Page) {
  return page.locator('#live').getByRole('article')
}

async function boxes(locator: Locator) {
  await expect(locator).toHaveCount(CITIES.length)

  return Promise.all(
    CITIES.map(async (_, index) => {
      const box = await locator.nth(index).boundingBox()

      expect(box).not.toBeNull()

      return box as NonNullable<typeof box>
    }),
  )
}

for (const viewport of [
  { width: 1280, height: 800 },
  { width: 390, height: 844 },
]) {
  test(`shows each city's conditions at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport)
    await page.goto('/#live')

    const section = page.locator('#live')

    await expect(section.locator('[aria-busy="false"]')).toBeVisible()
    await expect(section.locator('[aria-busy="true"]')).toHaveCount(0)
    await expect(section.getByText(live.stampJustNow)).toBeVisible()
    await expect(cards(page)).toHaveCount(CITIES.length)

    for (const [index, city] of CITIES.entries()) {
      const card = cards(page).nth(index)

      await expect(card.getByRole('heading', { level: 3 })).toHaveText(
        city.name,
      )
      await expect(card.getByText(city.localTime)).toBeVisible()
      await expect(card.getByText(city.verdict, { exact: true })).toBeVisible()
      await expect(card.getByRole('definition')).toHaveText(city.stats)
      await expect(card.getByRole('term')).toHaveText([
        live.labels.temp,
        live.labels.wind,
        live.labels.rain,
      ])
      await expect(card.getByText(city.nextOpen)).toBeVisible()
    }
  })
}

test('cards sit side by side above 1024px', async ({ page }) => {
  await page.setViewportSize({ width: 1025, height: 800 })
  await page.goto('/#live')

  const [first, second, third] = await boxes(cards(page))

  expect(second.y).toBe(first.y)
  expect(third.y).toBe(first.y)
  expect(second.x).toBeGreaterThan(first.x + first.width - 1)
  expect(third.x).toBeGreaterThan(second.x + second.width - 1)
})

test('cards stack at 1024px', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 800 })
  await page.goto('/#live')

  const [first, second, third] = await boxes(cards(page))

  expect(second.x).toBe(first.x)
  expect(third.x).toBe(first.x)
  expect(second.y).toBeGreaterThanOrEqual(first.y + first.height)
  expect(third.y).toBeGreaterThanOrEqual(second.y + second.height)
})
