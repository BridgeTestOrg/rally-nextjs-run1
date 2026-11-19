// @vitest-environment node
import { describe, expect, test } from 'vitest'
import { getCourts } from '../lib/courts'
import {
  closureOn,
  hours,
  nextOpenForCity,
  openNow,
  slotsFor,
  status,
  targetDate,
  type Court,
} from '../lib/schedule'

const RALLY_NOW = new Date('2026-11-17T17:40:00-07:00')

function court(id: string): Court {
  const found = getCourts().find((candidate) => candidate.id === id)

  if (!found) {
    throw new Error(`No court "${id}" in the data file.`)
  }

  return found
}

function fixture(overrides: Partial<Court>): Court {
  return {
    id: 'fixture',
    name: 'Fixture Park',
    city: 'Highlands Ranch',
    state: 'CO',
    timezone: 'America/Denver',
    lat: 39.5,
    lon: -104.9,
    courts: 1,
    lights: true,
    parking: true,
    slots: { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] },
    closures: [],
    ...overrides,
  }
}

function slotTimes(id: string, day: 'today' | 'tomorrow' | 'sat', at: Date) {
  return slotsFor(court(id), day, at).map((slot) => slot.hhmm)
}

test('the test process runs in UTC', () => {
  expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe('UTC')
})

describe('hours', () => {
  test('runs to 10 pm with lights', () => {
    expect(hours(court('northridge-park'))).toEqual({
      open: '07:00',
      close: '22:00',
    })
  })

  test('runs to 7 pm without lights', () => {
    expect(hours(court('redstone-park'))).toEqual({
      open: '07:00',
      close: '19:00',
    })
  })
})

describe('closureOn', () => {
  test('finds a closure by local date', () => {
    expect(closureOn(court('memorial-park'), '2026-11-21')).toEqual({
      date: '2026-11-21',
      reason: 'resurfacing',
    })
  })

  test('is undefined on other dates', () => {
    expect(closureOn(court('memorial-park'), '2026-11-22')).toBeUndefined()
  })
})

describe('targetDate', () => {
  test.each([
    ['today', '2026-11-17'],
    ['tomorrow', '2026-11-18'],
    ['sat', '2026-11-21'],
  ] as const)('%s from a Tuesday', (day, expected) => {
    expect(targetDate(day, court('northridge-park'), RALLY_NOW)).toBe(expected)
  })

  test('Saturday is today on a local Saturday', () => {
    const saturday = new Date('2026-11-21T12:00:00-07:00')

    expect(targetDate('sat', court('northridge-park'), saturday)).toBe(
      '2026-11-21',
    )
  })

  test('Saturday is six days ahead on a Sunday', () => {
    const sunday = new Date('2026-11-22T12:00:00-07:00')

    expect(targetDate('sat', court('northridge-park'), sunday)).toBe(
      '2026-11-28',
    )
  })

  test('follows the court, not the server or another zone', () => {
    // Friday night in Denver is already Saturday in Hoboken and in UTC.
    const instant = new Date('2026-11-21T06:30:00Z')

    expect(targetDate('today', court('northridge-park'), instant)).toBe(
      '2026-11-20',
    )
    expect(targetDate('today', court('pier-a-park'), instant)).toBe(
      '2026-11-21',
    )
  })
})

describe('slotsFor', () => {
  test('gives remaining slots with an offset time', () => {
    expect(slotsFor(court('northridge-park'), 'today', RALLY_NOW)).toEqual([
      { hhmm: '18:00', at: '2026-11-17T18:00:00-07:00' },
      { hhmm: '20:30', at: '2026-11-17T20:30:00-07:00' },
    ])
  })

  test.each([
    ['ocean-park', ['17:00', '19:30']],
    ['memorial-park', ['18:00']],
    ['pier-a-park', ['20:30']],
    ['redstone-park', []],
  ])('uses local time for %s', (id, expected) => {
    expect(slotTimes(id, 'today', RALLY_NOW)).toEqual(expected)
  })

  test('uses the local offset of each court', () => {
    expect(slotsFor(court('ocean-park'), 'today', RALLY_NOW)[0].at).toBe(
      '2026-11-17T17:00:00-08:00',
    )
  })

  test.each([
    ['2026-11-17T17:59:30-07:00', ['18:00', '20:30']],
    ['2026-11-17T17:59:59-07:00', ['18:00', '20:30']],
    ['2026-11-17T18:00:00-07:00', ['20:30']],
    ['2026-11-17T18:00:00.500-07:00', ['20:30']],
  ])('keeps only slots strictly after %s', (instant, expected) => {
    expect(slotTimes('northridge-park', 'today', new Date(instant))).toEqual(
      expected,
    )
  })

  test('lists every slot on a later day', () => {
    expect(slotTimes('northridge-park', 'tomorrow', RALLY_NOW)).toEqual([
      '07:30',
      '17:00',
    ])
    expect(slotTimes('northridge-park', 'sat', RALLY_NOW)).toEqual([
      '09:00',
      '14:00',
    ])
  })

  test('drops passed slots when Saturday is today', () => {
    const saturday = new Date('2026-11-21T12:00:00-07:00')

    expect(slotTimes('northridge-park', 'sat', saturday)).toEqual(['14:00'])
  })

  test('is empty on a closure date', () => {
    expect(slotTimes('memorial-park', 'sat', RALLY_NOW)).toEqual([])
  })
})

describe('openNow', () => {
  test.each([
    ['northridge-park', true],
    ['redstone-park', true],
    ['ocean-park', true],
    ['memorial-park', true],
    ['pier-a-park', true],
    ['church-square-park', false],
  ])('%s at the frozen clock', (id, expected) => {
    expect(openNow(court(id), RALLY_NOW)).toBe(expected)
  })

  test.each([
    ['2026-11-18T06:59:59-07:00', false],
    ['2026-11-18T07:00:00-07:00', true],
    ['2026-11-18T21:59:59-07:00', true],
    ['2026-11-18T22:00:00-07:00', false],
  ])('at %s', (instant, expected) => {
    expect(openNow(court('northridge-park'), new Date(instant))).toBe(expected)
  })

  test('is false during opening hours on a closure date', () => {
    expect(
      openNow(court('memorial-park'), new Date('2026-11-21T12:00:00-08:00')),
    ).toBe(false)
  })
})

describe('status', () => {
  test('says when an open court closes', () => {
    expect(status(court('northridge-park'), 'today', RALLY_NOW)).toEqual({
      closed: false,
      statusText: 'Open until 10 pm',
      closedReason: null,
    })
    expect(status(court('redstone-park'), 'today', RALLY_NOW).statusText).toBe(
      'Open until 7 pm',
    )
  })

  test('marks a court closed after hours today', () => {
    expect(status(court('church-square-park'), 'today', RALLY_NOW)).toEqual({
      closed: true,
      statusText: 'Closed now · opens 7 am',
      closedReason: null,
    })
  })

  test('says closed but stays listable before opening', () => {
    const early = new Date('2026-11-18T06:00:00-07:00')

    expect(status(court('northridge-park'), 'today', early)).toEqual({
      closed: false,
      statusText: 'Closed now · opens 7 am',
      closedReason: null,
    })
    expect(slotTimes('northridge-park', 'today', early)).toEqual([
      '07:30',
      '17:00',
    ])
  })

  test('gives the hours for another day', () => {
    expect(status(court('northridge-park'), 'tomorrow', RALLY_NOW)).toEqual({
      closed: false,
      statusText: 'Open 7 am to 10 pm',
      closedReason: null,
    })
    expect(status(court('redstone-park'), 'sat', RALLY_NOW).statusText).toBe(
      'Open 7 am to 7 pm',
    )
  })

  test('names the day and reason of a closure', () => {
    expect(status(court('memorial-park'), 'sat', RALLY_NOW)).toEqual({
      closed: true,
      statusText: 'Closed Saturday for resurfacing',
      closedReason: 'resurfacing',
    })
  })

  test('lets a closure win over open hours today', () => {
    const saturdayNoon = new Date('2026-11-21T12:00:00-08:00')

    expect(status(court('memorial-park'), 'today', saturdayNoon)).toEqual({
      closed: true,
      statusText: 'Closed Saturday for resurfacing',
      closedReason: 'resurfacing',
    })
  })
})

describe('nextOpenForCity', () => {
  const inState = (state: Court['state']) =>
    getCourts().filter((candidate) => candidate.state === state)

  test.each([
    ['CO', 'northridge-park', 'Northridge Park', '2026-11-17T18:00:00-07:00'],
    ['CA', 'ocean-park', 'Ocean Park', '2026-11-17T17:00:00-08:00'],
    ['NJ', 'pier-a-park', 'Pier A Park', '2026-11-17T20:30:00-05:00'],
  ] as const)('finds the comp slot for %s', (state, courtId, courtName, time) => {
    expect(nextOpenForCity(inState(state), RALLY_NOW)).toEqual({
      courtId,
      courtName,
      time,
    })
  })

  test('needs a start strictly after the instant', () => {
    const atSlot = new Date('2026-11-17T18:00:00-07:00')

    expect(nextOpenForCity(inState('CO'), atSlot)?.time).toBe(
      '2026-11-17T20:30:00-07:00',
    )
  })

  test('skips a closure date', () => {
    const closed = fixture({
      slots: { ...fixture({}).slots, sat: ['09:00'], sun: ['10:00'] },
      closures: [{ date: '2026-11-21', reason: 'resurfacing' }],
    })

    expect(nextOpenForCity([closed], RALLY_NOW)?.time).toBe(
      '2026-11-22T10:00:00-07:00',
    )
  })

  test('looks as far as the same weekday next week', () => {
    const weekly = fixture({ slots: { ...fixture({}).slots, tue: ['12:00'] } })

    expect(nextOpenForCity([weekly], RALLY_NOW)?.time).toBe(
      '2026-11-24T12:00:00-07:00',
    )
  })

  test('is null past the seven-day limit', () => {
    const weekly = fixture({
      slots: { ...fixture({}).slots, tue: ['12:00'] },
      closures: [{ date: '2026-11-24', reason: 'repairs' }],
    })

    expect(nextOpenForCity([weekly], RALLY_NOW)).toBeNull()
  })

  test('is null with no slots', () => {
    expect(nextOpenForCity([fixture({})], RALLY_NOW)).toBeNull()
  })

  test('gives a tie to the earlier court in the list', () => {
    const slots = { ...fixture({}).slots, tue: ['18:00'] }
    const first = fixture({ id: 'first', slots })
    const second = fixture({ id: 'second', slots })

    expect(nextOpenForCity([first, second], RALLY_NOW)?.courtId).toBe('first')
    expect(nextOpenForCity([second, first], RALLY_NOW)?.courtId).toBe('second')
  })
})
