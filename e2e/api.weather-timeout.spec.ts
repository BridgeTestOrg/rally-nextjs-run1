import {
  CITY_STATES,
  getConditions,
  NEXT_OPEN,
  readHits,
  UNAVAILABLE_STATS,
} from './api-helpers'
import { expect, test } from './fixtures'

test('cuts each city off at its budget, in parallel, without caching', async ({
  request,
}, testInfo) => {
  // Loads the server's route code so the timing below measures the weather.
  expect((await request.get('/api/courts')).status()).toBe(200)

  const start = Date.now()
  const entries = await getConditions(request)
  const elapsed = Date.now() - start

  // One city after another would take at least nine seconds.
  expect(elapsed).toBeLessThan(4000)
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

  const afterFirst = await readHits(request, testInfo)

  await getConditions(request)

  const afterSecond = await readHits(request, testInfo)

  for (const state of CITY_STATES) {
    expect(afterSecond.points[state], state).toBe(afterFirst.points[state] + 1)
  }
})
