import 'server-only'

import { getCourts } from '@/lib/courts'
import { nextOpenForCity, type Court, type NextOpen } from '@/lib/schedule'
import { verdict, type Verdict } from '@/lib/verdict'
import {
  CITY_BUDGET_MS,
  getForecast,
  isWeatherFailure,
  readWeatherSettings,
  weatherFailure,
} from '@/lib/weather'
import { isoWithOffset } from '@/lib/zoned'

export type ConditionsEntry = {
  city: string
  state: Court['state']
  available: boolean
  nextOpen: NextOpen | null
  tempF: number | null
  windMph: number | null
  rainPct: number | null
  verdict: Verdict | null
  updatedAt: string | null
  timeZone: string
  checkedAt: string
}

const STATE_ORDER: readonly Court['state'][] = ['CO', 'CA', 'NJ']

function reportUnexpected(state: string, error: unknown): void {
  if (!isWeatherFailure(error)) {
    console.error(`Conditions failed unexpectedly for ${state}.`, error)
  }
}

/**
 * Runs `work` under one city's deadline, and stops waiting when it passes even
 * if `work` ignores the signal. Work that fails after that is still observed.
 */
function withDeadline<T>(
  state: string,
  work: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const signal = AbortSignal.timeout(CITY_BUDGET_MS)

  return new Promise<T>((resolve, reject) => {
    let expired = false
    const onDeadline = () => {
      expired = true
      reject(weatherFailure('The weather budget ran out.', signal.reason))
    }

    signal.addEventListener('abort', onDeadline, { once: true })
    work(signal)
      .then(resolve, (error: unknown) => {
        if (expired) {
          reportUnexpected(state, error)
        } else {
          reject(error)
        }
      })
      .finally(() => signal.removeEventListener('abort', onDeadline))
  })
}

async function cityConditions(
  courts: Court[],
  instant: Date,
): Promise<ConditionsEntry> {
  const [{ city, state, timezone: timeZone }] = courts
  const entry: ConditionsEntry = {
    city,
    state,
    available: false,
    nextOpen: null,
    tempF: null,
    windMph: null,
    rainPct: null,
    verdict: null,
    updatedAt: null,
    timeZone,
    checkedAt: isoWithOffset(instant, timeZone),
  }

  try {
    const nextOpen = nextOpenForCity(courts, instant)

    if (!nextOpen) {
      return entry
    }

    entry.nextOpen = nextOpen

    const court = courts.find(({ id }) => id === nextOpen.courtId)

    if (!court) {
      throw new Error(`Next open court "${nextOpen.courtId}" is not in ${state}.`)
    }

    const settings = readWeatherSettings()
    const forecast = await withDeadline(state, (signal) =>
      getForecast(
        { cityKey: state, lat: court.lat, lon: court.lon, settings },
        instant,
        signal,
      ),
    )
    const slotStart = Date.parse(nextOpen.time)
    const period = forecast.periods.find(
      ({ start, end }) =>
        Date.parse(start) <= slotStart && slotStart < Date.parse(end),
    )

    if (!period) {
      return entry
    }

    const { tempF, windMph, rainPct } = period

    return {
      ...entry,
      available: true,
      tempF,
      windMph,
      rainPct,
      verdict: verdict({ tempF, windMph, rainPct }),
      updatedAt: isoWithOffset(new Date(forecast.fetchedAt), timeZone),
    }
  } catch (error) {
    reportUnexpected(state, error)

    return entry
  }
}

/**
 * Conditions for the three cities in CO, CA, NJ order, fetched at the same
 * time. Never rejects: a city that fails comes back with `available: false`.
 */
export function getConditions(instant: Date): Promise<ConditionsEntry[]> {
  const courts = getCourts()

  return Promise.all(
    STATE_ORDER.map((state) =>
      cityConditions(
        courts.filter((court) => court.state === state),
        instant,
      ),
    ),
  )
}
