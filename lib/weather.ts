import 'server-only'

import { cacheLife } from 'next/cache'
import { now } from '@/lib/clock'

export type ForecastPeriod = {
  start: string
  end: string
  tempF: number
  windMph: number
  rainPct: number
}

export type Forecast = { periods: ForecastPeriod[]; fetchedAt: string }

export type WeatherSettings = { weatherUrl: string; clockKey: string }

export type ForecastRequest = {
  cityKey: string
  lat: number
  lon: number
  settings: WeatherSettings
}

const DEFAULT_WEATHER_URL = 'https://api.weather.gov'
const REQUEST_HEADERS = {
  'User-Agent': 'Rally test app (hello@example.com)',
  Accept: 'application/geo+json',
}
const MAX_AGE_MS = 10 * 60 * 1000

/** The time one city gets for its weather, across both requests. */
export const CITY_BUDGET_MS = 3000

// React replaces a thrown error's message and fields when it crosses a
// "use cache" boundary in production, but it keeps `digest`. That makes the
// digest the one marker still readable on the caller's side.
const WEATHER_FAILURE_DIGEST = 'RALLY_WEATHER_FAILURE'

/** An expected weather failure: the service, not this code, went wrong. */
class WeatherFailure extends Error {
  readonly digest = WEATHER_FAILURE_DIGEST

  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'WeatherFailure'
  }
}

export function weatherFailure(message: string, cause?: unknown): Error {
  return new WeatherFailure(message, { cause })
}

export function isWeatherFailure(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { digest?: unknown }).digest === WEATHER_FAILURE_DIGEST
  )
}

// A bad setting is a deployment mistake rather than a weather outage, so it is
// a plain Error that gets reported. The value is left out in case it holds a
// password.
function parseWeatherBase(weatherUrl: string): URL {
  let base: URL

  try {
    base = new URL(weatherUrl)
  } catch (cause) {
    throw new Error('WEATHER_URL is not a valid URL.', { cause })
  }

  if (base.protocol !== 'http:' && base.protocol !== 'https:') {
    throw new Error('WEATHER_URL must use http or https.')
  }

  if (base.username || base.password) {
    throw new Error('WEATHER_URL must not contain credentials.')
  }

  return base
}

/** Reads the weather settings. Call this outside any cached function. */
export function readWeatherSettings(): WeatherSettings {
  const weatherUrl = process.env.WEATHER_URL ?? DEFAULT_WEATHER_URL

  parseWeatherBase(weatherUrl)

  return { weatherUrl, clockKey: process.env.RALLY_NOW ?? 'live' }
}

function pointsUrl(base: URL, lat: number, lon: number): string {
  const prefix = base.pathname.replace(/\/+$/, '')

  return `${base.origin}${prefix}/points/${lat.toFixed(4)},${lon.toFixed(4)}`
}

function authorizedHourlyUrl(value: unknown, base: URL): string {
  if (typeof value !== 'string') {
    throw weatherFailure('The points response has no forecastHourly URL.')
  }

  let url: URL

  try {
    url = new URL(value)
  } catch (cause) {
    throw weatherFailure('The forecastHourly URL is not valid.', cause)
  }

  if (url.username || url.password) {
    throw weatherFailure('The forecastHourly URL contains credentials.')
  }

  if (url.origin !== base.origin) {
    throw weatherFailure('The forecastHourly URL is on another origin.')
  }

  return url.href
}

async function getJson(
  url: string,
  label: string,
  signal: AbortSignal,
): Promise<unknown> {
  let response: Response

  try {
    response = await fetch(url, {
      headers: REQUEST_HEADERS,
      redirect: 'error',
      cache: 'no-store',
      signal,
    })
  } catch (cause) {
    throw weatherFailure(`The ${label} request failed.`, cause)
  }

  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined)
    throw weatherFailure(`The ${label} request returned ${response.status}.`)
  }

  try {
    return await response.json()
  } catch (cause) {
    throw weatherFailure(`The ${label} response could not be read.`, cause)
  }
}

function properties(body: unknown): Record<string, unknown> {
  const value = (body as { properties?: unknown } | null)?.properties

  if (typeof value !== 'object' || value === null) {
    throw weatherFailure('The response has no properties object.')
  }

  return value as Record<string, unknown>
}

function parseWind(value: unknown): number {
  const numbers = typeof value === 'string' ? value.match(/\d+/g) : null

  if (!numbers) {
    throw weatherFailure('A forecast period has no usable windSpeed.')
  }

  return Math.max(...numbers.map(Number))
}

function parseRain(value: unknown): number {
  if (typeof value !== 'object' || value === null || !('value' in value)) {
    throw weatherFailure('A forecast period has no rain probability.')
  }

  const rain = value.value

  if (rain === null) {
    return 0
  }

  if (typeof rain !== 'number' || !Number.isFinite(rain)) {
    throw weatherFailure('A forecast period has an invalid rain probability.')
  }

  return rain
}

function parsePeriod(value: unknown): ForecastPeriod {
  if (typeof value !== 'object' || value === null) {
    throw weatherFailure('A forecast period is not an object.')
  }

  const period = value as Record<string, unknown>
  const { startTime, endTime, temperature, temperatureUnit } = period

  if (
    typeof startTime !== 'string' ||
    typeof endTime !== 'string' ||
    !(Date.parse(startTime) < Date.parse(endTime))
  ) {
    throw weatherFailure('A forecast period has invalid start or end times.')
  }

  if (typeof temperature !== 'number' || !Number.isFinite(temperature)) {
    throw weatherFailure('A forecast period has an invalid temperature.')
  }

  if (temperatureUnit !== 'F') {
    throw weatherFailure('A forecast period is not in Fahrenheit.')
  }

  return {
    start: startTime,
    end: endTime,
    tempF: temperature,
    windMph: parseWind(period.windSpeed),
    rainPct: parseRain(period.probabilityOfPrecipitation),
  }
}

/**
 * Fetches and normalizes the hourly forecast for a point. `signal` covers both
 * requests, and the second may only go to the origin of `weatherUrl`. Throws on
 * any failure rather than returning a partial forecast.
 */
export async function fetchForecast(
  lat: number,
  lon: number,
  weatherUrl: string,
  signal: AbortSignal,
): Promise<ForecastPeriod[]> {
  const base = parseWeatherBase(weatherUrl)
  const points = await getJson(pointsUrl(base, lat, lon), 'points', signal)
  const hourlyUrl = authorizedHourlyUrl(
    properties(points).forecastHourly,
    base,
  )

  if (signal.aborted) {
    throw weatherFailure('The weather budget ran out.', signal.reason)
  }

  const hourly = await getJson(hourlyUrl, 'hourly forecast', signal)
  const periods = properties(hourly).periods

  if (!Array.isArray(periods) || periods.length === 0) {
    throw weatherFailure('The hourly forecast has no periods.')
  }

  return periods.map(parsePeriod)
}

/** Whether a forecast stamp is at most ten minutes old and not in the future. */
export function isFresh(fetchedAt: string, instant: Date): boolean {
  const age = instant.getTime() - Date.parse(fetchedAt)

  return age >= 0 && age <= MAX_AGE_MS
}

/**
 * Only successes reach the cache: a failure throws, so the next request tries
 * again. `cityKey` and `clockKey` have no use in the body, but as arguments they
 * are part of the cache key.
 */
async function getCachedForecast(
  cityKey: string,
  lat: number,
  lon: number,
  weatherUrl: string,
  clockKey: string,
): Promise<Forecast> {
  'use cache'
  cacheLife({ stale: 60, revalidate: 300, expire: 600 })
  void cityKey
  void clockKey

  const periods = await fetchForecast(
    lat,
    lon,
    weatherUrl,
    AbortSignal.timeout(CITY_BUDGET_MS),
  )

  return { periods, fetchedAt: now().toISOString() }
}

// A forecast fetched for this very request is stamped just after `instant`, so
// a stamp inside the attempt's budget counts as current rather than future.
function isUsable(fetchedAt: string, instant: Date): boolean {
  const reference =
    Date.parse(fetchedAt) > instant.getTime()
      ? new Date(instant.getTime() + CITY_BUDGET_MS)
      : instant

  return isFresh(fetchedAt, reference)
}

/** A forecast no older than ten minutes at `instant`. */
export async function getForecast(
  { cityKey, lat, lon, settings }: ForecastRequest,
  instant: Date,
  signal: AbortSignal,
): Promise<Forecast> {
  const { weatherUrl, clockKey } = settings
  const cached = await getCachedForecast(
    cityKey,
    lat,
    lon,
    weatherUrl,
    clockKey,
  )

  if (isUsable(cached.fetchedAt, instant)) {
    return cached
  }

  if (signal.aborted) {
    throw weatherFailure('The weather budget ran out.', signal.reason)
  }

  const periods = await fetchForecast(lat, lon, weatherUrl, signal)

  return { periods, fetchedAt: now().toISOString() }
}
