import { describe, expect, test, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { LiveCard } from '../app/_sections/live/LiveCard'
import { LiveSkeleton } from '../app/_sections/live/LiveSkeleton'
import { Notice } from '../app/_sections/live/Notice'
import { LiveSection } from '../app/_sections/live/Section'
import {
  allWeatherFailed,
  lastCheckedText,
  nextOpenText,
  stampText,
} from '../app/_sections/live/stamp'
import type { ConditionsEntry } from '../lib/conditions'
import { content, fill } from '../lib/content'

// Never settles, so the section shows its fallback. The real component is an
// async Server Component, which a client render cannot run.
vi.mock('../app/_sections/live/LiveCards', () => ({
  LiveCards: () => {
    throw new Promise(() => {})
  },
}))

const { live } = content
const INSTANT = new Date('2026-11-18T00:40:00Z')
const DENVER = 'America/Denver'
const NEW_YORK = 'America/New_York'
const LOS_ANGELES = 'America/Los_Angeles'

function minutesBefore(minutes: number, instant = INSTANT) {
  return new Date(instant.getTime() - minutes * 60_000).toISOString()
}

function slot(time: string, courtName = 'Northridge Park') {
  return { courtId: 'court', courtName, time }
}

function availableEntry(
  overrides: Partial<ConditionsEntry> = {},
): ConditionsEntry {
  return {
    city: 'Highlands Ranch',
    state: 'CO',
    available: true,
    nextOpen: slot('2026-11-17T18:00:00-07:00'),
    tempF: 41,
    windMph: 14,
    rainPct: 10,
    verdict: 'breezy',
    updatedAt: INSTANT.toISOString(),
    timeZone: DENVER,
    checkedAt: INSTANT.toISOString(),
    ...overrides,
  }
}

function weatherFailedEntry(
  overrides: Partial<ConditionsEntry> = {},
): ConditionsEntry {
  return availableEntry({
    available: false,
    tempF: null,
    windMph: null,
    rainPct: null,
    verdict: null,
    updatedAt: null,
    ...overrides,
  })
}

function noSlotEntry(overrides: Partial<ConditionsEntry> = {}) {
  return weatherFailedEntry({ nextOpen: null, ...overrides })
}

describe('stampText', () => {
  test('says just now for an update under a minute old', () => {
    expect(
      stampText([availableEntry({ updatedAt: minutesBefore(0.5) })], INSTANT),
    ).toBe(live.stampJustNow)
  })

  test('gives the age in whole minutes', () => {
    expect(
      stampText([availableEntry({ updatedAt: minutesBefore(5) })], INSTANT),
    ).toBe('National Weather Service · updated 5 min ago')
  })

  test('uses the oldest update among available cities', () => {
    expect(
      stampText(
        [
          availableEntry({ updatedAt: minutesBefore(2) }),
          availableEntry({ updatedAt: minutesBefore(9) }),
          availableEntry({ updatedAt: minutesBefore(4) }),
        ],
        INSTANT,
      ),
    ).toBe(fill(live.stamp, { minutes: 9 }))
  })

  test('ignores cities without weather when any city has it', () => {
    expect(
      stampText(
        [
          availableEntry({ updatedAt: minutesBefore(3) }),
          weatherFailedEntry({ checkedAt: minutesBefore(30) }),
        ],
        INSTANT,
      ),
    ).toBe(fill(live.stamp, { minutes: 3 }))
  })

  test('clamps a future update to just now', () => {
    expect(
      stampText([availableEntry({ updatedAt: minutesBefore(-5) })], INSTANT),
    ).toBe(live.stampJustNow)
  })

  test('reports the newest check when no city has weather', () => {
    expect(
      stampText(
        [
          weatherFailedEntry({ checkedAt: minutesBefore(12) }),
          weatherFailedEntry({ checkedAt: minutesBefore(5) }),
          noSlotEntry({ checkedAt: minutesBefore(8) }),
        ],
        INSTANT,
      ),
    ).toBe('National Weather Service · last checked 5 min ago')
  })
})

describe('lastCheckedText', () => {
  test('reads 0 minutes for a check made now', () => {
    expect(lastCheckedText(INSTANT, INSTANT)).toBe(
      'National Weather Service · last checked 0 min ago',
    )
  })

  test('never reports a negative age', () => {
    expect(lastCheckedText(new Date(minutesBefore(-5)), INSTANT)).toBe(
      fill(live.stampDown, { minutes: 0 }),
    )
  })
})

describe('nextOpenText', () => {
  test('words a slot later today', () => {
    expect(
      nextOpenText(slot('2026-11-17T18:00:00-07:00'), DENVER, INSTANT),
    ).toBe('Next open: Northridge Park, 6:00 pm')
  })

  test('words a slot tomorrow', () => {
    expect(
      nextOpenText(slot('2026-11-18T07:30:00-07:00'), DENVER, INSTANT),
    ).toBe('Next open: Northridge Park, tomorrow 7:30 am')
  })

  test('names the weekday for a later slot', () => {
    expect(
      nextOpenText(slot('2026-11-21T09:00:00-07:00'), DENVER, INSTANT),
    ).toBe('Next open: Northridge Park, Saturday 9:00 am')
  })

  test('says so when there is no slot', () => {
    expect(nextOpenText(null, DENVER, INSTANT)).toBe(live.noOpenSlot)
  })

  test('compares dates in the city, not across a fixed 24 hours', () => {
    const instant = new Date('2026-11-18T03:30:00Z')
    const nextOpen = slot('2026-11-18T05:30:00Z', 'Pier A Park')

    expect(nextOpenText(nextOpen, NEW_YORK, instant)).toBe(
      'Next open: Pier A Park, tomorrow 12:30 am',
    )
    expect(nextOpenText(nextOpen, LOS_ANGELES, instant)).toBe(
      'Next open: Pier A Park, 9:30 pm',
    )
  })

  test('counts a 25-hour day across the end of DST as one day', () => {
    expect(
      nextOpenText(
        slot('2026-11-01T23:30:00-05:00'),
        NEW_YORK,
        new Date('2026-10-31T23:30:00-04:00'),
      ),
    ).toBe('Next open: Northridge Park, tomorrow 11:30 pm')
  })

  test('rolls tomorrow over the end of a year', () => {
    expect(
      nextOpenText(
        slot('2027-01-01T08:00:00-05:00'),
        NEW_YORK,
        new Date('2026-12-31T20:00:00-05:00'),
      ),
    ).toBe('Next open: Northridge Park, tomorrow 8:00 am')
  })
})

describe('allWeatherFailed', () => {
  test('is true when every city lost its weather', () => {
    expect(
      allWeatherFailed([weatherFailedEntry(), weatherFailedEntry()]),
    ).toBe(true)
  })

  test('is false when any city has weather', () => {
    expect(allWeatherFailed([availableEntry(), weatherFailedEntry()])).toBe(
      false,
    )
  })

  test('keeps the grid when a failure sits beside a city with no slot', () => {
    expect(allWeatherFailed([weatherFailedEntry(), noSlotEntry()])).toBe(false)
  })

  test('keeps the grid when no city has a slot', () => {
    expect(allWeatherFailed([noSlotEntry(), noSlotEntry()])).toBe(false)
  })
})

describe('LiveCard', () => {
  function renderCard(entry: ConditionsEntry) {
    render(<LiveCard entry={entry} instant={INSTANT} />)

    return within(screen.getByRole('article', { name: 'Highlands Ranch, CO' }))
  }

  test('shows an available city', () => {
    const card = renderCard(availableEntry())

    expect(card.getByRole('heading', { level: 3 }).textContent).toBe(
      'Highlands Ranch, CO',
    )
    expect(card.getByText('5:40 pm local time')).toBeDefined()
    expect(card.getByText(live.verdicts.breezy)).toBeDefined()
    expect(card.getAllByRole('term').map((term) => term.textContent)).toEqual([
      live.labels.temp,
      live.labels.wind,
      live.labels.rain,
    ])
    expect(
      card.getAllByRole('definition').map((value) => value.textContent),
    ).toEqual(['41°', '14 mph', '10%'])
    expect(card.getByText('Next open: Northridge Park, 6:00 pm')).toBeDefined()
  })

  test.each([
    ['playable', live.verdicts.playable],
    ['breezy', live.verdicts.breezy],
    ['not_today', live.verdicts.notToday],
  ] as const)('labels the %s verdict', (verdict, label) => {
    expect(renderCard(availableEntry({ verdict })).getByText(label)).toBeDefined()
  })

  test('keeps a zero reading instead of treating it as missing', () => {
    const card = renderCard(availableEntry({ tempF: 0, rainPct: 0 }))

    expect(
      card.getAllByRole('definition').map((value) => value.textContent),
    ).toEqual(['0°', '14 mph', '0%'])
  })

  test('refuses an available city with no weather values', () => {
    vi.spyOn(console, 'error').mockImplementationOnce(() => {})

    expect(() => renderCard(availableEntry({ tempF: null }))).toThrow(
      'Conditions for CO are available but empty.',
    )
  })

  test('shows the unavailable message when weather failed', () => {
    const card = renderCard(weatherFailedEntry())

    expect(card.getByText('5:40 pm local time')).toBeDefined()
    expect(
      card.getByText('Conditions unavailable for Highlands Ranch right now.'),
    ).toBeDefined()
    expect(card.getByText(live.cityUnavailableNote)).toBeDefined()
    expect(card.queryByRole('definition')).toBeNull()
    expect(card.queryByText(/^Next open/)).toBeNull()
  })

  test('shows only the no-slot line when a city has no slot', () => {
    const card = renderCard(noSlotEntry())

    expect(card.getByText('5:40 pm local time')).toBeDefined()
    expect(card.getByText(live.noOpenSlot)).toBeDefined()
    expect(card.queryByRole('definition')).toBeNull()
    expect(card.queryByText(live.cityUnavailableNote)).toBeNull()
  })
})

test('LiveSkeleton announces loading and hides its placeholders', () => {
  const { container } = render(<LiveSkeleton />)
  const root = container.querySelector('[aria-busy="true"]') as HTMLElement
  const placeholders = root.querySelector('[aria-hidden="true"]') as HTMLElement

  expect(within(root).getByText(live.stampLoading)).toBeDefined()
  expect(placeholders.children).toHaveLength(3)
  expect(placeholders.textContent).toBe('')
})

test('Notice shows its copy with a decorative icon', () => {
  const { container } = render(<Notice />)
  const icon = container.querySelector('img') as HTMLImageElement

  expect(icon.getAttribute('alt')).toBe('')
  expect(icon.getAttribute('width')).toBe('28')
  expect(
    screen.getByRole('heading', { name: live.allUnavailableTitle }),
  ).toBeDefined()
  expect(screen.getByText(live.allUnavailableBody)).toBeDefined()
})

test('LiveSection keeps its heading outside the polite live region', () => {
  const { container } = render(<LiveSection />)
  const section = screen.getByRole('region', { name: live.heading })
  const region = container.querySelector('[aria-live="polite"]') as HTMLElement

  expect(section.id).toBe('live')
  expect(section.contains(region)).toBe(true)
  expect(within(section).getByText(live.eyebrow)).toBeDefined()
  expect(within(region).queryByText(live.heading)).toBeNull()
  expect(region.querySelector('[aria-busy="true"]')).not.toBeNull()
  expect(within(region).getByText(live.stampLoading)).toBeDefined()
})
