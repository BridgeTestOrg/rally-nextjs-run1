export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const

export type Weekday = (typeof WEEKDAYS)[number]

export type LocalParts = {
  /** The local calendar date, `YYYY-MM-DD`. */
  date: string
  weekday: Weekday
  /** Minutes since local midnight. */
  minutes: number
  /** Seconds past the local minute. */
  seconds: number
}

const MS_PER_SECOND = 1000
const MS_PER_MINUTE = 60 * MS_PER_SECOND
// Wider than any UTC offset, so one side of a DST change is always in reach.
const TRANSITION_WINDOW_MS = 36 * 60 * MS_PER_MINUTE

const LOCAL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/
const LOCAL_TIME = /^(\d{2}):(\d{2})$/

const formatters = new Map<string, Intl.DateTimeFormat>()

function formatterFor(tz: string): Intl.DateTimeFormat {
  let formatter = formatters.get(tz)

  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      weekday: 'short',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    formatters.set(tz, formatter)
  }

  return formatter
}

function wallClock(instant: Date, tz: string) {
  const fields = new Map(
    formatterFor(tz)
      .formatToParts(instant)
      .map((part) => [part.type, part.value]),
  )
  const field = (type: Intl.DateTimeFormatPartTypes) => fields.get(type) ?? ''

  return {
    year: Number(field('year')),
    month: Number(field('month')),
    day: Number(field('day')),
    hour: Number(field('hour')),
    minute: Number(field('minute')),
    second: Number(field('second')),
    weekday: field('weekday').toLowerCase() as Weekday,
  }
}

/** The local wall clock at `epochMs`, written as if it were a UTC time. */
function wallClockMs(epochMs: number, tz: string): number {
  const wall = wallClock(new Date(epochMs), tz)

  return Date.UTC(
    wall.year,
    wall.month - 1,
    wall.day,
    wall.hour,
    wall.minute,
    wall.second,
  )
}

function wholeSecond(epochMs: number): number {
  return Math.floor(epochMs / MS_PER_SECOND) * MS_PER_SECOND
}

function offsetMs(epochMs: number, tz: string): number {
  const instant = wholeSecond(epochMs)

  return wallClockMs(instant, tz) - instant
}

function parseLocalDate(localDate: string): [number, number, number] {
  const match = LOCAL_DATE.exec(localDate)

  if (!match) {
    throw new Error(`Expected a YYYY-MM-DD date, got "${localDate}".`)
  }

  return [Number(match[1]), Number(match[2]), Number(match[3])]
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

/** The calendar date, weekday and time of day at `instant` in `tz`. */
export function localParts(instant: Date, tz: string): LocalParts {
  const wall = wallClock(instant, tz)

  return {
    date: `${wall.year}-${pad(wall.month)}-${pad(wall.day)}`,
    weekday: wall.weekday,
    minutes: wall.hour * 60 + wall.minute,
    seconds: wall.second,
  }
}

/** Moves a `YYYY-MM-DD` date by whole calendar days. */
export function addLocalDays(localDate: string, n: number): string {
  const [year, month, day] = parseLocalDate(localDate)

  return new Date(Date.UTC(year, month - 1, day + n)).toISOString().slice(0, 10)
}

/**
 * The instant a local date and `HH:MM` time happen in `tz`.
 *
 * Daylight saving changes make some local times ambiguous or missing:
 * - A repeated time resolves to its earlier occurrence, so Denver's
 *   `2026-11-01 01:30` is the one at `-06:00`.
 * - A skipped time moves forward to the first time after the gap, so Denver's
 *   `2026-03-08 02:30` becomes 03:00 at `-06:00`.
 */
export function zonedInstant(localDate: string, hhmm: string, tz: string): Date {
  const [year, month, day] = parseLocalDate(localDate)
  const time = LOCAL_TIME.exec(hhmm)

  if (!time) {
    throw new Error(`Expected an HH:MM time, got "${hhmm}".`)
  }

  const wall = Date.UTC(year, month - 1, day, Number(time[1]), Number(time[2]))

  let guess = wall
  for (let pass = 0; pass < 2; pass += 1) {
    guess = wall - offsetMs(guess, tz)
  }

  const before = offsetMs(wall - TRANSITION_WINDOW_MS, tz)
  const after = offsetMs(wall + TRANSITION_WINDOW_MS, tz)
  const exact = [offsetMs(guess, tz), before, after]
    .map((offset) => wall - offset)
    .filter((candidate) => wallClockMs(candidate, tz) === wall)

  if (exact.length > 0) {
    return new Date(Math.min(...exact))
  }

  // No instant shows this wall time, so it is inside a spring-forward gap. The
  // first valid time is the moment the offset changes.
  let low = wall - TRANSITION_WINDOW_MS
  let high = wall + TRANSITION_WINDOW_MS

  while (high - low > MS_PER_SECOND) {
    const middle = wholeSecond(low + (high - low) / 2)

    if (offsetMs(middle, tz) === before) {
      low = middle
    } else {
      high = middle
    }
  }

  return new Date(high)
}

/** Formats `instant` like `2026-11-17T18:00:00-07:00`, never with `Z`. */
export function isoWithOffset(instant: Date, tz: string): string {
  const wall = wallClock(instant, tz)
  const offsetMinutes = Math.trunc(offsetMs(instant.getTime(), tz) / MS_PER_MINUTE)
  const sign = offsetMinutes < 0 ? '-' : '+'
  const absolute = Math.abs(offsetMinutes)

  return (
    `${wall.year}-${pad(wall.month)}-${pad(wall.day)}` +
    `T${pad(wall.hour)}:${pad(wall.minute)}:${pad(wall.second)}` +
    `${sign}${pad(Math.floor(absolute / 60))}:${pad(absolute % 60)}`
  )
}
