import { createServer } from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const COORDINATES = String.raw`(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)`
const POINTS_PATH = new RegExp(`^/points/${COORDINATES}$`)
const FORECAST_PATH = new RegExp(`^/forecast/${COORDINATES}/hourly$`)

// Starts and ends in UTC so 17 to 25 Nov is covered in every launch city's zone.
const FIRST_HOUR = Date.UTC(2026, 10, 17, 0)
const LAST_HOUR = Date.UTC(2026, 10, 26, 12)
const HOUR_MS = 60 * 60 * 1000

export function hourlyPeriods() {
  const periods = []

  for (let start = FIRST_HOUR; start < LAST_HOUR; start += HOUR_MS) {
    periods.push({
      startTime: new Date(start).toISOString(),
      endTime: new Date(start + HOUR_MS).toISOString(),
      temperature: 60,
      windSpeed: '5 mph',
      probabilityOfPrecipitation: { value: 10 },
    })
  }

  return periods
}

function sendJson(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json' })
  response.end(JSON.stringify(body))
}

export function createWeatherStub() {
  const server = createServer((request, response) => {
    const { pathname } = new URL(request.url, 'http://127.0.0.1')

    if (request.method === 'GET' && pathname === '/healthz') {
      sendJson(response, 200, { status: 'ok' })
      return
    }

    const point = request.method === 'GET' && pathname.match(POINTS_PATH)

    if (point) {
      const { port } = server.address()
      const forecastHourly = `http://127.0.0.1:${port}/forecast/${point[1]},${point[2]}/hourly`
      sendJson(response, 200, { properties: { forecastHourly } })
      return
    }

    if (request.method === 'GET' && FORECAST_PATH.test(pathname)) {
      sendJson(response, 200, { properties: { periods: hourlyPeriods() } })
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
  const value = flag === -1 ? env.PORT : argv[flag + 1]

  return value === undefined || value === '' ? 4010 : Number(value)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  createWeatherStub().listen(resolvePort(), '127.0.0.1')
}
