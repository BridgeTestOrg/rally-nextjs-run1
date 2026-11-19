import { describe, expect, test } from 'vitest'
import {
  addLocalDays,
  isoWithOffset,
  localParts,
  zonedInstant,
} from '../lib/zoned'

const DENVER = 'America/Denver'
const LOS_ANGELES = 'America/Los_Angeles'
const NEW_YORK = 'America/New_York'
const RALLY_NOW = new Date('2026-11-17T17:40:00-07:00')

test('the test process runs in UTC', () => {
  expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe('UTC')
})

describe('localParts', () => {
  test.each([
    [DENVER, 17 * 60 + 40],
    [LOS_ANGELES, 16 * 60 + 40],
    [NEW_YORK, 19 * 60 + 40],
  ])('reads the local time in %s', (zone, minutes) => {
    expect(localParts(RALLY_NOW, zone)).toEqual({
      date: '2026-11-17',
      weekday: 'tue',
      minutes,
      seconds: 0,
    })
  })

  test('gives each zone its own date and weekday', () => {
    const instant = new Date('2026-11-18T06:30:15Z')

    expect(localParts(instant, DENVER)).toEqual({
      date: '2026-11-17',
      weekday: 'tue',
      minutes: 23 * 60 + 30,
      seconds: 15,
    })
    expect(localParts(instant, NEW_YORK)).toEqual({
      date: '2026-11-18',
      weekday: 'wed',
      minutes: 60 + 30,
      seconds: 15,
    })
  })

  test('counts midnight as minute zero', () => {
    expect(localParts(new Date('2026-11-17T07:00:00Z'), DENVER).minutes).toBe(0)
  })
})

describe('addLocalDays', () => {
  test.each([
    ['2026-02-28', 1, '2026-03-01'],
    ['2026-12-31', 1, '2027-01-01'],
    ['2026-03-01', -1, '2026-02-28'],
    ['2026-03-07', 2, '2026-03-09'],
    ['2026-11-17', 0, '2026-11-17'],
  ])('moves %s by %i days', (date, days, expected) => {
    expect(addLocalDays(date, days)).toBe(expected)
  })

  test('rejects a value that is not a date', () => {
    expect(() => addLocalDays('soon', 1)).toThrow(/YYYY-MM-DD/)
  })
})

describe('isoWithOffset', () => {
  test('uses the local time and a signed offset', () => {
    expect(isoWithOffset(new Date('2026-11-18T01:00:00Z'), DENVER)).toBe(
      '2026-11-17T18:00:00-07:00',
    )
  })

  test('keeps seconds and drops milliseconds', () => {
    expect(isoWithOffset(new Date('2026-11-18T01:00:09.999Z'), NEW_YORK)).toBe(
      '2026-11-17T20:00:09-05:00',
    )
  })

  test('writes a zero offset instead of Z', () => {
    expect(isoWithOffset(new Date('2026-11-18T01:00:00Z'), 'UTC')).toBe(
      '2026-11-18T01:00:00+00:00',
    )
  })

  test('writes a positive offset', () => {
    expect(isoWithOffset(new Date('2026-11-18T01:00:00Z'), 'Asia/Kolkata')).toBe(
      '2026-11-18T06:30:00+05:30',
    )
  })
})

describe('zonedInstant', () => {
  test('uses the offset of the date on each side of a DST change', () => {
    expect(isoWithOffset(zonedInstant('2026-10-31', '12:00', DENVER), DENVER)).toBe(
      '2026-10-31T12:00:00-06:00',
    )
    expect(isoWithOffset(zonedInstant('2026-11-01', '12:00', DENVER), DENVER)).toBe(
      '2026-11-01T12:00:00-07:00',
    )
  })

  test('moves a time in the spring gap to the first time after it', () => {
    const instant = zonedInstant('2026-03-08', '02:30', DENVER)

    expect(instant.toISOString()).toBe('2026-03-08T09:00:00.000Z')
    expect(isoWithOffset(instant, DENVER)).toBe('2026-03-08T03:00:00-06:00')
  })

  test('picks the earlier occurrence of a repeated time', () => {
    const instant = zonedInstant('2026-11-01', '01:30', DENVER)

    expect(instant.toISOString()).toBe('2026-11-01T07:30:00.000Z')
    expect(isoWithOffset(instant, DENVER)).toBe('2026-11-01T01:30:00-06:00')
  })

  test.each([
    ['2026-03-08', '01:59', '2026-03-08T08:59:00.000Z'],
    ['2026-03-08', '03:00', '2026-03-08T09:00:00.000Z'],
    ['2026-11-01', '00:59', '2026-11-01T06:59:00.000Z'],
    ['2026-11-01', '02:00', '2026-11-01T09:00:00.000Z'],
  ])('resolves %s %s next to a change', (date, time, expected) => {
    expect(zonedInstant(date, time, DENVER).toISOString()).toBe(expected)
  })

  test('rejects a value that is not a time', () => {
    expect(() => zonedInstant('2026-11-17', '6pm', DENVER)).toThrow(/HH:MM/)
  })
})
