import {
  CITY_STATES,
  CONDITION_KEYS,
  getConditions,
  NEXT_OPEN,
  readHits,
} from './api-helpers'
import { expect, test } from './fixtures'

const ALL_COURTS = [
  'northridge-park',
  'redstone-park',
  'ocean-park',
  'memorial-park',
  'pier-a-park',
  'church-square-park',
]

const COURT_KEYS = [
  'city',
  'closedReason',
  'courts',
  'id',
  'lights',
  'name',
  'openNow',
  'parking',
  'slots',
  'state',
  'status',
  'timezone',
]

type CourtEntry = {
  id: string
  openNow: boolean
  status: string
  closedReason: string | null
  slots: { today: string[]; tomorrow: string[]; sat: string[] }
}

test.describe('GET /api/courts', () => {
  async function courts(
    request: Parameters<typeof getConditions>[0],
    search = '',
  ): Promise<CourtEntry[]> {
    const response = await request.get(`/api/courts${search}`)

    expect(response.status()).toBe(200)
    expect(response.headers()['cache-control']).toBe('no-store')

    return response.json()
  }

  const byId = (entries: CourtEntry[], id: string) => {
    const entry = entries.find((court) => court.id === id)

    expect(entry, id).toBeDefined()

    return entry as CourtEntry
  }

  test('lists six courts in file order with the documented keys', async ({
    request,
  }) => {
    const entries = await courts(request)

    expect(entries.map((court) => court.id)).toEqual(ALL_COURTS)

    for (const entry of entries) {
      expect(Object.keys(entry).sort()).toEqual(COURT_KEYS)
      expect(Object.keys(entry.slots).sort()).toEqual([
        'sat',
        'today',
        'tomorrow',
      ])
    }
  })

  test('shows the frozen-clock state of each court', async ({ request }) => {
    const entries = await courts(request)

    expect(byId(entries, 'church-square-park')).toMatchObject({
      openNow: false,
      status: 'Closed now · opens 7 am',
      slots: { today: [] },
    })
    expect(byId(entries, 'northridge-park')).toMatchObject({
      openNow: true,
      status: 'Open until 10 pm',
      slots: { today: ['18:00', '20:30'] },
    })
    expect(byId(entries, 'redstone-park')).toMatchObject({
      openNow: true,
      slots: { today: [] },
    })
    expect(
      entries.filter((court) => court.openNow).map((court) => court.id),
    ).toEqual(ALL_COURTS.filter((id) => id !== 'church-square-park'))
  })

  test('filters by state and honors the Saturday closure', async ({
    request,
  }) => {
    const entries = await courts(request, '?state=CA')

    expect(entries.map((court) => court.id)).toEqual([
      'ocean-park',
      'memorial-park',
    ])
    expect(byId(entries, 'memorial-park').slots.sat).toEqual([])
  })

  test('is not changed by day', async ({ request }) => {
    expect(await courts(request, '?day=sat')).toEqual(await courts(request))
  })

  test('narrows slots to the evening and keeps every court', async ({
    request,
  }) => {
    const entries = await courts(request, '?time=eve')

    expect(entries.map((court) => court.id)).toEqual(ALL_COURTS)

    for (const { slots } of entries) {
      for (const hhmm of [...slots.today, ...slots.tomorrow, ...slots.sat]) {
        expect(hhmm >= '17:00', hhmm).toBe(true)
      }
    }

    expect(byId(entries, 'northridge-park').slots.tomorrow).toEqual(['17:00'])
  })
})

test.describe('GET /api/conditions', () => {
  test('returns the comp 04 values', async ({ request }) => {
    expect(await getConditions(request)).toEqual([
      {
        city: 'Highlands Ranch',
        state: 'CO',
        available: true,
        nextOpen: NEXT_OPEN.CO,
        tempF: 41,
        windMph: 14,
        rainPct: 10,
        verdict: 'breezy',
        updatedAt: '2026-11-17T17:40:00-07:00',
      },
      {
        city: 'Santa Monica',
        state: 'CA',
        available: true,
        nextOpen: NEXT_OPEN.CA,
        tempF: 66,
        windMph: 8,
        rainPct: 0,
        verdict: 'playable',
        updatedAt: '2026-11-17T16:40:00-08:00',
      },
      {
        city: 'Hoboken',
        state: 'NJ',
        available: true,
        nextOpen: NEXT_OPEN.NJ,
        tempF: 47,
        windMph: 9,
        rainPct: 70,
        verdict: 'not_today',
        updatedAt: '2026-11-17T19:40:00-05:00',
      },
    ])
  })

  test('exposes only the documented keys', async ({ request }) => {
    for (const entry of await getConditions(request)) {
      expect(Object.keys(entry).sort()).toEqual(CONDITION_KEYS)
      expect(Object.keys(entry.nextOpen).sort()).toEqual(['courtId', 'time'])
    }
  })

  test('identifies Rally to the weather service', async ({
    request,
  }, testInfo) => {
    await getConditions(request)

    const { userAgent } = await readHits(request, testInfo)

    for (const state of CITY_STATES) {
      expect(userAgent[state], state).toBe('Rally test app (hello@example.com)')
    }
  })
})
