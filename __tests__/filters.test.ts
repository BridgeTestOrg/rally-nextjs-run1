// @vitest-environment node
import { describe, expect, test } from 'vitest'
import { courtsApi, queryCourts } from '../lib/courts'
import { inTimeBucket, parseFilters } from '../lib/filters'

const RALLY_NOW = new Date('2026-11-17T17:40:00-07:00')
const DEFAULTS = {
  state: 'all',
  day: 'today',
  time: 'any',
  lights: false,
  parking: false,
}

function query(search: string, instant = RALLY_NOW) {
  return queryCourts(parseFilters(new URLSearchParams(search)), instant)
}

function api(search: string, instant = RALLY_NOW) {
  return courtsApi(parseFilters(new URLSearchParams(search)), instant)
}

function entry(search: string, id: string, instant = RALLY_NOW) {
  const found = api(search, instant).find((court) => court.id === id)

  if (!found) {
    throw new Error(`No API entry for "${id}".`)
  }

  return found
}

describe('parseFilters', () => {
  test('defaults everything', () => {
    expect(parseFilters({})).toEqual(DEFAULTS)
    expect(parseFilters(new URLSearchParams())).toEqual(DEFAULTS)
  })

  test('reads every value from URLSearchParams', () => {
    expect(
      parseFilters(
        new URLSearchParams('state=NJ&day=sat&time=eve&lights=1&parking=1'),
      ),
    ).toEqual({
      state: 'NJ',
      day: 'sat',
      time: 'eve',
      lights: true,
      parking: true,
    })
  })

  test('reads a record', () => {
    expect(parseFilters({ state: 'CA', day: 'tomorrow', time: 'am' })).toEqual({
      ...DEFAULTS,
      state: 'CA',
      day: 'tomorrow',
      time: 'am',
    })
  })

  test('uses the first array value', () => {
    expect(parseFilters({ state: ['CO', 'NJ'], lights: ['1', '0'] })).toEqual({
      ...DEFAULTS,
      state: 'CO',
      lights: true,
    })
  })

  test('falls back for a bad first array value', () => {
    expect(parseFilters({ state: ['TX', 'NJ'] }).state).toBe('all')
    expect(parseFilters({ state: [] }).state).toBe('all')
  })

  test('falls back for each invalid value on its own', () => {
    expect(
      parseFilters(new URLSearchParams('state=co&day=monday&time=eve')),
    ).toEqual({ ...DEFAULTS, time: 'eve' })
  })

  test.each(['true', '0', '01', 'on', ''])('lights=%s is off', (value) => {
    expect(parseFilters({ lights: value, parking: value })).toEqual(DEFAULTS)
  })

  test('ignores inherited keys of a record', () => {
    expect(parseFilters(Object.create({ state: 'CO' })).state).toBe('all')
  })
})

describe('inTimeBucket', () => {
  test.each([
    ['11:59', 'am', true],
    ['12:00', 'am', false],
    ['11:59', 'pm', false],
    ['12:00', 'pm', true],
    ['16:59', 'pm', true],
    ['17:00', 'pm', false],
    ['16:59', 'eve', false],
    ['17:00', 'eve', true],
    ['00:00', 'any', true],
    ['23:59', 'any', true],
  ] as const)('%s in %s', (hhmm, time, expected) => {
    expect(inTimeBucket(hhmm, time)).toBe(expected)
  })
})

describe('queryCourts', () => {
  const ids = (search: string, instant?: Date) =>
    query(search, instant).rows.map((row) => row.id)

  test('keeps closed rows, drops courts with no slots, keeps file order', () => {
    expect(ids('')).toEqual([
      'northridge-park',
      'ocean-park',
      'memorial-park',
      'pier-a-park',
      'church-square-park',
    ])
  })

  test('counts only rows that are not closed', () => {
    expect(query('').count).toBe(4)
  })

  test('gives a closed row its status and no slots', () => {
    const row = query('').rows.at(-1)

    expect(row).toEqual({
      id: 'church-square-park',
      name: 'Church Square Park',
      city: 'Hoboken',
      state: 'NJ',
      timeZone: 'America/New_York',
      courts: 2,
      lights: false,
      parking: false,
      closed: true,
      statusText: 'Closed now · opens 7 am',
      closedReason: null,
      slots: [],
    })
  })

  test('returns the CO rows for tomorrow', () => {
    const { rows, count } = query('state=CO&day=tomorrow')

    expect(rows.map((row) => [row.id, row.statusText])).toEqual([
      ['northridge-park', 'Open 7 am to 10 pm'],
      ['redstone-park', 'Open 7 am to 7 pm'],
    ])
    expect(count).toBe(2)
  })

  test('returns Saturday with the closure kept and not counted', () => {
    const { rows, count } = query('day=sat')

    expect(rows.map((row) => row.id)).toEqual([
      'northridge-park',
      'redstone-park',
      'ocean-park',
      'memorial-park',
      'pier-a-park',
      'church-square-park',
    ])
    expect(rows[3]).toMatchObject({
      closed: true,
      statusText: 'Closed Saturday for resurfacing',
      closedReason: 'resurfacing',
      slots: [],
    })
    expect(count).toBe(5)
  })

  test('narrows slots by time and drops courts left empty', () => {
    const { rows, count } = query('day=tomorrow&time=eve')

    expect(rows.map((row) => row.id)).toEqual([
      'northridge-park',
      'ocean-park',
      'memorial-park',
      'pier-a-park',
    ])
    expect(rows[0].slots.map((slot) => slot.hhmm)).toEqual(['17:00'])
    expect(count).toBe(4)
  })

  test('keeps a closed row when no time matches', () => {
    expect(query('time=am')).toMatchObject({
      rows: [{ id: 'church-square-park', closed: true }],
      count: 0,
    })
  })

  test('filters by lights and parking', () => {
    expect(ids('lights=1')).toEqual([
      'northridge-park',
      'ocean-park',
      'memorial-park',
      'pier-a-park',
    ])
    expect(ids('parking=1')).toEqual(['northridge-park', 'memorial-park'])
  })
})

describe('courtsApi', () => {
  const ALL_IDS = [
    'northridge-park',
    'redstone-park',
    'ocean-park',
    'memorial-park',
    'pier-a-park',
    'church-square-park',
  ]

  test('lists every court in file order', () => {
    expect(api('').map((court) => court.id)).toEqual(ALL_IDS)
  })

  test('has exactly the documented entry', () => {
    expect(entry('', 'northridge-park')).toEqual({
      id: 'northridge-park',
      name: 'Northridge Park',
      city: 'Highlands Ranch',
      state: 'CO',
      timezone: 'America/Denver',
      courts: 4,
      lights: true,
      parking: true,
      openNow: true,
      status: 'Open until 10 pm',
      closedReason: null,
      slots: {
        today: ['18:00', '20:30'],
        tomorrow: ['07:30', '17:00'],
        sat: ['09:00', '14:00'],
      },
    })
  })

  test('keeps an open court with no slot left', () => {
    expect(entry('', 'redstone-park')).toMatchObject({
      openNow: true,
      status: 'Open until 7 pm',
      slots: { today: [] },
    })
  })

  test('empties only today for a court closed now', () => {
    expect(entry('', 'church-square-park')).toMatchObject({
      openNow: false,
      status: 'Closed now · opens 7 am',
      closedReason: null,
      slots: { today: [], tomorrow: ['08:00', '11:30'], sat: ['10:00'] },
    })
  })

  test('filters by state and empties a closure day', () => {
    expect(api('state=CA').map((court) => court.id)).toEqual([
      'ocean-park',
      'memorial-park',
    ])
    expect(entry('state=CA', 'memorial-park').slots.sat).toEqual([])
  })

  test('is not changed by day', () => {
    expect(api('day=sat')).toEqual(api(''))
    expect(api('day=tomorrow')).toEqual(api(''))
  })

  test('narrows every day by time and keeps every court', () => {
    const evening = api('time=eve')

    expect(evening.map((court) => court.id)).toEqual(ALL_IDS)
    expect(evening[0].slots).toEqual({
      today: ['18:00', '20:30'],
      tomorrow: ['17:00'],
      sat: [],
    })
  })

  test('lists today before opening', () => {
    const early = new Date('2026-11-18T06:00:00-07:00')

    expect(entry('', 'northridge-park', early)).toMatchObject({
      openNow: false,
      status: 'Closed now · opens 7 am',
      slots: { today: ['07:30', '17:00'] },
    })
  })

  test('empties today after closing', () => {
    const late = new Date('2026-11-17T22:00:00-07:00')

    expect(entry('', 'northridge-park', late)).toMatchObject({
      openNow: false,
      status: 'Closed now · opens 7 am',
      slots: { today: [], tomorrow: ['07:30', '17:00'] },
    })
  })

  test('reports today\'s closure', () => {
    const saturday = new Date('2026-11-21T12:00:00-08:00')

    expect(entry('', 'memorial-park', saturday)).toMatchObject({
      openNow: false,
      status: 'Closed Saturday for resurfacing',
      closedReason: 'resurfacing',
      slots: { today: [], tomorrow: ['11:00', '16:30'], sat: [] },
    })
  })
})
