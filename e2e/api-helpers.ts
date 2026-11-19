import { expect, type APIRequestContext, type TestInfo } from '@playwright/test'

export type StubHits = {
  points: Record<'CO' | 'CA' | 'NJ', number>
  hourly: Record<'CO' | 'CA' | 'NJ', number>
  userAgent: Record<'CO' | 'CA' | 'NJ', string | null>
}

export const CITY_STATES = ['CO', 'CA', 'NJ'] as const

export const CONDITION_KEYS = [
  'available',
  'city',
  'nextOpen',
  'rainPct',
  'state',
  'tempF',
  'updatedAt',
  'verdict',
  'windMph',
]

export const NEXT_OPEN = {
  CO: { courtId: 'northridge-park', time: '2026-11-17T18:00:00-07:00' },
  CA: { courtId: 'ocean-park', time: '2026-11-17T17:00:00-08:00' },
  NJ: { courtId: 'pier-a-park', time: '2026-11-17T20:30:00-05:00' },
}

export const UNAVAILABLE_STATS = {
  available: false,
  tempF: null,
  windMph: null,
  rainPct: null,
  verdict: null,
  updatedAt: null,
}

/** Reads the hit counters of this project's own weather stub. */
export async function readHits(
  request: APIRequestContext,
  testInfo: TestInfo,
): Promise<StubHits> {
  const { stubURL } = testInfo.project.metadata as { stubURL: string }
  const response = await request.get(`${stubURL}/__hits`)

  expect(response.status()).toBe(200)

  return response.json()
}

export async function getConditions(request: APIRequestContext) {
  const response = await request.get('/api/conditions')

  expect(response.status()).toBe(200)
  expect(response.headers()['cache-control']).toBe('no-store')

  return response.json()
}
