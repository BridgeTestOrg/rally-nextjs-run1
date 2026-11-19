import { content, fill } from '../lib/content'
import { expect, test } from './fixtures'

const { live } = content

test.use({ viewport: { width: 1280, height: 800 } })

test('only the failed city shows the unavailable message', async ({ page }) => {
  await page.goto('/#live')

  const section = page.locator('#live')
  const cards = section.getByRole('article')
  const message = fill(live.cityUnavailable, { city: 'Hoboken' })

  await expect(section.locator('[aria-busy="false"]')).toBeVisible()
  await expect(cards).toHaveCount(3)

  await expect(cards.nth(0).getByRole('definition')).toHaveText([
    '41°',
    '14 mph',
    '10%',
  ])
  await expect(cards.nth(1).getByRole('definition')).toHaveText([
    '66°',
    '8 mph',
    '0%',
  ])
  await expect(section.getByText(/^Conditions unavailable/)).toHaveCount(1)

  const hoboken = section.getByRole('article', { name: 'Hoboken, NJ' })

  await expect(hoboken.getByText('7:40 pm local time')).toBeVisible()
  await expect(hoboken.getByText(message)).toBeVisible()
  await expect(hoboken.getByText(live.cityUnavailableNote)).toBeVisible()
  await expect(hoboken.getByRole('definition')).toHaveCount(0)

  const heights = await cards.evaluateAll((elements) =>
    elements.map((element) => element.getBoundingClientRect().height),
  )

  expect(heights[2]).toBe(heights[0])
  expect(heights[2]).toBe(heights[1])
})
