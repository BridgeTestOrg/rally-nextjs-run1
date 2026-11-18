const LOCALE = "en-US";

function partsOf(
  instant: Date,
  timeZone: string,
  options: Intl.DateTimeFormatOptions,
): (type: Intl.DateTimeFormatPartTypes) => string {
  const parts = new Intl.DateTimeFormat(LOCALE, {
    ...options,
    timeZone,
  }).formatToParts(instant);

  return (type) => parts.find((part) => part.type === type)?.value ?? "";
}

/** "6:00 pm": 12-hour, no leading zero, two-digit minutes, lowercase am/pm. */
export function time(instant: Date, timeZone: string): string {
  const part = partsOf(instant, timeZone, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  return `${part("hour")}:${part("minute")} ${part("dayPeriod").toLowerCase()}`;
}

/** "10 pm": 12-hour, hour only, lowercase am/pm. */
export function hour(instant: Date, timeZone: string): string {
  const part = partsOf(instant, timeZone, { hour: "numeric", hour12: true });

  return `${part("hour")} ${part("dayPeriod").toLowerCase()}`;
}

/** "2 Nov": day without a leading zero, then the three-letter month. */
export function date(instant: Date, timeZone: string): string {
  const part = partsOf(instant, timeZone, { day: "numeric", month: "short" });

  return `${part("day")} ${part("month")}`;
}

/** "Saturday": the full weekday name. */
export function weekday(instant: Date, timeZone: string): string {
  return partsOf(instant, timeZone, { weekday: "long" })("weekday");
}
