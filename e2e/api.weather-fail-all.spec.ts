import {
  CITY_STATES,
  getConditions,
  NEXT_OPEN,
  readHits,
  UNAVAILABLE_STATS,
} from './api-helpers'
import { expect, test } from './fixtures'

test('every city is unavailable and retried, with a 200 response', async ({
  request,
}, testInfo) => {
  const entries = await getConditions(request)
  const afterFirst = await readHits(request, testInfo)

  expect(entries).toEqual([
    {
      city: 'Highlands Ranch',
      state: 'CO',
      nextOpen: NEXT_OPEN.CO,
      ...UNAVAILABLE_STATS,
    },
    {
      city: 'Santa Monica',
      state: 'CA',
      nextOpen: NEXT_OPEN.CA,
      ...UNAVAILABLE_STATS,
    },
    {
      city: 'Hoboken',
      state: 'NJ',
      nextOpen: NEXT_OPEN.NJ,
      ...UNAVAILABLE_STATS,
    },
  ])

  await getConditions(request)

  const afterSecond = await readHits(request, testInfo)

  for (const state of CITY_STATES) {
    expect(afterSecond.points[state], state).toBe(afterFirst.points[state] + 1)
  }
})
