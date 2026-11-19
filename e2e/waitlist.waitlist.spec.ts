import AxeBuilder from '@axe-core/playwright'
import type { Page, Route, TestInfo } from '@playwright/test'
import { content, fill } from '../lib/content'
import { immediateTransaction, openDb } from '../lib/db'
import { WAITLIST_E2E_DB_PATH } from '../playwright.config'
import { expect, test } from './fixtures'

const { waitlist } = content
const EMAIL = 'sam@example.com'
const CITY_LABEL = waitlist.cities['highlands-ranch']
const SUCCESS_TITLE = fill(waitlist.success.title, {
  place: 1,
  city: CITY_LABEL,
})

function section(page: Page) {
  return page.locator('#waitlist')
}

function emailInput(page: Page) {
  return section(page).getByLabel(waitlist.fields.email)
}

function submitButton(page: Page, name = waitlist.submit) {
  return section(page).getByRole('button', { name })
}

function waitlistRowCount() {
  const db = openDb(WAITLIST_E2E_DB_PATH)

  try {
    return db.prepare('SELECT COUNT(*) AS total FROM waitlist').get()?.total
  } finally {
    db.close()
  }
}

/** Opens the page and waits until React has taken over the form. */
async function openHydrated(page: Page) {
  await page.goto('/')
  await page.waitForFunction(() => {
    const form = document.querySelector('#waitlist form')

    return (
      form !== null &&
      Object.keys(form).some((key) => key.startsWith('__reactProps'))
    )
  })
}

async function fillForm(page: Page, email = EMAIL) {
  await emailInput(page).fill(email)
  await section(page)
    .getByLabel(waitlist.fields.city)
    .selectOption('highlands-ranch')
  await section(page).getByRole('radio', { name: waitlist.levels.mid }).check()
}

async function join(page: Page, email = EMAIL) {
  await fillForm(page, email)
  await submitButton(page).click()
}

/** Holds action posts until the returned function is called. */
async function holdActionPosts(page: Page) {
  const held: Route[] = []
  let release = false

  await page.route('/', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue()
    } else if (release) {
      await route.continue()
    } else {
      held.push(route)
    }
  })

  return {
    held,
    release: async () => {
      release = true
      await Promise.all(held.map((route) => route.continue()))
    },
  }
}

async function attachRegion(page: Page, testInfo: TestInfo, name: string) {
  await testInfo.attach(name, {
    body: await section(page).screenshot(),
    contentType: 'image/png',
  })
}

test.beforeEach(() => {
  const db = openDb(WAITLIST_E2E_DB_PATH)

  try {
    immediateTransaction(db, () => db.exec('DELETE FROM waitlist'))
  } finally {
    db.close()
  }
})

test.describe('with JavaScript', () => {
  test.beforeEach(async ({ page }) => {
    await openHydrated(page)
  })

  test('a bad email shows a linked error and keeps the input', async ({
    page,
  }) => {
    await join(page, 'sam@')

    const message = section(page).getByText(waitlist.errors.email)

    await expect(message).toBeVisible()
    await expect(emailInput(page)).toHaveValue('sam@')
    await expect(emailInput(page)).toHaveAttribute('aria-invalid', 'true')
    await expect(emailInput(page)).toHaveAttribute(
      'aria-describedby',
      (await message.getAttribute('id')) as string,
    )
    await expect(
      section(page).getByRole('radio', { name: waitlist.levels.mid }),
    ).toBeChecked()
    expect(waitlistRowCount()).toBe(0)

    const { violations } = await new AxeBuilder({ page })
      .include('#waitlist')
      .analyze()

    expect(violations).toEqual([])
  })

  test('success shows the city place and a courts link', async ({ page }) => {
    await join(page)

    await expect(
      section(page).getByRole('heading', { name: SUCCESS_TITLE }),
    ).toBeVisible()
    await expect(section(page).locator('form')).toHaveCount(0)
    await expect(
      section(page).getByRole('link', { name: waitlist.success.cta }),
    ).toHaveAttribute('href', '#courts')
    expect(waitlistRowCount()).toBe(1)
  })

  test('a second sign-up shows the original city and date', async ({ page }) => {
    await join(page)
    await expect(
      section(page).getByRole('heading', { name: SUCCESS_TITLE }),
    ).toBeVisible()

    await openHydrated(page)
    await emailInput(page).fill(` ${EMAIL.toUpperCase()} `)
    await section(page)
      .getByLabel(waitlist.fields.city)
      .selectOption('hoboken')
    await submitButton(page).click()

    await expect(
      section(page).getByRole('heading', { name: waitlist.duplicate.title }),
    ).toBeVisible()
    await expect(section(page)).toContainText(
      fill(waitlist.duplicate.body, {
        email: EMAIL.toUpperCase(),
        city: CITY_LABEL,
        date: '17 Nov',
      }),
    )
    expect(waitlistRowCount()).toBe(1)
  })

  test('a second press while joining sends nothing more', async ({ page }) => {
    const posts = await holdActionPosts(page)

    await join(page)

    const pendingButton = submitButton(page, waitlist.submitting)

    await expect(pendingButton).toBeDisabled()
    await expect(section(page).getByRole('status')).toHaveText(
      waitlist.submitting,
    )
    await expect(emailInput(page)).toHaveValue(EMAIL)

    await pendingButton.click({ force: true })
    await section(page)
      .locator('form')
      .evaluate((form: HTMLFormElement) => form.requestSubmit())

    expect(posts.held).toHaveLength(1)

    await posts.release()

    await expect(
      section(page).getByRole('heading', { name: SUCCESS_TITLE }),
    ).toBeVisible()
    expect(posts.held).toHaveLength(1)
    expect(waitlistRowCount()).toBe(1)
  })

  test('the pending spinner stops under reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })

    const posts = await holdActionPosts(page)

    await join(page)
    await expect(submitButton(page, waitlist.submitting)).toBeDisabled()

    await expect(
      section(page).locator('.rally-button__spinner'),
    ).toHaveCSS('animation-name', 'none')

    await posts.release()
    await expect(
      section(page).getByRole('heading', { name: SUCCESS_TITLE }),
    ).toBeVisible()
  })

  test('every control is at least 44px tall', async ({ page }) => {
    const controls = [
      emailInput(page),
      section(page).getByLabel(waitlist.fields.city),
      ...Object.values(waitlist.levels).map((name) =>
        section(page).getByRole('radio', { name }),
      ),
      submitButton(page),
    ]

    for (const control of controls) {
      const box = await control.boundingBox()

      expect(box?.height).toBeGreaterThanOrEqual(44)
    }
  })

  test('a keyboard user can pick a level and see focus', async ({ page }) => {
    const radio = section(page).getByRole('radio', {
      name: waitlist.levels.new,
    })

    await emailInput(page).focus()
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')
    await expect(radio).toBeFocused()
    await page.keyboard.press('ArrowRight')

    await expect(
      section(page).getByRole('radio', { name: waitlist.levels.mid }),
    ).toBeChecked()

    const outline = await section(page)
      .locator('input[name="level"]:checked + span')
      .evaluate((element) => {
        const style = getComputedStyle(element)

        return [style.outlineWidth, style.outlineStyle, style.outlineOffset]
      })

    expect(outline).toEqual(['3px', 'solid', '2px'])
  })
})

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  test('a valid post renders the success panel', async ({ page }) => {
    await page.goto('/')
    await join(page)

    await expect(
      section(page).getByRole('heading', { name: SUCCESS_TITLE }),
    ).toBeVisible()
    expect(waitlistRowCount()).toBe(1)
  })

  test('a bad email renders the error and keeps the input', async ({ page }) => {
    await page.goto('/')
    await join(page, 'sam@')

    await expect(section(page).getByText(waitlist.errors.email)).toBeVisible()
    await expect(emailInput(page)).toHaveValue('sam@')
    await expect(
      section(page).getByRole('radio', { name: waitlist.levels.mid }),
    ).toBeChecked()
    expect(waitlistRowCount()).toBe(0)
  })
})

for (const viewport of [
  { width: 1280, height: 800 },
  { width: 390, height: 844 },
]) {
  test.describe(`comp states at ${viewport.width}px`, () => {
    test.use({ viewport })

    test('captures each state for review', async ({ page }, testInfo) => {
      await openHydrated(page)
      await attachRegion(page, testInfo, `13-default-${viewport.width}`)

      await join(page, 'sam@example')
      await expect(section(page).getByText(waitlist.errors.email)).toBeVisible()
      await attachRegion(page, testInfo, `14-error-${viewport.width}`)

      const posts = await holdActionPosts(page)

      await emailInput(page).fill(EMAIL)
      await submitButton(page).click()
      await expect(submitButton(page, waitlist.submitting)).toBeDisabled()
      await attachRegion(page, testInfo, `15-joining-${viewport.width}`)

      await posts.release()
      await expect(
        section(page).getByRole('heading', { name: SUCCESS_TITLE }),
      ).toBeVisible()
      await attachRegion(page, testInfo, `17-success-${viewport.width}`)

      await openHydrated(page)
      await join(page)
      await expect(
        section(page).getByRole('heading', { name: waitlist.duplicate.title }),
      ).toBeVisible()
      await attachRegion(page, testInfo, `16-duplicate-${viewport.width}`)

      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true)
    })
  })
}
