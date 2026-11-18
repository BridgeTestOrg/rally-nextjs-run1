// @vitest-environment node
import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { createWeatherStub, resolvePort } from '../e2e/weather-stub.mjs'

let server: Server
let origin: string

type Period = {
  startTime: string
  endTime: string
  temperature: number
  windSpeed: string
  probabilityOfPrecipitation: { value: number }
}

beforeEach(async () => {
  server = createWeatherStub()
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

afterEach(async () => {
  await new Promise((resolve) => server.close(resolve))
})

test('answers the health check', async () => {
  expect((await fetch(`${origin}/healthz`)).status).toBe(200)
})

test('points link to an hourly forecast on the same server', async () => {
  const response = await fetch(`${origin}/points/39.5,-104.9`)

  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({
    properties: { forecastHourly: `${origin}/forecast/39.5,-104.9/hourly` },
  })
})

describe('hourly forecast', () => {
  async function periods(): Promise<Period[]> {
    const points = await (await fetch(`${origin}/points/39.5,-104.9`)).json()
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
    ['the start of 17 Nov in New York', '2026-11-17T00:00:00-05:00'],
    ['the end of 25 Nov in Los Angeles', '2026-11-25T23:59:00-08:00'],
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

test.each(['/', '/points/not-a-point', '/forecast/1,2', '/other'])(
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
})
