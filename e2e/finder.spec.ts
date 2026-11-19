import type { Locator, Page } from '@playwright/test'
import { content } from '../lib/content'
import { expect, test } from './fixtures'

const { finder } = content

type ExpectedRow = {
  name: string
  meta: string
  status: string
  badge: string
  chips: string[]
}

const NORTHRIDGE_META = 'Highlands Ranch, CO · 4 courts · lights · free parking'
const REDSTONE_META = 'Highlands Ranch, CO · 6 courts · free parking'
const OCEAN_META = 'Santa Monica, CA · 2 courts · lights'
const MEMORIAL_META = 'Santa Monica, CA · 6 courts · lights · free parking'
const PIER_META = 'Hoboken, NJ · 3 courts · lights'
const CHURCH_META = 'Hoboken, NJ · 2 courts'

const LATE_HOURS = 'Open 7 am to 10 pm'
const EARLY_HOURS = 'Open 7 am to 7 pm'

const TODAY_ROWS: ExpectedRow[] = [
  {
    name: 'Northridge Park',
    meta: NORTHRIDGE_META,
    status: 'Open until 10 pm',
    badge: '2 open',
    chips: ['6:00 pm', '8:30 pm'],
  },
  {
    name: 'Ocean Park',
    meta: OCEAN_META,
    status: 'Open until 10 pm',
    badge: '2 open',
    chips: ['5:00 pm', '7:30 pm'],
  },
  {
    name: 'Memorial Park',
    meta: MEMORIAL_META,
    status: 'Open until 10 pm',
    badge: '1 open',
    chips: ['6:00 pm'],
  },
  {
    name: 'Pier A Park',
    meta: PIER_META,
    status: 'Open until 10 pm',
    badge: '1 open',
    chips: ['8:30 pm'],
  },
  {
    name: 'Church Square Park',
    meta: CHURCH_META,
    status: 'Closed now · opens 7 am',
    badge: 'Closed',
    chips: [],
  },
]

const CO_TOMORROW_ROWS: ExpectedRow[] = [
  {
    name: 'Northridge Park',
    meta: NORTHRIDGE_META,
    status: LATE_HOURS,
    badge: '2 open',
    chips: ['7:30 am', '5:00 pm'],
  },
  {
    name: 'Redstone Park',
    meta: REDSTONE_META,
    status: EARLY_HOURS,
    badge: '3 open',
    chips: ['8:00 am', '10:30 am', '3:00 pm'],
  },
]

const SATURDAY_ROWS: ExpectedRow[] = [
  {
    name: 'Northridge Park',
    meta: NORTHRIDGE_META,
    status: LATE_HOURS,
    badge: '2 open',
    chips: ['9:00 am', '2:00 pm'],
  },
  {
    name: 'Redstone Park',
    meta: REDSTONE_META,
    status: EARLY_HOURS,
    badge: '2 open',
    chips: ['8:00 am', '11:00 am'],
  },
  {
    name: 'Ocean Park',
    meta: OCEAN_META,
    status: LATE_HOURS,
    badge: '2 open',
    chips: ['10:00 am', '4:00 pm'],
  },
  {
    name: 'Memorial Park',
    meta: MEMORIAL_META,
    status: 'Closed Saturday for resurfacing',
    badge: 'Closed',
    chips: [],
  },
  {
    name: 'Pier A Park',
    meta: PIER_META,
    status: LATE_HOURS,
    badge: '3 open',
    chips: ['9:30 am', '1:00 pm', '5:00 pm'],
  },
  {
    name: 'Church Square Park',
    meta: CHURCH_META,
    status: EARLY_HOURS,
    badge: '1 open',
    chips: ['10:00 am'],
  },
]

const EMPTY_URL = '/?state=NJ&day=today&time=am&lights=1&parking=1'

// Not #courts: without JavaScript the streamed body stays at the end of <body>.
function section(page: Page): Locator {
  return page.locator('[data-finder-body]')
}

function form(page: Page): Locator {
  return section(page).getByRole('form', { name: finder.formLabel })
}

function cards(page: Page): Locator {
  return section(page).locator('ul > li:has(h3):visible')
}

function summary(page: Page): Locator {
  return section(page).locator('[aria-live="polite"]')
}

function radio(page: Page, group: string, name: string): Locator {
  return form(page)
    .getByRole('group', { name: group })
    .getByRole('radio', { name, exact: true })
}

function checkbox(page: Page, name: string): Locator {
  return form(page).getByRole('checkbox', { name })
}

function clearLinks(page: Page): Locator {
  return section(page).getByRole('link', { name: finder.clear })
}

async function expectRows(page: Page, rows: ExpectedRow[]) {
  await expect(cards(page).locator('h3')).toHaveText(
    rows.map(({ name }) => name),
  )

  for (const [index, row] of rows.entries()) {
    const card = cards(page).nth(index)

    await expect(card.getByText(row.meta, { exact: true })).toBeVisible()
    await expect(card.getByText(row.status, { exact: true })).toBeVisible()
    await expect(card.locator('.rally-badge')).toHaveText(row.badge)
    await expect(card.locator('time')).toHaveText(row.chips)
  }
}

async function expectDefaultControls(page: Page) {
  await expect(radio(page, finder.groups.state, finder.states.all)).toBeChecked()
  await expect(radio(page, finder.groups.day, finder.days.today)).toBeChecked()
  await expect(radio(page, finder.groups.time, finder.times.any)).toBeChecked()
  await expect(checkbox(page, finder.lights)).not.toBeChecked()
  await expect(checkbox(page, finder.parking)).not.toBeChecked()
}

async function rowText(page: Page): Promise<string[]> {
  return cards(page).allInnerTexts()
}

function activeControl(page: Page) {
  return page.evaluate(() => {
    const active = document.activeElement as HTMLInputElement

    return { name: active.name, value: active.value }
  })
}

test('finder from a URL', async ({ page }) => {
  await page.goto('/?state=CO&day=tomorrow')

  await expect(summary(page)).toContainText('2 courts open tomorrow')
  await expect(summary(page)).toContainText(finder.localNote)
  await expectRows(page, CO_TOMORROW_ROWS)
  await expect(radio(page, finder.groups.state, finder.states.CO)).toBeChecked()
  await expect(
    radio(page, finder.groups.day, finder.days.tomorrow),
  ).toBeChecked()
  await expect(radio(page, finder.groups.time, finder.times.any)).toBeChecked()
})

test('shows the default results', async ({ page }) => {
  await page.goto('/')

  await expect(summary(page)).toContainText('4 courts open today')
  await expectRows(page, TODAY_ROWS)
  await expect(section(page).getByText('Redstone Park')).toHaveCount(0)
  await expect(clearLinks(page)).toHaveCount(1)
  await expect(clearLinks(page)).toHaveAttribute('href', '/#courts')
  await expectDefaultControls(page)
})

test('keeps a closed court listed with its reason', async ({ page }) => {
  await page.goto('/?day=sat')

  await expect(summary(page)).toContainText('5 courts open on Saturday')
  await expectRows(page, SATURDAY_ROWS)
  await expect(radio(page, finder.groups.day, finder.days.sat)).toBeChecked()
})

test('falls back to defaults for invalid values', async ({ page }) => {
  await page.goto('/?state=TX&day=friday&time=noon&lights=yes&parking=0')

  await expect(summary(page)).toContainText('4 courts open today')
  await expectRows(page, TODAY_ROWS)
  await expectDefaultControls(page)
})

test.describe('with no matching courts', () => {
  test('shows the empty state and its controls', async ({ page }) => {
    await page.goto(EMPTY_URL)

    await expect(radio(page, finder.groups.state, finder.states.NJ)).toBeChecked()
    await expect(radio(page, finder.groups.day, finder.days.today)).toBeChecked()
    await expect(radio(page, finder.groups.time, finder.times.am)).toBeChecked()
    await expect(checkbox(page, finder.lights)).toBeChecked()
    await expect(checkbox(page, finder.parking)).toBeChecked()
    await expect(summary(page)).toContainText('No courts open today')
    await expect(summary(page)).toContainText(finder.localNote)
    await expect(section(page).getByText(finder.emptyTitle)).toBeVisible()
    await expect(section(page).getByText(finder.emptyBody)).toBeVisible()
    await expect(cards(page)).toHaveCount(0)
    await expect(clearLinks(page)).toHaveCount(2)
    await expect(clearLinks(page).nth(1)).toHaveCSS(
      'background-color',
      'rgb(20, 83, 45)',
    )
  })

  for (const [label, index] of [
    ['text link', 0],
    ['button', 1],
  ] as const) {
    test(`the ${label} clears the filters`, async ({ page }) => {
      await page.goto(EMPTY_URL)
      await expect(clearLinks(page)).toHaveCount(2)

      await clearLinks(page).nth(index).click()

      await expect(page).toHaveURL(/\/#courts$/)
      await expect(summary(page)).toContainText('4 courts open today')
      await expectRows(page, TODAY_ROWS)
      await expectDefaultControls(page)
    })
  }
})

test.describe('changing a filter', () => {
  test('a click updates the URL and rows in place', async ({ page }) => {
    await page.goto('/')
    await expect(cards(page)).toHaveCount(5)
    await section(page).scrollIntoViewIfNeeded()
    await form(page).evaluate((element) => element.scrollIntoView())
    await page.evaluate(() => {
      Object.assign(window, { finderMarker: 'kept' })
      document
        .querySelector('#courts [aria-live="polite"]')
        ?.setAttribute('data-marker', 'kept')
    })

    const historyLength = await page.evaluate(() => history.length)
    const scrollY = await page.evaluate(() => window.scrollY)

    expect(scrollY).toBeGreaterThan(0)

    await radio(page, finder.groups.state, finder.states.CA).click()

    await expect(page).toHaveURL('/?state=CA&day=today&time=any')
    await expect(cards(page).locator('h3')).toHaveText([
      'Ocean Park',
      'Memorial Park',
    ])
    await expect(summary(page)).toContainText('2 courts open today')
    await expect(summary(page)).toHaveAttribute('data-marker', 'kept')
    expect(await page.evaluate(() => 'finderMarker' in window)).toBe(true)
    expect(await page.evaluate(() => history.length)).toBe(historyLength)
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0)
    expect(await activeControl(page)).toEqual({ name: 'state', value: 'CA' })
  })

  test('the keyboard updates the URL and keeps focus', async ({ page }) => {
    await page.goto('/')
    await expect(cards(page)).toHaveCount(5)

    await radio(page, finder.groups.day, finder.days.today).focus()
    await page.keyboard.press('ArrowRight')

    await expect(page).toHaveURL('/?state=all&day=tomorrow&time=any')
    await expect(summary(page)).toContainText('open tomorrow')
    await expect(
      radio(page, finder.groups.day, finder.days.tomorrow),
    ).toBeFocused()
    expect(await activeControl(page)).toEqual({
      name: 'day',
      value: 'tomorrow',
    })
  })

  test('time and must-have filters serialize to the URL', async ({ page }) => {
    await page.goto('/?day=sat')
    await expect(cards(page)).toHaveCount(6)

    await radio(page, finder.groups.time, finder.times.am).click()
    await expect(page).toHaveURL('/?state=all&day=sat&time=am')

    await checkbox(page, finder.lights).click()
    await expect(page).toHaveURL('/?state=all&day=sat&time=am&lights=1')
    await expect(checkbox(page, finder.lights)).toBeFocused()

    await checkbox(page, finder.parking).press('Space')
    await expect(page).toHaveURL(
      '/?state=all&day=sat&time=am&lights=1&parking=1',
    )
    await expect(checkbox(page, finder.parking)).toBeFocused()
    await expect(cards(page).locator('h3')).toHaveText([
      'Northridge Park',
      'Memorial Park',
    ])

    await checkbox(page, finder.lights).click()
    await expect(page).toHaveURL('/?state=all&day=sat&time=am&parking=1')
  })

  test('rapid toggles end on rows that match the URL', async ({
    page,
    browser,
    baseURL,
  }) => {
    await page.goto('/')
    await expect(cards(page)).toHaveCount(5)

    await radio(page, finder.groups.state, finder.states.CO).click()
    await radio(page, finder.groups.state, finder.states.CA).click()
    await radio(page, finder.groups.state, finder.states.NJ).click()
    await radio(page, finder.groups.day, finder.days.sat).click()

    const finalUrl = '/?state=NJ&day=sat&time=any'

    await expect(page).toHaveURL(finalUrl)
    await expect(cards(page).locator('h3')).toHaveText([
      'Pier A Park',
      'Church Square Park',
    ])
    await expect(radio(page, finder.groups.state, finder.states.NJ)).toBeChecked()
    await expect(radio(page, finder.groups.day, finder.days.sat)).toBeChecked()

    const context = await browser.newContext({ baseURL })
    const fresh = await context.newPage()

    await fresh.goto(finalUrl)
    await expect(cards(fresh)).toHaveCount(2)
    expect(await rowText(page)).toEqual(await rowText(fresh))
    await context.close()
  })
})

test.describe('history', () => {
  test('Back and Forward restore rows and controls', async ({ page }) => {
    await page.goto('/?day=sat')
    await expect(cards(page)).toHaveCount(6)
    await page.goto('/?state=CO')
    await expect(cards(page).locator('h3')).toHaveText(['Northridge Park'])

    await page.goBack()
    await expect(page).toHaveURL('/?day=sat')
    await expectRows(page, SATURDAY_ROWS)
    await expect(radio(page, finder.groups.day, finder.days.sat)).toBeChecked()
    await expect(radio(page, finder.groups.state, finder.states.all)).toBeChecked()

    await page.goForward()
    await expect(page).toHaveURL('/?state=CO')
    await expect(cards(page).locator('h3')).toHaveText(['Northridge Park'])
    await expect(radio(page, finder.groups.state, finder.states.CO)).toBeChecked()
    await expect(radio(page, finder.groups.day, finder.days.today)).toBeChecked()
  })

  test('controls follow a client-side Back', async ({ page }) => {
    await page.goto('/?state=CO&day=tomorrow')
    await expect(cards(page)).toHaveCount(2)
    await page.evaluate(() => Object.assign(window, { finderMarker: 'kept' }))

    await clearLinks(page).click()
    await expect(page).toHaveURL(/\/#courts$/)
    await expectDefaultControls(page)

    await page.goBack()
    await expect(page).toHaveURL('/?state=CO&day=tomorrow')
    await expectRows(page, CO_TOMORROW_ROWS)
    await expect(radio(page, finder.groups.state, finder.states.CO)).toBeChecked()
    await expect(
      radio(page, finder.groups.day, finder.days.tomorrow),
    ).toBeChecked()
    expect(await page.evaluate(() => 'finderMarker' in window)).toBe(true)
  })
})

test('a reload and a new context show the same rows', async ({
  page,
  browser,
  baseURL,
}) => {
  await page.goto('/?state=CO&day=tomorrow')
  await expectRows(page, CO_TOMORROW_ROWS)

  const rows = await rowText(page)

  await page.reload()
  await expectRows(page, CO_TOMORROW_ROWS)
  expect(await rowText(page)).toEqual(rows)

  const context = await browser.newContext({ baseURL })
  const fresh = await context.newPage()

  await fresh.goto('/?state=CO&day=tomorrow')
  await expectRows(fresh, CO_TOMORROW_ROWS)
  expect(await rowText(fresh)).toEqual(rows)
  await context.close()
})

test.describe('with JavaScript off', () => {
  test.use({ javaScriptEnabled: false })

  for (const [url, rows] of [
    ['/', TODAY_ROWS],
    ['/?day=sat', SATURDAY_ROWS],
    ['/?state=CO&day=tomorrow', CO_TOMORROW_ROWS],
  ] as const) {
    test(`${url} renders the same rows`, async ({ page }) => {
      await page.goto(url)

      await expect(form(page)).toBeVisible()
      await expectRows(page, [...rows])
    })
  }

  test('the finder stays between its heading and the next section', async ({
    page,
  }) => {
    await page.goto('/')

    const courts = page.locator('#courts')
    const heading = await courts
      .getByRole('heading', { level: 2 })
      .boundingBox()
    const panel = await form(page).boundingBox()
    const next = await page.locator('#how').boundingBox()

    expect(panel!.y).toBeGreaterThan(heading!.y + heading!.height)
    expect(next!.y).toBeGreaterThan(panel!.y + panel!.height)
    await expect(courts.locator('[aria-busy="true"]')).toBeHidden()
  })

  test('the submit button applies the chosen filters', async ({ page }) => {
    await page.goto('/')

    const submit = form(page).getByRole('button', {
      name: finder.submitNoScript,
    })

    await expect(submit).toBeVisible()
    await radio(page, finder.groups.state, finder.states.CO).check()
    await radio(page, finder.groups.day, finder.days.tomorrow).check()
    await submit.click()

    await expect(page).toHaveURL('/?state=CO&day=tomorrow&time=any')
    await expectRows(page, CO_TOMORROW_ROWS)
    await expect(radio(page, finder.groups.state, finder.states.CO)).toBeChecked()
  })
})

test.describe('accessibility', () => {
  test('announces results politely', async ({ page }) => {
    await page.goto('/')

    await expect(summary(page)).toHaveCount(1)
    await expect(summary(page)).toHaveAttribute('aria-atomic', 'true')
    await expect(summary(page)).toContainText('4 courts open today')
  })

  test('names every control inside a labelled group', async ({ page }) => {
    await page.goto('/')
    await expect(form(page)).toBeVisible()

    const groups = [
      [finder.groups.state, 'radio', Object.values(finder.states)],
      [finder.groups.day, 'radio', Object.values(finder.days)],
      [finder.groups.time, 'radio', Object.values(finder.times)],
      [finder.groups.mustHave, 'checkbox', [finder.lights, finder.parking]],
    ] as const

    for (const [legend, role, names] of groups) {
      const group = form(page).getByRole('group', { name: legend })

      await expect(group.getByRole(role)).toHaveCount(names.length)

      for (const name of names) {
        await expect(group.getByRole(role, { name, exact: true })).toHaveCount(1)
      }
    }
  })

  test('every option is at least 44px tall', async ({ page }) => {
    await page.goto('/')
    await expect(form(page)).toBeVisible()

    const heights = await form(page)
      .locator('label')
      .evaluateAll((labels) =>
        labels.map((label) => label.getBoundingClientRect().height),
      )

    expect(heights).toHaveLength(13)

    for (const height of heights) {
      expect(height).toBeGreaterThanOrEqual(44)
    }
  })

  for (const [kind, focus] of [
    [
      'radio',
      (page: Page) => radio(page, finder.groups.state, finder.states.all),
    ],
    ['checkbox', (page: Page) => checkbox(page, finder.lights)],
  ] as const) {
    test(`a focused ${kind} shows the focus ring`, async ({ page }) => {
      await page.goto('/')
      await expect(form(page)).toBeVisible()

      const input = focus(page)

      await input.focus()
      await page.keyboard.press('Shift+Tab')
      await page.keyboard.press('Tab')
      await expect(input).toBeFocused()

      const visible = input.locator('+ span')

      await expect(visible).toHaveCSS('outline-style', 'solid')
      await expect(visible).toHaveCSS('outline-width', '3px')
      await expect(visible).toHaveCSS('outline-color', 'rgb(37, 99, 235)')
      await expect(visible).toHaveCSS('outline-offset', '2px')
    })
  }
})
