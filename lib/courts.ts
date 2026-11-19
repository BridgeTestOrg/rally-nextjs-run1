import 'server-only'

import courtsFile from '@/data/courts.json'
import { inTimeBucket, type Filters } from '@/lib/filters'
import {
  openNow,
  OPENING_HOURS,
  slotsFor,
  status,
  type Court,
  type Day,
  type Slot,
} from '@/lib/schedule'
import { addLocalDays, WEEKDAYS } from '@/lib/zoned'

export type CourtRow = {
  id: string
  name: string
  city: string
  state: Court['state']
  timeZone: string
  courts: number
  lights: boolean
  parking: boolean
  closed: boolean
  statusText: string
  closedReason: string | null
  slots: Slot[]
}

export type CourtsApiEntry = {
  id: string
  name: string
  city: string
  state: Court['state']
  timezone: string
  courts: number
  lights: boolean
  parking: boolean
  openNow: boolean
  status: string
  closedReason: string | null
  slots: Record<Day, string[]>
}

const STATES: readonly string[] = ['CO', 'CA', 'NJ']
const HHMM = /^(?:[01]\d|2[0-3]):[0-5]\d$/
const LOCAL_DATE = /^\d{4}-\d{2}-\d{2}$/
const API_DAYS: readonly Day[] = ['today', 'tomorrow', 'sat']

function invalid(path: string, expected: string): Error {
  return new Error(`data/courts.json: ${path} must be ${expected}.`)
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw invalid(path, 'an object')
  }

  return value as Record<string, unknown>
}

function list(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) {
    throw invalid(path, 'an array')
  }

  return value
}

function text(value: unknown, path: string): string {
  if (typeof value !== 'string' || value === '') {
    throw invalid(path, 'a non-empty string')
  }

  return value
}

function flag(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') {
    throw invalid(path, 'a boolean')
  }

  return value
}

function coordinate(value: unknown, path: string, limit: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw invalid(path, 'a finite number')
  }

  if (Math.abs(value) > limit) {
    throw invalid(path, `between -${limit} and ${limit}`)
  }

  return value
}

function time(value: unknown, path: string): string {
  if (typeof value !== 'string' || !HHMM.test(value)) {
    throw invalid(path, 'an HH:MM time')
  }

  return value
}

function timeZone(value: unknown, path: string): string {
  const zone = text(value, path)

  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone })
  } catch (cause) {
    throw new Error(`data/courts.json: ${path} must be an IANA time zone.`, {
      cause,
    })
  }

  return zone
}

function localDate(value: unknown, path: string): string {
  if (
    typeof value !== 'string' ||
    !LOCAL_DATE.test(value) ||
    Number.isNaN(Date.parse(`${value}T00:00:00Z`)) ||
    addLocalDays(value, 0) !== value
  ) {
    throw invalid(path, 'a real YYYY-MM-DD date')
  }

  return value
}

function parseCourt(value: unknown, path: string): Court {
  const court = record(value, path)
  const state = text(court.state, `${path}.state`)

  if (!STATES.includes(state)) {
    throw invalid(`${path}.state`, `one of ${STATES.join(', ')}`)
  }

  const count = court.courts

  if (typeof count !== 'number' || !Number.isInteger(count) || count <= 0) {
    throw invalid(`${path}.courts`, 'a positive integer')
  }

  const slots = record(court.slots, `${path}.slots`)

  return {
    id: text(court.id, `${path}.id`),
    name: text(court.name, `${path}.name`),
    city: text(court.city, `${path}.city`),
    state: state as Court['state'],
    timezone: timeZone(court.timezone, `${path}.timezone`),
    lat: coordinate(court.lat, `${path}.lat`, 90),
    lon: coordinate(court.lon, `${path}.lon`, 180),
    courts: count,
    lights: flag(court.lights, `${path}.lights`),
    parking: flag(court.parking, `${path}.parking`),
    slots: Object.fromEntries(
      WEEKDAYS.map((day) => [
        day,
        list(slots[day], `${path}.slots.${day}`).map((slot, index) =>
          time(slot, `${path}.slots.${day}[${index}]`),
        ),
      ]),
    ) as Court['slots'],
    closures: list(court.closures, `${path}.closures`).map((entry, index) => {
      const closurePath = `${path}.closures[${index}]`
      const closure = record(entry, closurePath)

      return {
        date: localDate(closure.date, `${closurePath}.date`),
        reason: text(closure.reason, `${closurePath}.reason`),
      }
    }),
  }
}

function parseHours(value: unknown, key: keyof typeof OPENING_HOURS) {
  const path = `openingHours.${key}`
  const block = record(value, path)
  const expected = OPENING_HOURS[key]
  const open = time(block.open, `${path}.open`)
  const close = time(block.close, `${path}.close`)

  if (open !== expected.open) {
    throw invalid(`${path}.open`, `"${expected.open}" to match lib/schedule.ts`)
  }

  if (close !== expected.close) {
    throw invalid(
      `${path}.close`,
      `"${expected.close}" to match lib/schedule.ts`,
    )
  }

  return { open, close }
}

function parseCourtsFile(value: unknown) {
  const root = record(value, 'root')
  const block = record(root.openingHours, 'openingHours')
  const courts = list(root.courts, 'courts').map((court, index) =>
    parseCourt(court, `courts[${index}]`),
  )

  if (courts.length === 0) {
    throw invalid('courts', 'a non-empty array')
  }

  const seen = new Set<string>()

  courts.forEach((court, index) => {
    if (seen.has(court.id)) {
      throw invalid(`courts[${index}].id`, `unique, "${court.id}" is repeated`)
    }

    seen.add(court.id)
  })

  return {
    courts,
    openingHours: {
      withLights: parseHours(block.withLights, 'withLights'),
      withoutLights: parseHours(block.withoutLights, 'withoutLights'),
    },
  }
}

// Throws on import, so a malformed data file fails loudly and only once.
const parsed = parseCourtsFile(courtsFile)

export const openingHours = parsed.openingHours

/** Every court in file order, as a copy the caller may change. */
export function getCourts(): Court[] {
  return structuredClone(parsed.courts)
}

function matchingCourts(filters: Filters): Court[] {
  return parsed.courts.filter(
    (court) =>
      (filters.state === 'all' || court.state === filters.state) &&
      (!filters.lights || court.lights) &&
      (!filters.parking || court.parking),
  )
}

/**
 * The finder's rows: closed courts stay with no slots, and open courts with no
 * matching slot are dropped. `count` is the number of rows that are not closed.
 */
export function queryCourts(
  filters: Filters,
  instant: Date,
): { rows: CourtRow[]; count: number } {
  const rows: CourtRow[] = []

  for (const court of matchingCourts(filters)) {
    const { closed, statusText, closedReason } = status(
      court,
      filters.day,
      instant,
    )
    const slots = closed
      ? []
      : slotsFor(court, filters.day, instant).filter((slot) =>
          inTimeBucket(slot.hhmm, filters.time),
        )

    if (closed || slots.length > 0) {
      rows.push({
        id: court.id,
        name: court.name,
        city: court.city,
        state: court.state,
        timeZone: court.timezone,
        courts: court.courts,
        lights: court.lights,
        parking: court.parking,
        closed,
        statusText,
        closedReason,
        slots,
      })
    }
  }

  return { rows, count: rows.filter((row) => !row.closed).length }
}

function apiSlots(
  court: Court,
  day: Day,
  filters: Filters,
  instant: Date,
): string[] {
  if (status(court, day, instant).closed) {
    return []
  }

  return slotsFor(court, day, instant)
    .map((slot) => slot.hhmm)
    .filter((hhmm) => inTimeBucket(hhmm, filters.time))
}

/**
 * The `/api/courts` body: one entry per court matching state, lights and
 * parking. Unlike the finder it never drops a court, and `filters.day` has no
 * effect because every day's slots are returned.
 */
export function courtsApi(filters: Filters, instant: Date): CourtsApiEntry[] {
  return matchingCourts(filters).map((court) => {
    const today = status(court, 'today', instant)

    return {
      id: court.id,
      name: court.name,
      city: court.city,
      state: court.state,
      timezone: court.timezone,
      courts: court.courts,
      lights: court.lights,
      parking: court.parking,
      openNow: openNow(court, instant),
      status: today.statusText,
      closedReason: today.closedReason,
      slots: Object.fromEntries(
        API_DAYS.map((day) => [day, apiSlots(court, day, filters, instant)]),
      ) as Record<Day, string[]>,
    }
  })
}
