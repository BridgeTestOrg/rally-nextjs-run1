import { describe, expect, test } from 'vitest'
import { verdict } from '../lib/verdict'

const CALM = { tempF: 60, windMph: 5, rainPct: 10 }

describe('verdict', () => {
  test.each([
    ['39 F', { tempF: 39 }, 'not_today'],
    ['40 F', { tempF: 40 }, 'playable'],
    ['wind 11', { windMph: 11 }, 'playable'],
    ['wind 12', { windMph: 12 }, 'breezy'],
    ['wind 17', { windMph: 17 }, 'breezy'],
    ['wind 18', { windMph: 18 }, 'not_today'],
    ['rain 29', { rainPct: 29 }, 'playable'],
    ['rain 30', { rainPct: 30 }, 'breezy'],
    ['rain 59', { rainPct: 59 }, 'breezy'],
    ['rain 60', { rainPct: 60 }, 'not_today'],
  ])('%s', (_name, change, expected) => {
    expect(verdict({ ...CALM, ...change })).toBe(expected)
  })

  test.each([
    ['Highlands Ranch', { tempF: 41, windMph: 14, rainPct: 10 }, 'breezy'],
    ['Santa Monica', { tempF: 66, windMph: 8, rainPct: 0 }, 'playable'],
    ['Hoboken', { tempF: 47, windMph: 9, rainPct: 70 }, 'not_today'],
  ])('matches the comp for %s', (_city, weather, expected) => {
    expect(verdict(weather)).toBe(expected)
  })
})
