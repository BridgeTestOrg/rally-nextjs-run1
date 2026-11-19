import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { content } from '../lib/content'
import { expect, test } from './fixtures'

const INTERACTIVE = 'a[href], button, summary, input, select, textarea'

/** Tabs from the top of the page until focus leaves it or returns to a stop. */
async function tabThroughPage(page: Page) {
  const stops: {
    index: number
    label: string
    outline: string
    outlineOffset: string
    height: number
  }[] = []

  for (let presses = 0; presses < 200; presses += 1) {
    await page.keyboard.press('Tab')

    const stop = await page.evaluate(() => {
      const element = document.activeElement

      if (!element || element === document.body) {
        return null
      }

      const style = getComputedStyle(element)

      return {
        index: Array.from(document.querySelectorAll('*')).indexOf(element),
        label: element.textContent?.trim() ?? '',
        outline: `${style.outlineWidth} ${style.outlineStyle} ${style.outlineColor}`,
        outlineOffset: style.outlineOffset,
        height: element.getBoundingClientRect().height,
      }
    })

    if (!stop || stops.some(({ index }) => index === stop.index)) {
      break
    }

    stops.push(stop)
  }

  return stops
}

for (const viewport of [
  { width: 1280, height: 800 },
  { width: 390, height: 844 },
]) {
  test.describe(`at ${viewport.width}px`, () => {
    test.use({ viewport })

    test('has no axe violations', async ({ page }) => {
      await page.goto('/')

      const { violations } = await new AxeBuilder({ page }).analyze()

      expect(violations).toEqual([])
    })
  })
}

test.describe('keyboard at 1280px', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('reaches every control with a visible focus ring', async ({ page }) => {
    await page.goto('/')

    const stops = await tabThroughPage(page)
    const expected = await page.evaluate((selector) => {
      const all = Array.from(document.querySelectorAll('*'))

      // Tab enters a radio group once, at its checked option.
      const isTabStop = (element: Element) =>
        !(
          element instanceof HTMLInputElement &&
          element.type === 'radio' &&
          !element.checked
        )

      return Array.from(document.querySelectorAll(selector))
        .filter((element) => element.checkVisibility() && isTabStop(element))
        .map((element) => all.indexOf(element))
    }, INTERACTIVE)

    expect(stops.map(({ index }) => index).sort((a, b) => a - b)).toEqual(
      expected.sort((a, b) => a - b),
    )

    for (const stop of stops) {
      expect(stop.outline, stop.label).toBe('3px solid rgb(37, 99, 235)')
      expect(stop.outlineOffset, stop.label).toBe('2px')
      expect(stop.height, stop.label).toBeGreaterThanOrEqual(44)
    }
  })
})

test.describe('keyboard at 390px', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('skips the hidden nav links and keeps the CTA', async ({ page }) => {
    await page.goto('/')

    const nav = page.getByRole('navigation', { name: content.header.navLabel })

    await expect(
      nav.getByRole('link', { name: content.header.cta }),
    ).toBeVisible()

    for (const item of content.header.nav) {
      await expect(nav.getByText(item.label, { exact: true })).toBeHidden()
    }

    const labels = (await tabThroughPage(page)).map(({ label }) => label)

    expect(labels[0]).toBe(content.header.cta)
    expect(labels).not.toContain(content.header.nav[0].label)
    expect(labels).not.toContain(content.header.nav[1].label)
  })
})

// The page does not render these states yet, so the shared classes are mounted
// on the real page to check the shipped stylesheet.
test.describe('shared component styles', () => {
  test('the button spinner stops under reduced motion', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => {
      const spinner = document.createElement('span')
      spinner.id = 'spinner-under-test'
      spinner.className = 'rally-button__spinner'
      document.body.append(spinner)
    })

    const spinner = page.locator('#spinner-under-test')

    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await expect(spinner).toHaveCSS('animation-name', 'rally-spin')
    await expect(spinner).toHaveCSS('animation-duration', '0.8s')

    await page.emulateMedia({ reducedMotion: 'reduce' })
    await expect(spinner).toHaveCSS('animation-name', 'none')
  })

  for (const [modifier, background, color] of [
    ['green', 'rgb(220, 245, 208)', 'rgb(27, 94, 32)'],
    ['amber', 'rgb(255, 233, 184)', 'rgb(122, 75, 0)'],
    ['grey', 'rgb(230, 233, 238)', 'rgb(59, 66, 80)'],
  ]) {
    test(`the ${modifier} badge uses its style-guide colors`, async ({
      page,
    }) => {
      await page.goto('/')
      await page.evaluate((name) => {
        const badge = document.createElement('span')
        badge.id = 'badge-under-test'
        badge.className = `rally-badge rally-badge--${name}`
        document.body.append(badge)
      }, modifier)

      const badge = page.locator('#badge-under-test')

      await expect(badge).toHaveCSS('background-color', background)
      await expect(badge).toHaveCSS('color', color)
    })
  }
})
