// @vitest-environment node
import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
  createWeatherStub,
  hourlyPeriods,
  resolvePort,
  SCENARIOS,
} from '../e2e/weather-stub.mjs'

let server: Server
let origin: string

const DENVER_POINT = '39.5480,-104.9690'
const SANTA_MONICA_POINT = '34.0063,-118.4823'
const HOBOKEN_POINT = '40.7370,-74.0283'

async function start(scenario?: string) {
  server = createWeatherStub(scenario ? { scenario } : undefined)
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
}

async function restart(scenario: string) {
  await new Promise((resolve) => server.close(resolve))
  await start(scenario)
}

async function hits() {
  return (await fetch(`${origin}/__hits`)).json()
}

type Period = {
  startTime: string
  endTime: string
  temperature: number
  temperatureUnit: string
  windSpeed: string
  probabilityOfPrecipitation: { value: number }
}

beforeEach(async () => {
  await start()
})

afterEach(async () => {
  vi.restoreAllMocks()
  await new Promise((resolve) => server.close(resolve))
})

test('answers the health check', async () => {
  expect((await fetch(`${origin}/healthz`)).status).toBe(200)
})

test('points link to an hourly forecast on the same server', async () => {
  const response = await fetch(`${origin}/points/${DENVER_POINT}`)

  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({
    properties: { forecastHourly: `${origin}/gridpoints/CO/hourly` },
  })
})

describe('hourly forecast', () => {
  async function periods(): Promise<Period[]> {
    const points = await (await fetch(`${origin}/points/${DENVER_POINT}`)).json()
    const forecast = await fetch(points.properties.forecastHourly)

    expect(forecast.status).toBe(200)

    return (await forecast.json()).properties.periods
  }

  test('uses the National Weather Service period shape', async () => {
    const [first] = await periods()

    expect(first).toEqual({
      startTime: expect.any(String),
      endTime: expect.any(String),
      temperature: expect.any(Number),
      temperatureUnit: 'F',
      windSpeed: expect.stringMatching(/^\d+ mph$/),
      probabilityOfPrecipitation: { value: expect.any(Number) },
    })
  })

  test('has contiguous hours', async () => {
    const all = await periods()

    all.forEach((period) => {
      expect(Date.parse(period.endTime) - Date.parse(period.startTime)).toBe(
        3_600_000,
      )
    })
    all.slice(1).forEach((period, index) => {
      expect(period.startTime).toBe(all[index].endTime)
    })
  })

  test.each([
    ['the start of 16 Nov in Denver', '2026-11-16T00:00:00-07:00'],
    ['the end of 23 Nov in Denver', '2026-11-23T23:59:00-07:00'],
  ])('covers %s', async (_name, instant) => {
    const target = Date.parse(instant)
    const all = await periods()

    expect(
      all.some(
        (period) =>
          Date.parse(period.startTime) <= target &&
          target < Date.parse(period.endTime),
      ),
    ).toBe(true)
  })
})

test.each([
  '/',
  '/points/not-a-point',
  '/forecast/1,2',
  '/gridpoints/TX/hourly',
  '/other',
])(
  '%s returns a JSON 404',
  async (path) => {
    const response = await fetch(`${origin}${path}`)

    expect(response.status).toBe(404)
    expect(response.headers.get('content-type')).toContain('application/json')
    expect(await response.json()).toEqual({ error: 'Not found' })
  },
)

test('other methods return a JSON 404', async () => {
  const response = await fetch(`${origin}/healthz`, { method: 'POST' })

  expect(response.status).toBe(404)
})

describe('resolvePort', () => {
  test('defaults to 4010', () => {
    expect(resolvePort([], {})).toBe(4010)
  })

  test('reads PORT', () => {
    expect(resolvePort([], { PORT: '4555' })).toBe(4555)
  })

  test('prefers --port', () => {
    expect(resolvePort(['--port', '4666'], { PORT: '4555' })).toBe(4666)
  })

  test('reads STUB_PORT ahead of PORT', () => {
    expect(resolvePort([], { STUB_PORT: '4777', PORT: '4555' })).toBe(4777)
  })

  test('prefers --port over STUB_PORT', () => {
    expect(resolvePort(['--port', '4666'], { STUB_PORT: '4777' })).toBe(4666)
  })
})

describe('hourlyPeriods', () => {
  test.each([
    ['CO', '-07:00', 41, '14 mph', 10],
    ['CA', '-08:00', 66, '8 mph', 0],
    ['NJ', '-05:00', 47, '9 mph', 70],
  ])('gives %s its comp values', (state, offset, temperature, wind, rain) => {
    const periods = hourlyPeriods(state)

    expect(periods).toHaveLength(192)
    expect(periods[0]).toEqual({
      startTime: `2026-11-16T00:00:00${offset}`,
      endTime: `2026-11-16T01:00:00${offset}`,
      temperature,
      temperatureUnit: 'F',
      windSpeed: wind,
      probabilityOfPrecipitation: { value: rain },
    })
    expect(periods.at(-1)?.endTime).toBe(`2026-11-24T00:00:00${offset}`)
  })
})

describe('city mapping', () => {
  test.each([
    [DENVER_POINT, 'CO'],
    ['39.5297,-104.9386', 'CO'],
    [SANTA_MONICA_POINT, 'CA'],
    ['34.0223,-118.4711', 'CA'],
    [HOBOKEN_POINT, 'NJ'],
    ['40.7425,-74.0306', 'NJ'],
  ])('%s belongs to %s', async (point, state) => {
    const body = await (await fetch(`${origin}/points/${point}`)).json()

    expect(body.properties.forecastHourly).toBe(
      `${origin}/gridpoints/${state}/hourly`,
    )
  })
})

describe('/__hits', () => {
  test('starts at zero', async () => {
    expect(await hits()).toEqual({
      points: { CO: 0, CA: 0, NJ: 0 },
      hourly: { CO: 0, CA: 0, NJ: 0 },
      userAgent: { CO: null, CA: null, NJ: null },
    })
  })

  test('counts each request and keeps the last User-Agent', async () => {
    const headers = { 'User-Agent': 'Rally test' }

    await fetch(`${origin}/points/${DENVER_POINT}`, { headers })
    await fetch(`${origin}/points/${DENVER_POINT}`)
    await fetch(`${origin}/gridpoints/CO/hourly`, { headers })

    expect(await hits()).toMatchObject({
      points: { CO: 2, CA: 0, NJ: 0 },
      hourly: { CO: 1, CA: 0, NJ: 0 },
      userAgent: { CO: 'Rally test', CA: null, NJ: null },
    })
  })

  test('reading it changes nothing', async () => {
    const first = await hits()

    expect(await hits()).toEqual(first)
  })

  test('cannot be written to', async () => {
    const response = await fetch(`${origin}/__hits`, { method: 'POST' })

    expect(response.status).toBe(404)
  })
})

describe('scenarios', () => {
  const statusOf = async (point: string) =>
    (await fetch(`${origin}/points/${point}`)).status

  /**
   * Records the stub's delays and answers without waiting for them. Only its
   * whole-second delays are caught, because fetch sets timers of its own.
   */
  function captureDelays() {
    const delays: number[] = []
    const realSetTimeout = globalThis.setTimeout

    vi.spyOn(globalThis, 'setTimeout').mockImplementation(((
      callback: (...args: unknown[]) => void,
      delay?: number,
      ...args: unknown[]
    ) => {
      if (delay === 2000 || delay === 4000) {
        delays.push(delay)

        return realSetTimeout(callback, 0, ...args)
      }

      return realSetTimeout(callback, delay, ...args)
    }) as typeof setTimeout)

    return delays
  }

  test('lists every scenario', () => {
    expect(SCENARIOS).toEqual([
      'ok',
      'weather-slow',
      'weather-timeout',
      'weather-fail-one',
      'weather-fail-all',
    ])
  })

  test('rejects an unknown scenario', () => {
    expect(() => createWeatherStub({ scenario: 'nope' })).toThrow(/nope/)
  })

  test('ok answers without delay', async () => {
    const delays = captureDelays()

    await fetch(`${origin}/points/${DENVER_POINT}`)
    await fetch(`${origin}/gridpoints/CO/hourly`)

    expect(delays).toEqual([])
  })

  test('weather-fail-one fails only Hoboken and still counts it', async () => {
    await restart('weather-fail-one')

    expect(await statusOf(DENVER_POINT)).toBe(200)
    expect(await statusOf(SANTA_MONICA_POINT)).toBe(200)
    expect(await statusOf(HOBOKEN_POINT)).toBe(500)
    expect((await hits()).points).toEqual({ CO: 1, CA: 1, NJ: 1 })
  })

  test('weather-fail-all fails every city', async () => {
    await restart('weather-fail-all')

    expect(await statusOf(DENVER_POINT)).toBe(500)
    expect(await statusOf(SANTA_MONICA_POINT)).toBe(500)
    expect(await statusOf(HOBOKEN_POINT)).toBe(500)
  })

  test('weather-slow delays only the hourly response, by 2 s', async () => {
    await restart('weather-slow')
    const delays = captureDelays()

    await fetch(`${origin}/points/${DENVER_POINT}`)
    expect(delays).toEqual([])

    const hourly = await fetch(`${origin}/gridpoints/CO/hourly`)

    expect(delays).toEqual([2000])
    expect((await hourly.json()).properties.periods[0].temperature).toBe(41)
  })

  test('weather-timeout delays every weather response by 4 s', async () => {
    await restart('weather-timeout')
    const delays = captureDelays()

    await fetch(`${origin}/points/${DENVER_POINT}`)
    await fetch(`${origin}/gridpoints/CO/hourly`)

    expect(delays).toEqual([4000, 4000])
  })

  test('weather-timeout leaves the health check and counters fast', async () => {
    await restart('weather-timeout')
    const delays = captureDelays()

    await fetch(`${origin}/healthz`)
    await hits()

    expect(delays).toEqual([])
  })
})
