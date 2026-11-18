import { afterEach, describe, expect, test, vi } from 'vitest'
import { fill } from '../lib/content'
import { date, hour, time, weekday } from '../lib/format'

const DENVER = 'America/Denver'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('time', () => {
  test('formats a 12-hour time in the given zone', () => {
    expect(time(new Date('2026-11-18T01:00:00Z'), DENVER)).toBe('6:00 pm')
  })

  test('keeps two-digit minutes', () => {
    expect(time(new Date('2026-11-18T01:05:00Z'), DENVER)).toBe('6:05 pm')
  })

  test('formats midnight and noon', () => {
    expect(time(new Date('2026-11-17T07:00:00Z'), DENVER)).toBe('12:00 am')
    expect(time(new Date('2026-11-17T19:00:00Z'), DENVER)).toBe('12:00 pm')
  })

  test('separates the day period with a plain space', () => {
    const formatted = time(new Date('2026-11-18T01:00:00Z'), DENVER)

    expect(formatted).not.toMatch(/[  ]/)
    expect(formatted).toContain(' ')
  })
})

describe('hour', () => {
  test('formats the hour only', () => {
    expect(hour(new Date('2026-11-18T05:00:00Z'), DENVER)).toBe('10 pm')
  })

  test('uses a plain space', () => {
    expect(hour(new Date('2026-11-18T05:00:00Z'), DENVER)).not.toMatch(
      /[  ]/,
    )
  })
})

describe('date', () => {
  test('puts the day before the short month', () => {
    expect(date(new Date('2026-11-02T18:00:00Z'), DENVER)).toBe('2 Nov')
  })

  test('uses the local date when the UTC date differs', () => {
    const instant = new Date('2026-11-03T02:00:00Z')

    expect(date(instant, 'UTC')).toBe('3 Nov')
    expect(date(instant, DENVER)).toBe('2 Nov')
  })
})

describe('weekday', () => {
  test('gives the full weekday name', () => {
    expect(weekday(new Date('2026-11-21T18:00:00Z'), DENVER)).toBe('Saturday')
  })

  test('uses the local day when the UTC day differs', () => {
    const instant = new Date('2026-11-22T02:00:00Z')

    expect(weekday(instant, 'UTC')).toBe('Sunday')
    expect(weekday(instant, DENVER)).toBe('Saturday')
  })
})

test.each(['UTC', 'America/New_York', 'Asia/Tokyo'])(
  'results do not depend on the process zone %s',
  (zone) => {
    vi.stubEnv('TZ', zone)
    const instant = new Date('2026-11-18T01:00:00Z')

    expect(time(instant, DENVER)).toBe('6:00 pm')
    expect(hour(instant, DENVER)).toBe('6 pm')
    expect(date(instant, DENVER)).toBe('17 Nov')
    expect(weekday(instant, DENVER)).toBe('Tuesday')
  },
)

describe('fill', () => {
  test('replaces every occurrence of a placeholder', () => {
    expect(fill('{a} and {b}, then {a}', { a: 'x', b: 2 })).toBe(
      'x and 2, then x',
    )
  })

  test('leaves a placeholder with no matching key', () => {
    expect(fill('{known} {unknown}', { known: 'yes' })).toBe('yes {unknown}')
  })

  test('does not use inherited properties', () => {
    expect(fill('{toString} {constructor}', {})).toBe(
      '{toString} {constructor}',
    )
  })

  test('keeps zero and empty-string values', () => {
    expect(fill('[{count}] [{note}]', { count: 0, note: '' })).toBe('[0] []')
  })

  test('inserts replacement patterns literally', () => {
    expect(fill('{value}', { value: '$& $1' })).toBe('$& $1')
  })
})
