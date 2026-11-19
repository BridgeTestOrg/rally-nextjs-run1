import type { ComponentProps, Ref } from 'react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { CourtRow } from '../app/_sections/finder/CourtRow'
import { FilterForm } from '../app/_sections/finder/FilterForm'
import { FinderSkeleton } from '../app/_sections/finder/FinderSkeleton'
import { Results } from '../app/_sections/finder/Results'
import { content } from '../lib/content'
import type { CourtRow as CourtRowData } from '../lib/courts'
import type { Filters } from '../lib/filters'

type MockFormProps = ComponentProps<'form'> & {
  ref?: Ref<HTMLFormElement>
  replace?: boolean
  scroll?: boolean
}

vi.mock('next/form', () => ({
  default: ({ replace, scroll, ...props }: MockFormProps) => (
    <form
      {...props}
      data-replace={String(replace)}
      data-scroll={String(scroll)}
    />
  ),
}))

const { finder } = content

const DEFAULT_FILTERS: Filters = {
  state: 'all',
  day: 'today',
  time: 'any',
  lights: false,
  parking: false,
}

function courtRow(overrides: Partial<CourtRowData> = {}): CourtRowData {
  return {
    id: 'test-park',
    name: 'Test Park',
    city: 'Santa Monica',
    state: 'CA',
    timeZone: 'America/Los_Angeles',
    courts: 2,
    lights: false,
    parking: false,
    closed: false,
    statusText: 'Open until 7 pm',
    closedReason: null,
    slots: [
      { hhmm: '09:30', at: '2026-11-18T09:30:00-08:00' },
      { hhmm: '18:00', at: '2026-11-18T18:00:00-08:00' },
    ],
    ...overrides,
  }
}

function closedRow(overrides: Partial<CourtRowData> = {}): CourtRowData {
  return courtRow({
    id: 'closed-park',
    name: 'Closed Park',
    closed: true,
    statusText: 'Closed Saturday for resurfacing',
    closedReason: 'resurfacing',
    slots: [],
    ...overrides,
  })
}

function liveRegion(container: HTMLElement): HTMLElement {
  const region = container.querySelector<HTMLElement>('[aria-live="polite"]')

  expect(region).not.toBeNull()

  return region as HTMLElement
}

function clearHrefs(): (string | null)[] {
  return screen
    .getAllByRole('link', { name: finder.clear })
    .map((link) => link.getAttribute('href'))
}

function radio(group: string, name: string): HTMLInputElement {
  return within(screen.getByRole('group', { name: group })).getByRole('radio', {
    name,
  }) as HTMLInputElement
}

function checkbox(name: string): HTMLInputElement {
  return screen.getByRole('checkbox', { name }) as HTMLInputElement
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Results', () => {
  test('uses the singular count line for one open court', () => {
    const { container } = render(
      <Results rows={[courtRow()]} count={1} day="tomorrow" />,
    )

    expect(liveRegion(container).textContent).toContain('1 court open tomorrow')
  })

  test('uses the plural count line and keeps the returned order', () => {
    const rows = [
      courtRow({ id: 'z', name: 'Zebra Park' }),
      courtRow({ id: 'a', name: 'Aspen Park' }),
      closedRow({ id: 'm', name: 'Maple Park' }),
    ]
    const { container } = render(<Results rows={rows} count={2} day="today" />)

    expect(liveRegion(container).textContent).toContain('2 courts open today')
    expect(
      screen
        .getAllByRole('heading', { level: 3 })
        .map((heading) => heading.textContent),
    ).toEqual(['Zebra Park', 'Aspen Park', 'Maple Park'])
    expect(container.querySelectorAll('ul > li:has(h3)')).toHaveLength(3)
  })

  test('shows closed rows, not the empty state, when none are open', () => {
    const { container } = render(
      <Results rows={[closedRow()]} count={0} day="sat" />,
    )

    expect(liveRegion(container).textContent).toContain(
      'No courts open on Saturday',
    )
    expect(screen.getByText('Closed Park')).toBeDefined()
    expect(screen.queryByText(finder.emptyTitle)).toBeNull()
    expect(clearHrefs()).toEqual(['/#courts'])
  })

  test('shows the empty state and both clear links when no rows return', () => {
    const { container } = render(<Results rows={[]} count={0} day="today" />)

    expect(liveRegion(container).textContent).toContain('No courts open today')
    expect(liveRegion(container).textContent).toContain(finder.localNote)
    expect(screen.getByText(finder.emptyTitle)).toBeDefined()
    expect(screen.getByText(finder.emptyBody)).toBeDefined()
    expect(container.querySelector('ul')).toBeNull()
    expect(clearHrefs()).toEqual(['/#courts', '/#courts'])
    expect(
      screen.getAllByRole('link', { name: finder.clear })[1].className,
    ).toContain('rally-button--court')
  })

  test('announces the summary atomically and leaves the link out', () => {
    const { container } = render(
      <Results rows={[courtRow()]} count={1} day="today" />,
    )
    const region = liveRegion(container)

    expect(region.getAttribute('aria-atomic')).toBe('true')
    expect(region.textContent).toContain(finder.localNote)
    expect(region.textContent).not.toContain(finder.clear)
    expect(clearHrefs()).toEqual(['/#courts'])
  })

  test('keeps the same live region when the results change', () => {
    const { container, rerender } = render(
      <Results rows={[courtRow()]} count={1} day="today" />,
    )
    const region = liveRegion(container)

    rerender(<Results rows={[]} count={0} day="sat" />)

    expect(liveRegion(container)).toBe(region)
    expect(region.textContent).toContain('No courts open on Saturday')
  })
})

describe('CourtRow', () => {
  test.each([
    [false, false, 'Santa Monica, CA · 2 courts'],
    [true, false, 'Santa Monica, CA · 2 courts · lights'],
    [false, true, 'Santa Monica, CA · 2 courts · free parking'],
    [true, true, 'Santa Monica, CA · 2 courts · lights · free parking'],
  ])('composes the meta line (lights %s, parking %s)', (lights, parking, meta) => {
    render(<CourtRow row={courtRow({ lights, parking })} />)

    expect(screen.getByText(meta)).toBeDefined()
  })

  test('shows the supplied status and the open slot count', () => {
    render(<CourtRow row={courtRow()} />)

    expect(
      screen.getByRole('heading', { level: 3, name: 'Test Park' }),
    ).toBeDefined()
    expect(screen.getByText('Open until 7 pm')).toBeDefined()
    expect(screen.getByText('2 open').className).toContain('rally-badge--green')
  })

  test('formats chips in the court time zone, not the process zone', () => {
    const { container } = render(<CourtRow row={courtRow()} />)
    const chips = Array.from(container.querySelectorAll('time'))

    expect(new Date().getTimezoneOffset()).toBe(0)
    expect(chips.map((chip) => chip.textContent)).toEqual([
      '9:30 am',
      '6:00 pm',
    ])
    expect(chips[0].getAttribute('datetime')).toBe('2026-11-18T09:30:00-08:00')
  })

  test('keeps chips non-interactive', () => {
    const { container } = render(<CourtRow row={courtRow()} />)

    expect(
      container.querySelector('a, button, input, [tabindex], [role="button"]'),
    ).toBeNull()
  })

  test('shows a closed row with its reason and no chips', () => {
    const { container } = render(<CourtRow row={closedRow()} />)

    expect(screen.getByText('Closed Saturday for resurfacing')).toBeDefined()
    expect(screen.getByText(finder.closedBadge).className).toContain(
      'rally-badge--grey',
    )
    expect(container.querySelector('time')).toBeNull()
    expect(container.firstElementChild?.className).toContain('bg-ground')
  })

  test('uses the closed flag rather than the status wording', () => {
    render(<CourtRow row={courtRow({ statusText: 'Closed soon' })} />)

    expect(screen.getByText('2 open')).toBeDefined()
    expect(screen.queryByText(finder.closedBadge)).toBeNull()
  })
})

describe('FilterForm', () => {
  test('is a replacing GET form that keeps the scroll position', () => {
    render(<FilterForm filters={DEFAULT_FILTERS} />)

    const form = screen.getByRole('form', { name: finder.formLabel })

    expect(form.getAttribute('action')).toBe('/')
    expect(form.getAttribute('data-replace')).toBe('true')
    expect(form.getAttribute('data-scroll')).toBe('false')
  })

  test('renders labelled groups with the contract names and values', () => {
    render(<FilterForm filters={DEFAULT_FILTERS} />)

    const groups = [
      [finder.groups.state, 'state', finder.states, ['all', 'CO', 'CA', 'NJ']],
      [finder.groups.day, 'day', finder.days, ['today', 'tomorrow', 'sat']],
      [finder.groups.time, 'time', finder.times, ['any', 'am', 'pm', 'eve']],
    ] as const

    for (const [legend, name, labels, values] of groups) {
      const radios = within(
        screen.getByRole('group', { name: legend }),
      ).getAllByRole('radio') as HTMLInputElement[]

      expect(radios.map((input) => input.name)).toEqual(values.map(() => name))
      expect(radios.map((input) => input.value)).toEqual([...values])
      expect(
        values.map((value) =>
          radio(legend, (labels as Record<string, string>)[value]).value,
        ),
      ).toEqual([...values])
    }

    const mustHave = within(
      screen.getByRole('group', { name: finder.groups.mustHave }),
    )

    expect(
      (mustHave.getByRole('checkbox', { name: finder.lights }) as HTMLInputElement)
        .name,
    ).toBe('lights')
    expect(
      (mustHave.getByRole('checkbox', { name: finder.parking }) as HTMLInputElement)
        .name,
    ).toBe('parking')
    expect(checkbox(finder.lights).value).toBe('1')
    expect(checkbox(finder.parking).value).toBe('1')
  })

  test('starts from the filters it is given', () => {
    render(
      <FilterForm
        filters={{
          state: 'NJ',
          day: 'sat',
          time: 'eve',
          lights: true,
          parking: false,
        }}
      />,
    )

    expect(radio(finder.groups.state, finder.states.NJ).checked).toBe(true)
    expect(radio(finder.groups.state, finder.states.all).checked).toBe(false)
    expect(radio(finder.groups.day, finder.days.sat).checked).toBe(true)
    expect(radio(finder.groups.time, finder.times.eve).checked).toBe(true)
    expect(checkbox(finder.lights).checked).toBe(true)
    expect(checkbox(finder.parking).checked).toBe(false)
  })

  test('submits when a radio or checkbox changes', () => {
    const requestSubmit = vi
      .spyOn(HTMLFormElement.prototype, 'requestSubmit')
      .mockImplementation(() => undefined)

    render(<FilterForm filters={DEFAULT_FILTERS} />)

    fireEvent.click(radio(finder.groups.state, finder.states.CO))
    expect(requestSubmit).toHaveBeenCalledTimes(1)

    fireEvent.click(checkbox(finder.parking))
    expect(requestSubmit).toHaveBeenCalledTimes(2)
    expect(radio(finder.groups.state, finder.states.CO).checked).toBe(true)
    expect(checkbox(finder.parking).checked).toBe(true)
  })

  test('follows new filters without replacing inputs or moving focus', () => {
    const { rerender } = render(<FilterForm filters={DEFAULT_FILTERS} />)
    const form = screen.getByRole('form', { name: finder.formLabel })
    const focused = radio(finder.groups.day, finder.days.today)

    focused.focus()
    rerender(
      <FilterForm
        filters={{
          state: 'CO',
          day: 'tomorrow',
          time: 'pm',
          lights: true,
          parking: true,
        }}
      />,
    )

    expect(screen.getByRole('form', { name: finder.formLabel })).toBe(form)
    expect(radio(finder.groups.day, finder.days.today)).toBe(focused)
    expect(document.activeElement).toBe(focused)
    expect(radio(finder.groups.state, finder.states.CO).checked).toBe(true)
    expect(radio(finder.groups.day, finder.days.tomorrow).checked).toBe(true)
    expect(radio(finder.groups.time, finder.times.pm).checked).toBe(true)
    expect(checkbox(finder.lights).checked).toBe(true)
    expect(checkbox(finder.parking).checked).toBe(true)
  })

  test('leaves a pending choice alone when the filters are unchanged', () => {
    const { rerender } = render(<FilterForm filters={DEFAULT_FILTERS} />)

    vi.spyOn(HTMLFormElement.prototype, 'requestSubmit').mockImplementation(
      () => undefined,
    )
    fireEvent.click(radio(finder.groups.state, finder.states.CA))
    rerender(<FilterForm filters={{ ...DEFAULT_FILTERS }} />)

    expect(radio(finder.groups.state, finder.states.CA).checked).toBe(true)
  })
})

describe('FinderSkeleton', () => {
  test('is a busy group named by the section heading', () => {
    render(
      <>
        <h2 id="courts-heading">{finder.heading}</h2>
        <FinderSkeleton />
      </>,
    )

    const skeleton = screen.getByRole('group', { name: finder.heading })

    expect(skeleton.getAttribute('aria-busy')).toBe('true')
  })

  test('adds no copy, controls or animation', () => {
    const { container } = render(<FinderSkeleton />)
    const root = container.firstElementChild as HTMLElement

    expect(root.textContent).toBe('')
    expect(root.querySelector('a, button, input, form')).toBeNull()
    expect(root.querySelector('[class*="animate"]')).toBeNull()
    expect(
      Array.from(root.children)
        .filter((child) => child.tagName !== 'NOSCRIPT')
        .map((child) => child.getAttribute('aria-hidden')),
    ).toEqual(['true', 'true'])
  })
})
