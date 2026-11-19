// @vitest-environment node
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import courtsFile from '../data/courts.json'

vi.mock('next/cache', () => ({ cacheLife: vi.fn() }))

const BASE = 'http://weather.test'
const RALLY_NOW = '2026-11-17T17:40:00-07:00'
const INSTANT = new Date(RALLY_NOW)
const STATE_BY_LAT: Record<string, string> = {
  '39.5480': 'CO',
  '34.0063': 'CA',
  '40.7370': 'NJ',
}

type Handler = (url: string, init: RequestInit) => Response | Promise<Response>

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status })
}

function period(overrides: Record<string, unknown> = {}) {
  return {
    startTime: '2026-11-17T00:00:00-07:00',
    endTime: '2026-11-18T00:00:00-07:00',
    temperature: 41,
    temperatureUnit: 'F',
    windSpeed: '14 mph',
    probabilityOfPrecipitation: { value: 10 },
    ...overrides,
  }
}

/** A coverage window wide enough for every city's next slot. */
function widePeriod(overrides: Record<string, unknown> = {}) {
  return period({
    startTime: '2026-11-17T00:00:00Z',
    endTime: '2026-11-19T00:00:00Z',
    ...overrides,
  })
}

function weatherService(periods: unknown[] = [period()]): Handler {
  return (url) =>
    url.includes('/points/')
      ? json({ properties: { forecastHourly: `${BASE}/gridpoints/X/hourly` } })
      : json({ properties: { periods } })
}

function stubFetch(handler: Handler) {
  const fake = vi.fn((url: string, init: RequestInit) =>
    Promise.resolve().then(() => handler(url, init)),
  )

  vi.stubGlobal('fetch', fake)

  return fake
}

function stateOf(url: string): string {
  const lat = /\/points\/(-?[\d.]+),/.exec(url)?.[1] ?? ''

  return STATE_BY_LAT[lat]
}

/** Replaces AbortSignal.timeout with signals the test aborts by hand. */
function controlledDeadlines() {
  const deadlines: { ms: number; controller: AbortController }[] = []
  const expire = (matches: (ms: number) => boolean) =>
    deadlines
      .filter(({ ms }) => matches(ms))
      .forEach(({ controller }) =>
        controller.abort(new DOMException('Timed out', 'TimeoutError')),
      )

  vi.spyOn(AbortSignal, 'timeout').mockImplementation((ms) => {
    const controller = new AbortController()

    deadlines.push({ ms, controller })

    return controller.signal
  })

  return {
    expireBudgets: () => expire((ms) => ms === 3000),
    expireAll: () => expire(() => true),
  }
}

beforeEach(() => {
  vi.resetModules()
  vi.stubEnv('RALLY_NOW', RALLY_NOW)
  vi.stubEnv('WEATHER_URL', BASE)
})

afterEach(() => {
  vi.doUnmock('@/lib/weather')
  vi.doUnmock('@/data/courts.json')
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('readWeatherSettings', () => {
  test('defaults to the National Weather Service and the live clock', async () => {
    vi.stubEnv('WEATHER_URL', undefined)
    vi.stubEnv('RALLY_NOW', undefined)
    const { readWeatherSettings } = await import('../lib/weather')

    expect(readWeatherSettings()).toEqual({
      weatherUrl: 'https://api.weather.gov',
      clockKey: 'live',
    })
  })

  test('reads both settings', async () => {
    const { readWeatherSettings } = await import('../lib/weather')

    expect(readWeatherSettings()).toEqual({
      weatherUrl: BASE,
      clockKey: RALLY_NOW,
    })
  })

  test.each([
    ['a value that is not a URL', 'not a url', /not a valid URL/],
    ['an empty value', '', /not a valid URL/],
    ['another protocol', 'ftp://weather.test', /http or https/],
    ['credentials', 'http://user:hunter2@weather.test', /credentials/],
  ])('rejects %s without echoing it', async (_name, value, message) => {
    vi.stubEnv('WEATHER_URL', value)
    const { isWeatherFailure, readWeatherSettings } = await import(
      '../lib/weather'
    )
    let thrown: unknown

    try {
      readWeatherSettings()
    } catch (error) {
      thrown = error
    }

    expect((thrown as Error).message).toMatch(message)
    expect((thrown as Error).message).not.toContain('hunter2')
    expect(isWeatherFailure(thrown)).toBe(false)
  })
})

describe('fetchForecast', () => {
  async function run(signal = new AbortController().signal) {
    const { fetchForecast } = await import('../lib/weather')

    return fetchForecast(39.548, -104.969, BASE, signal)
  }

  async function failure(run: Promise<unknown>) {
    const { isWeatherFailure } = await import('../lib/weather')
    const error = await run.then(
      () => {
        throw new Error('Expected the forecast to fail.')
      },
      (reason: unknown) => reason,
    )

    expect(isWeatherFailure(error)).toBe(true)

    return error as Error
  }

  test('calls points, then the hourly URL it returns', async () => {
    const fake = stubFetch(weatherService())

    await run()

    expect(fake.mock.calls.map(([url]) => url)).toEqual([
      `${BASE}/points/39.5480,-104.9690`,
      `${BASE}/gridpoints/X/hourly`,
    ])
  })

  test('sends the same safe options on both calls', async () => {
    const fake = stubFetch(weatherService())
    const { signal } = new AbortController()

    await run(signal)

    for (const [, init] of fake.mock.calls) {
      expect(init).toEqual({
        headers: {
          'User-Agent': 'Rally test app (hello@example.com)',
          Accept: 'application/geo+json',
        },
        redirect: 'error',
        cache: 'no-store',
        signal,
      })
    }
  })

  test('keeps a path on the weather URL', async () => {
    const fake = stubFetch((url) =>
      url.includes('/points/')
        ? json({ properties: { forecastHourly: `${BASE}/nws/hourly` } })
        : json({ properties: { periods: [period()] } }),
    )
    const { fetchForecast } = await import('../lib/weather')

    await fetchForecast(1, 2, `${BASE}/nws/`, new AbortController().signal)

    expect(fake.mock.calls[0][0]).toBe(`${BASE}/nws/points/1.0000,2.0000`)
  })

  test('normalizes a period', async () => {
    stubFetch(weatherService())

    expect(await run()).toEqual([
      {
        start: '2026-11-17T00:00:00-07:00',
        end: '2026-11-18T00:00:00-07:00',
        tempF: 41,
        windMph: 14,
        rainPct: 10,
      },
    ])
  })

  test('takes the largest number in a wind range', async () => {
    stubFetch(weatherService([period({ windSpeed: '10 to 15 mph' })]))

    expect((await run())[0].windMph).toBe(15)
  })

  test('counts null rain as zero', async () => {
    stubFetch(
      weatherService([period({ probabilityOfPrecipitation: { value: null } })]),
    )

    expect((await run())[0].rainPct).toBe(0)
  })

  test.each<[string, Handler]>([
    ['points status', () => json({}, 500)],
    [
      'hourly status',
      (url) =>
        url.includes('/points/')
          ? json({ properties: { forecastHourly: `${BASE}/h` } })
          : json({}, 503),
    ],
    ['a body that is not JSON', () => new Response('<html>')],
    ['no properties', () => json({})],
    ['no forecastHourly', () => json({ properties: {} })],
    ['a bad forecastHourly', () => json({ properties: { forecastHourly: '::' } })],
  ])('fails on %s', async (_name, handler) => {
    stubFetch(handler)

    await failure(run())
  })

  test.each<[string, unknown[]]>([
    ['no periods', []],
    ['a period that is not an object', [null]],
    ['Celsius', [period({ temperatureUnit: 'C' })]],
    ['no temperature', [period({ temperature: undefined })]],
    ['text temperature', [period({ temperature: '41' })]],
    ['no wind', [period({ windSpeed: undefined })]],
    ['wind with no number', [period({ windSpeed: 'calm' })]],
    ['no rain object', [period({ probabilityOfPrecipitation: undefined })]],
    ['no rain value', [period({ probabilityOfPrecipitation: {} })]],
    ['text rain', [period({ probabilityOfPrecipitation: { value: '5' } })]],
    ['a bad start', [period({ startTime: 'soon' })]],
    ['an end before the start', [period({ endTime: '2026-11-16T00:00:00Z' })]],
  ])('fails on a forecast with %s', async (_name, periods) => {
    stubFetch(weatherService(periods))

    await failure(run())
  })

  test.each([
    ['another origin', 'http://elsewhere.test/hourly'],
    ['another port', 'http://weather.test:8080/hourly'],
    ['another protocol', 'https://weather.test/hourly'],
    ['credentials', 'http://user:secret@weather.test/hourly'],
  ])('never requests an hourly URL with %s', async (_name, forecastHourly) => {
    const fake = stubFetch(() => json({ properties: { forecastHourly } }))

    await failure(run())

    expect(fake).toHaveBeenCalledTimes(1)
  })

  test('treats a refused redirect as a failure and keeps the cause', async () => {
    const cause = new TypeError('unexpected redirect')

    stubFetch(() => {
      throw cause
    })

    expect((await failure(run())).cause).toBe(cause)
  })

  test('does not start the hourly request after the budget ends', async () => {
    const controller = new AbortController()
    const service = weatherService()
    const fake = stubFetch((url, init) => {
      controller.abort()

      return service(url, init)
    })

    await failure(run(controller.signal))

    expect(fake).toHaveBeenCalledTimes(1)
  })

  test('gives up when the signal aborts a hanging request', async () => {
    const controller = new AbortController()

    stubFetch(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () =>
            reject(init.signal?.reason),
          )
        }),
    )

    const pending = failure(run(controller.signal))

    await vi.waitFor(() => expect(fetch).toHaveBeenCalled())
    controller.abort(new DOMException('Timed out', 'TimeoutError'))

    await pending
  })
})

describe('isFresh', () => {
  const STAMP = '2026-11-18T00:30:00.000Z'

  test.each([
    ['at the same moment', '2026-11-18T00:30:00.000Z', true],
    ['one minute later', '2026-11-18T00:31:00.000Z', true],
    ['at exactly ten minutes', '2026-11-18T00:40:00.000Z', true],
    ['just past ten minutes', '2026-11-18T00:40:00.001Z', false],
    ['before the stamp', '2026-11-18T00:29:59.999Z', false],
  ])('%s', async (_name, instant, expected) => {
    const { isFresh } = await import('../lib/weather')

    expect(isFresh(STAMP, new Date(instant))).toBe(expected)
  })

  test('rejects an unreadable stamp', async () => {
    const { isFresh } = await import('../lib/weather')

    expect(isFresh('soon', new Date(STAMP))).toBe(false)
  })
})

describe('getForecast', () => {
  const request = {
    cityKey: 'CO',
    lat: 39.548,
    lon: -104.969,
    settings: { weatherUrl: BASE, clockKey: RALLY_NOW },
  }

  async function forecastAt(instant: Date, signal?: AbortSignal) {
    const { getForecast } = await import('../lib/weather')

    return getForecast(
      request,
      instant,
      signal ?? new AbortController().signal,
    )
  }

  test('uses a current result and stamps it from the clock', async () => {
    const fake = stubFetch(weatherService())
    const forecast = await forecastAt(INSTANT)

    expect(forecast.fetchedAt).toBe('2026-11-18T00:40:00.000Z')
    expect(fake).toHaveBeenCalledTimes(2)
  })

  test('accepts a stamp made just after the request began', async () => {
    const fake = stubFetch(weatherService())

    await forecastAt(new Date(INSTANT.getTime() - 1000))

    expect(fake).toHaveBeenCalledTimes(2)
  })

  test('fetches again when the result is over ten minutes old', async () => {
    const fake = stubFetch(weatherService())

    await forecastAt(new Date(INSTANT.getTime() + 10 * 60 * 1000 + 1))

    expect(fake).toHaveBeenCalledTimes(4)
  })

  test('fetches again when the stamp is beyond the budget', async () => {
    const fake = stubFetch(weatherService())

    await forecastAt(new Date(INSTANT.getTime() - 60 * 1000))

    expect(fake).toHaveBeenCalledTimes(4)
  })

  test('starts no fallback after the deadline', async () => {
    const { isWeatherFailure } = await import('../lib/weather')
    const fake = stubFetch(weatherService())
    const controller = new AbortController()

    controller.abort()

    const error = await forecastAt(
      new Date(INSTANT.getTime() + 11 * 60 * 1000),
      controller.signal,
    ).catch((reason: unknown) => reason)

    expect(isWeatherFailure(error)).toBe(true)
    expect(fake).toHaveBeenCalledTimes(2)
  })
})

describe('getConditions', () => {
  const VALUES: Record<string, Record<string, unknown>> = {
    CO: { temperature: 41, windSpeed: '14 mph', rain: 10 },
    CA: { temperature: 66, windSpeed: '8 mph', rain: 0 },
    NJ: { temperature: 47, windSpeed: '9 mph', rain: 70 },
  }

  function cityService(failing: string[] = []): Handler {
    return (url) => {
      if (url.includes('/points/')) {
        const state = stateOf(url)

        return failing.includes(state)
          ? json({}, 500)
          : json({
              properties: { forecastHourly: `${BASE}/gridpoints/${state}` },
            })
      }

      const { temperature, windSpeed, rain } = VALUES[url.slice(-2)]

      return json({
        properties: {
          periods: [
            widePeriod({
              temperature,
              windSpeed,
              probabilityOfPrecipitation: { value: rain },
            }),
          ],
        },
      })
    }
  }

  const CO_OK = {
    city: 'Highlands Ranch',
    state: 'CO',
    available: true,
    nextOpen: {
      courtId: 'northridge-park',
      courtName: 'Northridge Park',
      time: '2026-11-17T18:00:00-07:00',
    },
    tempF: 41,
    windMph: 14,
    rainPct: 10,
    verdict: 'breezy',
    updatedAt: '2026-11-17T17:40:00-07:00',
    timeZone: 'America/Denver',
    checkedAt: '2026-11-17T17:40:00-07:00',
  }

  const NJ_UNAVAILABLE = {
    city: 'Hoboken',
    state: 'NJ',
    available: false,
    nextOpen: {
      courtId: 'pier-a-park',
      courtName: 'Pier A Park',
      time: '2026-11-17T20:30:00-05:00',
    },
    tempF: null,
    windMph: null,
    rainPct: null,
    verdict: null,
    updatedAt: null,
    timeZone: 'America/New_York',
    checkedAt: '2026-11-17T19:40:00-05:00',
  }

  async function conditions() {
    const { getConditions } = await import('../lib/conditions')

    return getConditions(INSTANT)
  }

  test('returns the three cities in order with their verdicts', async () => {
    stubFetch(cityService())

    const entries = await conditions()

    expect(entries.map((entry) => entry.state)).toEqual(['CO', 'CA', 'NJ'])
    expect(entries[0]).toEqual(CO_OK)
    expect(entries[1]).toMatchObject({
      available: true,
      tempF: 66,
      windMph: 8,
      rainPct: 0,
      verdict: 'playable',
      updatedAt: '2026-11-17T16:40:00-08:00',
      checkedAt: '2026-11-17T16:40:00-08:00',
    })
    expect(entries[2]).toMatchObject({
      available: true,
      verdict: 'not_today',
      updatedAt: '2026-11-17T19:40:00-05:00',
    })
  })

  test('asks for the next open court\'s location', async () => {
    const fake = stubFetch(cityService())

    await conditions()

    expect(fake.mock.calls.map(([url]) => url)).toEqual(
      expect.arrayContaining([
        `${BASE}/points/39.5480,-104.9690`,
        `${BASE}/points/34.0063,-118.4823`,
        `${BASE}/points/40.7370,-74.0283`,
      ]),
    )
  })

  test('fetches the cities at the same time', async () => {
    let release = () => {}
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const service = cityService()
    const fake = stubFetch(async (url, init) => {
      await gate

      return service(url, init)
    })
    const pending = conditions()

    await vi.waitFor(() => expect(fake).toHaveBeenCalledTimes(3))
    release()

    expect(await pending).toHaveLength(3)
  })

  test('keeps the other cities when one fails, and logs nothing', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    stubFetch(cityService(['NJ']))

    const entries = await conditions()

    expect(entries[0]).toEqual(CO_OK)
    expect(entries[1].available).toBe(true)
    expect(entries[2]).toEqual(NJ_UNAVAILABLE)
    expect(log).not.toHaveBeenCalled()
  })

  test('resolves with every city unavailable when all fail', async () => {
    stubFetch(cityService(['CO', 'CA', 'NJ']))

    const entries = await conditions()

    expect(entries.map((entry) => entry.available)).toEqual([
      false,
      false,
      false,
    ])
    expect(entries.every((entry) => entry.nextOpen !== null)).toBe(true)
  })

  describe('choosing a forecast period', () => {
    const SLOT = '2026-11-17T18:00:00-07:00'
    const HOUR_BEFORE = '2026-11-17T17:00:00-07:00'
    const HOUR_AFTER = '2026-11-17T19:00:00-07:00'

    async function coWith(periods: unknown[]) {
      stubFetch(weatherService(periods))

      return (await conditions())[0]
    }

    test('includes a period starting at the slot', async () => {
      const entry = await coWith([
        period({ startTime: SLOT, endTime: HOUR_AFTER, temperature: 50 }),
      ])

      expect(entry).toMatchObject({ available: true, tempF: 50 })
    })

    test('excludes a period ending at the slot', async () => {
      const entry = await coWith([
        period({ startTime: HOUR_BEFORE, endTime: SLOT, temperature: 50 }),
        period({ startTime: SLOT, endTime: HOUR_AFTER, temperature: 60 }),
      ])

      expect(entry.tempF).toBe(60)
    })

    test('is unavailable when no period covers the slot', async () => {
      const entry = await coWith([
        period({ startTime: HOUR_BEFORE, endTime: SLOT }),
      ])

      expect(entry).toMatchObject({
        available: false,
        tempF: null,
        verdict: null,
        updatedAt: null,
        nextOpen: { courtId: 'northridge-park' },
      })
    })
  })

  test('makes no request for a city with no next slot', async () => {
    const file = structuredClone(courtsFile)

    for (const court of file.courts.filter(({ state }) => state === 'CO')) {
      court.slots = {
        mon: [],
        tue: [],
        wed: [],
        thu: [],
        fri: [],
        sat: [],
        sun: [],
      }
    }

    vi.doMock('@/data/courts.json', () => ({ default: file }))

    const fake = stubFetch(cityService())
    const entries = await conditions()

    expect(entries[0]).toMatchObject({
      state: 'CO',
      available: false,
      nextOpen: null,
      tempF: null,
    })
    expect(fake.mock.calls.map(([url]) => stateOf(url))).not.toContain('CO')
  })

  test('marks every city unavailable after its deadline', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const deadlines = controlledDeadlines()
    const fake = stubFetch(() => new Promise<Response>(() => undefined))
    const pending = conditions()

    await vi.waitFor(() => expect(fake).toHaveBeenCalledTimes(3))
    deadlines.expireAll()

    const entries = await pending

    expect(entries.map((entry) => entry.available)).toEqual([
      false,
      false,
      false,
    ])
    expect(entries[2]).toEqual(NJ_UNAVAILABLE)
    expect(AbortSignal.timeout).toHaveBeenCalledWith(3000)
    expect(log).not.toHaveBeenCalled()
  })

  describe('with a stubbed forecast lookup', () => {
    async function mockGetForecast(
      getForecast: (...args: never[]) => Promise<unknown>,
    ) {
      const actual =
        await vi.importActual<typeof import('../lib/weather')>('../lib/weather')

      vi.doMock('@/lib/weather', () => ({ ...actual, getForecast }))
    }

    test('stops waiting for a lookup that outlives the deadline', async () => {
      const deadlines = controlledDeadlines()
      const getForecast = vi.fn(() => new Promise(() => undefined))

      await mockGetForecast(getForecast)

      const pending = conditions()

      await vi.waitFor(() => expect(getForecast).toHaveBeenCalledTimes(3))
      deadlines.expireAll()

      expect((await pending)[0].available).toBe(false)
    })

    test('gives a timed-out lookup a moment to finish failing', async () => {
      const deadlines = controlledDeadlines()
      const getForecast = vi.fn(() => new Promise(() => undefined))
      let settled = false

      await mockGetForecast(getForecast)

      const pending = conditions().finally(() => {
        settled = true
      })

      await vi.waitFor(() => expect(getForecast).toHaveBeenCalledTimes(3))
      deadlines.expireBudgets()
      await new Promise((resolve) => setImmediate(resolve))
      expect(settled).toBe(false)

      deadlines.expireAll()

      expect((await pending)[0].available).toBe(false)
    })

    test('aborts the lookup signal at the three second budget', async () => {
      const deadlines = controlledDeadlines()
      const signals: AbortSignal[] = []
      const getForecast = vi.fn(
        (_request: unknown, _instant: Date, signal: AbortSignal) => {
          signals.push(signal)

          return new Promise(() => undefined)
        },
      )

      await mockGetForecast(getForecast)

      const pending = conditions()

      await vi.waitFor(() => expect(signals).toHaveLength(3))
      deadlines.expireBudgets()
      expect(signals.every((signal) => signal.aborted)).toBe(true)

      deadlines.expireAll()
      await pending
    })

    test('reports an unexpected error once with its city', async () => {
      const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
      const bug = new TypeError('bug')

      await mockGetForecast(() => Promise.reject(bug))

      const entries = await conditions()

      expect(entries[0].available).toBe(false)
      expect(log).toHaveBeenCalledTimes(3)
      expect(log).toHaveBeenCalledWith(expect.stringContaining('CO'), bug)
      expect(log).toHaveBeenCalledWith(expect.stringContaining('CA'), bug)
      expect(log).toHaveBeenCalledWith(expect.stringContaining('NJ'), bug)
    })

    test('reports an unexpected error that arrives after the deadline', async () => {
      const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
      const deadlines = controlledDeadlines()
      const bug = new TypeError('late bug')
      const rejecters: ((error: unknown) => void)[] = []
      const getForecast = vi.fn(
        () => new Promise((_resolve, reject) => rejecters.push(reject)),
      )

      await mockGetForecast(getForecast)

      const pending = conditions()

      await vi.waitFor(() => expect(getForecast).toHaveBeenCalledTimes(3))
      deadlines.expireAll()
      await pending
      expect(log).not.toHaveBeenCalled()

      rejecters[0](bug)

      await vi.waitFor(() => expect(log).toHaveBeenCalledTimes(1))
      expect(log).toHaveBeenCalledWith(expect.stringContaining('CO'), bug)
    })

    test('stays quiet about an expected failure after the deadline', async () => {
      const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
      const deadlines = controlledDeadlines()
      const { weatherFailure } = await import('../lib/weather')
      const rejecters: ((error: unknown) => void)[] = []
      const getForecast = vi.fn(
        () => new Promise((_resolve, reject) => rejecters.push(reject)),
      )

      await mockGetForecast(getForecast)

      const pending = conditions()

      await vi.waitFor(() => expect(getForecast).toHaveBeenCalledTimes(3))
      deadlines.expireAll()
      await pending
      rejecters.forEach((reject) => reject(weatherFailure('late')))
      await new Promise((resolve) => setImmediate(resolve))

      expect(log).not.toHaveBeenCalled()
    })

    test('recognizes a failure rebuilt from its digest alone', async () => {
      // What a caller receives after a "use cache" boundary in production.
      const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
      const { weatherFailure } = await import('../lib/weather')
      const { digest } = weatherFailure('x') as Error & { digest: string }
      const rebuilt = Object.assign(new Error('Hidden in production'), {
        digest,
      })

      await mockGetForecast(() => Promise.reject(rebuilt))

      expect((await conditions())[0].available).toBe(false)
      expect(log).not.toHaveBeenCalled()
    })
  })

  test('reports a bad weather setting and still answers', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const fake = stubFetch(cityService())

    vi.stubEnv('WEATHER_URL', 'ftp://weather.test')

    const entries = await conditions()

    expect(entries.map((entry) => entry.available)).toEqual([
      false,
      false,
      false,
    ])
    expect(entries[0].nextOpen?.courtId).toBe('northridge-park')
    expect(fake).not.toHaveBeenCalled()
    expect(log).toHaveBeenCalledTimes(3)
  })
})
