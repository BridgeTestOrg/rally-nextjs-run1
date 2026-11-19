import {
  CONDITION_KEYS,
  getConditions,
  NEXT_OPEN,
  readHits,
  UNAVAILABLE_STATS,
} from './api-helpers'
import { expect, test } from './fixtures'

test('only Hoboken is unavailable, and only Hoboken is retried', async ({
  request,
}, testInfo) => {
  const start = await readHits(request, testInfo)
  const first = await getConditions(request)
  const afterFirst = await readHits(request, testInfo)
  const second = await getConditions(request)
  const afterSecond = await readHits(request, testInfo)

  for (const entries of [first, second]) {
    expect(entries.map((entry: { state: string }) => entry.state)).toEqual([
      'CO',
      'CA',
      'NJ',
    ])
    expect(entries[0]).toMatchObject({ available: true, verdict: 'breezy' })
    expect(entries[1]).toMatchObject({ available: true, verdict: 'playable' })
    expect(entries[2]).toEqual({
      city: 'Hoboken',
      state: 'NJ',
      nextOpen: NEXT_OPEN.NJ,
      ...UNAVAILABLE_STATS,
    })
    expect(Object.keys(entries[2]).sort()).toEqual(CONDITION_KEYS)
  }

  expect(afterFirst.points.NJ - start.points.NJ).toBe(1)
  expect(afterSecond.points.NJ - afterFirst.points.NJ).toBe(1)
  expect(afterSecond.points.CO).toBe(afterFirst.points.CO)
  expect(afterSecond.points.CA).toBe(afterFirst.points.CA)
  expect(afterSecond.hourly.NJ).toBe(start.hourly.NJ)
})
