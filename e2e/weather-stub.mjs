import { readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const COORDINATES = String.raw`(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)`
const POINTS_PATH = new RegExp(`^/points/${COORDINATES}$`)
const HOURLY_PATH = /^\/gridpoints\/(CO|CA|NJ)\/hourly$/

export const SCENARIOS = [
  'ok',
  'weather-slow',
  'weather-timeout',
  'weather-fail-one',
  'weather-fail-all',
]

const STATES = ['CO', 'CA', 'NJ']

// The values in comp 04, with each city's standard UTC offset. DST ended on
// 1 Nov 2026, so the offset holds across the whole forecast.
const CITY_WEATHER = {
  CO: { offset: '-07:00', temperature: 41, windSpeed: '14 mph', rain: 10 },
  CA: { offset: '-08:00', temperature: 66, windSpeed: '8 mph', rain: 0 },
  NJ: { offset: '-05:00', temperature: 47, windSpeed: '9 mph', rain: 70 },
}

const FIRST_LOCAL_HOUR = Date.UTC(2026, 10, 16, 0)
const PERIOD_COUNT = 192
const HOUR_MS = 60 * 60 * 1000
const SLOW_HOURLY_MS = 2000
const TIMEOUT_MS = 4000

const COURT_POINTS = JSON.parse(
  readFileSync(new URL('../data/courts.json', import.meta.url), 'utf8'),
).courts.map(({ state, lat, lon }) => ({ state, lat, lon }))

function nearestState(lat, lon) {
  const distance = (court) => (court.lat - lat) ** 2 + (court.lon - lon) ** 2

  return COURT_POINTS.reduce((nearest, court) =>
    distance(court) < distance(nearest) ? court : nearest,
  ).state
}

function localTime(epochMs, offset) {
  return `${new Date(epochMs).toISOString().slice(0, 19)}${offset}`
}

/** 192 one-hour periods from 16 Nov 00:00 to 24 Nov 00:00, city local time. */
export function hourlyPeriods(state) {
  const { offset, temperature, windSpeed, rain } = CITY_WEATHER[state]

  return Array.from({ length: PERIOD_COUNT }, (_, index) => {
    const start = FIRST_LOCAL_HOUR + index * HOUR_MS

    return {
      startTime: localTime(start, offset),
      endTime: localTime(start + HOUR_MS, offset),
      temperature,
      temperatureUnit: 'F',
      windSpeed,
      probabilityOfPrecipitation: { value: rain },
    }
  })
}

function sendJson(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json' })
  response.end(JSON.stringify(body))
}

function perState(value) {
  return Object.fromEntries(STATES.map((state) => [state, value]))
}

function pointsFail(scenario, state) {
  return (
    scenario === 'weather-fail-all' ||
    (scenario === 'weather-fail-one' && state === 'NJ')
  )
}

function delayFor(scenario, leg) {
  if (scenario === 'weather-timeout') {
    return TIMEOUT_MS
  }

  return scenario === 'weather-slow' && leg === 'hourly' ? SLOW_HOURLY_MS : 0
}

/** Answers after `delay`, or not at all if the client has gone by then. */
function respondAfter(response, delay, respond) {
  if (delay === 0) {
    respond()
    return
  }

  const timer = setTimeout(respond, delay)

  response.once('close', () => clearTimeout(timer))
}

/**
 * A local stand-in for the National Weather Service. The scenario is fixed for
 * the life of the process: there is no control endpoint and no reset.
 */
export function createWeatherStub({ scenario = 'ok' } = {}) {
  if (!SCENARIOS.includes(scenario)) {
    throw new Error(`Unknown weather scenario "${scenario}".`)
  }

  const hits = {
    points: perState(0),
    hourly: perState(0),
    userAgent: perState(null),
  }

  function record(leg, state, request) {
    hits[leg][state] += 1
    hits.userAgent[state] = request.headers['user-agent'] ?? null
  }

  const server = createServer((request, response) => {
    const { pathname } = new URL(request.url, 'http://127.0.0.1')

    if (request.method !== 'GET') {
      sendJson(response, 404, { error: 'Not found' })
      return
    }

    if (pathname === '/healthz') {
      sendJson(response, 200, { status: 'ok' })
      return
    }

    if (pathname === '/__hits') {
      sendJson(response, 200, hits)
      return
    }

    const point = pathname.match(POINTS_PATH)

    if (point) {
      const state = nearestState(Number(point[1]), Number(point[2]))

      record('points', state, request)
      respondAfter(response, delayFor(scenario, 'points'), () => {
        if (pointsFail(scenario, state)) {
          sendJson(response, 500, { error: 'Weather unavailable' })
          return
        }

        const { port } = server.address()

        sendJson(response, 200, {
          properties: {
            forecastHourly: `http://127.0.0.1:${port}/gridpoints/${state}/hourly`,
          },
        })
      })
      return
    }

    const hourly = pathname.match(HOURLY_PATH)

    if (hourly) {
      const state = hourly[1]

      record('hourly', state, request)
      respondAfter(response, delayFor(scenario, 'hourly'), () => {
        sendJson(response, 200, {
          properties: { periods: hourlyPeriods(state) },
        })
      })
      return
    }

    sendJson(response, 404, { error: 'Not found' })
  })

  return server
}

/**
 * @param {string[]} argv
 * @param {Record<string, string | undefined>} env
 */
export function resolvePort(argv = process.argv.slice(2), env = process.env) {
  const flag = argv.indexOf('--port')
  const value = flag === -1 ? (env.STUB_PORT ?? env.PORT) : argv[flag + 1]

  return value === undefined || value === '' ? 4010 : Number(value)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  createWeatherStub({ scenario: process.env.STUB_SCENARIO || 'ok' }).listen(
    resolvePort(),
    '127.0.0.1',
  )
}
