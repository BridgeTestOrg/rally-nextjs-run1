import { afterEach, describe, expect, test, vi } from 'vitest'
import { now } from '../lib/clock'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.useRealTimers()
})

describe('now', () => {
  test('uses the real clock when RALLY_NOW is unset', () => {
    vi.stubEnv('RALLY_NOW', undefined)

    expect(Math.abs(now().getTime() - Date.now())).toBeLessThan(1000)
  })

  test('returns a fresh real time on each call', () => {
    vi.stubEnv('RALLY_NOW', undefined)
    vi.useFakeTimers({ now: new Date('2026-01-01T00:00:00Z') })
    const first = now()

    vi.advanceTimersByTime(5000)

    expect(now().getTime() - first.getTime()).toBe(5000)
  })

  test('honors a numeric offset', () => {
    vi.stubEnv('RALLY_NOW', '2026-11-17T17:40:00-07:00')

    expect(now().toISOString()).toBe('2026-11-18T00:40:00.000Z')
  })

  test('honors Z', () => {
    vi.stubEnv('RALLY_NOW', '2026-11-18T00:40:00Z')

    expect(now().toISOString()).toBe('2026-11-18T00:40:00.000Z')
  })

  test.each([
    ['no offset', '2026-11-17T17:40:00'],
    ['garbage', 'not-a-date'],
    ['garbage ending in Z', 'nonsenseZ'],
    ['an empty value', ''],
  ])('throws for %s', (_name, value) => {
    vi.stubEnv('RALLY_NOW', value)

    expect(() => now()).toThrow(/RALLY_NOW/)
  })

  test('reads the variable on every call', () => {
    vi.stubEnv('RALLY_NOW', '2026-11-17T00:00:00Z')
    expect(now().toISOString()).toBe('2026-11-17T00:00:00.000Z')

    vi.stubEnv('RALLY_NOW', '2026-11-18T00:00:00Z')
    expect(now().toISOString()).toBe('2026-11-18T00:00:00.000Z')
  })
})
