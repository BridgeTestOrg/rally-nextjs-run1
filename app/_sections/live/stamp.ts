import { content, fill } from "@/lib/content";
import { time, weekday } from "@/lib/format";
import type { ConditionsEntry } from "@/lib/conditions";

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;

/**
 * The instant's calendar date in `timeZone`, as a whole day count. UTC only
 * encodes the extracted year, month and day here, so subtracting two results
 * counts calendar days whatever the offset or a DST change does.
 */
function localDay(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((candidate) => candidate.type === type)?.value);

  return Date.UTC(part("year"), part("month") - 1, part("day")) / DAY_MS;
}

/** Whole minutes from `timestampMs` to `instant`, never below zero. */
function ageInMinutes(timestampMs: number, instant: Date): number {
  return Math.max(0, Math.floor((instant.getTime() - timestampMs) / MINUTE_MS));
}

/** The next-open line, worded by the slot's calendar day in the city's zone. */
export function nextOpenText(
  nextOpen: ConditionsEntry["nextOpen"],
  timeZone: string,
  instant: Date,
): string {
  const { live } = content;

  if (nextOpen === null) {
    return live.noOpenSlot;
  }

  const slot = new Date(nextOpen.time);
  const court = nextOpen.courtName;
  const slotTime = time(slot, timeZone);
  const daysAway = localDay(slot, timeZone) - localDay(instant, timeZone);

  if (daysAway === 0) {
    return fill(live.nextOpen, { court, time: slotTime });
  }

  if (daysAway === 1) {
    return fill(live.nextOpenTomorrow, { court, time: slotTime });
  }

  return fill(live.nextOpenLater, {
    court,
    weekday: weekday(slot, timeZone),
    time: slotTime,
  });
}

/** The "last checked" stamp for a check made at `checkedAt`. */
export function lastCheckedText(checkedAt: Date, instant: Date): string {
  return fill(content.live.stampDown, {
    minutes: ageInMinutes(checkedAt.getTime(), instant),
  });
}

/**
 * The freshness stamp for a nonempty conditions result. With any weather, it
 * reports the oldest update on screen. With none, the newest check.
 */
export function stampText(
  entries: readonly ConditionsEntry[],
  instant: Date,
): string {
  const { live } = content;
  const updates = entries.flatMap(({ available, updatedAt }) =>
    available && updatedAt !== null ? [Date.parse(updatedAt)] : [],
  );

  if (updates.length === 0) {
    const newestCheck = Math.max(
      ...entries.map(({ checkedAt }) => Date.parse(checkedAt)),
    );

    return lastCheckedText(new Date(newestCheck), instant);
  }

  const minutes = ageInMinutes(Math.min(...updates), instant);

  return minutes === 0 ? live.stampJustNow : fill(live.stamp, { minutes });
}

/**
 * True when every city lost its weather. A city with no open slot has no
 * weather to lose, so it keeps the grid and its own message.
 */
export function allWeatherFailed(entries: readonly ConditionsEntry[]): boolean {
  return entries.every(
    ({ available, nextOpen }) => !available && nextOpen !== null,
  );
}
