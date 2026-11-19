import { Badge } from "@/app/_components/Badge";
import type { ConditionsEntry } from "@/lib/conditions";
import { content, fill } from "@/lib/content";
import { time } from "@/lib/format";
import type { Verdict } from "@/lib/verdict";
import { nextOpenText } from "./stamp";

const VERDICT_LABEL_KEY = {
  playable: "playable",
  breezy: "breezy",
  not_today: "notToday",
} as const satisfies Record<Verdict, keyof typeof content.live.verdicts>;

/** The producer sets every weather field when `available` is true. */
function requireWeather(entry: ConditionsEntry) {
  const { tempF, windMph, rainPct, verdict } = entry;

  if (
    tempF === null ||
    windMph === null ||
    rainPct === null ||
    verdict === null
  ) {
    throw new Error(`Conditions for ${entry.state} are available but empty.`);
  }

  return { tempF, windMph, rainPct, verdict };
}

function Weather({ entry, instant }: { entry: ConditionsEntry; instant: Date }) {
  const { labels, units, verdicts } = content.live;
  const { tempF, windMph, rainPct, verdict } = requireWeather(entry);
  const stats = [
    { label: labels.temp, value: fill(units.temp, { value: tempF }) },
    { label: labels.wind, value: fill(units.wind, { value: windMph }) },
    { label: labels.rain, value: fill(units.rain, { value: rainPct }) },
  ];

  return (
    <>
      <div className="rally-live__verdict">
        <Badge variant={verdict}>{verdicts[VERDICT_LABEL_KEY[verdict]]}</Badge>
      </div>
      <div className="rally-live__divider" />
      <dl className="rally-live__stats">
        {stats.map(({ label, value }) => (
          <div key={label} className="rally-live__stat">
            <dt className="rally-live__stat-label">{label}</dt>
            <dd className="rally-live__stat-value">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="rally-live__next-open">
        {nextOpenText(entry.nextOpen, entry.timeZone, instant)}
      </p>
    </>
  );
}

export function LiveCard({
  entry,
  instant,
}: {
  entry: ConditionsEntry;
  instant: Date;
}) {
  const { live } = content;
  const headingId = `live-city-${entry.state}`;
  const weatherFailed = !entry.available && entry.nextOpen !== null;
  const boxClass = weatherFailed
    ? "rally-live__card-box rally-live__card-box--down"
    : "rally-live__card-box";

  return (
    <article aria-labelledby={headingId} className={boxClass}>
      <h3 id={headingId} className="rally-live__city">
        {entry.city}, {entry.state}
      </h3>
      <p className="rally-live__local-time">
        {fill(live.localTime, { time: time(instant, entry.timeZone) })}
      </p>
      {entry.available ? <Weather entry={entry} instant={instant} /> : null}
      {weatherFailed ? (
        <>
          <div className="rally-live__divider" />
          <div className="rally-live__unavailable">
            <p className="rally-live__unavailable-title">
              {fill(live.cityUnavailable, { city: entry.city })}
            </p>
            <p>{live.cityUnavailableNote}</p>
          </div>
        </>
      ) : null}
      {!entry.available && entry.nextOpen === null ? (
        <p className="rally-live__next-open">{live.noOpenSlot}</p>
      ) : null}
    </article>
  );
}
