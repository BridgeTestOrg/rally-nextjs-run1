import { content, fill } from '@/lib/content'
import type { Filters } from '@/lib/filters'
import { hour, weekday } from '@/lib/format'
import {
  addLocalDays,
  isoWithOffset,
  localParts,
  WEEKDAYS,
  zonedInstant,
  type Weekday,
} from '@/lib/zoned'

export type Court = {
  id: string
  name: string
  city: string
  state: 'CO' | 'CA' | 'NJ'
  timezone: string
  lat: number
  lon: number
  courts: number
  lights: boolean
  parking: boolean
  slots: Record<Weekday, string[]>
  closures: { date: string; reason: string }[]
}

export type Day = Filters['day']

export type Slot = { hhmm: string; at: string }

export type CourtStatus = {
  closed: boolean
  statusText: string
  closedReason: string | null
}

export type NextOpen = { courtId: string; courtName: string; time: string }

export const OPENING_HOURS = {
  withLights: { open: '07:00', close: '22:00' },
  withoutLights: { open: '07:00', close: '19:00' },
} as const

const DAYS_AHEAD = 7
const SATURDAY = WEEKDAYS.indexOf('sat')
const NEXT_DAY_OFFSET: Record<Exclude<Day, 'sat'>, number> = {
  today: 0,
  tomorrow: 1,
}

function minutesOf(hhmm: string): number {
  return Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))
}

function wholeSeconds(instant: Date): number {
  return Math.floor(instant.getTime() / 1000)
}

function weekdayOf(localDate: string): Weekday {
  // getUTCDay counts from Sunday, WEEKDAYS from Monday.
  const day = new Date(`${localDate}T00:00:00Z`).getUTCDay()

  return WEEKDAYS[(day + 6) % 7]
}

function slotInstants(court: Court, localDate: string) {
  return court.slots[weekdayOf(localDate)].map((hhmm) => ({
    hhmm,
    instant: zonedInstant(localDate, hhmm, court.timezone),
  }))
}

export function hours(court: Court) {
  return court.lights ? OPENING_HOURS.withLights : OPENING_HOURS.withoutLights
}

export function closureOn(court: Court, localDate: string) {
  return court.closures.find((closure) => closure.date === localDate)
}

/** The court's local date for a finder day. Saturday can be today. */
export function targetDate(day: Day, court: Court, instant: Date): string {
  const today = localParts(instant, court.timezone)

  if (day === 'sat') {
    const daysToSaturday =
      (SATURDAY - WEEKDAYS.indexOf(today.weekday) + WEEKDAYS.length) %
      WEEKDAYS.length

    return addLocalDays(today.date, daysToSaturday)
  }

  return addLocalDays(today.date, NEXT_DAY_OFFSET[day])
}

/** The day's slots. On the court's local today, only those still to start. */
export function slotsFor(court: Court, day: Day, instant: Date): Slot[] {
  const target = targetDate(day, court, instant)

  if (closureOn(court, target)) {
    return []
  }

  const isToday = target === localParts(instant, court.timezone).date

  return slotInstants(court, target)
    .filter(
      (slot) =>
        !isToday || wholeSeconds(slot.instant) > wholeSeconds(instant),
    )
    .map((slot) => ({
      hhmm: slot.hhmm,
      at: isoWithOffset(slot.instant, court.timezone),
    }))
}

export function openNow(court: Court, instant: Date): boolean {
  const { date, minutes } = localParts(instant, court.timezone)
  const { open, close } = hours(court)

  return (
    !closureOn(court, date) &&
    minutes >= minutesOf(open) &&
    minutes < minutesOf(close)
  )
}

/**
 * The status line for a finder day.
 *
 * Before opening today the text says closed, but `closed` stays false so the
 * day's remaining slots are still listed.
 */
export function status(court: Court, day: Day, instant: Date): CourtStatus {
  const { finder } = content
  const tz = court.timezone
  const target = targetDate(day, court, instant)
  const closure = closureOn(court, target)

  if (closure) {
    const dayName = weekday(zonedInstant(target, '12:00', tz), tz)

    return {
      closed: true,
      statusText: fill(finder.statusClosure, {
        dayName,
        reason: closure.reason,
      }),
      closedReason: closure.reason,
    }
  }

  const today = localParts(instant, tz)

  if (target !== today.date) {
    return {
      closed: false,
      statusText: court.lights
        ? finder.statusHoursWithLights
        : finder.statusHoursWithoutLights,
      closedReason: null,
    }
  }

  const { open, close } = hours(court)

  if (today.minutes >= minutesOf(close)) {
    return {
      closed: true,
      statusText: finder.statusClosedNow,
      closedReason: null,
    }
  }

  if (today.minutes >= minutesOf(open)) {
    return {
      closed: false,
      statusText: fill(finder.statusOpenUntil, {
        time: hour(zonedInstant(target, close, tz), tz),
      }),
      closedReason: null,
    }
  }

  return {
    closed: false,
    statusText: finder.statusClosedNow,
    closedReason: null,
  }
}

/**
 * The earliest slot after `instant` across a city's courts, looking at each
 * court's next seven local days. Ties go to the earlier court in the list.
 */
export function nextOpenForCity(
  courts: readonly Court[],
  instant: Date,
): NextOpen | null {
  let best: { court: Court; start: Date } | null = null

  for (const court of courts) {
    const today = localParts(instant, court.timezone).date

    for (let offset = 0; offset <= DAYS_AHEAD; offset += 1) {
      const localDate = addLocalDays(today, offset)

      if (closureOn(court, localDate)) {
        continue
      }

      for (const slot of slotInstants(court, localDate)) {
        const isAfterNow = wholeSeconds(slot.instant) > wholeSeconds(instant)

        if (
          isAfterNow &&
          (!best || slot.instant.getTime() < best.start.getTime())
        ) {
          best = { court, start: slot.instant }
        }
      }
    }
  }

  return (
    best && {
      courtId: best.court.id,
      courtName: best.court.name,
      time: isoWithOffset(best.start, best.court.timezone),
    }
  )
}
