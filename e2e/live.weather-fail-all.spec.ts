import { content } from '../lib/content'
import { expect, test } from './fixtures'

const { live } = content

for (const viewport of [
  { width: 1280, height: 800 },
  { width: 390, height: 844 },
]) {
  test(`shows one notice at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await page.goto('/#live')

    const section = page.locator('#live')
    const title = section.getByRole('heading', {
      name: live.allUnavailableTitle,
    })
    const notice = section.locator('.rally-live__notice')

    await expect(section.locator('[aria-busy="false"]')).toBeVisible()
    await expect(notice).toHaveCount(1)
    await expect(title).toBeVisible()
    await expect(title).toHaveCSS('font-weight', '700')
    await expect(notice.getByText(live.allUnavailableBody)).toBeVisible()
    await expect(section.getByRole('article')).toHaveCount(0)
    await expect(
      section.getByText('National Weather Service · last checked 0 min ago'),
    ).toBeVisible()

    const icon = notice.locator('img')

    await expect(icon).toHaveAttribute('alt', '')
    await expect(icon).toHaveJSProperty('naturalWidth', 28)
    expect(await icon.boundingBox()).toMatchObject({ width: 28, height: 28 })

    const box = await notice.boundingBox()

    expect(box?.height).toBeLessThan(230)
  })
}

test('the rest of the page still renders', async ({ page }) => {
  await page.goto('/')

  await expect(
    page.locator('#live').getByRole('heading', {
      name: live.allUnavailableTitle,
    }),
  ).toBeVisible()

  for (const [id, heading] of [
    ['courts', content.finder.heading],
    ['waitlist', content.waitlist.heading],
    ['faq', content.faq.heading],
  ]) {
    await expect(
      page.locator(`#${id}`).getByRole('heading', { name: heading }),
    ).toBeVisible()
  }
})
